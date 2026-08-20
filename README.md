# Quick

> **AI-powered Active Recall Generator** — Upload any PDF course material, and Quick automatically generates interactive flashcards and multiple-choice quizzes using Google Gemini AI.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Gemini-AI-4285F4?logo=google" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-00E599?logo=postgresql" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## What is Quick?

Quick eliminates **passive reading** by transforming your lecture PDFs, e-books, and study notes into **active recall tools** — flashcards for concept review and quizzes for self-assessment.

### Core Loop

```
Upload PDF  -->  AI Analysis  -->  Flashcards  -->  Quiz  -->  Score & Review
```

---

## How It Works — End-to-End Flow

```
+-----------------------------------------------------------------------------+
|                        USER UPLOADS PDF                                     |
|                    (lecture slides, e-book, notes)                          |
+-----------------------------------+-----------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                      SERVER: EXTRACT TEXT                                   |
|            unpdf library parses PDF -> raw text extraction                   |
|            (max 8,000 words sent to AI)                                    |
+-----------------------------------+-----------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                   AI: GOOGLE GEMINI ANALYSIS                               |
|                                                                             |
|  System Prompt + Raw Text  ->  Gemini API  ->  Structured JSON Output      |
|                                                                             |
|  +------------------+    +------------------+                              |
|  |   FLASHCARDS     |    |   QUIZ SET       |                              |
|  | - 8-15 terms     |    | - 5-8 questions  |                              |
|  | - Key concepts   |    | - 4 options each |                              |
|  | - Definitions    |    | - Correct answer |                              |
|  +------------------+    +------------------+                              |
|                                                                             |
|  > Multi-model fallback: gemini-3.5-flash-lite -> 3.6-flash -> 3.5-flash  |
|  > If language selected: AI generates in target language                   |
+-----------------------------------+-----------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                    SAVE TO POSTGRESQL DATABASE                              |
|            documents -> flashcards -> quiz_sets -> quiz_questions           |
+-----------------------------------+-----------------------------------------+
                                    |
                     +--------------+--------------+
                     v              v              v
             +----------+  +----------+  +--------------+
             | FLASHCARD |  |  QUIZ    |  |  HISTORY     |
             |  PAGE     |  |  PAGE    |  |  & SCORES    |
             |           |  |          |  |              |
             | - Flip    |  | - Answer |  | - View all   |
             | - Navigate|  | - Submit |  |   attempts   |
             | - Keyboard|  | - Score  |  | - Review     |
             |   hints   |  | - Review |  |   answers    |
             +----------+  +----------+  +--------------+
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) | Full-stack React framework with API routes |
| **UI** | [React 19](https://react.dev) + [Tailwind CSS 4](https://tailwindcss.com) | Component-based UI with utility-first styling |
| **State** | [TanStack React Query v5](https://tanstack.com/query) | Server state management, caching, and refetching |
| **AI** | [Google Gemini API](https://ai.google.dev) | Flashcard & quiz generation via structured JSON output |
| **Database** | [Neon PostgreSQL](https://neon.tech) (serverless) | Relational data storage with Drizzle ORM |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) | Type-safe SQL queries and migrations |
| **Auth** | [Better Auth](https://www.better-auth.com) | Email/password + Google OAuth, session management |
| **PDF Parsing** | [unpdf](https://github.com/nicepkg/unpdf) | Server-side PDF text extraction |
| **Icons** | [Lucide React](https://lucide.dev) | Consistent icon library |
| **i18n** | Custom JSON locale system | Indonesian (id) & English (en) support |

---

## Project Structure

```
quick/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── page.tsx                  # Landing page & PDF upload
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── login/page.tsx            # Email/password + Google login
│   │   ├── register/page.tsx         # Registration with Google OAuth
│   │   ├── history/page.tsx          # Document history list
│   │   ├── trash/page.tsx            # Soft-deleted documents
│   │   ├── documents/[id]/
│   │   │   ├── flashcards/page.tsx   # Interactive flashcard viewer
│   │   │   ├── quiz/page.tsx         # Quiz session & scoring
│   │   │   ├── quiz/results/page.tsx # Quiz results display
│   │   │   └── attempts/             # Exam history & review
│   │   ├── trial/                    # Free trial mode (no auth)
│   │   └── api/                      # Backend API routes
│   │       ├── documents/            # CRUD + generate endpoints
│   │       │   ├── generate/route.ts # Main generation endpoint
│   │       │   ├── [id]/             # Per-document operations
│   │       │   │   ├── generate/     # Re-generate flashcards
│   │       │   │   ├── quiz/regenerate/ # Generate new quiz set
│   │       │   │   ├── flashcards/   # Fetch flashcards
│   │       │   │   ├── attempts/     # Quiz attempt history
│   │       │   │   ├── restore/      # Restore from trash
│   │       │   │   └── permanent/    # Permanent delete
│   │       │   ├── trash/route.ts    # Trash listing + 30-day cleanup
│   │       │   └── save-trial/       # Migrate trial -> saved document
│   │       ├── quiz/                 # Quiz submission & scoring
│   │       ├── trial/                # Trial generation endpoint
│   │       └── auth/                 # Better Auth handlers
│   ├── components/                   # Shared UI components
│   ├── lib/                          # Utilities & config
│   │   ├── ai.ts                     # Gemini API integration
│   │   ├── auth.ts                   # Better Auth configuration
│   │   ├── i18n.tsx                  # Internationalization hook
│   │   ├── query-keys.ts             # TanStack Query key factory
│   │   ├── query-provider.tsx        # React Query provider
│   │   ├── session-provider.tsx      # Auth session context
│   │   ├── daily-limit.ts            # Rate limiting (5/day)
│   │   └── format-date.ts            # Date formatting utilities
│   ├── db/
│   │   ├── schema.ts                 # Drizzle ORM schema
│   │   └── index.ts                  # Database connection
│   └── locales/                      # i18n translations
│       ├── id.json                   # Indonesian
│       └── en.json                   # English
├── scripts/                          # DB migration & test scripts
├── .env.local                        # Environment variables (not committed)
└── package.json
```

---

## Features

### PDF Upload & AI Generation
- Drag-and-drop PDF upload (max 15 MB)
- Automatic text extraction via `unpdf`
- Multi-model Gemini fallback (`flash-lite` -> `flash` -> `flash` classic)
- Up to 8,000 words processed per document
- **Content language selector**: Auto (match PDF), Bahasa Indonesia, or English

### Interactive Flashcards
- Flip-card animation (click or press Space)
- Keyboard navigation (arrow keys)
- Progress tracking with card counter
- End-of-deck celebration + quiz CTA

### Quiz System
- Multiple-choice questions (4 options each)
- Question set selector (multiple sets per document)
- **Regenerate** — create new quiz sets with one click
- Submit confirmation dialog
- Per-question answer review (correct/wrong/skipped)

### History & Attempt Review
- Full exam history per document
- Detailed answer review with correct/wrong indicators
- Score grading (Excellent / Good / Needs Practice / Review Material)
- Date-time tracking per attempt

### Trash System (Soft Delete)
- Deleted documents move to trash (not permanent)
- Restore from trash back to history
- Permanent delete with confirmation
- **Auto-cleanup**: documents permanently deleted after 30 days

### Authentication
- Email + password registration (min 8 chars, letters + numbers)
- Google OAuth login
- Smart flow: unregistered Google users get redirected to register with prefilled data
- Daily generation limit: **5 per day** for logged-in users

### Internationalization (i18n)
- Full UI in **Bahasa Indonesia** and **English**
- Content language override for AI output (independent from UI language)

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Neon PostgreSQL** database (free tier works)
- **Google Gemini API** key ([get one here](https://aistudio.google.com/apikey))
- **Google OAuth** credentials (for Google login, optional)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd quick
npm install
```

