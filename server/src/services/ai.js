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
    return { result: parseJsonResponse(text), meta };
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
