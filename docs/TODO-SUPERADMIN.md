# Superadmin – Framtida utveckling

## Byggt (v1)
- [x] Överblick: användare, projekt, kapitel, API-kostnad dag/månad
- [x] Användarhantering: lista, sök, ändra plan, dev-konto toggle
- [x] API-förbrukning: 30-dagars daglig kostnad, uppdelning per typ
- [x] Prompt-editor: redigera prompts live, versionshistorik
- [x] Dev-konto: skippar billing + usage tracking

## Att bygga

### Prio 1 – Nästa sprint
- [ ] A/B-test för prompts: kör två versioner parallellt, jämför godkännandegrad
- [ ] Felloggar: visa senaste 500/502/429-fel med timestamp och endpoint
- [ ] Rate limit-monitor: antal 429-svar per dag/timme
- [ ] Genomsnittlig svarstid per modell (Haiku/Sonnet/Opus)
- [ ] Bulk-åtgärder på användare (t.ex. ändra plan för flera)

### Prio 2 – Ekonomi & Analys
- [ ] MRR/ARR-beräkning från Stripe-data
- [ ] Stripe-intäkter vs API-kostnader (marginalgraf)
- [ ] Churn-rate (avregistreringar per månad)
- [ ] Kohortanalys (retention per registreringsmånad)
- [ ] Revenue per plan-typ
- [ ] LTV-estimat per kundsegment

### Prio 3 – Innehållsanalys
- [ ] Godkännandegrad per förslags-typ (hur ofta accepteras röda/gula/gröna?)
- [ ] Populäraste genretilläggen
- [ ] Vanligaste felen som AI:n hittar (aggregerat)
- [ ] Genomsnittligt antal förslag per kapitel
- [ ] Antal manus som exporterats

### Prio 4 – System & Drift
- [ ] Server-hälsa: CPU, minne, disk (Railway metrics API)
- [ ] Deploy-historik med status
- [ ] Database-storlek och tillväxt
- [ ] Automatiska varningar vid hög API-kostnad (>X kr/dag)
- [ ] Backup-status för PostgreSQL

### Prio 5 – Avancerat
- [ ] Prompt-playground: testa promptändringar mot exempeltext direkt i admin
- [ ] Användarsupport: se en specifik användares manus/förslag (read-only)
- [ ] Announcement-system: visa meddelanden för alla/vissa användare
- [ ] Feature flags: slå på/av funktioner per plan eller globalt
- [ ] Export admin-data till CSV