### 2. Environment Variables

Create `.env.local`:

```env
# -- Database -----------------------------------------------------------
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/quick?sslmode=require

# -- AI -----------------------------------------------------------------
GEMINI_API_KEY=your-google-gemini-api-key
# GEMINI_MODEL=gemini-3.5-flash        # optional: override default model

# -- Auth ---------------------------------------------------------------
BETTER_AUTH_SECRET=your-random-secret-at-least-32-chars
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# -- App URL ------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

```bash
# Push schema to database
npm run db:push

# Or run migrations manually
npm run db:migrate
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents/generate` | Upload PDF, AI generate flashcards + quiz, save to DB |
| `GET` | `/api/documents` | List all active documents (excludes trashed) |
| `DELETE` | `/api/documents/:id` | Soft delete (move to trash) |
| `GET` | `/api/documents/trash` | List trashed documents + auto-delete 30-day expired |
| `POST` | `/api/documents/:id/restore` | Restore document from trash |
| `DELETE` | `/api/documents/:id/permanent` | Permanently delete document + cascade |
| `POST` | `/api/documents/:id/generate` | Re-generate flashcards for existing document |
| `GET` | `/api/documents/:id/flashcards` | Fetch flashcards |
| `GET` | `/api/documents/:id/quiz` | Fetch quiz questions + sets |
| `POST` | `/api/documents/:id/quiz/regenerate` | Generate new quiz set (uses doc's content language) |
| `POST` | `/api/quiz/:docId/submit` | Submit quiz answers, compute score |
| `GET` | `/api/documents/:id/attempts` | List all quiz attempts |
| `POST` | `/api/trial/generate` | Trial generation (no auth, results in localStorage) |
| `POST` | `/api/documents/save-trial` | Migrate trial data to saved document |

---

## Database Schema

```
+--------------+     +--------------+     +--------------+
|     user     |     |  documents   |     |  flashcards  |
+--------------+     +--------------+     +--------------+
| id (PK)      |<--| id (PK)      |<--| id (PK)      |
| email        |   | user_id (FK) |--| document_id  |--+
| name         |   | title        |   | term          |  |
| password     |   | raw_text     |   | definition    |  |
| generation_  |   | content_lang  |   +--------------+  |
|   count_today|   | deleted_at   |                      |
| last_gen_    |   | created_at   |   +--------------+  |
|   date       |   +--------------+   |  quiz_sets    |  |
+--------------+                      +--------------+  |
                                      | id (PK)      |<-+
                                      | document_id  |-|
                                      | label        | |
                                      | created_at   | |
                                      +--------------+ |
                                                     |
                   +--------------+    +--------------+
                   |quiz_questions|    | quiz_attempts |
                   +--------------+    +--------------+
                   | id (PK)      |    | id (PK)      |
                   | document_id  |    | document_id  |--+
                   | quiz_set_id  |--+ | session_id   |  |
                   | question     |  | | score        |  |
                   | options[]    |  | | total        |  |
                   | correct_idx  |  | | answers[]    |  |
                   +--------------+  | | quiz_set_id  |--+
                                     +-| created_at   |  |
                                       +--------------+  |
                                                     |
                   +--------------+                   |
                   |   session    |                   |
                   +--------------+                   |
                   | id (PK)      |                   |
                   | user_id (FK) |                   |
                   | token        |                   |
                   | expires_at   |                   |
                   +--------------+                   |
