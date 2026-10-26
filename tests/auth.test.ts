import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, verifySession, safeReturnPath, requestOriginAllowed } from "../src/lib/auth";

const secret = "test-secret-at-least-32-characters-long";
test("session signature rejects modification, wrong keys and expired sessions", async () => {
  const now = 1_700_000_000_000;
  const token = await createSession(secret, now);
  assert.equal(await verifySession(token, secret, now + 1), true);
  assert.equal(await verifySession(token + "x", secret, now), false);
  assert.equal(await verifySession(token, "different-secret", now), false);
  assert.equal(await verifySession(token, secret, now + 8 * 86_400_000), false);
  assert.equal(await verifySession("broken", secret, now), false);
});
test("login returns only to a local safe path", () => {
  assert.equal(safeReturnPath("/resumes/123?tab=questions"), "/resumes/123?tab=questions");
  for (const path of ["//evil.test", "https://evil.test", "/\\evil.test", "/login", "javascript:alert(1)"]) {
    assert.equal(safeReturnPath(path), "/");
  }
});
test("mutating requests reject foreign origins and cross-site requests", () => {
  assert.equal(requestOriginAllowed("https://prep.test", null, "https://prep.test"), true);
  assert.equal(requestOriginAllowed("https://evil.test", "cross-site", "https://prep.test"), false);
  assert.equal(requestOriginAllowed(null, "cross-site", "https://prep.test"), false);
  assert.equal(requestOriginAllowed(null, null, "https://prep.test"), true);
});
