import test from "node:test";
import assert from "node:assert/strict";
import {
  sealSecret,
  openSecret,
  resolveConfig,
  publicConfig,
} from "../src/lib/ai/config";
test("saved secrets are encrypted and require the same deployment secret", () => {
  const secret = "private-test-key";
  const sealed = sealSecret(secret, "a".repeat(40));
  assert.ok(!sealed.includes(secret));
  assert.equal(openSecret(sealed, "a".repeat(40)), secret);
  assert.throws(() => openSecret(sealed, "b".repeat(40)));
  assert.throws(() => sealSecret(secret, ""));
});
test("public config contains availability flags but no secret material", () => {
  const config = resolveConfig(null, {
    AI_PROVIDER: "CometAPI",
    COMETAPI_API_KEY: "private-test-key",
  });
  const view = publicConfig(config);
  assert.equal(view.hasApiKey, true);
  assert.equal(view.configured, true);
  assert.ok(!JSON.stringify(view).includes("private-test-key"));
});
test("blank keys preserve saved keys and environment fallback; unsupported providers fail", () => {
  const config = resolveConfig(
    null,
    { COMETAPI_API_KEY: "env-secret" },
    { apiKey: "", model: "test" },
  );
  assert.equal(config.apiKey, "env-secret");
  assert.throws(() =>
    resolveConfig(null, {}, { provider: "Invalid" as never }),
  );
});
test("configured status requires a model, matching credentials and valid endpoint", () => {
  assert.equal(publicConfig(resolveConfig(null, {})).configured, false);
  assert.throws(() =>
    resolveConfig(null, {}, { baseUrl: "https://user:password@example.com" }),
  );
  const c = resolveConfig(
    null,
    { AI_PROVIDER: "Bedrock", AI_MODEL: "model", AWS_REGION: "us-east-1" },
    { authMode: "default" },
  );
  assert.equal(publicConfig(c).configured, true);
});
test("switching to another provider never sends the previous saved provider credential", () => {
  const stored = {
    provider: "CometAPI",
    model: "old",
    apiKeyEncrypted: sealSecret("comet-only-key", "x".repeat(40)),
    baseUrl: "https://api.cometapi.com/v1",
  };
  const next = resolveConfig(
    stored,
    { APP_SECRET: "x".repeat(40), OPENAI_API_KEY: "openai-env-key" },
    { provider: "OpenAI-compatible", baseUrl: "https://example.com/v1" },
  );
  assert.equal(next.apiKey, "openai-env-key");
});
