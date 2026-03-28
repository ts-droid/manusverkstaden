import mammoth from 'mammoth';

/**
 * Clean imported text — remove invisible Unicode characters, normalize
 * whitespace, and ensure consistent formatting BEFORE chapter splitting.
 */
function cleanTextForImport(text) {
  return text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u200B\u200C\u200D\u00AD\uFEFF\u2060\u200E\u200F]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/([^\n]) {2,}/g, '$1 ')
    .replace(/[\u2010\u2011]/g, '-')
    .replace(/\u2012/g, '\u2013')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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

  return splitIntoChapters(cleanTextForImport(text));
}

/**
 * Split text into chapters based on Swedish chapter markers.
 */
/**
 * Build chapter objects from detected heading markers.
 */
function buildChaptersFromMarkers(text, markers) {
  const chapters = [];
  for (let i = 0; i < markers.length; i++) {
    const headingEnd = markers[i].index + markers[i].title.length;
    const contentStart = text.indexOf('\n', headingEnd);
    const start = contentStart !== -1 ? contentStart + 1 : headingEnd;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    const words = content.split(/\s+/).filter(w => w).length;
    if (content.length === 0) continue;
    chapters.push({ title: markers[i].title, content, wordCount: words });
  }
  return chapters.length > 0 ? chapters : splitByWordCount(text, 5000);
}

function splitIntoChapters(text) {
  // Swedish ordinal words for chapter matching
  // LONGEST FIRST to prevent partial matching (e.g. "tjugoförsta" before "första")
  const SWEDISH_ORDINALS = "trettionde|tjugonionde|tjugo[åa]ttonde|tjugosjunde|tjugosj[äa]tte|tjugofemte|tjugofj[äa]rde|tjugotredje|tjugoandra|tjugof[öo]rsta|tjugonde|nittonde|artonde|sjuttonde|sextonde|femtonde|fjortonde|trettonde|tolfte|elfte|tionde|nionde|[åa]ttonde|sjunde|sj[äa]tte|femte|fj[äa]rde|tredje|andra|f[öo]rsta";

  // Pre-process: ensure chapter headings get their own line
  const chapterWordPattern = new RegExp(`([^\\n])((?:${SWEDISH_ORDINALS})\\s+kapitlet)`, 'gi');
  text = text
    .replace(/([^\n])(KAPITEL\s+\d+)/gi, '$1\n$2')
    .replace(/([^\n])(Chapter\s+\d+)/gi, '$1\n$2')
    .replace(chapterWordPattern, '$1\n$2');

  // Try Swedish ordinal pattern first: "Första kapitlet", "Tionde kapitlet"
  const ordinalPattern = new RegExp(`^((?:${SWEDISH_ORDINALS})\\s+kapitlet.*)$`, 'gim');
  const ordinalMarkers = [];
  let ordMatch;
  while ((ordMatch = ordinalPattern.exec(text)) !== null) {
    ordinalMarkers.push({ index: ordMatch.index, title: ordMatch[0].trim() });
  }
  if (ordinalMarkers.length >= 2) {
    return buildChaptersFromMarkers(text, ordinalMarkers);
  }

  // Fallback: numeric pattern "KAPITEL 1", "Kapitel 2", etc.
  const chapterPattern = /^(KAPITEL|Kapitel|kapitel|CHAPTER|Chapter)\s+(\d+)/gm;
  const markers = [];
  let match;

  while ((match = chapterPattern.exec(text)) !== null) {
    markers.push({ index: match.index, title: match[0].trim() });
  }

  if (markers.length === 0) {
    return splitByWordCount(text, 5000);
  }

  return buildChaptersFromMarkers(text, markers);
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
