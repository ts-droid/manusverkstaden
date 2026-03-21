/**
 * Manuscript Parser
 *
 * Parses uploaded manuscript files (docx, txt) into structured
 * chapter data for the application.
 *
 * TODO: Implement actual docx parsing with mammoth.js
 * TODO: Add support for .odt, .rtf formats
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
    default:
      throw new Error(`Filformat "${extension}" stöds inte. Använd .docx eller .txt.`);
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
 * Split raw text into chapters based on common patterns.
 * Detects: "Kapitel X", "Chapter X", numbered chapters, etc.
 */
function splitIntoChapters(text) {
  // Common chapter heading patterns
  const chapterPatterns = [
    /^(Kapitel\s+\d+[^\n]*)/gim,
    /^(Chapter\s+\d+[^\n]*)/gim,
    /^(\d+\.\s+[A-ZÅÄÖ][^\n]*)/gm,
    /^(#{1,2}\s+[^\n]+)/gm, // Markdown headings
  ];

  let bestSplits = null;
  let bestPattern = null;

  for (const pattern of chapterPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 1 && (!bestSplits || matches.length > bestSplits.length)) {
      bestSplits = matches;
      bestPattern = pattern;
    }
  }

  if (!bestSplits || bestSplits.length < 2) {
    // No chapter markers found - treat as single chapter or split by size
    return splitByWordCount(text, 5000);
  }

  const chapters = [];
  for (let i = 0; i < bestSplits.length; i++) {
    const start = bestSplits[i].index;
    const end = i + 1 < bestSplits.length ? bestSplits[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
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
