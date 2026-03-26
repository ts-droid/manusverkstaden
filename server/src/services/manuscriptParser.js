import mammoth from 'mammoth';

/**
 * Parse an uploaded file (from multer) into chapters.
 */
export async function parseUploadedFile(file) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();

  let text = '';

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    text = result.value;
  } else if (ext === 'txt') {
    text = file.buffer.toString('utf-8');
  } else {
    throw new Error(`Filtypen .${ext} stöds inte. Använd .docx eller .txt`);
  }

  return splitIntoChapters(text);
}

/**
 * Split text into chapters based on Swedish chapter markers.
 */
function splitIntoChapters(text) {
  const chapterPattern = /^(KAPITEL|Kapitel|kapitel|CHAPTER|Chapter)\s+(\d+)/gm;
  const markers = [];
  let match;

  while ((match = chapterPattern.exec(text)) !== null) {
    markers.push({ index: match.index, title: match[0].trim() });
  }

  if (markers.length === 0) {
    // No chapter markers found – split by word count
    return splitByWordCount(text, 5000);
  }

  const chapters = [];
  for (let i = 0; i < markers.length; i++) {
    const headingEnd = markers[i].index + markers[i].title.length;
    const contentStart = text.indexOf('\n', headingEnd);
    const start = contentStart !== -1 ? contentStart + 1 : headingEnd;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    const words = content.split(/\s+/).filter(w => w).length;

    if (content.length === 0) continue; // Skip heading-only entries

    chapters.push({
      title: markers[i].title,
      content,
      wordCount: words,
    });
  }

  return chapters;
}

/**
 * Fallback: split text into chunks of approximately `maxWords` words.
 */
function splitByWordCount(text, maxWords) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  const chapters = [];
  let current = [];
  let currentWords = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).length;
    if (currentWords + words > maxWords && current.length > 0) {
      const content = current.join('\n\n');
      chapters.push({
        title: `Del ${chapters.length + 1}`,
        content,
        wordCount: currentWords,
      });
      current = [];
      currentWords = 0;
    }
    current.push(para.trim());
    currentWords += words;
  }

  if (current.length > 0) {
    const content = current.join('\n\n');
    chapters.push({
      title: `Del ${chapters.length + 1}`,
      content,
      wordCount: currentWords,
    });
  }

  return chapters;
}
