/**
 * AI Provider wrapper — provider-agnostic layer above Anthropic and OpenAI.
 *
 * Public API:
 *   - sendMessage({ promptKey, system, messages, max_tokens, cheap, temperature })
 *       Routes to Claude or OpenAI based on the active codeset.
 *       Returns { text, meta, raw, provider, model }.
 *
 *   - getActiveCodeset() / setActiveCodeset(id)
 *       Read/write the active codeset from PromptConfig DB (key = "codeset:active").
 *
 *   - parseJsonResponse(text, { fallbackExtraction })
 *       Robust JSON parser — strict first, optional markdown-block fallback.
 *
 * The wrapper handles:
 *   - Per-task temperature from codeset
 *   - OpenAI JSON mode (response_format)
 *   - Cross-provider fallback (if primary fails, try alternate)
 *   - 30-day in-memory cache for DNA + expensive calls (keyed by content hash)
 *   - Retries with exponential backoff on transient errors
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';
import { CODESETS, MODELS, resolveCall } from '../config/codesets.js';

const prisma = new PrismaClient();

// ─── Clients ──────────────────────────────────────────────────────────
const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 120000 })
  : null;

const openai = config.openaiApiKey
  ? new OpenAI({ apiKey: config.openaiApiKey, timeout: 120000 })
  : null;

// ─── Active codeset cache ─────────────────────────────────────────────
const CODESET_KEY = 'codeset:active';
let activeCodesetId = config.defaultCodeset || 'claude-only';
let activeCodesetLoadedAt = 0;
const CODESET_TTL = 30_000; // 30s — refresh from DB periodically

export async function getActiveCodeset() {
  const now = Date.now();
  if (now - activeCodesetLoadedAt > CODESET_TTL) {
    try {
      const row = await prisma.promptConfig.findUnique({
        where: { key: CODESET_KEY },
      });
      if (row && CODESETS[row.content]) {
        activeCodesetId = row.content;
      }
      activeCodesetLoadedAt = now;
    } catch (err) {
      console.warn('[aiProvider] Could not load active codeset from DB:', err.message);
    }
  }
  return CODESETS[activeCodesetId] || CODESETS['claude-only'];
}

export async function setActiveCodeset(id, updatedBy = 'admin') {
  if (!CODESETS[id]) {
    throw new Error(`Unknown codeset: ${id}. Valid: ${Object.keys(CODESETS).join(', ')}`);
  }
  await prisma.promptConfig.upsert({
    where: { key: CODESET_KEY },
    update: { content: id, version: { increment: 1 }, updatedBy },
    create: { key: CODESET_KEY, content: id, version: 1, updatedBy },
  });
  activeCodesetId = id;
  activeCodesetLoadedAt = Date.now();
  console.log(`[aiProvider] Active codeset switched to "${id}" by ${updatedBy}`);
  return CODESETS[id];
}

// ─── Persistent storage note ──────────────────────────────────────────
// DNA profiles are stored PERMANENTLY in the database:
//   - User.authorDna        → per-user, cumulates across manuscripts
//   - User.authorDnaVersion → version counter
//   - Project.storyDna      → per-manuscript, saved forever
//   - Project.dnaProfile    → legacy combined format
//
// The caller (reviewChapterMultiPass in ai.js) only calls generateDNAProfile
// when dnaProfile is missing — DB acts as the persistent cache. No in-memory
// cache is needed; the only reason to regenerate DNA is if the user explicitly
// asks (e.g. "Recompute DNA" button in admin) or if the manuscript text changes
// significantly.

// ─── JSON parsing ─────────────────────────────────────────────────────
export function parseJsonResponse(text, { fallbackExtraction = false } = {}) {
  if (!text) return null;
  const trimmed = text.trim();

  // Try strict parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to fallback
  }

  if (!fallbackExtraction) {
    throw new Error('Invalid JSON (strict mode, no fallback)');
  }

  // Try markdown code block extraction
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // Try to find first { or [ and last matching } or ]
  const firstBrace = trimmed.search(/[{[]/);
  if (firstBrace >= 0) {
    const startChar = trimmed[firstBrace];
    const endChar = startChar === '{' ? '}' : ']';
    const lastBrace = trimmed.lastIndexOf(endChar);
    if (lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
  }

  throw new Error('Could not extract JSON from response');
}

// ─── Provider adapters ────────────────────────────────────────────────
async function callAnthropic({ model, system, messages, max_tokens, temperature }) {
  if (!anthropic) {
    throw new Error('Anthropic API-nyckel saknas. Ställ in ANTHROPIC_API_KEY.');
  }
  const response = await anthropic.messages.create({
    model,
    max_tokens,
    temperature,
    system,
    messages,
  });
  const text = (response.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
  const usage = response.usage || {};
  return {
    text,
    raw: response,
    meta: {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      model,
      provider: 'claude',
    },
  };
}

async function callOpenAI({ model, system, messages, max_tokens, temperature, responseFormat }) {
  if (!openai) {
    throw new Error('OpenAI API-nyckel saknas. Ställ in OPENAI_API_KEY.');
  }
  // Build OpenAI message array: system message + user messages
  const openaiMessages = [];
  if (system) openaiMessages.push({ role: 'system', content: system });
  for (const m of messages) {
    openaiMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    });
  }

  const params = {
    model,
    messages: openaiMessages,
    max_tokens: max_tokens || 4096,
    temperature,
  };
  if (responseFormat) params.response_format = responseFormat;

  const response = await openai.chat.completions.create(params);
  const text = response.choices?.[0]?.message?.content || '';
  const usage = response.usage || {};
  return {
    text,
    raw: response,
    meta: {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      model,
      provider: 'openai',
    },
  };
}

// ─── Retry helper ─────────────────────────────────────────────────────
async function withRetry(fn, { maxRetries = 2, label = 'ai' } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.error?.status;
      const isRetryable =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 529 ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT';
      if (isRetryable && attempt < maxRetries) {
        const delay = 1000 * (attempt + 1);
        console.warn(
          `[${label}] Retryable error (${status || err.code}), attempt ${attempt + 1}/${maxRetries}, waiting ${delay}ms...`
        );
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ─── Main entry: sendMessage ──────────────────────────────────────────
/**
 * Send a message via the active codeset's routing.
 *
 * @param {object} opts
 * @param {string} opts.promptKey - Task identifier (authorDNA, pass1, pass2, etc.)
 *                                  Used to pick provider + temperature + settings.
 * @param {string} [opts.system] - System prompt
 * @param {Array} opts.messages - User/assistant messages (Anthropic format)
 * @param {number} [opts.max_tokens=4096]
 * @param {boolean} [opts.cheap=false] - Use the cheap model variant (haiku/gpt-4o-mini)
 * @param {number} [opts.temperature] - Override codeset temperature
 * @param {boolean} [opts.allowFallback=true] - Try alternate provider if primary fails
 * @returns {Promise<{text, meta, raw, provider, model}>}
 *
 * Note: DNA profiles are persisted in the DB (User.authorDna, Project.storyDna)
 * and callers already skip regeneration when DNA exists — no in-memory cache here.
 */
