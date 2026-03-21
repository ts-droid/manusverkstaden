/**
 * Export Utility
 *
 * Exports manuscript with review suggestions in various formats.
 *
 * TODO: Implement actual docx generation with docx.js
 * TODO: Add Track Changes markup support
 * TODO: Add PDF export
 */

/**
 * Export manuscript with accepted changes applied and
 * pending suggestions as Track Changes.
 *
 * @param {Object} project - Project metadata
 * @param {Array} chapters - Chapters with suggestions
 * @param {Object} options - Export options
 * @returns {Blob} The generated file
 */
export async function exportToDocx(project, chapters, options = {}) {
  // Placeholder - will use docx.js library
  throw new Error('Docx-export är under utveckling. Kommer snart!');
}

/**
 * Export as markdown with suggestion annotations.
 *
 * @param {Object} project - Project metadata
 * @param {Array} chapters - Chapters with suggestions
 * @returns {string} Markdown string
 */
export function exportToMarkdown(project, chapters) {
  const lines = [];

  lines.push(`# ${project.title}`);
  lines.push('');
  lines.push(`*Exporterad från Manusverkstaden*`);
  lines.push('');

  for (const chapter of chapters) {
    lines.push(`## ${chapter.title}`);
    lines.push('');

    // Apply accepted changes, annotate pending
    let text = chapter.content;

    const acceptedSuggestions = chapter.suggestions?.filter((s) => s.status === 'accepted') || [];
    const pendingSuggestions = chapter.suggestions?.filter((s) => s.status === 'pending') || [];

    // Apply accepted changes
    for (const s of acceptedSuggestions) {
      if (s.original && s.replacement) {
        text = text.replace(s.original, s.replacement);
      }
    }

    lines.push(text);
    lines.push('');

    // Add pending suggestions as comments
    if (pendingSuggestions.length > 0) {
      lines.push('### Kvarstående förslag');
      lines.push('');
      for (const s of pendingSuggestions) {
        const priority = s.priority === 'red' ? '🔴' : s.priority === 'yellow' ? '🟡' : '🟢';
        lines.push(`${priority} **${s.original}**`);
        if (s.replacement) {
          lines.push(`  → *${s.replacement}*`);
        }
        lines.push(`  ${s.reason}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Export translation with parallel text.
 *
 * @param {Object} chapter - Chapter with translations
 * @param {string} language - Target language code
 * @returns {string} Markdown with parallel text
 */
export function exportTranslation(chapter, language) {
  const translation = chapter.translations?.find((t) => t.language === language);
  if (!translation) {
    throw new Error(`Ingen översättning till ${language} finns för detta kapitel.`);
  }

  const lines = [];
  lines.push(`## ${chapter.title}`);
  lines.push('');
  lines.push('### Original (svenska)');
  lines.push(chapter.content);
  lines.push('');
  lines.push(`### Översättning (${language})`);
  lines.push(translation.content);
  lines.push('');

  if (translation.comments?.length > 0) {
    lines.push('### Översättningskommentarer');
    for (const comment of translation.comments) {
      lines.push(`- "${comment.original}" → ${comment.note}`);
    }
    lines.push('');
  }

  if (translation.glossary) {
    lines.push('### Ordlista');
    lines.push('| Original | Översättning | Anmärkning |');
    lines.push('|----------|-------------|------------|');
    for (const entry of translation.glossary) {
      lines.push(`| ${entry.original} | ${entry.translated} | ${entry.note || ''} |`);
    }
  }

  return lines.join('\n');
}
