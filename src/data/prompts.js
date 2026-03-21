/**
 * Prompt templates for the AI system.
 * These are imported by prompt-builder.js.
 *
 * This file contains the raw prompt text fragments.
 * See docs/PROMPTSYSTEM.md for the full human-readable documentation.
 */

export const REVIEW_RESPONSE_FORMAT = `
Returnera ALLTID dina förslag som JSON med följande struktur:
{
  "suggestions": [
    {
      "type": "style|repetition|structure|grammar|consistency",
      "priority": "red|yellow|green",
      "level": 1,
      "paragraphIndex": 0,
      "original": "den exakta texten i originalet",
      "replacement": "föreslagen ny text eller null",
      "reason": "motivering på svenska"
    }
  ],
  "overallAssessment": "kort helhetsbedömning av avsnittet på 2-3 meningar",
  "emotionScore": -3,
  "emotionLabel": "kort etikett, t.ex. 'Melankoli, ensamhet'"
}`;

export const DEVELOP_INSTRUCTIONS = {
  expand: `Bygga ut scen:
Användaren vill fördjupa en befintlig scen. Analysera originaltexten och generera utökad text som:
- Matchar författarens språkliga DNA-profil exakt
- Lägger till sinnesintryck, internmonolog eller dialog
- Behåller konsekvent tempus och perspektiv
- Inte introducerar nya karaktärer eller plottsvängar utan godkännande

Returnera JSON:
{
  "expandedText": "den utökade texten",
  "insertionPoint": "efter vilken mening/stycke",
  "notes": ["kommentarer om val som gjordes"]
}`,

  rewrite: `Skriva om:
Användaren vill att en passage skrivs om. Fokusområde anges av användaren.
Generera omskriven text som:
- Matchar författarens DNA-profil
- Adresserar det angivna fokusområdet
- Behåller all viktig information från originalet
- Presenterar originalet bredvid omskrivningen

Returnera JSON:
{
  "original": "originaltexten",
  "rewritten": "omskriven text",
  "focusApplied": "vilket fokus som tillämpades",
  "notes": ["kommentarer"]
}`,

  newScene: `Ny scen:
Användaren vill ha en helt ny scen/kapitel. Generera text som:
- Matchar författarens DNA-profil exakt
- Passar in i manuskriptets kontext
- Uppfyller det beskrivna syftet
- Inte skapar konflikter med befintlig berättelse

Returnera JSON:
{
  "title": "föreslagen rubrik",
  "text": "den genererade texten",
  "placement": "var i manuset texten passar",
  "impact": "vilka följdändringar som kan behövas",
  "alternatives": ["kort beskrivning av alternativa riktningar"]
}`,
};

export const BRAINSTORM_INSTRUCTIONS = `Brainstorming:
Användaren har en fråga eller ett problem med sin berättelse.
Presentera ALLTID exakt 3 alternativa vägar framåt.

Returnera JSON:
{
  "question": "sammanfattning av användarens fråga",
  "alternatives": [
    {
      "letter": "A",
      "title": "kort titel",
      "description": "2-3 meningar om vart detta leder narrativt",
      "strength": "vad detta gör bra",
      "risk": "vad som kan bli problematiskt"
    },
    { "letter": "B", ... },
    { "letter": "C", ... }
  ],
  "recommendation": "vilket alternativ du rekommenderar och varför"
}`;

export const DNA_PROFILE_INSTRUCTIONS = `Analysera författarens språkliga DNA-profil baserat på den tillhandahållna texten.

Returnera JSON:
{
  "avgSentenceLength": 14.2,
  "shortLongRatio": "60/40",
  "dominantImagery": "beskrivning av dominerande bildspråk",
  "dialogStyle": "beskrivning av dialogstil",
  "favoriteWords": ["ord1", "ord2", "ord3"],
  "tonality": "beskrivning av tonalitet",
  "perspective": "berättarperspektiv",
  "tense": "tempus",
  "paragraphStyle": "beskrivning av styckestruktur",
  "uniqueTraits": ["unika stilistiska drag"]
}`;

export const TRANSLATION_INSTRUCTIONS = (targetLang) => `Översätt den tillhandahållna texten till ${targetLang}.

Principer:
- Bevara författarens röst, rytm och tonalitet
- Kulturell anpassning framför ordagrann översättning
- Idiomatik på målspråket
- Behåll registervariationer

Returnera JSON:
{
  "translatedText": "den översatta texten",
  "comments": [
    {
      "original": "passage på originalspråket",
      "note": "kommentar om översättningsval"
    }
  ],
  "glossary": [
    {
      "original": "term",
      "translated": "översatt term",
      "note": "förklaring av val"
    }
  ]
}`;
