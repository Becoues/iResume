import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const temp = mkdtempSync(join(tmpdir(), "brief-runtime-"));
process.env.DATABASE_URL = `file:${join(temp, "test.db")}`;
let db: typeof import("../src/lib/db").prisma;
let runtime: typeof import("../src/lib/brief-runtime");
const config = {
  provider: "CometAPI" as const,
  model: "test",
  baseUrl: "https://example.com/v1",
  region: "us-west-2",
  authMode: "default" as const,
  apiKey: "secret-should-not-persist",
  bedrockApiKey: "",
};
before(async () => {
  execFileSync(
    "node",
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, stdio: "pipe" },
  );
  db = (await import("../src/lib/db")).prisma;
  runtime = await import("../src/lib/brief-runtime");
});
after(async () => {
  await db?.$disconnect();
  rmSync(temp, { recursive: true, force: true });
});
test("simultaneous claims create exactly one persisted run without storing credentials", async () => {
  const row = await db.resume.create({
    data: { filename: "one.txt", pdfText: "本人负责系统开发" },
  });
  const claims = await Promise.all([
    runtime.claimBrief(row.id, "quick", config),
    runtime.claimBrief(row.id, "deep", config),
  ]);
  assert.equal(claims[0].runId, claims[1].runId);
  assert.equal(claims.filter((c) => c.claimed).length, 1);
  const runs = await db.analysisRun.findMany({ where: { resumeId: row.id } });
  assert.equal(runs.length, 1);
  assert.ok(!runs[0].configJson.includes("secret-should-not-persist"));
  const view = await runtime.getBriefState(row.id);
  assert.equal(view.briefStatus, "running");
  assert.equal(view.briefRun?.id, claims[0].runId);
});
test("failed retries preserve the last successful brief and stale late finishes cannot replace it", async () => {
  const brief = { version: 1, candidate: { name: "旧简报" } } as never;
  const row = await db.resume.create({
    data: {
      filename: "two.txt",
      pdfText: "本人负责系统开发",
      briefJson: JSON.stringify(brief),
      briefStatus: "completed",
    },
  });
  const run = await runtime.claimBrief(row.id, "quick", config);
  await runtime.finishBrief(row.id, run.runId, null, "连接失败");
  assert.equal(
    (await runtime.getBriefState(row.id)).brief?.candidate.name,
    "旧简报",
  );
  const next = await runtime.claimBrief(row.id, "deep", config);
  await db.analysisRun.update({
    where: { id: next.runId },
    data: { createdAt: new Date(Date.now() - 180_000) },
  });
  const recovered = await runtime.getBriefState(row.id);
  assert.equal(recovered.briefStatus, "failed");
  assert.match(recovered.briefError!, /超时/);
  await runtime.finishBrief(
    row.id,
    next.runId,
    { version: 1, candidate: { name: "已超时的输出" } } as never,
    null,
  );
  assert.equal(
    (await runtime.getBriefState(row.id)).brief?.candidate.name,
    "旧简报",
  );
});
test("saved settings encrypt keys, blank inputs preserve keys, explicit clear reverts to environment", async () => {
  process.env.APP_SECRET = "deployment-test-key-".repeat(3);
  process.env.COMETAPI_API_KEY = "fallback-key";
  const { saveSettings, getRuntimeConfig } =
    await import("../src/lib/ai/config");
  const view = await saveSettings({
    provider: "CometAPI",
    model: "test",
    apiKey: "saved-private-key",
  });
  assert.equal(view.hasApiKey, true);
  assert.ok(!JSON.stringify(view).includes("saved-private-key"));
  assert.ok(
    !(
      await db.settings.findUniqueOrThrow({ where: { id: 1 } })
    ).apiKeyEncrypted.includes("saved-private-key"),
  );
  await saveSettings({ apiKey: "" });
  assert.equal((await getRuntimeConfig()).apiKey, "saved-private-key");
  await saveSettings({ clearApiKey: true });
  assert.equal((await getRuntimeConfig()).apiKey, "fallback-key");
});

test("saving a provider switch removes the prior provider credential", async () => {
  const { saveSettings, getRuntimeConfig } =
    await import("../src/lib/ai/config");
  await saveSettings({
    provider: "CometAPI",
    apiKey: "never-send-to-another-provider",
  });
  await saveSettings({
    provider: "OpenAI-compatible",
    model: "test",
    baseUrl: "https://example.com/v1",
    apiKey: "",
  });
  assert.notEqual(
    (await getRuntimeConfig()).apiKey,
    "never-send-to-another-provider",
  );
  assert.equal(
    (await db.settings.findUniqueOrThrow({ where: { id: 1 } })).apiKeyEncrypted,
    "",
  );
});

test("failed deep attempt retains the successful quick brief metadata", async () => {
  const row = await db.resume.create({
    data: { filename: "metadata.txt", pdfText: "本人负责支付系统开发" },
  });
  const quick = await runtime.claimBrief(row.id, "quick", config);
  await runtime.finishBrief(
    row.id,
    quick.runId,
    { version: 1, candidate: { name: "快速简报候选人" } } as never,
    null,
  );
  const completedAt = new Date("2026-10-25T10:00:00.000Z");
  await db.analysisRun.update({
    where: { id: quick.runId },
    data: { completedAt },
  });
  const deep = await runtime.claimBrief(row.id, "deep", {
    ...config,
    model: "deep-model",
  });
  await runtime.finishBrief(row.id, deep.runId, null, "模型连接失败");
  const view = await runtime.getBriefState(row.id);
  const resultRun = view.briefResultRun;
  assert.equal(view.brief?.candidate.name, "快速简报候选人");
  assert.equal(view.briefStatus, "failed");
  assert.equal(view.briefRun?.id, deep.runId);
  assert.equal(view.briefRun?.mode, "deep");
  assert.equal(resultRun?.id, quick.runId);
  assert.equal(resultRun?.mode, "quick");
  assert.equal(resultRun?.status, "completed");
  assert.equal(resultRun?.model, "test");
  assert.equal(resultRun?.completedAt, "2026-10-25T10:00:00.000Z");
});
