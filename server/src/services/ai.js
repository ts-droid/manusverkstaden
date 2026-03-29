import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

const client = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 120000 })
  : null;

const prisma = new PrismaClient();

// In-memory cache for DB prompts (refreshed every 60s)
let promptCache = {};
let promptCacheTime = 0;
const CACHE_TTL = 60_000;

/**
 * Get a prompt by key, falling back to the provided default.
 * Reads from PromptConfig DB table with in-memory caching.
 */
async function getPrompt(key, fallback) {
  try {
    const now = Date.now();
    if (now - promptCacheTime > CACHE_TTL) {
      const all = await prisma.promptConfig.findMany();
      promptCache = Object.fromEntries(all.map(p => [p.key, p.content]));
      promptCacheTime = now;
    }
    return promptCache[key] || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Send a message to Claude API (server-side only).
 */
async function sendMessage({ model = 'claude-sonnet-4-20250514', max_tokens = 4096, system, messages }) {
  if (!client) {
    throw new Error('Anthropic API-nyckel saknas. Ställ in ANTHROPIC_API_KEY.');
  }

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens,
        system,
        messages,
      });
      return response;
    } catch (err) {
      const status = err?.status || err?.error?.status;
      const isRetryable = status === 500 || status === 529 || err?.code === 'ECONNRESET';
      if (isRetryable && attempt < maxRetries) {
        const delay = 1000 * (attempt + 1); // 1s, 2s
        console.warn(`[AI] Retryable error (${status || err.code}), attempt ${attempt + 1}/${maxRetries}, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Extract usage metadata from an Anthropic API response.
 */
function extractMeta(response, model = 'claude-sonnet-4-20250514') {
  const usage = response?.usage || {};
  return {
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    model,
  };
}

function extractText(response) {
  if (!response?.content) return '';
  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}

function parseJsonResponse(text) {
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}

/**
 * Review a chapter and return suggestions.
 */
export async function reviewChapter(content, { genres = [], modules = [] } = {}) {
  const defaultPrompt = `Du är en professionell svensk redaktör. Granska följande text och returnera förslag på förbättringar.

Returnera ett JSON-array med objekt:
{
  "type": "grammar" | "style" | "repetition" | "structure",
  "priority": "red" | "yellow" | "green",
  "level": 1-4,
  "original": "exakt citat från texten",
  "replacement": "föreslagen ersättning",
  "reason": "kort förklaring på svenska"
}

VIKTIGT om "original"-fältet:
- "original" MÅSTE vara en EXAKT ordagrann kopia från texten, tecken för tecken
- Kopiera texten direkt - ändra INGA ord, lägg inte till eller ta bort något
- Inkludera tillräckligt med kontext (hela meningen eller frasen) så att citatet är unikt i texten
- Om du inte kan citera exakt, hoppa över förslaget

KVALITETSKRAV:
- Var SÄKER på att ditt förslag verkligen är en förbättring innan du inkluderar det
- Dubbelkolla svensk grammatik noggrant: substantivets genus styr adjektivböjningen (en dyster natt, ett dystert mörker, den/det dystra)
- Föreslå INTE ändringar av korrekt böjda ord – verifiera genus och böjning innan du flaggar
- Om du är osäker på om något är ett fel, hoppa över det – falska positiva är värre än att missa något
- Prioritera tydliga, odiskutabla förbättringar framför subjektiva stilval

Nivåer:
1 = Utvecklingsredaktionellt (berättarstruktur, tempo, karaktärer)
2 = Stilistiskt (ordval, flöde, ton, upprepningar)
3 = Språkgranskning (grammatik, meningsbyggnad, tempus)
4 = Korrektur (stavfel, interpunktion, typografi)

Returnera ENBART JSON-arrayen, inga andra kommentarer.`;

  const basePrompt = await getPrompt('ai:review', defaultPrompt);
  const systemPrompt = `${basePrompt}\n\nGenrer aktiva: ${genres.join(', ') || 'inga'}`;

  const response = await sendMessage({
    system: systemPrompt,
    messages: [{ role: 'user', content: `Granska följande kapitel:\n\n${content}` }],
    max_tokens: 8192,
  });

  const meta = extractMeta(response);
  const text = extractText(response);
  try {
    const parsed = parseJsonResponse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error('[AI Review] Empty or invalid response from Claude:', text.slice(0, 500));
      throw new Error('AI returnerade inga förslag. Försök igen.');
    }
    return { result: parsed, meta };
  } catch (parseErr) {
    console.error('[AI Review] Failed to parse response:', text.slice(0, 500));
    throw new Error(`AI-svaret kunde inte tolkas: ${parseErr.message}`);
  }
}

/**
 * Multi-pass chapter review with DNA profiling and validation.
 * level: "basic" (2 pass + validate), "standard" (3 pass + validate), "deep" (4 pass + validate)
 * onProgress: callback(step, total, message) for frontend updates
 */
export async function reviewChapterMultiPass(content, { genres = [], level = 'basic', dnaProfile = null, allText = '', onProgress } = {}) {
  const totalSteps = level === 'deep' ? 5 : level === 'standard' ? 4 : 3;
  let step = 0;
  const progress = (msg) => { step++; onProgress?.(step, totalSteps, msg); };
  let totalMeta = { inputTokens: 0, outputTokens: 0, model: 'claude-sonnet-4-20250514' };
  const addMeta = (m) => { totalMeta.inputTokens += m.inputTokens || 0; totalMeta.outputTokens += m.outputTokens || 0; };

  // === PASS 1: Find obvious errors (red only) + build DNA if needed ===
  progress('Hittar fel (pass 1)...');

  const pass1Prompt = await getPrompt('ai:review_pass1', `Du gör FÖRSTA genomgången av en svensk text. Hitta ALLA:
- Stavfel och skrivfel
- Grammatikfel (böjning, kongruens, ordföljd)
- Interpunktionsfel (komma, punkt, citattecken)
- Saknade eller felaktiga ord
- Syftningsfel
- Felaktiga prepositioner

IDENTIFIERA BERÄTTARTEMPUS FÖRST. Om texten är i preteritum: "var", "hade", "kunde" etc. är KORREKT — flagga INTE dessa.

Returnera ENBART priority: "red" (måste åtgärdas). INGA stilförslag, INGA "bör övervägas", INGA smaksaker.

Citera originaltexten EXAKT. Inkludera hela meningen för unika matchningar.

Returnera JSON-array:
[{"type":"grammar"|"structure","priority":"red","level":3|4,"original":"exakt citat","replacement":"föreslagen ersättning","reason":"motivering"}]

Returnera ENBART JSON-arrayen.`);

  // Load genre-specific prompts and inject into system prompt
  let genreContext = '';
  if (genres.length > 0) {
    const genrePrompts = await Promise.all(
      genres.map(g => getPrompt(`genre:${g}`, ''))
    );
    genreContext = genrePrompts.filter(Boolean).join('\n\n');
  }

  // Run pass 1 and DNA generation in parallel
  const pass1System = genreContext
    ? `${pass1Prompt}\n\n${genreContext}`
    : pass1Prompt;

  const pass1Promise = sendMessage({
    system: pass1System,
    messages: [{ role: 'user', content: `Granska:\n\n${content}` }],
    max_tokens: 8192,
  });

  let dnaPromise = null;
  if (!dnaProfile && allText) {
    const dnaPromptText = await getPrompt('ai:dna_profile', 'Analysera textens språkliga DNA-profil. Returnera JSON.');
    dnaPromise = sendMessage({
      system: dnaPromptText,
      messages: [{ role: 'user', content: `Analysera:\n\n${allText.slice(0, 50000)}` }],
      max_tokens: 4096,
    });
  }

  const [pass1Response, dnaResponse] = await Promise.all([pass1Promise, dnaPromise || Promise.resolve(null)]);

  const pass1Meta = extractMeta(pass1Response);
  addMeta(pass1Meta);
  let pass1Suggestions = [];
  try {
    pass1Suggestions = parseJsonResponse(extractText(pass1Response));
    if (!Array.isArray(pass1Suggestions)) pass1Suggestions = [];
  } catch { pass1Suggestions = []; }

  // Parse DNA if generated
  let dna = dnaProfile;
  let dnaMeta = null;
  if (dnaResponse) {
    dnaMeta = extractMeta(dnaResponse);
    addMeta(dnaMeta);
    try { dna = parseJsonResponse(extractText(dnaResponse)); } catch { dna = null; }
  }

  // === PASS 2: Complement with DNA (red only) ===
  progress('Kompletterande genomgång med DNA (pass 2)...');

  const pass2Prompt = await getPrompt('ai:review_pass2', `Du gör ANDRA genomgången. Författarens DNA-profil och redan hittade fel finns nedan.

Gå igenom texten IGEN och hitta FEL som missades i första genomgången:
- Kontextberoende fel (rätt ord men fel i sammanhanget)
- Subtila tempusinkonsekvenser
- Logiska inkonsekvenser
- Syftningsfel som kräver helhetsbild
- Ordvalsfel som avviker från författarens etablerade register

BARA priority: "red". BARA FEL som INTE redan finns i listan nedan.

Returnera JSON-array (samma format som pass 1). Tom array [] om inga nya fel hittades.`);

  const dnaStr = dna ? `\n\nFörfattarens DNA-profil:\n${JSON.stringify(dna, null, 2)}` : '';
  const pass1Summary = pass1Suggestions.length > 0
    ? `\n\nRedan hittade fel (${pass1Suggestions.length} st):\n${pass1Suggestions.map(s => `- "${s.original?.slice(0, 50)}" → ${s.reason}`).join('\n')}`
    : '\n\nInga fel hittades i pass 1.';

  const pass2Response = await sendMessage({
    system: `${pass2Prompt}${dnaStr}${pass1Summary}`,
    messages: [{ role: 'user', content: `Granska igen:\n\n${content}` }],
    max_tokens: 8192,
  });

  addMeta(extractMeta(pass2Response));
  let pass2Suggestions = [];
  try {
    pass2Suggestions = parseJsonResponse(extractText(pass2Response));
    if (!Array.isArray(pass2Suggestions)) pass2Suggestions = [];
  } catch { pass2Suggestions = []; }

  // Merge pass 1 + pass 2
  let allSuggestions = [...pass1Suggestions, ...pass2Suggestions];

  // === VALIDATION PASS (Haiku — cheap, fast) ===
  progress('Validerar förslag...');

  const validatePrompt = await getPrompt('ai:review_validate', `Du är kvalitetsgranskare för en svensk manusgransknings-AI. Gå igenom varje förslag nedan och avgör om det är ett VERKLIGT fel.

Kontrollera särskilt:
- Genus/böjning: "ett dystert mörker" = KORREKT (neutrum). Underkänn förslag som ändrar korrekt böjning.
- Tempus: Om berättelsen är i preteritum, är "var"/"hade"/"kunde" KORREKT. Underkänn tempusändringar i konsekvent preteritum-text.
- Kontext: Är det verkligen fel i det narrativa sammanhanget?
- Medvetet stilval: Kan det vara författarens avsiktliga val?

Returnera JSON:
{"validated":[{"index":0,"approved":true,"reason":"..."},{"index":1,"approved":false,"reason":"Korrekt böjning i neutrum"}]}`);

  const suggestionsForValidation = allSuggestions.map((s, i) => ({
    index: i,
    original: s.original,
    replacement: s.replacement,
    reason: s.reason,
  }));

  const validateResponse = await sendMessage({
    model: 'claude-haiku-4-5-20251001',
    system: validatePrompt,
    messages: [{ role: 'user', content: `Validera dessa ${allSuggestions.length} förslag:\n${JSON.stringify(suggestionsForValidation, null, 2)}\n\nOriginaltexten (för kontext):\n${content.slice(0, 8000)}` }],
    max_tokens: 4096,
  });

  addMeta(extractMeta(validateResponse, 'claude-haiku-4-5-20251001'));
  try {
    const validateResult = parseJsonResponse(extractText(validateResponse));
    const validated = validateResult?.validated || validateResult;
    if (Array.isArray(validated)) {
      const rejected = new Set(validated.filter(v => !v.approved).map(v => v.index));
      const beforeCount = allSuggestions.length;
      allSuggestions = allSuggestions.filter((_, i) => !rejected.has(i));
      console.log(`[Multi-pass] Validation: ${beforeCount} → ${allSuggestions.length} (removed ${rejected.size} false positives)`);
    }
  } catch (e) {
    console.warn('[Multi-pass] Validation parse failed, keeping all suggestions:', e.message);
  }

  // === PASS 3 (Standard + Deep): Yellow suggestions ===
  if (level === 'standard' || level === 'deep') {
    progress('Analyserar stil och struktur...');

    const pass3Prompt = await getPrompt('ai:review_pass3', `Med författarens DNA-profil, hitta nu STILISTISKA problem (priority: "yellow" — bör övervägas):

- Ordupprepningar inom 2-3 meningar
- "Telling" istället för "showing" i emotionella scener
- Överflödiga adverb/adjektiv
- Passiv röst där aktiv vore starkare
- Klumpiga meningar
- Klichéer
- Oklara pronomenreferenser
- Tempoproblem
- Svaga scenöppningar/avslutningar

BARA priority: "yellow". INGA röda (redan hanterade). INGA gröna.

Returnera JSON-array (samma format).`);

    const existingSummary = `\n\nRedan hittade fel (${allSuggestions.length} st validerade röda).`;

    const pass3Response = await sendMessage({
      system: `${pass3Prompt}${dnaStr}${existingSummary}`,
      messages: [{ role: 'user', content: `Analysera stil:\n\n${content}` }],
      max_tokens: 8192,
    });

    addMeta(extractMeta(pass3Response));
    try {
      const pass3 = parseJsonResponse(extractText(pass3Response));
      if (Array.isArray(pass3)) allSuggestions.push(...pass3);
    } catch { /* skip */ }
  }

  // === PASS 4 (Deep only): Green + developmental ===
  if (level === 'deep') {
    progress('Djupanalys — dramaturgi och utveckling...');

    const pass4Prompt = await getPrompt('ai:review_pass4', `Djupanalys med författarens DNA-profil. Hitta nu FINSLIPNING och UTVECKLINGSFÖRSLAG:

priority: "green" (smaksak/finslipning):
- Alternativa formuleringar som ger bättre rytm
- Finslipning av ordval
- Stilistiska alternativ
MAX 5 gröna förslag per kapitel — välj de som gör störst skillnad.

level: 1 (Utvecklingsredaktionellt):
- Dramaturgisk effektivitet i scenen
- Karaktärsutveckling och konsistens
- Tematisk koherens
- Tempo och spänningskurva

Returnera JSON-array (samma format). Max 8 förslag totalt.`);

    const pass4Response = await sendMessage({
      system: `${pass4Prompt}${dnaStr}`,
      messages: [{ role: 'user', content: `Djupanalysera:\n\n${content}` }],
      max_tokens: 8192,
    });

    addMeta(extractMeta(pass4Response));
    try {
      const pass4 = parseJsonResponse(extractText(pass4Response));
      if (Array.isArray(pass4)) allSuggestions.push(...pass4);
    } catch { /* skip */ }
  }

  progress('Klar!');

  return {
    result: allSuggestions,
    meta: totalMeta,
    dnaProfile: dna,
    passCount: totalSteps,
    level,
  };
}

/**
 * Generate a linguistic DNA profile for the entire manuscript.
 */
export async function generateDNAProfile(allText, { genres = [] } = {}) {
  const systemPrompt = await getPrompt('ai:dna_profile', `Du är en litterär analytiker. Analysera textens språkliga DNA-profil.

Returnera JSON:
{
  "vocabulary": { "level": "hög/medel/låg", "uniqueRatio": 0.0-1.0, "notes": "..." },
  "sentenceStructure": { "avgLength": 0, "variation": "hög/medel/låg", "notes": "..." },
  "tone": { "primary": "...", "secondary": "...", "notes": "..." },
  "pacing": { "overall": "snabb/medel/långsam", "variation": "hög/medel/låg", "notes": "..." },
  "strengths": ["...", "..."],
  "areasForImprovement": ["...", "..."],
  "comparableAuthors": ["...", "..."],
  "summary": "Kort sammanfattning av textens karaktär"
}

Returnera ENBART JSON, inga andra kommentarer.`);

  const response = await sendMessage({
    system: systemPrompt,
    messages: [{ role: 'user', content: `Analysera följande manus:\n\n${allText.slice(0, 50000)}` }],
    max_tokens: 4096,
  });

  const meta = extractMeta(response);
  const text = extractText(response);
  try {
    return { result: parseJsonResponse(text), meta };
  } catch {
    console.error('Failed to parse DNA profile:', text.slice(0, 200));
    return { result: null, meta };
  }
}

/**
 * Writing development: brainstorm, expand, rewrite, newscene.
 */
export async function developText(mode, input, options = {}) {
  const { context, dnaProfile, emotionMap, chapterTitle, userInstruction, rewriteFocus } =
    typeof options === 'string' ? { context: options } : options;

  const defaultModes = {
    brainstorm: `Du är en kreativ skrivassistent. Analysera problemet och ge EXAKT tre alternativa lösningsförslag.\n\nSvara ENBART med giltig JSON:\n{"developedText":"kort sammanfattning","reasoning":"ditt resonemang","alternatives":["förslag 1","förslag 2","förslag 3"]}`,
    expand: `Du är en litterär ghostwriter. Bygg ut scenen med sinnesintryck, intern dialog och atmosfärskapande detaljer. Behåll författarens röst.\n\nSvara ENBART med giltig JSON:\n{"developedText":"den utbyggda texten","reasoning":"1-3 meningar om dina val"}`,
    rewrite: `Du är en erfaren svensk redaktör och stilist. Skriv om texten med förbättrad stil och flöde. Behåll kärnan.\n\nSvara ENBART med giltig JSON:\n{"developedText":"den omskrivna texten","reasoning":"1-3 meningar om dina val"}`,
    newscene: `Du är en kreativ skrivassistent för svenska manus. Skriv ett nytt textavsnitt baserat på beskrivningen. Matcha författarens stil.\n\nSvara ENBART med giltig JSON:\n{"developedText":"det nya avsnittet","reasoning":"1-3 meningar om dina val"}`,
  };

  // Fetch admin prompt (falls back to default)
  const basePrompt = await getPrompt(`ai:develop_${mode}`, defaultModes[mode] || defaultModes.brainstorm);

  // Build system prompt with DNA profile and emotion context
  let systemPrompt = basePrompt;

  if (dnaProfile) {
    const dnaStr = [
      dnaProfile.perspective && `Perspektiv: ${dnaProfile.perspective}`,
      dnaProfile.tense && `Tempus: ${dnaProfile.tense}`,
      dnaProfile.tonality && `Tonalitet: ${dnaProfile.tonality}`,
      dnaProfile.avgSentenceLen && `Meningslängd: ${dnaProfile.avgSentenceLen}`,
      dnaProfile.dialogStyle && `Dialogstil: ${dnaProfile.dialogStyle}`,
      dnaProfile.dominantImagery && `Bildspråk: ${dnaProfile.dominantImagery}`,
    ].filter(Boolean).join(', ');
    if (dnaStr) systemPrompt += `\n\nFörfattarens DNA-profil: ${dnaStr}`;
  }

  if (emotionMap) {
    const emotionStr = [
      emotionMap.dominantEmotion && `Dominant känsla: ${emotionMap.dominantEmotion}`,
      emotionMap.tension != null && `Spänningsnivå: ${Math.round(emotionMap.tension * 100)}%`,
      emotionMap.arc && `Emotionell båge: ${emotionMap.arc}`,
    ].filter(Boolean).join(', ');
    if (emotionStr) systemPrompt += `\nKapitlets emotionella karta: ${emotionStr}`;
  }

  if (context) {
    systemPrompt += `\n\nKontext från ${chapterTitle || 'kapitlet'}:\n${context.slice(0, 6000)}`;
  }

  // Build user message
  let userMsg = input;
  const instructionStr = userInstruction?.trim() ? `\nFörfattarens instruktioner: ${userInstruction}` : '';

  if (mode === 'expand') {
    userMsg = `Bygg ut denna scen med mer detaljer, sinnesintryck, dialog eller internmonolog. Behåll författarens röst.${instructionStr}\n\n${input}`;
  } else if (mode === 'rewrite') {
    const focus = rewriteFocus?.length > 0 ? `\nFokus: ${rewriteFocus.join(', ')}` : '';
    userMsg = `Skriv om denna passage.${focus}${instructionStr}\n\n${input}`;
  } else if (mode === 'newscene') {
    userMsg = `Skriv ett nytt textavsnitt baserat på denna beskrivning. Matcha författarens stil.${instructionStr}\n\n${input}`;
  } else if (mode === 'brainstorm') {
    userMsg = input; // brainstorm gets free-form text
  }

  const response = await sendMessage({
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
    max_tokens: 4096,
  });

  const meta = extractMeta(response);
  const text = extractText(response);
  try {
    return { result: parseJsonResponse(text), meta };
  } catch {
    return { result: { developedText: text, reasoning: '' }, meta };
  }
}

/**
 * Literary translation.
 */
export async function translateText(content, language) {
  const langNames = { en: 'engelska', de: 'tyska', es: 'spanska', ar: 'arabiska' };
  const langName = langNames[language] || language;

  const defaultTranslatePrompt = `Du är en professionell litterär översättare. Översätt texten till målspråket med hög litterär kvalitet. Behåll stil, ton och känsla.

Returnera JSON:
{
  "content": "den översatta texten",
  "comments": [{ "original": "svenskt uttryck", "note": "översättningskommentar" }],
  "glossary": [{ "original": "...", "translated": "...", "note": "..." }]
}`;

  const baseTranslatePrompt = await getPrompt('ai:translate', defaultTranslatePrompt);
  const model = 'claude-sonnet-4-20250514';
  const response = await sendMessage({
    model,
    system: `${baseTranslatePrompt}\n\nÖversätt till: ${langName}`,
    messages: [{ role: 'user', content }],
    max_tokens: 8192,
  });

  const meta = extractMeta(response, model);
  const text = extractText(response);
  try {
    return { result: parseJsonResponse(text), meta };
  } catch {
    return { result: { content: text, comments: [], glossary: [] }, meta };
  }
}

/**
 * Final pre-export consistency check across entire manuscript.
 */
export async function finalCheck(allText, { genres = [] } = {}) {
  const defaultPrompt = `Du är en professionell svensk korrekturläsare och redaktör. Du gör en SLUTKONTROLL av ett helt manuskript inför export/tryckning.

Analysera texten och hitta:

1. **Namnkonsekvens** — Stavas karaktärsnamn, platsnamn och andra egennamn konsekvent genom hela texten? Rapportera variationer.
2. **Tempusbrott** — Bryts berättartempus (t.ex. plötsligt presens i ett preteritum-manus)? Ange kapitel och citat.
3. **Stilbrott** — Finns passager som bryter mot den övergripande tonen/stilen? T.ex. plötsligt formellt i en informell text.
4. **Upprepningar** — Återkommer samma ord/fras onaturligt ofta inom korta avsnitt?
5. **Logiska hål** — Finns inkonsekvenser i handlingen (karaktär på två platser, tid som inte stämmer)?
6. **Korrekturfel** — Stavfel, felaktig interpunktion, saknade ord som missats i tidigare granskning.
7. **Formateringsfel** — Inkonsekvent dialogmarkering, blandade citattecken, inkonsekvent kursivering.

Returnera JSON:
{
  "issues": [
    {
      "category": "namnkonsekvens" | "tempusbrott" | "stilbrott" | "upprepning" | "logik" | "korrektur" | "formatering",
      "severity": "critical" | "warning" | "minor",
      "chapter": "<kapitelnamn eller null>",
      "quote": "<kort citat från texten>",
      "description": "<beskrivning av problemet på svenska>",
      "suggestion": "<förslag på åtgärd>"
    }
  ],
  "summary": "<1-3 meningar: övergripande bedömning av manuskriptets status>"
}

Var GRUNDLIG men rapportera bara verkliga problem, inte subjektiva stilval. Prioritera critical > warning > minor.
Returnera ENBART JSON.`;

  const systemPrompt = await getPrompt('ai:final_check', defaultPrompt);

  const response = await sendMessage({
    system: `${systemPrompt}\n\nGenrer: ${genres.join(', ') || 'inga'}`,
    messages: [{ role: 'user', content: `Gör en slutkontroll av följande manuskript:\n\n${allText.slice(0, 80000)}` }],
    max_tokens: 8192,
  });

  const meta = extractMeta(response);
  const text = extractText(response);
  try {
    return { result: parseJsonResponse(text), meta };
  } catch {
    console.error('Failed to parse final check response:', text.slice(0, 200));
    return { result: { issues: [], summary: 'Kunde inte tolka svaret.' }, meta };
  }
}
