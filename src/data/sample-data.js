/**
 * Sample data for demo and development.
 * Replace with real data from API in production.
 */

export const SAMPLE_PROJECT = {
  id: 'proj_001',
  title: 'Mardrömsprinsen',
  genre: ['realistic'],
  language: 'sv',
  targetAudience: 'Vuxna',
  timePeriod: '1980-talet till nutid',
  perspective: 'Tredjeperson begränsad',
  tense: 'Preteritum',
  tonality: 'Mörk och introspektiv',
};

export const SAMPLE_CHAPTERS = [
  { id: 1, title: 'Kap 1 – Pojken i fönstret', wordCount: 3420, status: 'done' },
  { id: 2, title: 'Kap 2 – Skuggorna', wordCount: 2890, status: 'done' },
  { id: 3, title: 'Kap 3 – Första dagen', wordCount: 4100, status: 'active' },
  { id: 4, title: 'Kap 4 – Mörkret faller', wordCount: 3650, status: 'pending' },
  { id: 5, title: 'Kap 5 – Vändpunkten', wordCount: 5200, status: 'pending' },
];

export const SAMPLE_PARAGRAPHS = [
  {
    id: 'p1',
    text: 'Morgonen grydde grå och tung över taken i Bredäng. Lägenheten på sjätte våningen var tyst, som den alltid var vid den här tiden – innan väckarklockan ringde, innan Leila vaknade, innan allt det andra.',
    suggestions: [],
  },
  {
    id: 'p2',
    text: 'Marcus stod vid fönstret och såg ner på parkeringen. En ensam kvinna gick med snabba steg mot tunnelbanan. Hon hade en röd jacka. Han kände inte igen henne, men det fanns något i hennes sätt att gå som påminde om hans mamma. Samma hastiga steg. Samma framåtlutade hållning, som om hon ständigt var på flykt från något.',
    suggestions: [
      {
        id: 's1',
        type: 'style',
        priority: 'green',
        level: 2,
        original: 'Hon hade en röd jacka.',
        replacement: 'Hennes röda jacka lyste som ett sår mot den grådaskiga asfalten.',
        reason:
          'Meningen konstaterar utan att skapa stämning. Genom att knyta jackan till omgivningen skapas kontrast och atmosfär.',
      },
    ],
  },
  {
    id: 'p3',
    text: 'Han hade alltid hatat den där vanan han hade. Att stå vid fönstret och titta. Det kändes som att vara instängd. Instängd i sitt eget liv, instängd i den här lägenheten, instängd i allt som hade varit och allt som fortfarande var. Det kändes tungt. Allting kändes tungt.',
    suggestions: [
      {
        id: 's2',
        type: 'repetition',
        priority: 'yellow',
        level: 2,
        original: 'instängd i sitt eget liv, instängd i den här lägenheten, instängd i allt',
        replacement: 'instängd i sitt eget liv, i lägenheten, i allt',
        reason:
          'Trippelupprepningen av "instängd" riskerar att kännas tung snarare än poetisk. Två räcker för mönstret.',
      },
      {
        id: 's3',
        type: 'repetition',
        priority: 'red',
        level: 3,
        original: 'Det kändes tungt. Allting kändes tungt.',
        replacement: 'Tyngden hade lagt sig över allting.',
        reason:
          '"Kändes tungt" upprepas direkt. Kombinerat med "instängd"-upprepningen skapas oavsiktlig monotoni.',
      },
    ],
  },
  {
    id: 'p4',
    text: 'Leila rörde sig i sängen bakom honom. Ett svagt mummel, sedan tystnad igen. Han vände sig inte om. Det var bättre så – att hon sov, att hon inte såg honom stå här som ett spöke i gryningen.',
    suggestions: [
      {
        id: 's4',
        type: 'style',
        priority: 'green',
        level: 2,
        original: 'som ett spöke i gryningen',
        replacement: 'som en skugga i gryningsljuset',
        reason:
          'Smaksak: "skugga" knyter an till kapitlets titel och skapar tematisk koherens.',
      },
    ],
  },
  {
    id: 'p5',
    text: 'Klockan var kvart i sex. Om en timme skulle allt börja igen – rutinerna, maskerna, det ständiga spelet av att allt var som det skulle. Marcus drog ett djupt andetag och kände kaffedoften från köket. Hade han satt på kaffebryggaren? Han mindes inte. Dagarna flöt ihop.',
    suggestions: [
      {
        id: 's5',
        type: 'structure',
        priority: 'yellow',
        level: 1,
        original: 'Hade han satt på kaffebryggaren? Han mindes inte.',
        replacement: null,
        reason:
          'Fin detalj som visar dissociation – överväg att återkoppla till kaffedoften senare i kapitlet för att stärka motivet.',
      },
    ],
  },
];

export const SAMPLE_DNA_PROFILE = {
  avgSentenceLength: 14.2,
  shortLongRatio: '60/40',
  dominantImagery: 'Visuell (ljus/mörker), taktil',
  dialogStyle: 'Kort, undvikande',
  favoriteWords: ['tystnad', 'tungt', 'instängd', 'grå'],
  tonality: 'Introvert, melankolisk, observerande',
  perspective: 'Tredjeperson begränsad (Marcus)',
  tense: 'Preteritum',
};

export const SAMPLE_EMOTION_DATA = [
  { chapter: 'Kap 1', value: -2, label: 'Melankoli, ensamhet' },
  { chapter: 'Kap 2', value: -4, label: 'Ångest, mörker' },
  { chapter: 'Kap 3', value: -1, label: 'Försiktig öppning' },
  { chapter: 'Kap 4', value: -3, label: 'Bakslag, sorg' },
  { chapter: 'Kap 5', value: 1, label: 'Vändpunkt, hopp' },
];

export const PRIORITY_CONFIG = {
  red: { label: 'Måste åtgärdas', color: 'var(--color-red)', bgColor: 'var(--color-red-bg)' },
  yellow: { label: 'Bör övervägas', color: 'var(--color-yellow)', bgColor: 'var(--color-yellow-bg)' },
  green: { label: 'Smaksak', color: 'var(--color-green)', bgColor: 'var(--color-green-bg)' },
};

export const LEVEL_LABELS = {
  1: 'Utvecklingsred.',
  2: 'Stilistisk',
  3: 'Språkgranskning',
  4: 'Korrektur',
};

export const TYPE_LABELS = {
  style: { icon: '✦', label: 'Stil' },
  repetition: { icon: '↻', label: 'Upprepning' },
  structure: { icon: '▧', label: 'Struktur' },
  grammar: { icon: 'Aa', label: 'Grammatik' },
  consistency: { icon: '⟳', label: 'Konsekvens' },
};
