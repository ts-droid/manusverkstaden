# Manusverkstaden

> AI-stödd manusgranskning för författare, redaktörer och förlag.

Manusverkstaden är en webbaserad plattform som erbjuder professionell manusgranskning med hjälp av AI. Till skillnad från generella skrivverktyg är Manusverkstaden byggt specifikt för **bokmanuskript** och stödjer fyra redaktionella nivåer – från utvecklingsredaktionellt arbete till korrekturläsning.

## Funktioner

- **4 granskningsnivåer** – Utvecklingsredaktionellt, stilistisk redigering, språkgranskning, korrektur
- **9 genretillägg** – Realistisk fiktion, deckare/thriller, fantasy/sci-fi, romantik, skräck, historisk roman, barn & ungdom, memoar, lyrik
- **Skrivutveckling** – AI-stödd textutveckling med språklig DNA-profil, emotionell kartläggning och brainstorming
- **Litterär översättning** – Engelska, tyska, spanska och arabiska med kulturell anpassning
- **Inline-granskning** – Förslag markeras direkt i texten med prioritetsnivåer
- **Författarens röst** – AI:n analyserar och matchar din unika skriststil

## Teknik

- React 18 + Vite
- Anthropic Claude API
- PostgreSQL + Prisma (planerad)
- Stripe (planerad)

## Kom igång

```bash
# Klona repo
git clone https://github.com/DITT-ANVÄNDARNAMN/manusverkstaden.git
cd manusverkstaden

# Installera beroenden
npm install

# Kopiera miljövariabler
cp .env.example .env
# Fyll i din ANTHROPIC_API_KEY i .env

# Starta utvecklingsserver
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173) i din webbläsare.

## Projektstruktur

```
src/
├── components/     # React-komponenter organiserade per feature
├── pages/          # Sidkomponenter (Editor, Pricing)
├── data/           # Konfiguration, genrer, promptmallar
├── hooks/          # Custom React hooks
├── lib/            # Utilities (API-klient, prompt builder, parser)
└── styles/         # CSS Modules och variabler
docs/
├── PROMPTSYSTEM.md # Komplett promptsystem
├── ARCHITECTURE.md # Teknisk arkitektur
└── PRICING.md      # Affärsmodell
```

## Dokumentation

- [CLAUDE.md](./CLAUDE.md) – Instruktioner för AI-assisterad utveckling
- [docs/PROMPTSYSTEM.md](./docs/PROMPTSYSTEM.md) – Fullständigt promptsystem
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) – Teknisk arkitektur
- [docs/PRICING.md](./docs/PRICING.md) – Affärsmodell och prissättning

## Licens

Proprietär – alla rättigheter förbehållna.
