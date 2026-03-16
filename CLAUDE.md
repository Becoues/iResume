# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build (includes type checking)
npm run lint         # ESLint
npx prisma db push   # Sync schema changes to SQLite
npx prisma generate  # Regenerate Prisma client (auto-runs on npm install)
```

## Architecture

**Next.js 14 App Router** resume analysis system with Chinese UI. Users upload PDF resumes, optionally provide a JD, and an LLM analyzes the resume across 10 structured modules via SSE streaming.

### Tech Stack & Constraints
- **Next.js 14** (NOT 15): `params` is a plain object, not a Promise. Config must be `.mjs`.
- **Prisma 5.x** (NOT v7): different config format. SQLite as database.
- **LLM**: OpenAI SDK → multi-provider support via `PROVIDER_BASE_URLS` in `openai.ts`. Providers: AiHubMix (`aihubmix.com/v1`), DeerAPI (`api.deerapi.com/v1`). Models: gemini-3.1-pro-preview, claude-sonnet-4-5, gpt-5.4, gemini-3.1-flash-lite-preview, qwen3.5-27b, deepseek-v3.2.
- **PDF**: pdfjs-dist via `pdfjs-dist/legacy/build/pdf.mjs`. Requires `experimental.serverComponentsExternalPackages` in next.config.
- **UI**: Tailwind CSS 3 + custom shadcn-style components (no Radix dependency). Icons from lucide-react.
- **Charts**: recharts for radar charts and data visualization.

### Key Data Flow
1. **Upload**: `POST /api/resumes` — PDF via FormData → pdfjs-dist text extraction → save to DB
2. **Analyze**: `POST /api/analyze/[id]` — `streamCompletion()` yields text chunks via SSE (TransformStream). Accumulated response parsed as JSON and persisted. Status: uploaded → analyzing → completed|failed
3. **View**: `/resumes/[id]` — three-column layout (fixed left nav 220px, scrollable content, fixed right 240px)

### Core Files
- `src/lib/openai.ts` — OpenAI SDK client: `streamCompletion()` (AsyncGenerator), `testConnection()`. Multi-provider via `PROVIDER_BASE_URLS`. Config priority: DB Settings → env vars.
- `src/lib/score-utils.ts` — Post-processing: recalculates finalScore from sub-scores with distribution spreading.
- `src/lib/prompt.ts` — "DNA × Four-Layer Architecture" evaluation framework. Outputs structured JSON matching `ResumeAnalysis` type.
- `src/lib/types.ts` — All TypeScript interfaces for the 10-section analysis output.
- `src/lib/pdf.ts` — PDF text extraction.
- `src/lib/db.ts` — Prisma singleton for Next.js hot reload.

### Database Models
- **Resume**: id, filename, pdfText, jdText?, analysisJson?, status (uploaded|analyzing|completed|failed), errorMessage?, recordings[]
- **Recording**: id, resumeId, filename, duration, data (Bytes/BLOB)
- **Settings**: singleton (id=1), provider, apiKeyAihubmix, apiKeyDeerapi, model

### API Routes
- `GET/POST /api/resumes` — list / upload
- `GET/DELETE /api/resumes/[id]` — read / delete
- `GET/POST /api/resumes/[id]/recordings` — list / create audio recording
- `GET/DELETE /api/resumes/[id]/recordings/[recordingId]` — read / delete recording
- `POST /api/analyze/[id]` — SSE streaming analysis
- `GET/PUT /api/settings` — read / upsert settings (apiKey masked on GET)
- `POST /api/settings/test-connection` — test LLM connectivity

### UI Patterns
- Settings dialog: gear icon on homepage (fixed bottom-right). Provider selector + API key (per-provider caching) + model selection + connection test.
- API key masking: first 4 + `...` + last 4 on GET. Test-connection resolves masked keys from DB.
- Favorites: `localStorage` keyed by `favorites-{resumeId}`.
- Recording: browser `MediaRecorder` API (audio/webm), stored as BLOB in SQLite.
- Detail page (`/resumes/[id]`): ~2000 lines — all 10 analysis modules rendered in this single file.

### Analysis Modules (10 sections)
JD key points, candidate profile, four-layer architecture scoring (4×5=20 max), DNA fitness (6×5=30 max), capability matrix, claims audit, project deep analysis, assessment framework, 15 technical questions (5 basic + 5 intermediate + 5 expert), 9 algorithm questions (3 easy + 3 medium + 3 hard), score card (0-100).
