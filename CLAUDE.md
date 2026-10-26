# iResume project guidance

Next.js 15.5.28 App Router, React 18, TypeScript, Tailwind 3, Prisma 5 / SQLite. Node 22.13+.
Next was upgraded from 14 to the patched 15 release during the approved interview-prep refactor. Dynamic route params are Promises and must be awaited. `serverExternalPackages` is a top-level Next config field.

Product: urgent pre-interview preparation. Upload/paste resume + optional JD → short evidence-based brief → optional deeper questions. No voice or live-interview features. Preserve old analysis and recording data, but old recording/analyze endpoints return 410.

Shared DTOs: src/lib/prep-contract.ts. AI providers/config: src/lib/ai/. Brief validation and persistent run lifecycle: src/lib/brief-*.ts. Ingestion: src/lib/ingestion/. UI: src/components/prep/ and app pages.

Commands: npm ci; npm run setup:ocr; npx prisma migrate deploy; npm run dev; npm test; npm run typecheck; npm run build.

Database migrations must preserve legacy data. Production credentials live outside Git, and APP_SECRET encrypts stored provider keys. Production requires APP_PASSWORD and APP_ORIGIN. The deployment is a single long-lived Node instance; do not imply serverless background-job guarantees.

Prefer focused checks and one end-to-end smoke run; user explicitly requested agile iteration without excessive repeated testing.
