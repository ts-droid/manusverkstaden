import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

const client = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
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

  const response = await client.messages.create({
    model,
    max_tokens,
    system,
    messages,
  });

  return response;
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
function validateSuggestions(suggestions, chapterContent) {
  return suggestions.filter(s => {
    // Skip suggestions with missing required fields
    if (!s.original || !s.replacement) return false;

    // Skip if original and replacement are identical
    if (s.original.trim() === s.replacement.trim()) return false;

    // Skip if original text doesn't exist in the chapter
    if (!chapterContent.includes(s.original)) {
      // Try fuzzy: first 30 chars
      const prefix = s.original.substring(0, 30).trim();
      if (prefix.length < 10 || !chapterContent.includes(prefix)) return false;
    }

    // Validate punctuation changes at end of text
    const origTrimmed = s.original.trim();
    const replTrimmed = s.replacement.trim();
    const origLastChar = origTrimmed.slice(-1);
    const replLastChar = replTrimmed.slice(-1);
    const isPunctuationChange = origTrimmed.slice(0, -1) === replTrimmed.slice(0, -1)
      && /[.,;:!?]/.test(origLastChar) && /[.,;:!?]/.test(replLastChar);

    if (isPunctuationChange) {
      // Find what comes after the original text in the chapter
      const pos = chapterContent.indexOf(origTrimmed);
      if (pos >= 0) {
        const after = chapterContent.slice(pos + origTrimmed.length).replace(/^\s+/, '');
        const nextChar = after.charAt(0);

        // Comma→period: only valid if next char is uppercase (new sentence)
        if (origLastChar === ',' && replLastChar === '.') {
          if (nextChar && /[a-zåäö]/.test(nextChar)) return false;
        }
        // Period→comma: only valid if next char is lowercase (continuation)
        if (origLastChar === '.' && replLastChar === ',') {
          if (nextChar && /[A-ZÅÄÖ]/.test(nextChar)) return false;
        }
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
  "original": "den ursprungliga texten",
  "replacement": "föreslagen ersättning",
  "reason": "kort förklaring på svenska"
}

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
    const raw = parseJsonResponse(text);
    const validated = validateSuggestions(Array.isArray(raw) ? raw : (raw?.suggestions || []), content);
    return { result: validated, meta };
  } catch {
    console.error('Failed to parse review response:', text.slice(0, 200));
    return { result: [], meta };
  }
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
 * Writing development: brainstorm, expand, rewrite.
 */
export async function developText(mode, input, context = '') {
  const defaultModes = {
    brainstorm: 'Ge 3 kreativa alternativ för att utveckla denna text. Returnera JSON: { "alternatives": ["...", "...", "..."] }',
    expand: 'Bygg ut denna scen med mer detaljer, sinnesintryck och intern dialog. Returnera JSON: { "expanded": "..." }',
    rewrite: 'Skriv om denna text med förbättrad stil och flöde. Behåll kärnan. Returnera JSON: { "rewritten": "..." }',
  };

  const modePrompt = await getPrompt(`ai:develop_${mode}`, defaultModes[mode] || defaultModes.brainstorm);

  const response = await sendMessage({
    system: modePrompt,
    messages: [{ role: 'user', content: context ? `Kontext:\n${context}\n\nText att bearbeta:\n${input}` : input }],
    max_tokens: 4096,
  });

  const meta = extractMeta(response);
  const text = extractText(response);
  try {
    return { result: parseJsonResponse(text), meta };
  } catch {
    return { result: { text }, meta };
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
