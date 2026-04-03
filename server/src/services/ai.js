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

// In-memory cache for word list (refreshed every 60s)
let wordListCache = null;
let wordListCacheTime = 0;

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
 * Get the admin-curated word list formatted for injection into review prompts.
 * Returns a prompt block listing words that should NOT be flagged as errors.
 */
async function getWordListBlock() {
  try {
    const now = Date.now();
    if (!wordListCache || now - wordListCacheTime > CACHE_TTL) {
      wordListCache = await prisma.wordListEntry.findMany({ where: { isCorrect: true } });
      wordListCacheTime = now;
    }
    if (!wordListCache || wordListCache.length === 0) return '';

    const lines = wordListCache.map(e =>
      `- "${e.word}" är KORREKT — föreslå INTE "${e.correction}"${e.note ? ` (${e.note})` : ''}`
    );
    return `\n\nORDLISTA — BEKRÄFTAT KORREKTA ORD (flagga INTE dessa som fel):\n${lines.join('\n')}`;
  } catch {
    return '';
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
 * Validate suggestions against the actual chapter text.
 * Filters out false positives where the AI's reasoning doesn't match reality.
 */
function validateSuggestions(suggestions, chapterContent, wordList = []) {
  // Build a lookup set from word list: "word→correction" pairs that should be blocked
  const blockedCorrections = new Set(
    wordList.filter(e => e.isCorrect).map(e => `${e.word.trim().toLowerCase()}→${e.correction.trim().toLowerCase()}`)
  );

  return suggestions.filter(s => {
    if (!s.original || !s.replacement) return false;
    if (s.original.trim() === s.replacement.trim()) return false;

    // Block suggestions that match admin word list (e.g. "överbord" → "över bord")
    if (blockedCorrections.size > 0) {
      const origWords = s.original.trim().toLowerCase().split(/\s+/);
      const replWords = s.replacement.trim().toLowerCase().split(/\s+/);
      // Check if the change involves a word list entry
      for (const blocked of blockedCorrections) {
        const [word, correction] = blocked.split('→');
        if (s.original.toLowerCase().includes(word) && s.replacement.toLowerCase().includes(correction)) {
          console.log(`[WordList] Blocked suggestion: "${word}" → "${correction}" (admin override)`);
          return false;
        }
      }
    }
    if (!chapterContent.includes(s.original)) {
      const prefix = s.original.substring(0, 30).trim();
      if (prefix.length < 10 || !chapterContent.includes(prefix)) return false;
    }
    const origTrimmed = s.original.trim();
    const replTrimmed = s.replacement.trim();
    const origLastChar = origTrimmed.slice(-1);
    const replLastChar = replTrimmed.slice(-1);
    const isPunctuationChange = origTrimmed.slice(0, -1) === replTrimmed.slice(0, -1)
      && /[.,;:!?]/.test(origLastChar) && /[.,;:!?]/.test(replLastChar);
    if (isPunctuationChange) {
      const pos = chapterContent.indexOf(origTrimmed);
      if (pos >= 0) {
        const after = chapterContent.slice(pos + origTrimmed.length).replace(/^\s+/, '');
        const nextChar = after.charAt(0);
        if (origLastChar === ',' && replLastChar === '.' && nextChar && /[a-zåäö]/.test(nextChar)) return false;
        if (origLastChar === '.' && replLastChar === ',' && nextChar && /[A-ZÅÄÖ]/.test(nextChar)) return false;
      }
    }
    return true;
  });
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
    const validated = validateSuggestions(parsed, content);
    return { result: validated, meta };
  } catch (parseErr) {
    console.error('[AI Review] Failed to parse response:', text.slice(0, 500));
    throw new Error(`AI-svaret kunde inte tolkas: ${parseErr.message}`);
  }
}

/**
 * Aggregate suggestion accept/reject patterns for a user across all projects.
 * Used to feed feedback into DNA reinforcement prompts.
 * Returns null if fewer than 10 suggestions have been reviewed (cold start guard).
 */
export async function aggregateSuggestionFeedback(userId) {
  // Get all handled suggestions for this user
  const suggestions = await prisma.suggestion.findMany({
    where: {
      chapter: { project: { userId } },
      status: { in: ['ACCEPTED', 'REJECTED'] },
    },
    select: {
      type: true,
      priority: true,
      status: true,
      reason: true,
      original: true,
      replacement: true,
    },
  });

  if (suggestions.length < 10) return null;

  const accepted = suggestions.filter(s => s.status === 'ACCEPTED');
  const rejected = suggestions.filter(s => s.status === 'REJECTED');

  // Group by type + priority
  const byGroup = {};
  for (const s of suggestions) {
    const key = `${s.type}:${s.priority}`;
    if (!byGroup[key]) byGroup[key] = { accepted: 0, rejected: 0, type: s.type, priority: s.priority };
    byGroup[key][s.status === 'ACCEPTED' ? 'accepted' : 'rejected']++;
  }

  // Scan rejected reason fields for style-area keywords
  const areaKeywords = {
    sentence_length: /meningslängd|menings\s*längd|sentence.?len/i,
    dialogue_style: /dialog|dialogue/i,
    tone: /\bton\b|tonalitet|tonal/i,
    imagery: /bildspråk|metafor|imagery/i,
    pacing: /tempo|pacing|rytm/i,
    vocabulary: /ordval|register|vokabulär|vocabulary/i,
    repetition: /upprepa|repetit/i,
  };

  const areaRejections = {};
  for (const s of rejected) {
    const reason = (s.reason || '').toLowerCase();
    for (const [area, regex] of Object.entries(areaKeywords)) {
      if (regex.test(reason)) {
        areaRejections[area] = (areaRejections[area] || 0) + 1;
      }
    }
  }

  // Find strongly rejected areas (>60% rejection rate for that area)
  const stronglyRejected = [];
  for (const [area, count] of Object.entries(areaRejections)) {
    const totalForArea = count + (accepted.filter(s => areaKeywords[area].test(s.reason || '')).length);
    const rejectRate = totalForArea > 0 ? count / totalForArea : 0;
    if (rejectRate > 0.6 && count >= 3) {
      stronglyRejected.push({ area, rejectRate: Math.round(rejectRate * 100), count });
    }
  }

  // Find strongly rejected correction pairs (same original→replacement rejected multiple times)
  const rejectedCorrections = [];
  const correctionCounts = {};
  for (const s of rejected) {
    if (s.original && s.replacement && s.priority === 'red') {
      // Normalize to find patterns like "överbord" → "över bord"
      const key = `${s.original.trim().toLowerCase()}→${s.replacement.trim().toLowerCase()}`;
      correctionCounts[key] = (correctionCounts[key] || 0) + 1;
    }
  }

  return {
    totalReviewed: suggestions.length,
    acceptRate: Math.round((accepted.length / suggestions.length) * 100),
    accepted: accepted.length,
    rejected: rejected.length,
    byGroup: Object.values(byGroup),
    stronglyRejected,
    rejectedRedCount: rejected.filter(s => s.priority === 'red').length,
  };
}

/**
 * Format aggregated feedback as a compact prompt block for DNA reinforcement.
 */
function formatFeedbackForDnaPrompt(feedback) {
  if (!feedback) return '';

  const lines = [`\n\nFEEDBACK FRÅN FÖRFATTARENS TIDIGARE GRANSKNINGAR (baserat på ${feedback.totalReviewed} hanterade förslag):`];
  lines.push(`- Övergripande: ${feedback.acceptRate}% accepterade, ${100 - feedback.acceptRate}% avvisade`);

  // Report by type
  for (const g of feedback.byGroup) {
    const total = g.accepted + g.rejected;
    if (total >= 3) {
      const acceptRate = Math.round((g.accepted / total) * 100);
      const label = g.priority === 'red' ? 'felrättningar' : g.priority === 'yellow' ? 'stilförslag' : 'finslipning';
      if (acceptRate < 40) {
        lines.push(`- Författaren avvisar ${100 - acceptRate}% av ${g.type}/${label} → dessa typer av förslag bör undvikas`);
      } else if (acceptRate > 80) {
        lines.push(`- Författaren accepterar ${acceptRate}% av ${g.type}/${label} → bra matchning`);
      }
    }
  }

  // Report strongly rejected style areas
  for (const { area, rejectRate } of feedback.stronglyRejected) {
    const areaLabels = {
      sentence_length: 'meningslängd',
      dialogue_style: 'dialogstil',
      tone: 'tonalitet',
      imagery: 'bildspråk',
      pacing: 'tempo/rytm',
      vocabulary: 'ordval/register',
      repetition: 'upprepningar',
    };
    lines.push(`- Författaren avvisar ${rejectRate}% av förslag om ${areaLabels[area] || area} → detta är ett STARKT medvetet stilval`);
  }

  if (feedback.stronglyRejected.length > 0) {
    lines.push('\nINSTRUKTION: Förstärk dessa mönster i DNA-profilen. Lägg till konsekvent avvisade stilområden i "intentionalChoices". Markera dem som starkt intentionella stilval som INTE ska flaggas i framtida granskningar.');
  }

  return lines.join('\n');
}

/**
 * Format author DNA profile as a structured, human-readable string for AI prompts.
 * This replaces raw JSON.stringify — gives the AI explicit field labels and context.
 */
function formatAuthorDnaForPrompt(dna) {
  if (!dna) return '';
  const confidence = dna.manuscriptsAnalyzed > 1
    ? `(baserad på ${dna.manuscriptsAnalyzed} manus — förstärkt profil)`
    : '(baserad på ett manus — initial profil)';
  return `\n\nFÖRFATTARENS STIL-DNA ${confidence}:
- Perspektiv: ${dna.perspective || 'ej identifierat'}
- Tempus: ${dna.tense || 'ej identifierat'}
- Tonalitet: ${dna.tonality || 'ej identifierat'}
- Genomsnittlig meningslängd: ${dna.avgSentenceLen || '?'} ord
- Dialogstil: ${dna.dialogStyle || 'ej identifierat'}
- Bildspråk: ${dna.dominantImagery || 'ej identifierat'}
- Ordval/register: ${dna.vocabulary?.notes || dna.vocabulary?.level || 'ej identifierat'}
- Meningsstruktur: ${dna.sentenceStructure?.notes || 'ej identifierat'} (variation: ${dna.sentenceStructure?.variation || '?'})
- Ton: ${dna.tone?.primary || '?'} / ${dna.tone?.secondary || '—'} — ${dna.tone?.notes || ''}
- Tempo: ${dna.pacing?.overall || '?'} (variation: ${dna.pacing?.variation || '?'}) — ${dna.pacing?.notes || ''}
- Berättartekniker: ${(dna.narrativeTechniques || []).join(', ') || '—'}
- Styrkor: ${(dna.strengths || []).join(', ') || 'ej identifierade'}
- Utvecklingsområden: ${(dna.areasForImprovement || []).join(', ') || 'ej identifierade'}
- Jämförbara författare: ${(dna.comparableAuthors || []).join(', ') || '—'}
- Sammanfattning: ${dna.summary || '—'}
- Intentionella stilval: ${(dna.intentionalChoices || []).join(', ') || 'ej identifierade'}`;
}

/**
 * Format story DNA as a structured string for AI prompts.
 */
function formatStoryDnaForPrompt(storyDna) {
  if (!storyDna) return '';
  return `\n\nBERÄTTELSENS DNA:
- Huvudtema: ${storyDna.themes?.primary || '?'} — ${storyDna.themes?.notes || ''}
- Underteman: ${(storyDna.themes?.secondary || []).join(', ') || '—'}
- Dramaturgi: ${storyDna.dramaturgy?.structure || '?'} — ${storyDna.dramaturgy?.tensionArc || ''}
- Karaktärstyper: ${(storyDna.characters?.archetypes || []).join(', ') || '—'} (djup: ${storyDna.characters?.depth || '?'})
- Miljö: ${storyDna.setting?.type || '?'}, ${storyDna.setting?.period || '?'} — ${storyDna.setting?.atmosphere || ''}
- Emotionellt register: ${storyDna.emotionalRange?.primary || '?'}, ${(storyDna.emotionalRange?.secondary || []).join(', ') || '—'}
- Unik karaktär: ${storyDna.uniqueCharacter || '—'}`;
}

/**
 * Format combined DNA (backward compatible with old single-profile format).
 */
function formatDnaForPrompt(dna, storyDna) {
  if (!dna) return '';
  // If we have separate story DNA, format both
  if (storyDna) {
    return formatAuthorDnaForPrompt(dna) + formatStoryDnaForPrompt(storyDna);
  }
  // Fallback: legacy combined format
  return formatAuthorDnaForPrompt(dna);
}

/**
 * Multi-pass chapter review with DNA profiling and validation.
 * level: "basic" (2 pass + validate), "standard" (3 pass + validate), "deep" (4 pass + validate)
 * onProgress: callback(step, total, message) for frontend updates
 */
export async function reviewChapterMultiPass(content, { genres = [], level = 'basic', dnaProfile = null, storyDna = null, allText = '', onProgress } = {}) {
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

  // Load word list for injection into prompts
  const wordListBlock = await getWordListBlock();

  // Run pass 1 and DNA generation in parallel
  const pass1System = (genreContext
    ? `${pass1Prompt}\n\n${genreContext}`
    : pass1Prompt) + wordListBlock;

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
  const dnaStrFormatted = formatDnaForPrompt(dna, storyDna); // Structured format for pass 3/4
  const pass1Summary = pass1Suggestions.length > 0
    ? `\n\nRedan hittade fel (${pass1Suggestions.length} st):\n${pass1Suggestions.map(s => `- "${s.original?.slice(0, 50)}" → ${s.reason}`).join('\n')}`
    : '\n\nInga fel hittades i pass 1.';

  const pass2Response = await sendMessage({
    system: `${pass2Prompt}${dnaStr}${pass1Summary}${wordListBlock}`,
    messages: [{ role: 'user', content: `Granska igen:\n\n${content}` }],
    max_tokens: 8192,
  });

  addMeta(extractMeta(pass2Response));
  let pass2Suggestions = [];
  try {
    pass2Suggestions = parseJsonResponse(extractText(pass2Response));
    if (!Array.isArray(pass2Suggestions)) pass2Suggestions = [];
  } catch { pass2Suggestions = []; }

  // Merge pass 1 + pass 2, then filter against admin word list
  let allSuggestions = [...pass1Suggestions, ...pass2Suggestions];
  if (wordListCache && wordListCache.length > 0) {
    const before = allSuggestions.length;
    allSuggestions = validateSuggestions(allSuggestions, content, wordListCache);
    if (allSuggestions.length < before) {
      console.log(`[Multi-pass] Word list filter: ${before} → ${allSuggestions.length}`);
    }
  }

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

    const pass3Prompt = await getPrompt('ai:review_pass3', `Du är en erfaren svensk stilistisk redaktör. Detta är PASS 3 – stilistisk granskning.

Du har tillgång till författarens DNA-profil nedan. Använd den AKTIVT för att bedöma varje förslag.

DIN UPPGIFT:
Hitta priority: "yellow" (bör övervägas) stilistiska problem:
- Ordupprepningar inom 2-3 meningar (samma ord/stam upprepas)
- "Telling" istället för "showing" i emotionella scener
- Stilbrott som avviker från författarens etablerade ton
- Tempoproblem (för hastigt eller för utdraget)
- Passiv röst där aktiv vore starkare
- Klichéer som kan ersättas med originella formuleringar
- Överflödiga adverb/adjektiv som försvagar prosan
- Oklara pronomenreferenser
- Svag scenöppning eller -avslutning

FÖRBUD:
- Inga gröna förslag (smaksaker) – de hör till Pass 4.
- Inga röda förslag (språkfel) – de hanteras i Pass 1-2.
- ALLA förslag ska ha priority: "yellow".

RESPEKTERA DNA-PROFILEN — KRITISKT:
- PERSPEKTIV: Föreslå inte perspektivbyten om författaren konsekvent använder sitt berättarperspektiv.
- TEMPUS: Flagga bara tempusbrytningar som är oavsiktliga, inte stilistiska val.
- TONALITET: Alla förslag ska matcha författarens ton. Om tonen är lakonisk — föreslå INTE utsmyckat språk. Om tonen är lyrisk — föreslå INTE kortare formuleringar.
- MENINGSLÄNGD: Om författaren medvetet använder korta eller långa meningar — flagga INTE det som problem.
- DIALOGSTIL: Korrigera inte dialogstilen om den matchar DNA-profilen.
- BILDSPRÅK: Förslag ska använda samma typ av bildspråk och metaforik som författaren redan använder.
- ORDVAL/REGISTER: Håll dig till författarens register. Föreslå inte akademiskt språk i informell text eller vice versa.
- STYRKOR: Flagga ALDRIG författarens listade styrkor som problem — de definierar rösten.

INTENTIONELLA STILVAL:
- Om DNA-profilen listar "intentionalChoices" (t.ex. meningslängd, dialogstil, tonalitet), ska dessa områden
  ALDRIG flaggas som problem. Dessa är bekräftade av författarens egna granskningsbeslut.

KVALITETSKONTROLL:
- Varje förslag MÅSTE motiveras med "detta avviker från författarens etablerade stil".
- Om texten redan är konsekvent med DNA-profilen — ge INGET förslag.
- Hellre för FÅ förslag än för många irrelevanta.
- Replacement-texten ska låta som FÖRFATTAREN — inte som dig.

CITATPRECISION:
- "original"-fältet MÅSTE vara en EXAKT ordagrann kopia från texten.
- Inkludera ALLTID hela meningen eller meningarna som berörs.

Returnera ENBART giltig JSON-array:
[
  {
    "type": "style|repetition|structure",
    "priority": "yellow",
    "level": 2,
    "original": "exakt citat från texten – hela meningen/meningarna",
    "replacement": "föreslagen förbättring som matchar författarens röst",
    "reason": "kort motivering — förklara VARFÖR detta avviker från författarens DNA och HUR förslaget matchar bättre"
  }
]

Om inga stilistiska problem hittas, returnera en tom array: []`);

    const existingSummary = `\n\nRedan hittade fel (${allSuggestions.length} st validerade röda).`;

    const pass3Response = await sendMessage({
      system: `${pass3Prompt}${dnaStrFormatted}${existingSummary}`,
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

    const pass4Prompt = await getPrompt('ai:review_pass4', `Du är en erfaren svensk utvecklingsredaktör. Detta är PASS 4 – djupgranskning.

Du har tillgång till författarens DNA-profil nedan. Använd den AKTIVT — alla förslag ska låta som författaren på sin bästa dag.

DIN UPPGIFT:
Hitta två typer av förslag:

A) Priority: "green" (smaksaker/finslipning) – MAX 3 per kapitel:
- Alternativa formuleringar som ger bättre rytm — i författarens EGEN stil
- Finslipning av ordval för ökad precision — med författarens EGET register
- Stilistiska alternativ som stärker uttrycket — som författaren SJÄLV skulle uttrycka det
- Välj de 3 som gör STÖRST skillnad

B) Priority: "yellow", level: 1 (utvecklingsredaktionellt) – MAX 3 per kapitel:
- Dramaturgiska svagheter (scenen saknar riktning eller stakes)
- Karaktärsutveckling (agerande ur karaktär, platt karaktärisering)
- Scenbygge (saknade sinnesintryck, svag miljöskildring)
- Tempo och pacing (scenen drar ut eller hastar)
- Tematisk koherens (avviker från manuskriptets teman)

RESPEKTERA DNA-PROFILEN — KRITISKT:
- Gröna förslag ska låta som författaren PÅ SIN BÄSTA DAG — inte som en annan författare.
- Använd samma register, tonalitet och meningsrytm som DNA-profilen beskriver.
- Utvecklingsredaktionella förslag ska stärka det författaren REDAN gör bra (se styrkor), inte införa nya stilar.
- Referera till författarens specifika styrkor i motiveringen.
- Om ett textstycke redan uppvisar det DNA-profilen listar som styrkor — föreslå INGET.
- Replacement-texten MÅSTE matcha författarens röst och register exakt.

KVALITETSKONTROLL:
- Max 3 gröna + max 3 utvecklingsredaktionella = MAX 6 förslag totalt.
- Kvalitet > kvantitet. Hellre 2 träffsäkra förslag än 6 generiska.
- Om kapitlet redan är starkt — returnera en tom array.

CITATPRECISION:
- "original"-fältet MÅSTE vara en EXAKT ordagrann kopia från texten.
- Inkludera ALLTID hela meningen eller meningarna som berörs.

Returnera ENBART giltig JSON-array:
[
  {
    "type": "style|structure",
    "priority": "green eller yellow",
    "level": 1 eller 2,
    "original": "exakt citat från texten",
    "replacement": "föreslagen förbättring i författarens egen stil, eller null för strukturella kommentarer",
    "reason": "motivering — referera till DNA-profilen och förklara VARFÖR och HUR detta stärker texten"
  }
]

Om inga förslag hittas, returnera en tom array: []`);

    const pass4Response = await sendMessage({
      system: `${pass4Prompt}${dnaStrFormatted}`,
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
 * Addon review: run only pass 3 and/or pass 4 on an already-reviewed chapter.
 * This appends new suggestions without re-running the basic review pipeline.
 */
export async function reviewChapterAddon(content, { passes = ['pass3'], dnaProfile = null, storyDna = null, existingSuggestions = [], genres = [] } = {}) {
  const dnaStrFormatted = formatDnaForPrompt(dnaProfile, storyDna);
  const allSuggestions = [];
  const totalMeta = { inputTokens: 0, outputTokens: 0, models: {} };
  const addMeta = (m) => {
    totalMeta.inputTokens += m.inputTokens || 0;
    totalMeta.outputTokens += m.outputTokens || 0;
    for (const [model, tokens] of Object.entries(m.models || {})) {
      totalMeta.models[model] = totalMeta.models[model] || { input: 0, output: 0 };
      totalMeta.models[model].input += tokens.input || 0;
      totalMeta.models[model].output += tokens.output || 0;
    }
  };

  if (passes.includes('pass3')) {
    const pass3Prompt = await getPrompt('ai:review_pass3', `Du är en erfaren svensk stilistisk redaktör. Hitta STILISTISKA problem (priority: "yellow").

RESPEKTERA DNA-PROFILEN. Varje förslag MÅSTE motiveras med att det avviker från författarens etablerade stil.

Returnera ENBART giltig JSON-array med objekt: { "type", "priority": "yellow", "level": 2, "original", "replacement", "reason" }
Tom array [] om inga problem hittas.`);

    const existingSummary = existingSuggestions.length > 0
      ? `\n\nRedan hittade förslag (${existingSuggestions.length} st) — ge INGA dubbletter.`
      : '';

    const pass3Response = await sendMessage({
      system: `${pass3Prompt}${dnaStrFormatted}${existingSummary}`,
      messages: [{ role: 'user', content: `Analysera stil:\n\n${content}` }],
      max_tokens: 8192,
    });

    addMeta(extractMeta(pass3Response));
    try {
      const pass3 = parseJsonResponse(extractText(pass3Response));
      if (Array.isArray(pass3)) allSuggestions.push(...pass3);
    } catch { /* skip */ }
  }

  if (passes.includes('pass4')) {
    const pass4Prompt = await getPrompt('ai:review_pass4', `Du är en erfaren svensk utvecklingsredaktör. Hitta FINSLIPNING (priority: "green", max 3) och UTVECKLINGSFÖRSLAG (priority: "yellow", level: 1, max 3).

RESPEKTERA DNA-PROFILEN. Förslag ska låta som författaren på sin bästa dag.

Returnera ENBART giltig JSON-array med objekt: { "type", "priority", "level", "original", "replacement", "reason" }
Tom array [] om inga förslag hittas.`);

    const pass4Response = await sendMessage({
      system: `${pass4Prompt}${dnaStrFormatted}`,
      messages: [{ role: 'user', content: `Djupanalysera:\n\n${content}` }],
      max_tokens: 8192,
    });

    addMeta(extractMeta(pass4Response));
    try {
      const pass4 = parseJsonResponse(extractText(pass4Response));
      if (Array.isArray(pass4)) allSuggestions.push(...pass4);
    } catch { /* skip */ }
  }

  // === VALIDATION PASS for addon suggestions ===
  if (allSuggestions.length > 0) {
    const validatePrompt = await getPrompt('ai:review_validate', `Du är kvalitetsgranskare. Gå igenom varje förslag och avgör om det är relevant och korrekt.

Kontrollera särskilt:
- Matchar förslaget författarens stil och DNA-profil?
- Är replacement-texten konsekvent med författarens röst?
- Är det ett verkligt stilistiskt problem eller bara en smaksak?
- Passar förslaget i det narrativa sammanhanget?

Returnera JSON:
{"validated":[{"index":0,"approved":true,"reason":"..."},{"index":1,"approved":false,"reason":"..."}]}`);

    const suggestionsForValidation = allSuggestions.map((s, i) => ({
      index: i,
      original: s.original,
      replacement: s.replacement,
      reason: s.reason,
      priority: s.priority,
    }));

    try {
      const validateResponse = await sendMessage({
        model: 'claude-haiku-4-5-20251001',
        system: `${validatePrompt}${dnaStrFormatted}`,
        messages: [{ role: 'user', content: `Validera dessa ${allSuggestions.length} förslag:\n${JSON.stringify(suggestionsForValidation, null, 2)}\n\nOriginaltexten (för kontext):\n${content.slice(0, 8000)}` }],
        max_tokens: 4096,
      });

      addMeta(extractMeta(validateResponse, 'claude-haiku-4-5-20251001'));
      const validateResult = parseJsonResponse(extractText(validateResponse));
      const validated = validateResult?.validated || validateResult;
      if (Array.isArray(validated)) {
        const rejected = new Set(validated.filter(v => !v.approved).map(v => v.index));
        const beforeCount = allSuggestions.length;
        const filtered = allSuggestions.filter((_, i) => !rejected.has(i));
        console.log(`[Addon Validation] ${beforeCount} → ${filtered.length} (removed ${rejected.size} irrelevant suggestions)`);
        return { result: filtered, meta: totalMeta, passesRun: passes };
      }
    } catch (e) {
      console.warn('[Addon Validation] Parse failed, keeping all suggestions:', e.message);
    }
  }

  return {
    result: allSuggestions,
    meta: totalMeta,
    passesRun: passes,
  };
}

/**
 * Generate a two-part DNA profile: story DNA (per-project) + author DNA (per-user, cumulative).
 * Returns { storyDna, authorDna, combined (legacy format), meta }
 */
export async function generateDNAProfile(allText, { genres = [], existingAuthorDna = null, feedbackSummary = null } = {}) {
  const totalMeta = { inputTokens: 0, outputTokens: 0, models: {} };
  const addMeta = (m) => {
    totalMeta.inputTokens += m.inputTokens || 0;
    totalMeta.outputTokens += m.outputTokens || 0;
    for (const [model, tokens] of Object.entries(m.models || {})) {
      totalMeta.models[model] = totalMeta.models[model] || { input: 0, output: 0 };
      totalMeta.models[model].input += tokens.input || 0;
      totalMeta.models[model].output += tokens.output || 0;
    }
  };

  // ─── PART 1: Story DNA (unique to this manuscript) ───
  const storyPrompt = await getPrompt('ai:dna_story', `Du är en litterär analytiker specialiserad på narrativ analys. Analysera BERÄTTELSENS unika DNA — det som gör just denna historia speciell.

Analysera följande dimensioner:
1. TEMAN — Identifiera huvudteman och underteman
2. DRAMATURGISK STRUKTUR — Berättelsens uppbyggnad, spänningskurva, vändpunkter
3. KARAKTÄRSTYPOLOGI — Typ av karaktärer, deras roller och relationer
4. HANDLINGSSTRUKTUR — Plotmönster, subplot-hantering, pacing
5. MILJÖ OCH VÄRLDSBYGGE — Typ av miljö, tidsepok, atmosfär
6. GENREMARKÖRER — Genrespecifika element och konventioner
7. EMOTIONELLT REGISTER — Vilka känslor berättelsen rör sig i
8. UNIK KARAKTÄR — Vad som skiljer denna berättelse från andra i samma genre

Returnera ENBART giltig JSON utan förklaringar:
{
  "themes": { "primary": "huvudtema", "secondary": ["undertema 1", "undertema 2"], "notes": "beskrivning" },
  "dramaturgy": { "structure": "typ av struktur", "turningPoints": "beskrivning", "tensionArc": "beskrivning" },
  "characters": { "archetypes": ["typ 1", "typ 2"], "relationships": "beskrivning", "depth": "hög/medel/låg" },
  "plot": { "pattern": "plotmönster", "subplots": "beskrivning", "resolution": "typ" },
  "setting": { "type": "typ av miljö", "period": "tidsepok", "atmosphere": "atmosfärbeskrivning" },
  "genreMarkers": ["markör 1", "markör 2"],
  "emotionalRange": { "primary": "huvudkänsla", "secondary": ["känsla 1", "känsla 2"], "notes": "beskrivning" },
  "uniqueCharacter": "2-3 meningar som sammanfattar berättelsens unika karaktär"
}`);

  // ─── PART 2: Author DNA (writing style — accumulates across manuscripts) ───
  const authorPrompt = await getPrompt('ai:dna_author', `Du är en litterär analytiker specialiserad på stilistisk fingeravtrycksanalys. Analysera FÖRFATTARENS skrivstil — det som är unikt för hur denna person skriver, oberoende av vilken berättelse det handlar om.

Analysera följande dimensioner:
1. PERSPEKTIV — Berättarperspektiv (första person, tredje person begränsad, allvetande, etc.)
2. TEMPUS — Berättartempus (preteritum, presens, växlande)
3. TONALITET — Övergripande ton (lyrisk, lakonisk, varm, distanserad, etc.)
4. MENINGSSTRUKTUR — Genomsnittlig meningslängd, variation kort/lång, rytmmönster
5. DIALOGSTIL — Hur dialog presenteras (naturalistisk, stiliserad, minimal, etc.)
6. BILDSPRÅK — Typ av metaforer, sinnesintryck, bildval
7. ORDVAL — Registernivå, favoritord, stilistiska preferenser
8. BERÄTTARTEKNIK — Specifika tekniker (stream of consciousness, foreshadowing, etc.)

${existingAuthorDna ? `
VIKTIGT: Du har tillgång till en TIDIGARE analyserad författarprofil nedan. Jämför med det nya manuskriptet och FÖRSTÄRK de mönster som bekräftas. Om nya mönster upptäcks, lägg till dem. Om tidigare mönster INTE syns i det nya manuset, behåll dem men markera dem som "ej bekräftat i detta manus".

Tidigare författarprofil:
${JSON.stringify(existingAuthorDna, null, 2)}
` : ''}

Returnera ENBART giltig JSON utan förklaringar:
{
  "perspective": "berättarperspektiv",
  "tense": "berättartempus",
  "tonality": "tonalitetsbeskrivning",
  "avgSentenceLen": 14.2,
  "dialogStyle": "dialogstilsbeskrivning",
  "dominantImagery": "dominerande bildspråk",
  "vocabulary": { "level": "hög/medel/låg", "uniqueRatio": 0.65, "notes": "beskrivning" },
  "sentenceStructure": { "avgLength": 14, "variation": "hög/medel/låg", "notes": "beskrivning" },
  "tone": { "primary": "huvudton", "secondary": "sekundär ton", "notes": "beskrivning" },
  "pacing": { "overall": "snabb/medel/långsam", "variation": "hög/medel/låg", "notes": "beskrivning" },
  "narrativeTechniques": ["teknik 1", "teknik 2"],
  "strengths": ["styrka 1", "styrka 2"],
  "areasForImprovement": ["område 1", "område 2"],
  "comparableAuthors": ["författare 1", "författare 2"],
  "summary": "2-3 meningar som sammanfattar författarens unika stil",
  "confidence": ${existingAuthorDna ? '"förstärkt — baserad på flera manus"' : '"initial — baserad på ett manus"'},
  "manuscriptsAnalyzed": ${existingAuthorDna?.manuscriptsAnalyzed ? existingAuthorDna.manuscriptsAnalyzed + 1 : 1},
  "intentionalChoices": ["stilområde som författaren konsekvent avvisar ändringar inom"]
}`);

  // Inject feedback from accept/reject patterns
  const feedbackBlock = formatFeedbackForDnaPrompt(feedbackSummary);

  const textSlice = allText.slice(0, 50000);

  // Run both DNA analyses in parallel
  const [storyResponse, authorResponse] = await Promise.all([
    sendMessage({
      system: storyPrompt,
      messages: [{ role: 'user', content: `Analysera berättelsens DNA:\n\n${textSlice}` }],
      max_tokens: 4096,
    }),
    sendMessage({
      system: `${authorPrompt}${feedbackBlock}`,
      messages: [{ role: 'user', content: `Analysera författarens stil:\n\n${textSlice}` }],
      max_tokens: 4096,
    }),
  ]);

  addMeta(extractMeta(storyResponse));
  addMeta(extractMeta(authorResponse));

  let storyDna = null;
  let authorDna = null;

  try {
    storyDna = parseJsonResponse(extractText(storyResponse));
  } catch {
    console.error('Failed to parse story DNA:', extractText(storyResponse).slice(0, 200));
  }

  try {
    authorDna = parseJsonResponse(extractText(authorResponse));
  } catch {
    console.error('Failed to parse author DNA:', extractText(authorResponse).slice(0, 200));
  }

  // Build combined legacy format (backward compatible with existing code)
  const combined = authorDna ? {
    ...authorDna,
    storyThemes: storyDna?.themes,
    storyDramaturgy: storyDna?.dramaturgy,
  } : null;

  return { storyDna, authorDna, result: combined, meta: totalMeta };
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
