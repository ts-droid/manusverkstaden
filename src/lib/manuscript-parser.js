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
  // LONGEST FIRST to prevent partial matching (e.g. "tjugoförsta" before "första")
  // Uses \s* between prefix and suffix to handle both "tjugoandra" and "tjugo andra"
  const ONES = "f[öo]rsta|andra|tredje|fj[äa]rde|femte|sj[äa]tte|sjunde|[åa]ttonde|nionde";
  const TEENS = "tionde|elfte|tolfte|trettonde|fjortonde|femtonde|sextonde|sjuttonde|artonde|nittonde";
  const TWENTIES = `tjugo\\s*nionde|tjugo\\s*[åa]ttonde|tjugo\\s*sjunde|tjugo\\s*sj[äa]tte|tjugo\\s*femte|tjugo\\s*fj[äa]rde|tjugo\\s*tredje|tjugo\\s*andra|tjugo\\s*f[öo]rsta|tjugonde`;
  const THIRTIES = `trettio\\s*nionde|trettio\\s*[åa]ttonde|trettio\\s*sjunde|trettio\\s*sj[äa]tte|trettio\\s*femte|trettio\\s*fj[äa]rde|trettio\\s*tredje|trettio\\s*andra|trettio\\s*f[öo]rsta|trettionde`;
  const FORTIES = `fyrtio\\s*nionde|fyrtio\\s*[åa]ttonde|fyrtio\\s*sjunde|fyrtio\\s*sj[äa]tte|fyrtio\\s*femte|fyrtio\\s*fj[äa]rde|fyrtio\\s*tredje|fyrtio\\s*andra|fyrtio\\s*f[öo]rsta|fyrtionde`;
  const FIFTIES = `femtio\\s*nionde|femtio\\s*[åa]ttonde|femtio\\s*sjunde|femtio\\s*sj[äa]tte|femtio\\s*femte|femtio\\s*fj[äa]rde|femtio\\s*tredje|femtio\\s*andra|femtio\\s*f[öo]rsta|femtionde`;
  const SIXTIES = `sextio\\s*nionde|sextio\\s*[åa]ttonde|sextio\\s*sjunde|sextio\\s*sj[äa]tte|sextio\\s*femte|sextio\\s*fj[äa]rde|sextio\\s*tredje|sextio\\s*andra|sextio\\s*f[öo]rsta|sextionde`;
  const SEVENTIES = `sjuttio\\s*nionde|sjuttio\\s*[åa]ttonde|sjuttio\\s*sjunde|sjuttio\\s*sj[äa]tte|sjuttio\\s*femte|sjuttio\\s*fj[äa]rde|sjuttio\\s*tredje|sjuttio\\s*andra|sjuttio\\s*f[öo]rsta|sjuttionde`;
  const EIGHTIES = `[åa]ttio\\s*nionde|[åa]ttio\\s*[åa]ttonde|[åa]ttio\\s*sjunde|[åa]ttio\\s*sj[äa]tte|[åa]ttio\\s*femte|[åa]ttio\\s*fj[äa]rde|[åa]ttio\\s*tredje|[åa]ttio\\s*andra|[åa]ttio\\s*f[öo]rsta|[åa]ttionde`;
  const NINETIES = `nittio\\s*nionde|nittio\\s*[åa]ttonde|nittio\\s*sjunde|nittio\\s*sj[äa]tte|nittio\\s*femte|nittio\\s*fj[äa]rde|nittio\\s*tredje|nittio\\s*andra|nittio\\s*f[öo]rsta|nittionde`;
  const SWEDISH_ORDINALS = `${NINETIES}|${EIGHTIES}|${SEVENTIES}|${SIXTIES}|${FIFTIES}|${FORTIES}|${THIRTIES}|${TWENTIES}|${TEENS}|${ONES}`;

  // Map ordinal words to numbers for display
  const ordinalToNumber = (word) => {
    // Normalize: lowercase, strip accents, collapse whitespace
    const w = word.toLowerCase().replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/å/g, 'a').replace(/\s+/g, '');
    const map = {
      forsta: 1, andra: 2, tredje: 3, fjarde: 4, femte: 5, sjatte: 6, sjunde: 7, attonde: 8, nionde: 9,
      tionde: 10, elfte: 11, tolfte: 12, trettonde: 13, fjortonde: 14, femtonde: 15, sextonde: 16, sjuttonde: 17, artonde: 18, nittonde: 19,
      tjugonde: 20, tjugoforsta: 21, tjugoandra: 22, tjugotredje: 23, tjugofjarde: 24, tjugofemte: 25, tjugosjatte: 26, tjugosjunde: 27, tjugoattonde: 28, tjugonionde: 29,
      trettionde: 30, trettioforsta: 31, trettioandra: 32, trettiotredje: 33, trettiofjarde: 34, trettiofemte: 35, trettiosjatte: 36, trettiosjunde: 37, trettioattonde: 38, trettionionde: 39,
      fyrtionde: 40, fyrtioforsta: 41, fyrtioandra: 42, fyrtiotredje: 43, fyrtiofjarde: 44, fyrtiofemte: 45, fyrtiosjatte: 46, fyrtiosjunde: 47, fyrtioattonde: 48, fyrtionionde: 49,
      femtionde: 50, femtioforsta: 51, femtioandra: 52, femtiotredje: 53, femtiofjarde: 54, femtiofemte: 55, femtiosjatte: 56, femtiosjunde: 57, femtioattonde: 58, femtionionde: 59,
      sextionde: 60, sextioforsta: 61, sextioandra: 62, sextiotredje: 63, sextiofjarde: 64, sextiofemte: 65, sextiosjatte: 66, sextiosjunde: 67, sextioattonde: 68, sextionionde: 69,
      sjuttionde: 70, sjuttioforsta: 71, sjuttioandra: 72, sjuttiotredje: 73, sjuttiofjarde: 74, sjuttiofemte: 75, sjuttiosjatte: 76, sjuttiosjunde: 77, sjuttioattonde: 78, sjuttionionde: 79,
      attionde: 80, attioforsta: 81, attioandra: 82, attiotredje: 83, attiofjarde: 84, attiofemte: 85, attiosjatte: 86, attiosjunde: 87, attioattonde: 88, attionionde: 89,
      nittionde: 90, nittioforsta: 91, nittioandra: 92, nittiotredje: 93, nittiofjarde: 94, nittiofemte: 95, nittiosjatte: 96, nittiosjunde: 97, nittioattonde: 98, nittionionde: 99,
    };
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

  console.log(`[Parser] Found ${numericMatches.length} numeric + ${ordinalMatches.length} ordinal = ${bestSplits.length} chapter headings`);
  bestSplits.forEach((m, i) => console.log(`  [${i}] "${m[1]?.trim().slice(0, 50)}" @ pos ${m.index}`));

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

    if (content.length === 0) {
      console.log(`[Parser] Skipping empty chapter: "${title.slice(0, 50)}"`);
      continue;
    }

    // Extract chapter number from heading for proper ordering
    let chapterNumber = i + 1; // fallback to parse order
    let displayTitle = `Kapitel ${i + 1}`; // sidebar label

    // Check ordinal format: "Tjugoandra kapitlet" → number 22
    const ordinalMatch = title.match(new RegExp(`^(${SWEDISH_ORDINALS})\\s+kapitlet`, 'i'));
    if (ordinalMatch) {
      const num = ordinalToNumber(ordinalMatch[1]);
      if (num) {
        chapterNumber = num;
        displayTitle = `Kapitel ${num}`;
      }
    }

    // Check numeric format: "Kapitel 19" → number 19
    const numericMatch = title.match(/(?:kapitel|chapter)\s+(\d+)/i);
    if (numericMatch) {
      chapterNumber = parseInt(numericMatch[1], 10);
      displayTitle = `Kapitel ${chapterNumber}`;
    }

    // Include original heading in content so the manuscript text is unmodified
    const fullContent = title + '\n\n' + content;

    chapters.push({
      id: chapterNumber,
      number: chapterNumber,
      title: displayTitle,
      content: fullContent,
      wordCount: countWords(fullContent),
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
      console.log(`[Parser] Dedup: chapter ${ch.number} duplicate — keeping ${ch.wordCount > existing.wordCount ? 'new' : 'existing'} (${ch.wordCount} vs ${existing.wordCount} words)`);
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
