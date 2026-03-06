# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build (also runs type checking)
npm run lint         # ESLint
npx prisma db push   # Sync schema changes to SQLite
npx prisma generate  # Regenerate Prisma client (auto-runs on npm install)
```

## Architecture

This is a **Next.js 14 App Router** resume analysis system with Chinese UI. Users upload PDF resumes, optionally provide a job description (JD), and an LLM analyzes the resume across 10 structured modules.

### Tech Stack
- **Framework**: Next.js 14 (App Router, NOT 15 — params is a plain object, not a Promise)
- **Database**: SQLite via Prisma 5.x (NOT v7 — different config format)
- **LLM**: OpenAI SDK → AiHubMix proxy (`https://aihubmix.com/v1`), model `gemini-3.1-pro-preview`
- **PDF**: pdfjs-dist (NOT pdf-parse — it can't handle modern PDFs)
- **UI**: Tailwind CSS 3 + custom shadcn-style components (no Radix dependency)

### Key Data Flow
1. **Upload**: `POST /api/resumes` — accepts PDF via FormData, extracts text with pdfjs-dist, saves to DB
2. **Analyze**: `POST /api/analyze/[id]` — streams LLM response via SSE (TransformStream), parses final JSON into `analysisJson`
3. **View**: `/resumes/[id]` — three-column layout (fixed left nav 220px, scrollable content, fixed right panel 240px)

### Core Files
- `src/lib/prompt.ts` — System prompt defining the "DNA × Four-Layer Architecture" evaluation framework; outputs structured JSON matching `ResumeAnalysis` type
- `src/lib/openai.ts` — OpenAI client configured for AiHubMix; env var `AIHUBMIX_API_KEY`
- `src/lib/pdf.ts` — PDF text extraction using `pdfjs-dist/legacy/build/pdf.mjs`
- `src/lib/db.ts` — Prisma singleton pattern for Next.js hot reload

### Analysis Modules (10 sections)
The LLM returns structured JSON with: JD key points, candidate profile, four-layer architecture scoring (4×5=20 max), DNA fitness (6×5=30 max), capability matrix, claims audit, project analysis, assessment framework, 20 technical questions, key observations + score card.

### Database Models
- **Resume**: id, filename, pdfText, jdText?, analysisJson?, status (uploaded|analyzing|completed|failed), recordings[]
- **Recording**: id, resumeId, filename, duration, data (Bytes/BLOB), createdAt

### UI Patterns
- Favorites persisted in `localStorage` keyed by `favorites-{resumeId}`
- Recording uses browser `MediaRecorder` API (audio/webm), stored as BLOB in SQLite
- The detail page (`/resumes/[id]`) is ~2000 lines — all analysis rendering is in this single file

### Important Constraints
- Next.js 14: use `const { id } = params` (NOT `use(params)` which is Next.js 15)
- next.config must be `.mjs` (Next.js 14 doesn't support `.ts` config)
- Use `experimental.serverComponentsExternalPackages` (NOT `serverExternalPackages`)
- Prisma 5.x: don't upgrade to v7 without migration
