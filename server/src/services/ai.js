import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const client = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

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
  const systemPrompt = `Du är en professionell svensk redaktör. Granska följande text och returnera förslag på förbättringar.

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

Genrer aktiva: ${genres.join(', ') || 'inga'}
Returnera ENBART JSON-arrayen, inga andra kommentarer.`;

  const response = await sendMessage({
    system: systemPrompt,
    messages: [{ role: 'user', content: `Granska följande kapitel:\n\n${content}` }],
    max_tokens: 8192,
  });

  const text = extractText(response);
  try {
    return parseJsonResponse(text);
  } catch {
    console.error('Failed to parse review response:', text.slice(0, 200));
    return [];
  }
}

/**
 * Generate a linguistic DNA profile for the entire manuscript.
 */
export async function generateDNAProfile(allText, { genres = [] } = {}) {
  const systemPrompt = `Du är en litterär analytiker. Analysera textens språkliga DNA-profil.

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

Returnera ENBART JSON, inga andra kommentarer.`;

  const response = await sendMessage({
    system: systemPrompt,
    messages: [{ role: 'user', content: `Analysera följande manus:\n\n${allText.slice(0, 50000)}` }],
    max_tokens: 4096,
  });

  const text = extractText(response);
  try {
    return parseJsonResponse(text);
  } catch {
    console.error('Failed to parse DNA profile:', text.slice(0, 200));
    return null;
  }
}

/**
 * Writing development: brainstorm, expand, rewrite.
 */
export async function developText(mode, input, context = '') {
  const modes = {
    brainstorm: 'Ge 3 kreativa alternativ för att utveckla denna text. Returnera JSON: { "alternatives": ["...", "...", "..."] }',
    expand: 'Bygg ut denna scen med mer detaljer, sinnesintryck och intern dialog. Returnera JSON: { "expanded": "..." }',
    rewrite: 'Skriv om denna text med förbättrad stil och flöde. Behåll kärnan. Returnera JSON: { "rewritten": "..." }',
  };

  const response = await sendMessage({
    system: modes[mode] || modes.brainstorm,
    messages: [{ role: 'user', content: context ? `Kontext:\n${context}\n\nText att bearbeta:\n${input}` : input }],
    max_tokens: 4096,
  });

  const text = extractText(response);
  try {
    return parseJsonResponse(text);
  } catch {
    return { text };
  }
}

/**
 * Literary translation.
 */
export async function translateText(content, language) {
  const langNames = { en: 'engelska', de: 'tyska', es: 'spanska', ar: 'arabiska' };
  const langName = langNames[language] || language;

  const response = await sendMessage({
    model: 'claude-sonnet-4-20250514',
    system: `Du är en professionell litterär översättare. Översätt texten till ${langName} med hög litterär kvalitet. Behåll stil, ton och känsla.

Returnera JSON:
{
  "content": "den översatta texten",
  "comments": [{ "original": "svenskt uttryck", "note": "översättningskommentar" }],
  "glossary": [{ "original": "...", "translated": "...", "note": "..." }]
}`,
    messages: [{ role: 'user', content }],
    max_tokens: 8192,
  });

  const text = extractText(response);
  try {
    return parseJsonResponse(text);
  } catch {
    return { content: text, comments: [], glossary: [] };
  }
}
