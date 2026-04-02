/**
 * Manuscript Parser
 *
 * Parses uploaded manuscript files (docx, txt) into structured
 * chapter data for the application.
 *
 * Supports .txt, .docx, and .pdf formats
 */

/**
 * Parse a manuscript file into chapters.
 * @param {File} file - The uploaded file
 * @returns {Promise<Array>} Array of chapter objects
 */
export async function parseManuscript(file) {
  const extension = file.name.split('.').pop().toLowerCase();

  switch (extension) {
    case 'txt':
      return parseTxtFile(file);
    case 'docx':
      return parseDocxFile(file);
    case 'pdf':
      return parsePdfFile(file);
    default:
      throw new Error(`Filformat "${extension}" stöds inte. Använd .docx, .pdf eller .txt.`);
  }
}

/**
 * Clean imported text — remove invisible Unicode characters, normalize
 * whitespace, and ensure consistent formatting BEFORE chapter splitting.
 * This prevents offset-drift in search, AI matching issues, and hidden chars.
 */
function cleanTextForImport(text) {
  return text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')                          // Normalize line endings
    .replace(/\t/g, ' ')                                                    // Tabs → spaces
    .replace(/[\u200B\u200C\u200D\u00AD\uFEFF\u2060\u200E\u200F]/g, '')   // Remove invisible chars
    .replace(/\u00A0/g, ' ')                                                // Non-breaking → regular space
    .replace(/([^\n]) {2,}/g, '$1 ')                                       // Collapse multiple spaces
    .replace(/[\u2010\u2011]/g, '-')                                       // Hyphen variants → regular
    .replace(/\u2012/g, '\u2013')                                          // Figure dash → en-dash
    .replace(/[ \t]+$/gm, '')                                              // Trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n')                                            // 3+ newlines → 2
    .replace(/^\d{1,4}\s*$/gm, '')                                         // Remove standalone page numbers (lines with only 1-4 digits)
    .replace(/\n{3,}/g, '\n\n')                                            // Re-collapse after page number removal
    .trim();
}

/**
 * Parse a plain text file.
 * Splits on common chapter markers.
 */
async function parseTxtFile(file) {
  const text = await file.text();
  return splitIntoChapters(cleanTextForImport(text));
}

/**
 * Parse a .docx file using mammoth.js.
 * Falls back to plain text extraction.
 */
async function parseDocxFile(file) {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const mammothModule = await import('mammoth');
      const mammoth = mammothModule.default || mammothModule;
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return splitIntoChapters(cleanTextForImport(result.value));
    } catch (error) {
      console.error(`Docx parsing failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw new Error('Kunde inte läsa .docx-filen. Kontrollera att filen inte är skadad.');
    }
  }
}

/**
 * Parse a .pdf file using pdf.js.
 * Extracts text from all pages.
 */
async function parsePdfFile(file) {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      return splitIntoChapters(cleanTextForImport(fullText));
    } catch (error) {
      console.error(`PDF parsing failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw new Error('Kunde inte läsa PDF-filen. Kontrollera att filen inte är skadad.');
    }
  }
}

/**
 * Split raw text into chapters based on common patterns.
 * Detects: "Kapitel X", "Chapter X", numbered chapters, etc.
 */
