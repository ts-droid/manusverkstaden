# Affärsmodell & Prissättning – Manusverkstaden

> **Version:** 2.0 – Hybridmodell (grund + användning)

## Marknadsposition

Manusverkstaden positionerar sig i gapet mellan:
- **Generella AI-skrivverktyg** (Grammarly, ProWritingAid) – bra på grammatik men saknar djup redaktionell granskning och svenska
- **AI-skrivgeneratorer** (Sudowrite, Novelcrafter) – fokus på att generera text, inte granska
- **Traditionella redaktörer** – hög kvalitet men kostar 16 000–40 000 SEK per manus

## Prismodell: Grund + Användning

### Varför hybrid?

Den tidigare flat-rate-modellen hade ett strukturellt problem:
- **Granskning** kostar oss ~3–10 kr per manus i API
- **Översättning** kostar oss ~35–85 kr per manus i API

En flat-rate som inkluderar båda tvingar oss att antingen prissätta alla högt (och tappa granskningskunderna) eller subventionera översättning (och äta marginalen). Hybridmodellen löser detta: varje tjänst prissätts utifrån sin faktiska API-kostnad med stabil marginal oavsett användarmix.

### Grundavgift

| Plan | Pris | Inkluderar |
|------|------|-----------|
| **Prova** | 0 kr | 1 kapitel (max 5 000 ord), alla granskningsnivåer |
| **Grund** | 99 kr/mån | Plattformen, alla genretillägg, export, 1 granskning/mån (50k ord) |
| **Förlag** | Offert (fr. 1 500 kr/mån) | Flerplatslicens, API-åtkomst, anpassade mallar, SSO |

### Användningsbaserade tjänster

#### Manusgranskning

| Tjänst | Pris | API-kostnad (est.) | Marginal |
|--------|------|---------------------|----------|
| Korrektur + språk (nivå 3–4) | 0,50 kr / 1 000 ord | ~0,08 kr | ~84% |
| Stilistisk + struktur (nivå 1–2) | 1,50 kr / 1 000 ord | ~0,35 kr | ~77% |
| Full granskning (alla 4 nivåer) | 2,50 kr / 1 000 ord | ~0,55 kr | ~78% |

#### Skrivutveckling

| Tjänst | Pris | API-kostnad (est.) | Marginal |
|--------|------|---------------------|----------|
| Språklig DNA-profil + emotionell karta | 19 kr / analys | ~3 kr | ~84% |
| Scenutbyggnad / omskrivning | 5 kr / anrop | ~1,50 kr | ~70% |
| Brainstorming (3 alternativ) | 3 kr / anrop | ~0,80 kr | ~73% |

#### Översättning

| Tjänst | Pris | API-kostnad (est.) | Marginal |
|--------|------|---------------------|----------|
| Per språk | 4 kr / 1 000 ord | ~1,20 kr | ~70% |
| Paket 3–4 språk | 12 kr / 1 000 ord (totalt) | ~3,60 kr | ~70% |

---

## Typanvändare – vad kostar det i praktiken?

| Persona | Användningsmönster | Månadskostnad | Jmf. traditionell |
|---------|-------------------|---------------|-------------------|
| **Hobbyförfattare** | 1 manus/mån (60k ord), full granskning, lite utvecklingsstöd | ~175 kr | ~18 000 kr |
| **Aktiv författare** | 2 manus/mån (80k ord), full granskning + utveckling | ~620 kr | ~48 000 kr |
| **Internationell** | 1 manus (80k ord) + översättning 4 språk | ~1 280 kr | ~160 000+ kr |
| **Litet förlag** | 5 manus/mån, granskning + 2 språk | ~3 400 kr | ~250 000+ kr |

---

## AI-modellstrategi

### Intelligent routing (tre nivåer)

| Uppgift | Modell | Kostnad/M tokens | Motivering |
|---------|--------|------------------|-----------|
| Korrektur, stavning, grammatik | Claude Haiku 4.5 | $1 / $5 | Snabb, billig, tillräcklig kvalitet |
| Stilistik, upprepningar, flöde | Claude Sonnet 4.6 | $3 / $15 | Bästa balans kvalitet/kostnad |
| Utvecklingsred., översättning | Claude Opus 4.6 | $5 / $25 | Krävs för djup analys och litterär kvalitet |

### Optimeringar

- **Prompt caching**: Systemprompt (~3 000 tokens) cachelagras. Cache-läsning kostar 10% av normalt.
- **Batch API**: 50% rabatt på översättning och fullständig granskning (ej realtidskritiskt).
- **Kontextfönster**: 1M tokens inkluderat i standardpris – hela manus som kontext vid utvecklingsredaktionellt.

---

## Kostnadskalkyl per manus (80 000 ord)

| Uppgift | Modell | API-kostnad | Kundpris |
|---------|--------|-------------|----------|
| Korrektur (20 kap) | Haiku 4.5 | ~0,50 kr | 40 kr |
| Stilistisk granskning | Sonnet 4.6 | ~4,60 kr | 120 kr |
| Utvecklingsredaktionellt | Sonnet/Opus | ~5 kr | 80 kr |
| **Full granskning totalt** | | **~10 kr** | **200 kr** |
| DNA-profil + emotion | Sonnet 4.6 | ~3 kr | 19 kr |
| Utvecklingsanrop (×10) | Sonnet 4.6 | ~15 kr | 50 kr |
| Översättning (4 språk) | Opus 4.6 | ~40 kr | 960 kr |

---

## Jämförelse med konkurrenter

| Tjänst | Prismodell | Manus 80k ord (est.) | Svenskt stöd |
|--------|-----------|----------------------|--------------|
| **Manusverkstaden** | 99 kr/mån + användning | ~200 kr (granskning) | Fullt |
| ProWritingAid | ~100–300 kr/mån flat | ~200 kr/mån | Begränsat |
| Sudowrite | ~100–590 kr/mån credits | ~200–590 kr/mån | Minimalt |
| editGPT | ~100 kr/mån flat | ~100 kr/mån | Delvis |
| **Traditionell redaktör** | Per ord/timme | 16 000–40 000 kr | Fullt |

---

## Revenue-projektion (År 1)

Antaganden: Snitt-ARPU stiger från 200 kr (nya) till 350 kr (mogna) i takt med att användare upptäcker utvecklings- och översättningsmodulerna.

| Period | Betalande kunder | Snitt-ARPU | MRR | ARR |
|--------|-----------------|------------|-----|-----|
| Mån 1–3 | 80 | 200 kr | 16 000 kr | 192 000 kr |
| Mån 4–6 | 250 | 250 kr | 62 500 kr | 750 000 kr |
| Mån 7–9 | 500 | 300 kr | 150 000 kr | 1 800 000 kr |
| Mån 10–12 | 800 | 350 kr | 280 000 kr | 3 360 000 kr |

Förväntad NRR: 120–140% (varje kohort spenderar mer över tid utan plan-uppgradering).

---

## Go-to-market

### Fas 1: Svensk lansering (Månad 1–6)
- Fokus: svenska författare, självpublicering, skrivarcommunities
- Kanaler: Författarforum, Bokmässan, Facebook-grupper, LinkedIn
- Hook: "Granska ditt första kapitel gratis – se vad en AI-redaktör hittar"

### Fas 2: Nordisk expansion (Månad 6–12)
- Lägg till norska och danska
- Partnerskap med nordiska förlag och skrivarkurser

### Fas 3: Internationell (År 2)
- Engelskspråkig plattform
- Fler översättningsspråk (franska, japanska, kinesiska)
- White-label-lösning för förlag
