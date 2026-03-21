/**
 * Supported translation languages with their specific guidelines.
 */

export const LANGUAGES = [
  {
    id: 'en',
    flag: '🇬🇧',
    label: 'Engelska',
    subtitle: 'British English',
    rtl: false,
    guidelines: [
      'Bevara nordiskt stämningsbygge – engelska tenderar att vara mer direkt',
      'Svenska sammansatta ord kräver ofta omskrivning',
      'Dialogmarkörer: tankstreck (–) → citationstecken ("")',
      'Var observant på false friends',
    ],
  },
  {
    id: 'de',
    flag: '🇩🇪',
    label: 'Tyska',
    subtitle: 'Hochdeutsch',
    rtl: false,
    guidelines: [
      'Komplex meningsstruktur tillåten – närmare svenska rytmen',
      'Avgör du/Sie-tilltal tidigt, var konsekvent',
      'Utnyttja sammansatta substantiv (liknar svenska)',
      'Kulturell närhet – mindre behov av kontextförklaringar',
    ],
  },
  {
    id: 'es',
    flag: '🇪🇸',
    label: 'Spanska',
    subtitle: 'Kastiliansk',
    rtl: false,
    guidelines: [
      'Utnyttja rikare verbmorfologi',
      'Genuskongruens genom hela texten',
      'Dialogkonventioner: rayas (—)',
      'Nordiskt klimat kan kräva kontextförstärkning',
      'tú/usted ska reflektera karaktärsrelationer',
    ],
  },
  {
    id: 'ar',
    flag: '🇸🇦',
    label: 'Arabiska',
    subtitle: 'Modern standard (MSA)',
    rtl: true,
    guidelines: [
      'RTL-layout – all formatering anpassas',
      'MSA som bas, dialog kan behöva dialektinslag',
      'Identifiera kulturellt känsliga passager, flagga utan att censurera',
      'Anpassa hedersbetyg och tilltalsformer',
      'Återskapa metaforer med kulturellt relevanta motsvarigheter',
    ],
  },
];

export function getLanguageById(id) {
  return LANGUAGES.find((l) => l.id === id) || null;
}
