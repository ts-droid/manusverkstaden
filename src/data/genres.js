/**
 * Genre definitions and their specific review focus areas.
 * Each genre adds a layer on top of the base prompt.
 */

export const GENRES = [
  {
    id: 'realistic',
    icon: '📖',
    label: 'Realistisk fiktion',
    description: 'Samtidsroman, vardagsskildring',
    focusAreas: [
      'Autenticitet i vardagsskildring',
      'Sociolekt och register',
      'Emotionell trovärdighet',
      'Biografiska drag',
      'Visa, inte berätta',
    ],
  },
  {
    id: 'crime',
    icon: '🔍',
    label: 'Deckare / Thriller',
    description: 'Brott, utredning, spänning',
    focusAreas: [
      'Ledtrådar och rödsillar (fair play)',
      'Spänningskurva och tempo',
      'Procedurell trovärdighet',
      'Kronologisk konsistens',
      'Kapitelavslutningar och cliffhangers',
      'Antagonistens trovärdighet',
    ],
  },
  {
    id: 'fantasy',
    icon: '🐉',
    label: 'Fantasy / Sci-fi',
    description: 'Fiktiva världar, magi, framtid',
    focusAreas: [
      'Världsbygge och intern logik',
      'Infodumping',
      'Namntäthet per kapitel',
      'Magisystem / teknologi',
      'Teman och allegori',
      'Genrekonventioner',
    ],
  },
  {
    id: 'romance',
    icon: '💕',
    label: 'Romantik',
    description: 'Kärleksrelationer, passion',
    focusAreas: [
      'Kemins trovärdighet',
      'Hinder och stakes',
      'Balans mellan protagonisterna',
      'Emotionell pay-off',
      'Subgenrekonventioner (HEA/HFN)',
      'Intimitet och känslomässig sårbarhet',
    ],
  },
  {
    id: 'feelgood',
    icon: '☀️',
    label: 'Feelgood',
    description: 'Varm, livlig, hoppfull',
    focusAreas: [
      'Ton och värme (varm utan att bli sockersöt)',
      'Personlig utveckling och tillväxt',
      'Vänskap och community',
      'Humoristiska inslag',
      'Emotionell pay-off och hopp',
      'Balans lätthet/djup',
    ],
  },
  {
    id: 'horror',
    icon: '👻',
    label: 'Skräck / Gothic',
    description: 'Obehag, rädsla, existentiell ångest',
    focusAreas: [
      'Atmosfärbygge',
      'Dosering av obehag',
      'Det outtalade',
      'Psykologisk trovärdighet',
      'Genremedvetenhet (klichéer)',
      'Gränshantering',
    ],
  },
  {
    id: 'historical',
    icon: '📚',
    label: 'Historisk roman',
    description: 'Avgränsad historisk period',
    focusAreas: [
      'Historisk korrekthet (anakronismer)',
      'Språklig balans (period vs läsbarhet)',
      'Historiska personers skildring',
      'Sinnliga periodsdetaljer',
      'Modern moral i historisk kontext',
    ],
  },
  {
    id: 'ya',
    icon: '👶',
    label: 'Barn & Ungdom',
    description: 'Upp till 18 år',
    focusAreas: [
      'Åldersanpassat språk',
      'Pacing och kapitelstruktur',
      'Representation och diversitet',
      'Empowerment (ung protagonist med agens)',
      'Tematisk lämplighet',
      'Vuxna karaktärers roll',
    ],
  },
  {
    id: 'memoir',
    icon: '📝',
    label: 'Memoar / Sakprosa',
    description: 'Icke-fiktivt, berättande',
    focusAreas: [
      'Narrativ båge i sakprosa',
      'Scener vs. referat',
      'Reflektion och insikt',
      'Trovärdighet och ärlighet',
      'Andras porträtt',
      'Balans fakta/berättelse',
    ],
  },
  {
    id: 'poetry',
    icon: '🎭',
    label: 'Lyrik / Poesi',
    description: 'Dikt, prosalyrik, versepos',
    focusAreas: [
      'Rytm och klang',
      'Bildspråk (originalitet)',
      'Ekonomi (varje ord bär vikt)',
      'Radbrytningens dramaturgi',
      'Formmedvetenhet',
      'Avslutets effekt',
    ],
  },
  {
    id: 'adventure',
    icon: '⚔️',
    label: 'Äventyr / Action',
    description: 'Spänning, resor, överlevnad',
    focusAreas: [
      'Tempo och actionscener',
      'Miljöbeskrivning (exotiska platser)',
      'Fysisk trovärdighet (stunts, resor)',
      'Protagonistens drivkraft och stakes',
      'Sidokaraktärers funktion',
      'Balans action/karaktärsutveckling',
    ],
  },
  {
    id: 'nonfiction',
    icon: '📊',
    label: 'Fakta / Populärvetenskap',
    description: 'Sakprosa, vetenskap, samhälle',
    focusAreas: [
      'Källhantering och trovärdighet',
      'Tillgänglighet (förklara utan att förenkla)',
      'Struktur och röd tråd',
      'Balans mellan fakta och berättelse',
      'Målgruppsanpassning',
      'Slutsatser och argumentation',
    ],
  },
  {
    id: 'truecrime',
    icon: '🎙️',
    label: 'Dokumentärt / True Crime',
    description: 'Verkliga händelser, brott, journalistik',
    focusAreas: [
      'Faktakontroll och källhänvisning',
      'Etisk hantering av verkliga personer',
      'Narrativ struktur i verklighetsbaserat material',
      'Balans objektivitet/berättarröst',
      'Kronologi och tidslinje',
      'Dramatisering utan att fabricera',
    ],
  },
  {
    id: 'humor',
    icon: '😂',
    label: 'Humor / Satir',
    description: 'Komik, ironi, samhällssatir',
    focusAreas: [
      'Timing och komisk rytm',
      'Satirisk udd (träffsäkerhet utan att bli platt)',
      'Konsekvent ton (farsen vs subtil ironi)',
      'Karaktärskomik vs situationskomik',
      'Balans humor/hjärta (undvik att bli enbart skämt)',
      'Målgruppsmedvetenhet',
    ],
  },
  {
    id: 'erotica',
    icon: '🔥',
    label: 'Erotik',
    description: 'Erotisk litteratur, romantisk erotik',
    focusAreas: [
      'Samtycke och maktdynamik',
      'Balans scen/berättelse',
      'Anatomisk trovärdighet',
      'Emotionell dimension',
      'Variation i språk och scener',
      'Genrekonventioner och gränser',
    ],
  },
];

export function getGenreById(id) {
  return GENRES.find((g) => g.id === id) || null;
}

export function getGenresByIds(ids) {
  return ids.map(getGenreById).filter(Boolean);
}
