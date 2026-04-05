/**
 * Export Utility
 *
 * Two-stage pipeline for print-ready .docx files:
 *   1. sanitizeText()  — Remove hidden characters, fix line breaks, validate
 *   2. formatForPrint() — Apply Swedish typographic standards
 *
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

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 1: SANITIZE — Clean hidden characters and structural problems
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitize text for export — removes all invisible/problematic characters
 * and structural issues. Returns { text, issues[] } where issues lists
 * everything that was found and fixed.
 */
export function sanitizeText(text) {
  const issues = [];
  let result = text;

  // ─── Line endings ───
  const crlfCount = (result.match(/\r\n/g) || []).length;
  const crCount = (result.match(/\r(?!\n)/g) || []).length;
  if (crlfCount || crCount) {
    issues.push({ type: 'lineEndings', count: crlfCount + crCount, desc: 'Radbrytningar normaliserade (Windows → Unix)' });
  }
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ─── Invisible Unicode characters ───
  const invisibles = result.match(/[\u200B\u200C\u200D\u00AD\uFEFF\u2060\u200E\u200F]/g);
  if (invisibles) {
    issues.push({ type: 'invisibleChars', count: invisibles.length, desc: `${invisibles.length} dolda Unicode-tecken borttagna` });
  }
  result = result.replace(/[\u200B\u200C\u200D\u00AD\uFEFF\u2060\u200E\u200F]/g, '');

  // ─── Tabs ───
  const tabCount = (result.match(/\t/g) || []).length;
  if (tabCount) {
    issues.push({ type: 'tabs', count: tabCount, desc: `${tabCount} tabbar ersatta med mellanslag` });
  }
  result = result.replace(/\t/g, ' ');

  // ─── Non-breaking spaces ───
  const nbspCount = (result.match(/\u00A0/g) || []).length;
  if (nbspCount) {
    issues.push({ type: 'nbsp', count: nbspCount, desc: `${nbspCount} hårda mellanslag normaliserade` });
  }
  result = result.replace(/\u00A0/g, ' ');

  // ─── Multiple spaces ───
  const multiSpaces = (result.match(/([^\n]) {2,}/g) || []).length;
  if (multiSpaces) {
    issues.push({ type: 'multiSpaces', count: multiSpaces, desc: `${multiSpaces} dubbla mellanslag kollapsade` });
  }
  result = result.replace(/([^\n]) {2,}/g, '$1 ');

  // ─── Single newlines within paragraphs (broken sentences) ───
  const singleNewlines = (result.match(/([^\n])\n(?=[^\n])/g) || []).length;
  if (singleNewlines) {
    issues.push({ type: 'brokenLines', count: singleNewlines, desc: `${singleNewlines} brutna rader sammanfogade` });
  }
  result = result.replace(/([^\n])\n(?=[^\n])/g, '$1 ');
  result = result.replace(/ {2,}/g, ' ');

  // ─── Excessive newlines ───
  const excessiveNewlines = (result.match(/\n{3,}/g) || []).length;
  if (excessiveNewlines) {
    issues.push({ type: 'excessiveNewlines', count: excessiveNewlines, desc: `${excessiveNewlines} överflödiga blankrader borttagna` });
  }
  result = result.replace(/\n{3,}/g, '\n\n');

  // ─── Trailing whitespace ───
  const trailingSpaces = (result.match(/[ \t]+$/gm) || []).length;
  if (trailingSpaces) {
    issues.push({ type: 'trailingSpaces', count: trailingSpaces, desc: `${trailingSpaces} rader med avslutande mellanslag rensade` });
  }
  result = result.replace(/[ \t]+$/gm, '');

  return { text: result.trim(), issues };
}


// ═══════════════════════════════════════════════════════════════════════════
// STAGE 2: FORMAT — Apply Swedish typographic standards for print
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format sanitized text according to Swedish typographic print standards.
 * Call AFTER sanitizeText().
 */
