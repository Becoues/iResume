# Interview Preparation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. User authorized concurrent implementation and deployment.

**Goal:** Ship a working pre-interview briefing app with broad resume ingestion, multiple AI providers and a reachable protected URL.
**Architecture:** Use patched Next.js 15.5.28, Prisma 5 and SQLite. Add brief-specific contracts and persistent runs; replace report-heavy UI with a briefing workspace.
**Tech Stack:** React 18, Tailwind 3, Zod, OpenAI-compatible client, AWS Bedrock SDK, document extraction and OCR.
**Spec:** ../specs/2026-10-26-interview-prep.md

## Global Constraints
- No voice UI or new recording writes.
- Preserve old analysis and recording data.
- No secrets in browser responses, logs or Git.
- Never fabricate source evidence; model result must pass schema and evidence checks.
- Existing stack retained; no deployment/runtime migration to Workers.

## Review Focus
- Corrupt/mislabeled/oversize files and scans must produce useful errors.
- Missing credentials must not produce fabricated demo analysis.
- Duplicate/stale jobs must not overwrite successful results.
- Model quotes unsupported by input must be flagged or removed.
- Mobile, keyboard navigation, failed requests and refresh while running must work.

## Tasks and ownership
- [x] T1 contracts/schema: main creates shared brief and settings DTOs; backend owns subsequent Prisma changes.
- [x] T2 AI/runtime: backend worker owns src/lib/ai/**, src/lib/brief**, src/app/api/briefs/**, settings routes, Prisma. Tests cover validation, evidence and provider configuration; implement frozen config and job claim; verify tests.
- [x] T3 UI: frontend worker owns src/app/{page,layout,globals}, resumes pages, settings page, src/components/prep/**. Consume shared DTOs; no recording UI; functional upload, list, detail, settings and print.
- [x] T4 ingestion: ingestion worker owns src/lib/ingestion/**, src/app/api/resumes/**, tests/ingestion*. Support text/Word/PDF/images with limits, OCR and clear failures. Remove recording endpoint functionality without deleting historical files.
- [x] T5 integration/deploy: main owns package files, Docker/entrypoint, auth, smoke/browser tests, docs. Pin compatible toolchain; migrate DB, run build and tests; inspect existing hosting before deployment; publish and verify URL.
- [x] T6 independent final review; fix blocking findings and recheck touched behavior.

## API contract
POST /api/resumes accepts multipart `file` and optional `jd`, or JSON `{ text, filename?, jd? }`; returns existing Resume shape `{id,...}` with `warnings`.
POST /api/briefs/:id accepts `{mode:"quick"|"deep"}` (default quick), returns 202 `{runId,status}`; duplicate active run returns same run 202.
GET /api/resumes/:id returns existing fields plus `brief: CandidateBrief|null`, `briefStatus:idle|running|completed|failed`, `briefError:string|null`, `briefRun: {id,status,mode,createdAt,completedAt?,model?,provider?}|null`.
GET /api/resumes returns summary array including `briefStatus` and brief-derived candidateName/techDirection/summary.
GET/PUT /api/settings and POST /api/settings/test-connection consume shared public AiSettings; blank secrets mean keep existing; explicit clear flags clear.
DELETE /api/resumes/:id removes candidate and related run records safely; any active run receives 409.
The shared contracts in src/lib/prep-contract.ts are authoritative. Workers coordinate changes with main.

## Decisions
- Prioritise a complete real brief flow; deeper preparation adds questions and evidence, not unrelated interview management.
- OCR is local where practical to avoid requiring a vision-capable configured provider.
- UI changes verified with real browser flows; backend changes receive meaningful automated tests before implementation.
- User approval already given; proceed without another planning gate.

## Delivery decisions
- User requested agile iteration: after focused fixes, only production build and a real browser/model smoke run; no expanded test campaign.
- Retained React18/Prisma5; moved Next14 to patched15.5.28 and PDF parser to5.7.284.
- Native systemd deployment avoids duplicating runtime dependencies; Caddy terminates HTTPS.
