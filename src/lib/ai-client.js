/**
 * AI Client
 *
 * Wrapper for Anthropic Claude API calls.
 * In production, these calls should go through a backend proxy
 * to avoid exposing the API key in the frontend.
 *
 * TODO: Replace direct API calls with backend endpoints
 */

const API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Send a message to Claude API.
 * @param {Object} params - API request parameters
 * @param {string} params.model - Model to use
 * @param {number} params.max_tokens - Max tokens in response
 * @param {string} params.system - System prompt
 * @param {Array} params.messages - Conversation messages
 * @returns {Promise<Object>} API response
 */
export async function sendMessage({ model, max_tokens, system, messages }) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('No API key configured. Using demo mode.');
    return null;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI Client error:', error);
    throw error;
  }
}

/**
 * Extract text content from API response.
 * @param {Object} response - API response
 * @returns {string} Combined text content
 */
export function extractText(response) {
  if (!response?.content) return '';
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * Parse JSON from AI response text.
 * Handles markdown code fences and other formatting.
 * @param {string} text - Raw response text
 * @returns {Object|null} Parsed JSON or null
 */
export function parseJsonResponse(text) {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Sanitize replacement fields – remove AI meta-instructions
    if (parsed?.suggestions) {
      parsed.suggestions = parsed.suggestions.map(s => ({
        ...s,
        replacement: s.replacement ? s.replacement
          .replace(/\s*\(genomgående[^)]*\)/gi, '')
          .replace(/\s*\(ändra överallt[^)]*\)/gi, '')
          .replace(/\s*\(i hela texten[^)]*\)/gi, '')
          .replace(/\s*\(genom hela[^)]*\)/gi, '')
          .replace(/\s*\(konsekvent[^)]*\)/gi, '')
          .replace(/\s*\(ändra genom[^)]*\)/gi, '')
          .replace(/\s*\(bör ändras[^)]*\)/gi, '')
          .trim() : s.replacement,
      }));
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    return null;
  }
}
