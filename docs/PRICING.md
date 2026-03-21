# Affärsmodell & Prissättning – Manusverkstaden

## Marknadsposition

Manusverkstaden positionerar sig i gapet mellan:
- **Generella AI-skrivverktyg** (Grammarly, ProWritingAid) – bra på grammatik men saknar djup redaktionell granskning och svenska
- **AI-skrivgeneratorer** (Sudowrite, Novelcrafter) – fokus på att generera text, inte granska
- **Traditionella redaktörer** – hög kvalitet men kostar 16 000–40 000 SEK per manus

## Prisplaner

| Plan | Pris | Målgrupp | API-kostnad (est.) | Marginal |
|------|------|----------|---------------------|----------|
| **Prova** | 0 SEK | Alla | ~2–5 SEK per gratis kapitel | Förlust (acquisition) |
| **Författare** | 149 SEK/mån | Hobbyförfattare, självpublicerande | ~30–60 SEK/mån* | ~60–80% |
| **Professionell** | 349 SEK/mån | Aktiva författare, frilansredaktörer | ~80–150 SEK/mån* | ~55–75% |
| **Översättning** | 499 SEK/mån | Författare med internationell ambition | ~150–250 SEK/mån* | ~50–70% |
| **Förlag** | Offert (fr. 2 000 SEK/mån) | Förlag, agenturer, skrivarkurser | Varierar | ~60–70% |

*Estimerad API-kostnad baserad på Claude Sonnet, ~120 000 ord/manus, 2 manus/mån.

## Kostnadskalkyl per granskning

Antaganden:
- Manus: 80 000 ord
- Granskning per kapitel: ~4 000 ord input + ~2 000 ord output
- 20 kapitel per manus
- Claude Sonnet prissättning (uppskattad)

| Komponent | Tokens (est.) | Kostnad (est.) |
|-----------|---------------|----------------|
| System prompt + kapitel | ~6 000 input | ~0,15 SEK |
| AI-svar per kapitel | ~2 000 output | ~0,30 SEK |
| Per kapitel totalt | | ~0,45 SEK |
| Per manus (20 kap) | | ~9 SEK |
| Med DNA-profil + emotion | | ~15 SEK |
| Med översättning (4 språk) | | ~80 SEK |

## Jämförelse med konkurrenter

| Tjänst | Pris/mån | Fokus | Svenskt stöd |
|--------|----------|-------|--------------|
| **Manusverkstaden** | 149–499 SEK | Manusgranskning, 4 nivåer, 9 genrer | ★★★★★ |
| ProWritingAid | ~100–300 SEK | Grammatik, 25+ rapporter | ★★☆☆☆ |
| Sudowrite | ~100–590 SEK | AI-textgenerering | ★☆☆☆☆ |
| editGPT | ~100 SEK | Korrekturläsning | ★★★☆☆ |
| Grammarly Pro | ~130 SEK | Grammatik, klarhet | ★★☆☆☆ |
| **Traditionell redaktör** | 16 000–40 000 SEK* | Full redaktionell granskning | ★★★★★ |

*Per manus, ej per månad.

## Jämförelse med traditionell översättning

| | Manusverkstaden | Mänsklig översättare |
|---|---|---|
| Pris per manus (80k ord, 4 språk) | ~499 SEK/mån | 120 000–240 000 SEK |
| Leveranstid | Timmar | Månader |
| Kulturell anpassning | AI-stödd + ordlista | Mänsklig expertis |
| Kvalitet | God grund, kräver mänsklig slutgranskning | Professionell |
| Bäst för | Första utkast, budgetmedvetna | Slutgiltig publicering |

## Revenue-projektion (År 1)

| Månad | Prova → Betalt konv. | Författare | Professionell | Översättning | MRR |
|-------|----------------------|-----------|---------------|-------------|-----|
| 1–3 | 5% | 50 | 10 | 5 | 12 900 SEK |
| 4–6 | 7% | 150 | 30 | 15 | 38 700 SEK |
| 7–9 | 8% | 350 | 80 | 35 | 92 600 SEK |
| 10–12 | 10% | 600 | 150 | 60 | 161 850 SEK |

## Go-to-market

### Fas 1: Svensk lansering (Månad 1–6)
- Fokus: svenska författare, självpublicering, skrivarcommunities
- Kanaler: Författarforum, Bokmässan, Facebook-grupper, LinkedIn
- Erbjudande: Gratis granskning av ett kapitel

### Fas 2: Nordisk expansion (Månad 6–12)
- Lägg till norska och danska som granskningsspråk
- Partnerskap med nordiska förlag

### Fas 3: Internationell (År 2)
- Engelskspråkig version
- Fler genretillägg baserat på efterfrågan
- Förlagsintegrationer via API
