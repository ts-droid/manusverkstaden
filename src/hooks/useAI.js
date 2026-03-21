import { useState, useCallback } from 'react';
import { sendMessage, extractText, parseJsonResponse } from '../lib/ai-client';
import { buildPrompt, buildReviewRequest } from '../lib/prompt-builder';

/**
 * Hook for AI operations (review, develop, translate).
 *
 * In demo mode (no API key), returns null from all operations.
 * The UI should detect this and use sample data.
 */
export function useAI({ project, genres, modules, translationLanguages }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const systemPrompt = buildPrompt({
    project,
    genres,
    modules: {
      develop: modules.includes('develop'),
      translate: modules.includes('translate'),
    },
    translationLanguages,
  });

  const reviewChapter = useCallback(
    async (chapterText) => {
      setLoading(true);
      setError(null);
      try {
        const request = buildReviewRequest(systemPrompt, chapterText);
        const response = await sendMessage(request);

        if (!response) {
          // Demo mode - no API key
          return null;
        }

        const text = extractText(response);
        return parseJsonResponse(text);
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [systemPrompt]
  );

  const generateDNAProfile = useCallback(
    async (fullManuscriptText) => {
      setLoading(true);
      setError(null);
      try {
        const response = await sendMessage({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt + '\n\nGenerera en språklig DNA-profil baserat på texten.',
          messages: [
            {
              role: 'user',
              content: `Analysera följande text och skapa en språklig DNA-profil:\n\n${fullManuscriptText.slice(0, 20000)}`,
            },
          ],
        });

        if (!response) return null;
        return parseJsonResponse(extractText(response));
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [systemPrompt]
  );

  const developText = useCallback(
    async (mode, input, context) => {
      setLoading(true);
      setError(null);
      try {
        const response = await sendMessage({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Läge: ${mode}\nKontext: ${context}\n\nInput:\n${input}`,
            },
          ],
        });

        if (!response) return null;
        return parseJsonResponse(extractText(response));
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [systemPrompt]
  );

  const translateChapter = useCallback(
    async (chapterText, targetLanguage) => {
      setLoading(true);
      setError(null);
      try {
        const response = await sendMessage({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Översätt följande text till ${targetLanguage}:\n\n${chapterText}`,
            },
          ],
        });

        if (!response) return null;
        return parseJsonResponse(extractText(response));
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [systemPrompt]
  );

  return {
    loading,
    error,
    reviewChapter,
    generateDNAProfile,
    developText,
    translateChapter,
    systemPrompt, // Exposed for debugging
  };
}
