import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { analyze, encrypt, decrypt } from "./github.js";
import { config } from "./config.js";

test("token encryption is randomized and rejects tampering", () => {
  const previous = config.encryptionKey;
  config.encryptionKey = randomBytes(32).toString("hex");
  try {
    const first = encrypt("test-only-token");
    assert.notEqual(first, encrypt("test-only-token"));
    assert.ok(!first.includes("test-only-token"));
    assert.equal(decrypt(first), "test-only-token");
    const parts = first.split(":");
    parts[2] = (parts[2].startsWith("00") ? "ff" : "00") + parts[2].slice(2);
    assert.throws(() => decrypt(parts.join(":")));
  } finally {
    config.encryptionKey = previous;
  }
});

test("analysis uses an immutable tree, excludes generated content and derives real framework evidence", async (t) => {
  const calls: string[] = [];
  const source =
    'import React from "react";\n' +
    Array.from({ length: 20 }, (_, i) => `const value${i} = ${i};`).join("\n");
  const fixtures: Record<string, unknown> = {
    "/repos/owner/example/commits/main": {
      sha: "commit-sha",
      commit: { tree: { sha: "tree-sha" } },
    },
    "/repos/owner/example/git/trees/tree-sha?recursive=1": {
      truncated: false,
      tree: [
        { type: "blob", path: "src/main.tsx", sha: "source-blob", size: 500 },
        {
          type: "blob",
          path: "src/client.ts",
          sha: "generated-blob",
          size: 100,
        },
        { type: "blob", path: "vendor/a.ts", sha: "vendor-blob", size: 100 },
        { type: "blob", path: "README.md", sha: "readme-blob", size: 100 },
      ],
    },
    "/repos/owner/example/git/blobs/source-blob": {
      encoding: "base64",
      content: Buffer.from(source).toString("base64"),
    },
    "/repos/owner/example/git/blobs/generated-blob": {
      encoding: "base64",
      content: Buffer.from("// @generated\nconst a=1;").toString("base64"),
    },
  };
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const parsed = new URL(String(url));
    const path = parsed.pathname + parsed.search;
    calls.push(path);
    assert.ok(path in fixtures, `Unexpected request: ${path}`);
    return new Response(JSON.stringify(fixtures[path]), { status: 200 });
  });
  const result = await analyze(
    { size: 10, full_name: "owner/example", default_branch: "main" },
    "test-only",
  );
  assert.equal(result.loc, 21);
  assert.deepEqual(result.languages, { TypeScript: 21 });
  assert.ok(result.tags.includes("React"));
  assert.ok(result.tags.includes("TypeScript"));
  assert.equal(result.analyzedSha, "commit-sha");
  assert.equal(result.analyzedFiles, 1);
  assert.equal(result.excludedFiles, 3);
  assert.equal(calls.length, 4);
});

test("truncated repository trees fail before publishing partial analytics", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request) =>
      new Response(
        JSON.stringify(
          String(url).includes("/commits/")
            ? { commit: { tree: { sha: "tree-sha" } } }
            : { truncated: true, tree: [] },
        ),
        { status: 200 },
      ),
  );
  await assert.rejects(
    analyze(
      { size: 10, full_name: "owner/example", default_branch: "main" },
      "test-only",
    ),
    /No partial statistics/,
  );
});