export function formatForPrint(text) {
  let result = text;

  // ─── Quotes: Swedish standard ───
  // Swedish uses "citattecken" (right double quotes on both sides)
  // or »guillemets» — we standardize to typographic double quotes
  result = result.replace(/[\u201C\u201D]/g, '\u201D');     // left/right double → right (Swedish "")
  result = result.replace(/[\u2018\u2019]/g, '\u2019');     // left/right single → right
  // Straight quotes → Swedish typographic quotes
  // "text" → \u201Dtext\u201D (only when clearly wrapping a word/phrase)
  result = result.replace(/"([^"]+)"/g, '\u201D$1\u201D');

  // ─── Dashes: Swedish standard ───
  // Hyphen variants → regular hyphen
  result = result.replace(/[\u2010\u2011]/g, '-');
  // Figure dash → en-dash
  result = result.replace(/\u2012/g, '\u2013');
  // Dialog marker: Swedish uses en-dash (–) with space, not em-dash
  // em-dash → en-dash (Swedish convention)
  result = result.replace(/\u2014/g, '\u2013');
  // Ensure space around en-dash when used as parenthetical
  result = result.replace(/(\S)\u2013(\S)/g, '$1 \u2013 $2');
  // But dialog lines start with – without preceding space
  result = result.replace(/^\u2013\s*/gm, '\u2013 ');

  // ─── Ellipsis: proper Unicode character ───
  result = result.replace(/\.{3}/g, '\u2026');

  // ─── Spaces before punctuation (remove) ───
  result = result.replace(/ +([.,;:!?])/g, '$1');

  // ─── Space after punctuation (ensure) ───
  // Add space after .,;:!? if followed by a letter (but not in numbers like 3.14)
  result = result.replace(/([.,;:!?])([A-Za-zÀ-ÿÅÄÖåäö])/g, '$1 $2');

  // ─── Non-breaking space before colon/semicolon (French style — optional for Swedish) ───
  // Swedish doesn't require this, but we ensure no double-space

  // ─── Number formatting ───
  // Thin space in large numbers: 1 000 000 (Swedish standard, not 1,000,000)
  // Only apply to numbers with 5+ digits to avoid breaking years (1962, 2024)
  result = result.replace(/\b(\d{1,3})(\d{3})(\d{3})\b/g, '$1\u00A0$2\u00A0$3');  // millions
  result = result.replace(/\b(\d{2,3})(\d{3})\b/g, '$1\u00A0$2');                  // 10 000 – 999 000

  // ─── Fix common word-processing artifacts ───
  // Double periods
  result = result.replace(/\.\.(?!\.)/g, '.');
  // Space before closing parenthesis / bracket
  result = result.replace(/ +\)/g, ')');
  // Space after opening parenthesis / bracket
  result = result.replace(/\( +/g, '(');

  return result;
}


// ═══════════════════════════════════════════════════════════════════════════
// LEGACY COMPAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combined clean function (used internally by exportToDocx).
 * Runs both stages.
 */
function cleanTextForExport(text) {
  const { text: sanitized } = sanitizeText(text);
  return formatForPrint(sanitized);
}


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


// ═══════════════════════════════════════════════════════════════════════════
// MARGIN & TYPOGRAPHY PRESETS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Margin presets in twips (1 cm = 567 twips).
 */
const MARGIN_PRESETS = {
  normal: { top: 1440, right: 1440, bottom: 1440, left: 1440 },       // 2.54 cm
  wide: { top: 1800, right: 1800, bottom: 1800, left: 1800 },         // 3.17 cm
  narrow: { top: 1080, right: 1080, bottom: 1080, left: 1080 },       // 1.91 cm
};

const ALIGN_MAP = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
};

