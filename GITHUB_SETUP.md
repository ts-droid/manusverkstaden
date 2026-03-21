# Push till GitHub – Snabbguide

## 1. Skapa repo på GitHub

Gå till https://github.com/new och skapa ett nytt repo:
- **Namn:** `manusverkstaden`
- **Synlighet:** Private (rekommenderat)
- **Initiera INTE** med README, .gitignore eller licens (vi har redan det)

## 2. Initiera och pusha

```bash
# Packa upp projektet (om du laddade ner .tar.gz)
tar xzf manusverkstaden.tar.gz
cd manusverkstaden

# Initiera git
git init
git add .
git commit -m "feat: initial project scaffold with prototype, promptsystem and docs"

# Koppla till GitHub
git remote add origin https://github.com/DITT-ANVÄNDARNAMN/manusverkstaden.git
git branch -M main
git push -u origin main
```

## 3. Börja utveckla med Claude Code

```bash
# Installera Claude Code (om du inte redan har det)
npm install -g @anthropic-ai/claude-code

# Starta Claude Code i projektmappen
cd manusverkstaden
claude

# Claude Code läser automatiskt CLAUDE.md och förstår projektet.
# Börja med t.ex:
#   "Bryt ut App.jsx till separata komponenter enligt strukturen i CLAUDE.md"
#   "Implementera filuppladdning med manuscript-parser.js"
#   "Koppla Claude API via useAI hooken"
```

## 4. Rekommenderad första sprint i Claude Code

Dessa uppgifter i ordning:

1. **Komponentuppdelning** – Bryt ut den monolitiska App.jsx till separata
   komponenter enligt mappstrukturen i CLAUDE.md
2. **CSS Modules** – Flytta inline-styles till CSS Modules
3. **Routing** – Lägg till react-router för Editor/Pricing-sidorna
4. **Filuppladdning** – Implementera drag-and-drop med manuscript-parser.js
5. **AI-integration** – Koppla reviewChapter() till riktiga API-anrop
6. **Prompt builder** – Verifiera att dynamisk promptbyggning fungerar korrekt

## 5. Environment Variables

Skapa `.env` i projektets rot:

```
VITE_ANTHROPIC_API_KEY=sk-ant-din-api-nyckel-här
```

Applikationen fungerar i **demo-läge** utan API-nyckel (visar exempeldata).
