import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { testJsonConnection, publicError } from "../src/lib/ai/client";
import type { RuntimeConfig } from "../src/lib/ai/config";
test("compatible provider receives real JSON request and capability test validates response", async () => {
  const requests: unknown[] = [];
  const server = createServer(async (req, res) => {
    let data = "";
    for await (const chunk of req) data += chunk;
    requests.push(JSON.parse(data));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "test",
        object: "chat.completion",
        created: 1,
        model: "test",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: '{"ok":true}' },
            finish_reason: "stop",
          },
        ],
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as { port: number };
    const config: RuntimeConfig = {
      provider: "OpenAI-compatible",
      model: "test",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      region: "us-west-2",
      authMode: "default",
      apiKey: "private-test-key",
      bedrockApiKey: "",
    };
    assert.equal((await testJsonConnection(config)).ok, true);
    const body = requests[0] as { response_format: unknown; model: string };
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.model, "test");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
test("provider error bodies containing secret material are never returned", async () => {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    req.resume();
    res.writeHead(401, { "content-type": "application/json" });
    res.end('{"error":{"message":"private-api-key-leaked-by-upstream"}}');
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as { port: number };
    const config: RuntimeConfig = {
      provider: "OpenAI-compatible",
      model: "test",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      region: "us-west-2",
      authMode: "default",
      apiKey: "private-test-key",
      bedrockApiKey: "",
    };
    await assert.rejects(testJsonConnection(config), (error: unknown) => {
      assert.ok(!publicError(error).includes("private-api-key"));
      assert.match(publicError(error), /认证失败/);
      return true;
    });
    assert.equal(requests, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
