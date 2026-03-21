/**
 * Export Utility
 *
 * Generates print-ready .docx files with typography options.
 * Also supports markdown export with suggestion annotations.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageNumber,
  NumberFormat,
  Header,
  Footer,
  PageBreak,
  SectionType,
} from 'docx';

/**
 * Margin presets in twips (1 cm = 567 twips).
 */
const MARGIN_PRESETS = {
  normal: { top: 1440, right: 1440, bottom: 1440, left: 1440 },       // 2.54 cm
  wide: { top: 1800, right: 1800, bottom: 1800, left: 1800 },         // 3.17 cm
  narrow: { top: 1080, right: 1080, bottom: 1080, left: 1080 },       // 1.91 cm
};

/**
 * Apply accepted suggestions to chapter text.
 */
function applyAcceptedChanges(text, paragraphs, accepted) {
  let result = text;
  if (!paragraphs) return result;

  for (const para of paragraphs) {
    if (!para.suggestions) continue;
    for (const s of para.suggestions) {
      if (accepted.has(s.id) && s.original && s.replacement) {
        result = result.replace(s.original, s.replacement);
      }
    }
  }
  return result;
}

/**
 * Format a chapter title based on style options.
 */
function formatTitle(title, options) {
  const style = options.chapterTitleStyle || 'bold';
  let text = title;
  if (style === 'uppercase' || style === 'both') {
    text = text.toUpperCase();
  }
  const isBold = style === 'bold' || style === 'both';

  return new Paragraph({
    spacing: { before: 400, after: 300 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text,
        bold: isBold,
        font: options.font,
        size: (options.fontSize + 6) * 2, // title is 6pt larger, size in half-points
      }),
    ],
  });
}

/**
 * Export manuscript as .docx with typography options.
 *
 * @param {Object} params
 * @param {string} params.title - Manuscript title
 * @param {Array} params.chapters - Chapter objects
 * @param {Object} params.paragraphsByChapter - Paragraphs mapped by chapter ID
 * @param {Set} params.accepted - Accepted suggestion IDs
 * @param {Set} params.rejected - Rejected suggestion IDs
 * @param {Object} params.options - Typography options
 * @returns {Promise<Blob>} DOCX blob
 */
export async function exportToDocx({ title, chapters, paragraphsByChapter, accepted, rejected, options = {} }) {
  const {
    font = 'Times New Roman',
    fontSize = 12,
    lineSpacing = 1.5,
    margins = 'normal',
    chapterTitleStyle = 'both',
    pageNumbers = true,
  } = options;

  const marginValues = MARGIN_PRESETS[margins] || MARGIN_PRESETS.normal;
  const sizeHalfPts = fontSize * 2;
  // Line spacing: docx uses 240 twips per single line
  const lineSpacingTwips = Math.round(240 * lineSpacing);

  // ─── Title page ───
  const titlePageChildren = [
    new Paragraph({ spacing: { before: 4000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          font,
          size: 56, // 28pt
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Exporterad från Manusverkstaden',
          font,
          size: 22,
          italics: true,
          color: '888888',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }),
          font,
          size: 20,
          color: '888888',
        }),
      ],
    }),
  ];

  // ─── Chapter sections ───
  const chapterSections = chapters.map((chapter, chapterIdx) => {
    const paras = paragraphsByChapter?.[chapter.id] || [];
    const processedText = applyAcceptedChanges(chapter.content, paras, accepted);
    const textParagraphs = processedText.split(/\n\s*\n/).filter(p => p.trim());

    const children = [
      // Chapter title
      formatTitle(chapter.title, { font, fontSize, chapterTitleStyle }),
      // Body paragraphs
      ...textParagraphs.map(text => new Paragraph({
        spacing: { line: lineSpacingTwips, after: Math.round(lineSpacingTwips * 0.5) },
        indent: { firstLine: 720 }, // 1.27 cm indent
        children: [
          new TextRun({
            text: text.trim(),
            font,
            size: sizeHalfPts,
          }),
        ],
      })),
    ];

    return {
      properties: {
        type: chapterIdx === 0 ? SectionType.NEXT_PAGE : SectionType.NEXT_PAGE,
        page: {
          margin: marginValues,
          pageNumbers: pageNumbers ? { start: chapterIdx === 0 ? 1 : undefined } : undefined,
        },
      },
      children,
    };
  });

  // ─── Footer with page numbers ───
  const footerConfig = pageNumbers ? {
    default: new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              children: [PageNumber.CURRENT],
              font,
              size: 18,
              color: '999999',
            }),
          ],
        }),
      ],
    }),
  } : {};

  // ─── Build document ───
  const doc = new Document({
    sections: [
      // Title page
      {
        properties: {
          page: { margin: marginValues },
          titlePage: true,
        },
        headers: {},
        footers: {},
        children: titlePageChildren,
      },
      // Chapters
      ...chapterSections.map(section => ({
        ...section,
        footers: footerConfig,
      })),
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Trigger file download in the browser.
 * @param {Blob} blob - File data
 * @param {string} filename - Download filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export as markdown with suggestion annotations.
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

    let text = chapter.content;

    const acceptedSuggestions = chapter.suggestions?.filter((s) => s.status === 'accepted') || [];
    const pendingSuggestions = chapter.suggestions?.filter((s) => s.status === 'pending') || [];

    for (const s of acceptedSuggestions) {
      if (s.original && s.replacement) {
        text = text.replace(s.original, s.replacement);
      }
    }

    lines.push(text);
    lines.push('');

    if (pendingSuggestions.length > 0) {
      lines.push('### Kvarstående förslag');
      lines.push('');
      for (const s of pendingSuggestions) {
        const priority = s.priority === 'red' ? '\u{1F534}' : s.priority === 'yellow' ? '\u{1F7E1}' : '\u{1F7E2}';
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
