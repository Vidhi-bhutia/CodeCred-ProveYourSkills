import { test } from "node:test";
import assert from "node:assert/strict";
// Isolate readiness tests from local credentials before importing configuration.
for (const key of [
  "MONGODB_URI",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "SESSION_SECRET",
  "TOKEN_ENCRYPTION_KEY",
])
  process.env[key] = "";
const { app } = await import("./app.js");
test("unconfigured API reports readiness and never fakes authentication", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).configured, false);
    for (const path of [
      "/api/me",
      "/api/discover",
      "/api/auth/github",
      "/api/repositories",
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /not configured/);
      assert.equal(response.headers.get("set-cookie"), null);
    }
    const response = await fetch(`${base}/api/health`, {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.notEqual(
      response.headers.get("access-control-allow-origin"),
      "https://untrusted.example",
    );
    assert.match(
      response.headers.get("content-security-policy") || "",
      /default-src/,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
