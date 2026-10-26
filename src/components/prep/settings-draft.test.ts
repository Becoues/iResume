import assert from "node:assert/strict";
import test from "node:test";
import type { AiSettings } from "../../lib/prep-contract";
import { switchProviderDraft } from "./settings-draft";

const openAiDraft: AiSettings = {
  provider: "OpenAI-compatible",
  model: "old-provider-model",
  baseUrl: "https://private-provider.example/v1?token=draft-secret",
  region: "eu-west-1",
  authMode: "apiKey",
  apiKey: "unsaved-openai-secret",
  bedrockApiKey: "unsaved-bedrock-secret",
  hasApiKey: true,
  hasBedrockApiKey: true,
  configured: true,
};

test("changing providers cannot forward draft secrets or a custom endpoint", () => {
  const next = switchProviderDraft(openAiDraft, "CometAPI");
  assert.equal(next.provider, "CometAPI");
  assert.equal(next.baseUrl, "https://api.cometapi.com/v1");
  assert.equal(next.apiKey, "");
  assert.equal(next.bedrockApiKey, "");
  assert.equal(next.hasApiKey, false);
  assert.equal(next.hasBedrockApiKey, false);
  assert.equal(next.configured, false);
  assert.equal(next.model, "");
  assert.ok(!JSON.stringify(next).includes("secret"));
});

test("changing to custom API or Bedrock starts with a clean endpoint and credentials", () => {
  for (const provider of ["OpenAI-compatible", "Bedrock"] as const) {
    const next = switchProviderDraft(
      { ...openAiDraft, provider: "CometAPI" },
      provider,
    );
    assert.equal(next.baseUrl, "");
    assert.equal(next.apiKey, "");
    assert.equal(next.bedrockApiKey, "");
    assert.equal(next.hasApiKey, false);
    assert.equal(next.hasBedrockApiKey, false);
    assert.equal(next.region, "us-west-2");
    assert.equal(next.authMode, "default");
  }
});

test("selecting the active provider retains its own draft", () => {
  assert.deepEqual(
    switchProviderDraft(openAiDraft, "OpenAI-compatible"),
    openAiDraft,
  );
});

test("switching back does not restore the previous provider's secret draft", () => {
  const next = switchProviderDraft(
    switchProviderDraft(openAiDraft, "CometAPI"),
    "OpenAI-compatible",
  );
  assert.equal(next.baseUrl, "");
  assert.equal(next.apiKey, "");
  assert.equal(next.hasApiKey, false);
});
