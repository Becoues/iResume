import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const temp = mkdtempSync(join(tmpdir(), "ingestion-api-"));
process.env.DATABASE_URL = `file:${join(temp, "test.db")}`;
process.env.RECORDINGS_DIR = join(temp, "recordings");
let db: typeof import("../src/lib/db").prisma;
let list: typeof import("../src/app/api/resumes/route");
let detail: typeof import("../src/app/api/resumes/[id]/route");
before(async () => {
  execFileSync("node", ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: process.env, stdio: "pipe" });
  db = (await import("../src/lib/db")).prisma;
  list = await import("../src/app/api/resumes/route");
  detail = await import("../src/app/api/resumes/[id]/route");
});
after(async () => { await db?.$disconnect(); rmSync(temp, { recursive: true, force: true }); });
test("paste creates a readable resume with briefing contract and list summary", async () => {
  const res = await list.POST(new Request("http://local/api/resumes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "张三\n负责数据仓库", jd: "数据工程师" }) }));
  assert.equal(res.status, 201);
  const created = await res.json(); assert.equal(created.sourceType, "text"); assert.deepEqual(created.warnings, []);
  const view = await (await detail.GET(new Request("http://local"), { params: Promise.resolve({ id: created.id }) })).json();
  assert.equal(view.pdfText, "张三\n负责数据仓库"); assert.equal(view.briefStatus, "idle"); assert.equal(view.brief, null); assert.equal(view.briefRun, null);
  const summaries = await (await list.GET(new Request("http://local/api/resumes?limit=1"))).json();
  assert.equal(summaries.length, 1); assert.equal(summaries[0].briefStatus, "idle"); assert.equal(summaries[0].pdfText, undefined);
});
test("multipart handles non-PDF and bad JSON has actionable validation", async () => {
  const form = new FormData(); form.set("file", new File(["李四\nJava 后端开发"], "cv.txt", { type: "text/plain" }));
  assert.equal((await list.POST(new Request("http://local/api/resumes", { method: "POST", body: form }))).status, 201);
  assert.equal((await list.POST(new Request("http://local/api/resumes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status, 400);
});
test("explicit deletion blocks active jobs then removes related rows and historical files", async () => {
  const row = await db.resume.create({ data: { filename: "history.pdf", pdfText: "旧简历", briefStatus: "running" } });
  const run = await db.analysisRun.create({ data: { resumeId: row.id, mode: "quick", provider: "test", model: "test", configJson: "{}" } });
  mkdirSync(process.env.RECORDINGS_DIR!, { recursive: true }); writeFileSync(join(process.env.RECORDINGS_DIR!, "old.webm"), "old audio");
  await db.recording.create({ data: { resumeId: row.id, filename: "旧录音", duration: 1, path: "old.webm" } });
  assert.equal((await detail.DELETE(new Request("http://local"), { params: Promise.resolve({ id: row.id }) })).status, 409);
  assert.equal(existsSync(join(process.env.RECORDINGS_DIR!, "old.webm")), true);
  await db.resume.update({ where: { id: row.id }, data: { briefStatus: "failed" } });
  await db.analysisRun.update({ where: { id: run.id }, data: { status: "failed" } });
  assert.equal((await detail.DELETE(new Request("http://local"), { params: Promise.resolve({ id: row.id }) })).status, 200);
  assert.equal(await db.recording.count({ where: { resumeId: row.id } }), 0); assert.equal(await db.analysisRun.count({ where: { resumeId: row.id } }), 0);
  assert.equal(existsSync(join(process.env.RECORDINGS_DIR!, "old.webm")), false);
});
test("recording endpoints are retired without mutating historical data", async () => {
  const collection = await import("../src/app/api/resumes/[id]/recordings/route");
  const recording = await import("../src/app/api/resumes/[id]/recordings/[recordingId]/route");
  assert.equal((await collection.GET()).status, 410); assert.equal((await collection.POST()).status, 410);
  assert.equal((await recording.GET()).status, 410); assert.equal((await recording.DELETE()).status, 410);
});
