# CLAUDE.md – Manusverkstaden

## Projektöversikt

Manusverkstaden är en SaaS-plattform för AI-stödd manusgranskning av bokmanuskript.
Målgrupp: författare, redaktörer, förlag – primärt svenskspråkig marknad, internationell expansion planerad.

## Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** CSS Modules (inga utility-ramverk – designen har en distinkt editorial estetik)
- **Fonts:** Newsreader (serif, brödtext), DM Sans (UI-element)
- **State:** React hooks (useState, useContext) – Redux/Zustand om behov uppstår
- **Backend (planerad):** Node.js/Express eller Python/FastAPI
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514 för granskning, claude-opus-4-6 för utvecklingsredaktionellt)
- **Databas (planerad):** PostgreSQL + Prisma
- **Betalning (planerad):** Stripe
- **Deploy (planerad):** Vercel (frontend), Railway/Fly.io (backend)

## Projektstruktur

```
manusverkstaden/
├── CLAUDE.md              ← Du läser denna
├── README.md              ← Projektdokumentation
├── package.json
├── vite.config.js
├── index.html
├── .gitignore
├── .env.example
├── docs/
│   ├── PROMPTSYSTEM.md    ← Komplett promptsystem (grund + genre + moduler)
│   ├── ARCHITECTURE.md    ← Teknisk arkitektur och planering
│   └── PRICING.md         ← Affärsmodell och prissättning
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx           ← Entry point
│   ├── App.jsx            ← Huvudapp med routing
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── Layout.jsx
│   │   ├── Editor/
│   │   │   ├── ManuscriptView.jsx
│   │   │   ├── TextRenderer.jsx
│   │   │   └── SuggestionHighlight.jsx
│   │   ├── Suggestions/
│   │   │   ├── SuggestionPanel.jsx
│   │   │   ├── SuggestionCard.jsx
│   │   │   └── SuggestionFilters.jsx
│   │   ├── Develop/
│   │   │   ├── DevelopPanel.jsx
│   │   │   ├── DNAView.jsx
│   │   │   ├── EmotionMap.jsx
│   │   │   ├── DevelopView.jsx
│   │   │   └── BrainstormView.jsx
│   │   ├── Translate/
│   │   │   └── TranslatePanel.jsx
│   │   ├── Settings/
│   │   │   └── SettingsModal.jsx
│   │   └── ui/
│   │       ├── Toggle.jsx
│   │       ├── Badge.jsx
│   │       └── Button.jsx
│   ├── pages/
│   │   ├── EditorPage.jsx
│   │   └── PricingPage.jsx
│   ├── data/
│   │   ├── genres.js       ← Genrekonfigurationer
│   │   ├── languages.js    ← Översättningsspråk
│   │   ├── prompts.js      ← Promptmallar (grund + genre + moduler)
│   │   └── sample-data.js  ← Demo/testdata
│   ├── hooks/
│   │   ├── useProject.js   ← Projektstate
│   │   ├── useSuggestions.js
│   │   └── useAI.js        ← Claude API-anrop
│   ├── lib/
│   │   ├── ai-client.js    ← Anthropic API wrapper
│   │   ├── prompt-builder.js ← Bygger prompt från grund + tillägg
│   │   ├── manuscript-parser.js ← Parsar docx/txt till kapitel
│   │   └── export.js       ← Export till docx med Track Changes
│   └── styles/
│       ├── global.css
│       ├── variables.css   ← CSS custom properties (färger, typsnitt)
│       └── editor.module.css
```

## Kommandoreferens

```bash
npm run dev          # Starta dev-server (Vite)
npm run build        # Bygg för produktion
npm run preview      # Förhandsgranska produktionsbygge
npm run lint         # ESLint
```

## Kodkonventioner

- **Språk i kod:** Engelska (variabelnamn, kommentarer, git-meddelanden)
- **Språk i UI:** Svenska (all text som användaren ser)
- **Komponenter:** Funktionella komponenter med hooks, inga klasskomponenter
- **Namngivning:** PascalCase för komponenter, camelCase för funktioner/variabler
- **Filer:** PascalCase för komponenter (.jsx), camelCase för utilities (.js)
- **CSS:** CSS Modules med camelCase-klassnamn
- **Git-meddelanden:** Conventional Commits (feat:, fix:, docs:, refactor:)

## Designsystem – viktigt att bevara

Applikationen har en medveten **editorial/literary estetik** – INTE generisk SaaS-design:

- **Färgpalett:** Varma jordtoner (#1a1410 ink, #f7f4ef bg, #a0522d accent)
- **Typsnitt:** Newsreader (serif) för manustext, DM Sans för UI
- **Princip:** Avskalad, bokliknande känsla – som att arbeta i ett fint förlag
- **Undvik:** Neonblått, stora gradients, generiska component libraries
- **Animationer:** Subtila transitions, inget flashigt

## Nuläge och nästa steg

### ✅ Klart (prototyp)
- Fullständigt promptsystem (grund + 9 genretillägg + skrivutveckling + översättning)
- Interaktivt gränssnitt med: kapitelnavigering, inline-markeringar, förslagspanel
- Genretillägg som tick-box-val i inställningsmodal
- Skrivutvecklingsmodul (DNA-profil, emotionell karta, scenutbyggnad, brainstorming)
- Översättningsmodul (4 språk, parallellvy, RTL-stöd, ordlista)
- Prissida med 5 nivåer

### 🔜 Nästa sprint (MVP)
1. **Filuppladdning** – Docx/txt-parser som delar upp manus i kapitel
2. **Claude API-integration** – Koppla promptsystemet till riktig AI-granskning
3. **Prompt builder** – Dynamisk ihopsättning av grund + valda genre + moduler
4. **Autentisering** – Clerk eller NextAuth
5. **Databas** – PostgreSQL för projekt, kapitel, förslag, användare

### 🔮 Framtida
- Export till docx med riktiga Track Changes-markeringar
- Realtids-samarbete (flera redaktörer)
- Stripe-integration för prenumerationer
- API för förlagsintegrationer
- Fler översättningsspråk
- **Manusverkstaden Dramatik** — avknoppning för film/teater-manus (act-struktur, beats, formatregler, dialog-fokus)

## AI-promptarkitektur

Promptsystemet byggs dynamiskt av `prompt-builder.js`:

```
Grundprompt (alltid aktiv)
  + Projektbeskrivning (metadata om manuskriptet)
  + Genretillägg × N (valda av användaren)
  + [Skrivutvecklingsmodul] (om aktiverad)
  + [Översättningsmodul] (om aktiverad)
  + Aktuellt kapitel/textavsnitt
```

Se `docs/PROMPTSYSTEM.md` för komplett promptdokumentation.