export async function sendMessage({
  promptKey = 'default',
  system,
  messages,
  max_tokens = 4096,
  cheap = false,
  temperature,
  allowFallback = true,
}) {
  const codeset = await getActiveCodeset();
  const call = resolveCall(codeset, promptKey, { cheap });
  const effectiveTemp = temperature ?? call.temperature;

  // Prepend shared system rules (light-touch; don't duplicate)
  const rulesBlock = (call.systemRules || []).join(' ');
  const systemWithRules =
    system && !system.includes('Return ONLY valid JSON')
      ? `${system}\n\nREGLER: ${rulesBlock}`
      : system;

  const primaryCall = () =>
    call.provider === 'openai'
      ? callOpenAI({
          model: call.model,
          system: systemWithRules,
          messages,
          max_tokens,
          temperature: effectiveTemp,
          responseFormat: call.responseFormat,
        })
      : callAnthropic({
          model: call.model,
          system: systemWithRules,
          messages,
          max_tokens,
          temperature: effectiveTemp,
        });

  try {
    const result = await withRetry(primaryCall, {
      maxRetries: 2,
      label: `aiProvider:${call.provider}:${promptKey}`,
    });
    return result;
  } catch (primaryErr) {
    console.warn(
      `[aiProvider] Primary provider (${call.provider}) failed for ${promptKey}: ${primaryErr.message}`
    );

    if (!allowFallback) throw primaryErr;

    // Fallback: try the OTHER provider
    const altProvider = call.provider === 'claude' ? 'openai' : 'claude';
    const altModelSet = MODELS[altProvider];
    if (!altModelSet) throw primaryErr;
    const altModel = cheap ? altModelSet.cheap : altModelSet.default;

    const hasAltClient = altProvider === 'openai' ? !!openai : !!anthropic;
    if (!hasAltClient) {
      console.warn(`[aiProvider] Fallback provider ${altProvider} has no API key — re-throwing`);
      throw primaryErr;
    }

    console.log(`[aiProvider] Falling back to ${altProvider} for ${promptKey}`);
    const fallbackCall = () =>
      altProvider === 'openai'
        ? callOpenAI({
            model: altModel,
            system: systemWithRules,
            messages,
            max_tokens,
            temperature: Math.max(0.1, effectiveTemp - 0.1),
            responseFormat: { type: 'json_object' },
          })
        : callAnthropic({
            model: altModel,
            system: systemWithRules,
            messages,
            max_tokens,
            temperature: Math.max(0.1, effectiveTemp - 0.1),
          });

    const result = await withRetry(fallbackCall, {
      maxRetries: 1,
      label: `aiProvider:fallback:${altProvider}:${promptKey}`,
    });
    return result;
  }
}

// ─── Compatibility helpers (mirror ai.js old API) ─────────────────────
export function extractText(response) {
  // Support both new unified format {text, meta, raw} and legacy Anthropic response
  if (response?.text != null) return response.text;
  if (response?.content) {
    return response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
  }
  return '';
}

export function extractMeta(response, fallbackModel = 'claude-sonnet-4-20250514') {
  if (response?.meta) return response.meta;
  const usage = response?.usage || {};
  return {
    inputTokens: usage.input_tokens || usage.prompt_tokens || 0,
    outputTokens: usage.output_tokens || usage.completion_tokens || 0,
    model: fallbackModel,
    provider: 'claude',
  };
}

export { CODESETS };