const CHAPTER_START_SPACING = {
  direct: 400,    // small gap
  third: 4800,    // ~1/3 down the page
  half: 7200,     // ~1/2 down the page
};

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
  const alignment = ALIGN_MAP[options.chapterTitleAlign] || AlignmentType.CENTER;
  const startSpacing = CHAPTER_START_SPACING[options.chapterStartPosition] || CHAPTER_START_SPACING.third;

  return new Paragraph({
    spacing: { before: startSpacing, after: 300 },
    alignment,
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


// ═══════════════════════════════════════════════════════════════════════════
// DOCX EXPORT
// ═══════════════════════════════════════════════════════════════════════════

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
    chapterTitleAlign = 'center',
    pageNumbers = true,
    pageNumberPosition = 'center',
    firstLineIndent = 1.27,
    chapterStartPosition = 'third',
    headerStyle = 'none',
    authorName = '',
    paragraphSpacing = false,
  } = options;

  const marginValues = MARGIN_PRESETS[margins] || MARGIN_PRESETS.normal;
  const sizeHalfPts = fontSize * 2;
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

  /**
   * Parse markdown-style formatting into TextRun objects.
   * Supports *italic* and **bold**.
   */
  function parseFormattedText(str, baseFont, baseSize) {
    const runs = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        runs.push(new TextRun({ text: str.slice(lastIdx, match.index), font: baseFont, size: baseSize }));
      }
      if (match[2]) {
        runs.push(new TextRun({ text: match[2], font: baseFont, size: baseSize, bold: true }));
      } else if (match[3]) {
        runs.push(new TextRun({ text: match[3], font: baseFont, size: baseSize, italics: true }));
      }
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < str.length) {
      runs.push(new TextRun({ text: str.slice(lastIdx), font: baseFont, size: baseSize }));
    }
    return runs.length ? runs : [new TextRun({ text: str, font: baseFont, size: baseSize })];
  }

  // ─── Chapter sections ───
  const chapterSections = chapters.map((chapter, chapterIdx) => {
    const paras = paragraphsByChapter?.[chapter.id] || [];
    const rawText = applyAcceptedChanges(chapter.content, paras, accepted);

    // Two-stage pipeline: sanitize → format for print
    const processedText = cleanTextForExport(rawText);
    const textParagraphs = processedText.split(/\n\s*\n/).filter(p => p.trim());

    // Extract the actual chapter heading from content (first paragraph if it matches
    // a chapter heading pattern), to avoid duplicating "KAPITEL 1" + "FÖRSTA KAPITLET"
    const headingPattern = /^((?:kapitel|chapter)\s+\d+|(?:f[öo]rsta|andra|tredje|fj[äa]rde|femte|sj[äa]tte|sjunde|[åa]ttonde|nionde|tionde|elfte|tolfte|trettonde|fjortonde|femtonde|sextonde|sjuttonde|artonde|nittonde|tjugo\S*|trettio\S*|fyrtio\S*|femtio\S*)\s+kapitlet)$/i;
    let exportTitle = chapter.title;
    let bodyParagraphs = textParagraphs;

    if (textParagraphs.length > 0 && headingPattern.test(textParagraphs[0].trim())) {
      // Use the manuscript's own heading as the export title
      exportTitle = textParagraphs[0].trim();
      bodyParagraphs = textParagraphs.slice(1);
    }

    const indentTwips = Math.round(firstLineIndent * 567);

    const children = [
      formatTitle(exportTitle, { font, fontSize, chapterTitleStyle, chapterTitleAlign, chapterStartPosition }),
      ...bodyParagraphs.map(text => new Paragraph({
        spacing: { line: lineSpacingTwips, after: paragraphSpacing ? Math.round(lineSpacingTwips * 0.5) : 0 },
        indent: indentTwips > 0 ? { firstLine: indentTwips } : undefined,
        children: parseFormattedText(text.trim(), font, sizeHalfPts),
      })),
    ];

    return {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          margin: marginValues,
          pageNumbers: pageNumbers ? { start: chapterIdx === 0 ? 1 : undefined } : undefined,
        },
      },
      children,
    };
  });

  // ─── Header ───
  const pageNumAlignment = ALIGN_MAP[pageNumberPosition] || AlignmentType.CENTER;

  const headerConfig = headerStyle !== 'none' ? {
    default: new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: headerStyle === 'title' ? title
                : headerStyle === 'author' ? (authorName || '')
                : headerStyle === 'both' ? `${authorName || ''} \u2013 ${title}`
                : '',
              font,
              size: 16,
              color: '999999',
              italics: true,
            }),
          ],
        }),
      ],
    }),
  } : {};

  // ─── Footer with page numbers ───
  const footerConfig = pageNumbers ? {
    default: new Footer({
      children: [
        new Paragraph({
          alignment: pageNumAlignment,
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
      {
        properties: {
          page: { margin: marginValues },
          titlePage: true,
        },
        headers: {},
        footers: {},
        children: titlePageChildren,
      },
      ...chapterSections.map(section => ({
        ...section,
        headers: headerConfig,
        footers: footerConfig,
      })),
    ],
  });

  return await Packer.toBlob(doc);
}


// ═══════════════════════════════════════════════════════════════════════════
// OTHER EXPORT FORMATS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trigger file download in the browser.
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