```

---

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:push      # Push schema changes to database (primary workflow)
npm run db:verify    # Verify schema matches database
npm run db:studio    # Open Drizzle Studio (DB browser)

npm run ai:test      # Test Gemini AI connection
npm run api:test     # Run API end-to-end tests
```

---

## Internationalization

The app supports two languages:

| Language | UI Locale | Content Language |
|----------|-----------|-----------------|
| Bahasa Indonesia | `id.json` | `contentLanguage: "id"` |
| English | `en.json` | `contentLanguage: "en"` |

**UI Language** — toggled via the language button in the header. Affects all labels, buttons, and messages.

**Content Language** — selected during PDF upload. Controls the language of AI-generated flashcards and quiz questions, independent of the UI language.

---

## Database Guide

### Database Overview

- **Engine**: PostgreSQL (hosted on [Neon](https://neon.tech) serverless)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) with type-safe queries
- **Schema file**: `src/db/schema.ts` (single source of truth)

### Schema Change Workflow

This project uses `db:push` to apply schema changes directly to the database. No migration files are generated or committed to git.

**Step 1: Edit schema**

```bash
# Edit src/db/schema.ts (add column, table, etc.)
# Example: add a new column to documents table
```

**Step 2: Push to database**

```bash
# Reads schema.ts, compares with DB, applies changes
npm run db:push
```

When prompted, type `y` to confirm pushing the changes.

**Step 3: Verify (optional)**

```bash
# Check if schema.ts matches the actual database
npm run db:verify
```

**Step 4: Deploy**

```bash
git add -A && git commit -m "feat: add new column"
git push origin main
# Vercel auto-deploys, no migration step needed
```

That's it. The database is always in sync with `schema.ts`.

### Useful Commands

```bash
npm run db:push      # Push schema.ts changes to database
npm run db:verify    # Verify schema.ts matches database
npm run db:studio    # Open Drizzle Studio (visual DB browser)
```

### Production Deployment

**Before deploying to production:**

```bash
# 1. Apply schema changes to production database
DATABASE_URL=<production-url> npm run db:push

# 2. Deploy app to Vercel
git push origin main
```

Vercel only runs `next build` -- it does not auto-sync schema. Always push schema changes from local before deploying.

**Alternatively, set Vercel build command to auto-push:**

```
npm run db:push && npm run build
```

In Vercel Dashboard:
1. Project Settings -> Build & Development Settings
2. Build Command: `npm run db:push && npm run build`
3. Make sure `DATABASE_URL` env var is set to production database

### Important Notes

- **Source of truth**: `src/db/schema.ts` is always the authoritative schema. The database is synced to match it via `db:push`.
- **No migration files**: This project does not generate or track migration files. If you switch to a team workflow, consider using `db:generate` + `db:migrate` instead.
- **Production backup**: Always backup production database before pushing schema changes.
- **Neon cold start**: Database sleeps on free tier. First connection takes ~2-3 seconds.
- **`db:push` confirmation**: Drizzle Kit will ask for confirmation before applying changes. Review the diff carefully before accepting.

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Set environment variables (see below)
4. Deploy

```bash
npm run build   # production build
```

### Environment Variables for Production

Make sure to update:
- `DATABASE_URL` -> production Neon connection string
- `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` -> your production domain
- `GOOGLE_CLIENT_ID` -> add production domain to authorized origins
- `trustedOrigins` in `src/lib/auth.ts` -> add production domain

---

## License

MIT
