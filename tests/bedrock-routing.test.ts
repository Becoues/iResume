import { test } from "node:test";
import assert from "node:assert/strict";
import { mantleEndpoint } from "../src/lib/ai/bedrock-routing";

test("bare OpenAI model IDs use their Mantle path, while profiles stay on Runtime", () => {
  assert.equal(mantleEndpoint("openai.gpt-6-astra", "us-west-2"), "https://bedrock-mantle.us-west-2.api.aws/openai/v1");
  assert.equal(mantleEndpoint("openai.gpt-oss-120b", "us-west-2"), "https://bedrock-mantle.us-west-2.api.aws/v1");
  assert.equal(mantleEndpoint("us.openai.gpt-6-astra", "us-west-2"), null);
  assert.equal(mantleEndpoint("arn:aws:bedrock:us-west-2:123:application-inference-profile/abc", "us-west-2"), null);
  assert.equal(mantleEndpoint("anthropic.claude-sonnet-4-6", "us-west-2"), null);
});
