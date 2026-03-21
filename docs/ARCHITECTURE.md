# Teknisk Arkitektur – Manusverkstaden

## Systemöversikt

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React 18 + Vite                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Editor   │ │ Suggest  │ │ Develop  │ │  Translate     │  │
│  │  View     │ │ Panel    │ │ Module   │ │  Module        │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│         │            │            │              │           │
│         └────────────┴────────────┴──────────────┘           │
│                          │                                   │
│                   useAI() hook                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────┴──────────────────────────────────┐
│                     BACKEND API                              │
│  Node.js / Express (eller Python / FastAPI)                  │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ Auth        │ │ Prompt       │ │ Manuscript           │  │
│  │ (Clerk)     │ │ Builder      │ │ Parser (docx→json)   │  │
│  └─────────────┘ └──────┬───────┘ └──────────────────────┘  │
│                          │                                   │
│  ┌─────────────┐ ┌──────┴───────┐ ┌──────────────────────┐  │
│  │ Stripe      │ │ Claude API   │ │ Export               │  │
│  │ Billing     │ │ Proxy        │ │ (docx+Track Changes) │  │
│  └─────────────┘ └──────────────┘ └──────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                      DATABASE                                │
│  PostgreSQL + Prisma ORM                                     │
│                                                              │
│  users ──< projects ──< chapters ──< suggestions             │
│                │                                             │
│                ├──< genre_selections                         │
│                ├──< translations                             │
│                └──< dna_profiles                             │
└─────────────────────────────────────────────────────────────┘
```

## Datamodell (Prisma-skiss)

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  plan          Plan      @default(FREE)
  projects      Project[]
  createdAt     DateTime  @default(now())
}

enum Plan {
  FREE
  AUTHOR
  PROFESSIONAL
  TRANSLATION
  PUBLISHER
}

model Project {
  id              String    @id @default(cuid())
  title           String
  language        String    @default("sv")
  targetAudience  String?
  timePeriod      String?
  perspective     String?
  tense           String?
  tonality        String?
  genres          String[]  // Array of genre IDs
  modules         String[]  // ["develop", "translate"]
  transLanguages  String[]  // ["en", "de", "es", "ar"]
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  chapters        Chapter[]
  dnaProfile      Json?     // Språklig DNA-profil
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Chapter {
  id          String       @id @default(cuid())
  number      Int
  title       String
  content     String       // Originaltext
  wordCount   Int
  status      ChapterStatus @default(PENDING)
  projectId   String
  project     Project      @relation(fields: [projectId], references: [id])
  suggestions Suggestion[]
  translations Translation[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

enum ChapterStatus {
  PENDING
  REVIEWING
  REVIEWED
  APPROVED
}

model Suggestion {
  id          String   @id @default(cuid())
  type        String   // style, repetition, structure, grammar, consistency
  priority    String   // red, yellow, green
  level       Int      // 1-4
  original    String
  replacement String?
  reason      String
  status      SuggestionStatus @default(PENDING)
  chapterId   String
  chapter     Chapter  @relation(fields: [chapterId], references: [id])
  createdAt   DateTime @default(now())
}

enum SuggestionStatus {
  PENDING
  ACCEPTED
  REJECTED
}

model Translation {
  id          String   @id @default(cuid())
  language    String   // en, de, es, ar
  content     String   // Översatt text
  comments    String?  // Översättningskommentarer
  glossary    Json?    // Ordlista
  chapterId   String
  chapter     Chapter  @relation(fields: [chapterId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## API-endpoints (planerade)

### Auth
- `POST /auth/register` – Registrera ny användare
- `POST /auth/login` – Logga in
- `GET  /auth/me` – Hämta inloggad användare

### Projects
- `POST   /projects` – Skapa nytt projekt
- `GET    /projects` – Lista användarens projekt
- `GET    /projects/:id` – Hämta projekt med kapitel
- `PATCH  /projects/:id` – Uppdatera projektinställningar
- `DELETE /projects/:id` – Radera projekt

### Chapters
- `POST   /projects/:id/upload` – Ladda upp manuskript (docx/txt)
- `GET    /chapters/:id` – Hämta kapitel med förslag
- `POST   /chapters/:id/review` – Starta AI-granskning
- `GET    /chapters/:id/suggestions` – Hämta förslag

### Suggestions
- `PATCH  /suggestions/:id` – Uppdatera status (accept/reject)
- `POST   /suggestions/bulk-update` – Massuppdatera

### Develop (skrivutveckling)
- `POST   /projects/:id/dna-profile` – Generera DNA-profil
- `POST   /chapters/:id/emotion-map` – Generera emotionell karta
- `POST   /chapters/:id/develop` – Generera ny text
- `POST   /chapters/:id/brainstorm` – Brainstorming

### Translate
- `POST   /chapters/:id/translate` – Starta översättning
- `GET    /chapters/:id/translations` – Hämta översättningar

### Export
- `GET    /projects/:id/export/docx` – Exportera med Track Changes
- `GET    /projects/:id/export/docx/:lang` – Exportera översättning

## Prompt-flöde

```
Användare laddar upp manus
        │
        ▼
  Manuscript Parser
  (docx → kapitel → stycken)
        │
        ▼
  Prompt Builder sammanställer:
  ┌─────────────────────────┐
  │ Grundprompt             │ ← alltid aktiv
  │ + Projektbeskrivning    │ ← från projektinställningar
  │ + Genre × N             │ ← valda genretillägg
  │ + [Skrivutveckling]     │ ← om aktiverad
  │ + [Översättning]        │ ← om aktiverad
  └─────────────────────────┘
        │
        ▼
  Claude API (sonnet för granskning, opus för utvecklingsred.)
        │
        ▼
  JSON-svar → Suggestions i databasen
        │
        ▼
  Presenteras inline i editorn
```

## Säkerhet

- API-nycklar hanteras enbart server-side
- Alla API-anrop går genom backend-proxy
- Rate limiting per användare och plan
- Manuskriptdata krypterad at rest
- GDPR-kompatibel datahantering
- Möjlighet att radera all data

## Skalning

- **Fas 1 (MVP):** Monolitisk Node.js-app, en PostgreSQL-databas
- **Fas 2:** Separera AI-anrop till bakgrundsjobb (queue med BullMQ/Redis)
- **Fas 3:** Microservices vid behov (översättning, export som egna tjänster)