function splitIntoChapters(text) {
  // Normalize line breaks and clean up whitespace
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Swedish ordinal words for chapter matching
  // Swedish ordinal words — LONGEST FIRST to prevent partial matching
  // (e.g. "tjugoförsta" must match before "första")
  const SWEDISH_ORDINALS = "trettionde|tjugonionde|tjugo[åa]ttonde|tjugosjunde|tjugosj[äa]tte|tjugofemte|tjugofj[äa]rde|tjugotredje|tjugoandra|tjugof[öo]rsta|tjugonde|nittonde|artonde|sjuttonde|sextonde|femtonde|fjortonde|trettonde|tolfte|elfte|tionde|nionde|[åa]ttonde|sjunde|sj[äa]tte|femte|fj[äa]rde|tredje|andra|f[öo]rsta";

  // Map ordinal words to numbers for display
  const ordinalToNumber = (word) => {
    const w = word.toLowerCase().replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/å/g, 'a');
    const map = { forsta: 1, andra: 2, tredje: 3, fjarde: 4, femte: 5, sjatte: 6, sjunde: 7, attonde: 8, nionde: 9, tionde: 10, elfte: 11, tolfte: 12, trettonde: 13, fjortonde: 14, femtonde: 15, sextonde: 16, sjuttonde: 17, artonde: 18, nittonde: 19, tjugonde: 20, tjugoforsta: 21, tjugoandra: 22, tjugotredje: 23, tjugofjarde: 24, tjugofemte: 25, tjugosjatte: 26, tjugosjunde: 27, tjugoattonde: 28, tjugonionde: 29, trettionde: 30 };
    return map[w] || null;
  };

  // Pre-process: ensure chapter headings get their own line.
  // Mammoth/PDF extractors may merge headings with body text, losing the \n boundary.
  const chapterWordPattern = new RegExp(`([^\\n])((?:${SWEDISH_ORDINALS})\\s+kapitlet)`, 'gi');
  normalized = normalized
    .replace(/([^\n])(KAPITEL\s+\d+)/gi, '$1\n$2')
    .replace(/([^\n])(Chapter\s+\d+)/gi, '$1\n$2')
    .replace(chapterWordPattern, '$1\n$2');

  // Combined chapter heading pattern — matches both "Kapitel X" and "Xte kapitlet" in a single pass
  // This ensures we find ALL chapters even if the document mixes numeric and ordinal formats
  const ordinalChapterPattern = new RegExp(`(?:^|\\n)\\s*((${SWEDISH_ORDINALS})\\s+kapitlet[^\\n]*)`, 'gi');
  const numericChapterPattern = /(?:^|\n)\s*((?:KAPITEL|Kapitel|kapitel|Chapter|chapter)\s+\d+[^\n]*)/gi;

  // Collect all chapter-style matches from both patterns
  numericChapterPattern.lastIndex = 0;
  ordinalChapterPattern.lastIndex = 0;
  const numericMatches = [...normalized.matchAll(numericChapterPattern)];
  const ordinalMatches = [...normalized.matchAll(ordinalChapterPattern)];

  // Merge and sort by position in text
  let bestSplits = [...numericMatches, ...ordinalMatches];
  bestSplits.sort((a, b) => a.index - b.index);

  // Fallback patterns if no chapter-style matches found
  if (bestSplits.length < 2) {
    const fallbackPatterns = [
      /(?:^|\n)\s*(\d+\.\s+[A-ZÅÄÖ][^\n]*)/g,
      /^(#{1,2}\s+[^\n]+)/gm, // Markdown headings
    ];
    for (const pattern of fallbackPatterns) {
      pattern.lastIndex = 0;
      const matches = [...normalized.matchAll(pattern)];
      if (matches.length > 1 && matches.length > bestSplits.length) {
        bestSplits = matches;
      }
    }
  }

  if (!bestSplits || bestSplits.length < 2) {
    // No chapter markers found - treat as single chapter or split by size
    return splitByWordCount(normalized, 5000);
  }

  const chapters = [];
  for (let i = 0; i < bestSplits.length; i++) {
    const matchStr = bestSplits[i][0];
    const captureStart = bestSplits[i].index + matchStr.indexOf(bestSplits[i][1]);
    const title = bestSplits[i][1].trim();

    // Content starts AFTER the chapter heading line
    const headingEnd = captureStart + title.length;
    const contentStart = normalized.indexOf('\n', headingEnd);
    const start = contentStart !== -1 ? contentStart + 1 : headingEnd;
    const end = i + 1 < bestSplits.length
      ? bestSplits[i + 1].index + bestSplits[i + 1][0].indexOf(bestSplits[i + 1][1])
      : normalized.length;
    const content = normalized.slice(start, end).trim();

    if (content.length === 0) continue; // Skip empty chapters (heading-only)

    // Extract chapter number from heading for proper ordering (don't change the title)
    let chapterNumber = i + 1; // fallback to parse order

    // Check ordinal format: "Tjugoandra kapitlet" → number 22
    const ordinalMatch = title.match(new RegExp(`^(${SWEDISH_ORDINALS})\\s+kapitlet`, 'i'));
    if (ordinalMatch) {
      const num = ordinalToNumber(ordinalMatch[1]);
      if (num) chapterNumber = num;
    }

    // Check numeric format: "Kapitel 19" → number 19
    const numericMatch = title.match(/(?:kapitel|chapter)\s+(\d+)/i);
    if (numericMatch) {
      chapterNumber = parseInt(numericMatch[1], 10);
    }

    chapters.push({
      id: chapterNumber,
      number: chapterNumber,
      title: title,
      content,
      wordCount: countWords(content),
      status: 'pending',
    });
  }

  // Sort by chapter number and deduplicate (in case TOC entries were matched)
  chapters.sort((a, b) => a.number - b.number);

  // Deduplicate: if two chapters share the same number, keep the one with more content
  const deduped = [];
  for (const ch of chapters) {
    const existing = deduped.find(d => d.number === ch.number);
    if (existing) {
      if (ch.wordCount > existing.wordCount) {
        deduped[deduped.indexOf(existing)] = ch;
      }
    } else {
      deduped.push(ch);
    }
  }

  // Re-assign sequential IDs
  return deduped.map((ch, idx) => ({ ...ch, id: idx + 1 }));
}

/**
 * Fallback: split text into chunks of approximately targetWords words.
 */
function splitByWordCount(text, targetWords) {
  const paragraphs = text.split(/\n\s*\n/);
  const chapters = [];
  let currentChapter = [];
  let currentWordCount = 0;
  let chapterNum = 1;

  for (const para of paragraphs) {
    const words = countWords(para);
    currentChapter.push(para);
    currentWordCount += words;

    if (currentWordCount >= targetWords) {
      const content = currentChapter.join('\n\n');
      chapters.push({
        id: chapterNum,
        number: chapterNum,
        title: `Avsnitt ${chapterNum}`,
        content,
        wordCount: currentWordCount,
        status: 'pending',
      });
      currentChapter = [];
      currentWordCount = 0;
      chapterNum++;
    }
  }

  // Remaining text
  if (currentChapter.length > 0) {
    const content = currentChapter.join('\n\n');
    chapters.push({
      id: chapterNum,
      number: chapterNum,
      title: `Avsnitt ${chapterNum}`,
      content,
      wordCount: countWords(content),
      status: 'pending',
    });
  }

  return chapters;
}

/**
 * Count words in a text string.
 */
export function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * Split chapter text into paragraphs for the editor.
 */
export function splitIntoParagraphs(chapterContent) {
  const raw = chapterContent
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  // Dedup consecutive identical paragraphs (from develop-insert bugs)
  const deduped = [];
  for (let i = 0; i < raw.length; i++) {
    if (i > 0 && raw[i] === raw[i - 1]) continue;
    deduped.push(raw[i]);
  }

  return deduped.map((text, index) => ({
    id: `p${index}`,
    text,
    suggestions: [],
  }));
}
