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
 * Parse a plain text file.
 * Splits on common chapter markers.
 */
async function parseTxtFile(file) {
  const text = await file.text();
  return splitIntoChapters(text);
}

/**
 * Parse a .docx file using mammoth.js.
 * Falls back to plain text extraction.
 */
async function parseDocxFile(file) {
  try {
    // Dynamic import of mammoth for docx parsing
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return splitIntoChapters(result.value);
  } catch (error) {
    console.error('Docx parsing failed:', error);
    throw new Error('Kunde inte läsa .docx-filen. Kontrollera att filen inte är skadad.');
  }
}

/**
 * Parse a .pdf file using pdf.js.
 * Extracts text from all pages.
 */
async function parsePdfFile(file) {
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
    return splitIntoChapters(fullText);
  } catch (error) {
    console.error('PDF parsing failed:', error);
    throw new Error('Kunde inte läsa PDF-filen. Kontrollera att filen inte är skadad.');
  }
}

/**
 * Split raw text into chapters based on common patterns.
 * Detects: "Kapitel X", "Chapter X", numbered chapters, etc.
 */
function splitIntoChapters(text) {
  // Normalize line breaks and clean up whitespace
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Common chapter heading patterns - order matters, most specific first
  // The key fix: match KAPITEL/Chapter headings even if not at absolute line start
  // (mammoth/pdf extractors may add spaces or merge lines)
  const chapterPatterns = [
    /(?:^|\n)\s*(KAPITEL\s+\d+[^\n]*)/gi,
    /(?:^|\n)\s*(Kapitel\s+\d+[^\n]*)/g,
    /(?:^|\n)\s*(Chapter\s+\d+[^\n]*)/gi,
    /(?:^|\n)\s*(\d+\.\s+[A-ZÅÄÖ][^\n]*)/g,
    /^(#{1,2}\s+[^\n]+)/gm, // Markdown headings
  ];

  let bestSplits = null;
  let bestPattern = null;

  for (const pattern of chapterPatterns) {
    pattern.lastIndex = 0; // Reset regex state
    const matches = [...normalized.matchAll(pattern)];
    if (matches.length > 1 && (!bestSplits || matches.length > bestSplits.length)) {
      bestSplits = matches;
      bestPattern = pattern;
    }
  }

  if (!bestSplits || bestSplits.length < 2) {
    // No chapter markers found - treat as single chapter or split by size
    return splitByWordCount(normalized, 5000);
  }

  const chapters = [];
  for (let i = 0; i < bestSplits.length; i++) {
    // Use the index of the actual chapter title (capture group 1), not the newline prefix
    const matchStr = bestSplits[i][0];
    const captureStart = bestSplits[i].index + matchStr.indexOf(bestSplits[i][1]);
    const start = captureStart;
    const end = i + 1 < bestSplits.length
      ? bestSplits[i + 1].index + bestSplits[i + 1][0].indexOf(bestSplits[i + 1][1])
      : normalized.length;
    const content = normalized.slice(start, end).trim();
    const title = bestSplits[i][1].trim();

    chapters.push({
      id: i + 1,
      number: i + 1,
      title,
      content,
      wordCount: countWords(content),
      status: 'pending',
    });
  }

  return chapters;
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
  return chapterContent
    .split(/\n\s*\n/)
    .map((text, index) => ({
      id: `p${index}`,
      text: text.trim(),
      suggestions: [],
    }))
    .filter((p) => p.text.length > 0);
}
