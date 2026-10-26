import assert from "node:assert/strict";
import test from "node:test";
import type { BriefRunInfo } from "../../lib/prep-contract";
import { successfulBriefRun } from "./brief-result";
const quick: BriefRunInfo = {
  id: "quick",
  status: "completed",
  mode: "quick",
  createdAt: "2026-10-26T09:00:00Z",
  completedAt: "2026-10-26T09:01:00Z",
};
const failedDeep: BriefRunInfo = {
  id: "deep",
  status: "failed",
  mode: "deep",
  createdAt: "2026-10-26T10:00:00Z",
  completedAt: "2026-10-26T10:01:00Z",
};
test("a failed deep attempt cannot relabel a preserved successful quick brief", () => {
  assert.deepEqual(
    successfulBriefRun({ briefRun: failedDeep, briefResultRun: quick }),
    quick,
  );
});
test("an active deep attempt cannot replace the old brief's provenance", () => {
  assert.deepEqual(
    successfulBriefRun({
      briefRun: { ...failedDeep, status: "running", completedAt: null },
      briefResultRun: quick,
    }),
    quick,
  );
});
test("legacy fallback only accepts a completed run", () => {
  assert.deepEqual(successfulBriefRun({ briefRun: quick }), quick);
  assert.equal(successfulBriefRun({ briefRun: failedDeep }), null);
  assert.equal(successfulBriefRun({ briefRun: null }), null);
});
