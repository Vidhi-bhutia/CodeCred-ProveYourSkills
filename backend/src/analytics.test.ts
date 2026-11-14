import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  badges,
  countLines,
  languageFor,
  similarity,
} from "./analytics.js";
test("LOC excludes blank lines and supports CRLF", () =>
  assert.equal(countLines("const a = 1;\r\n\r\n // comment\r\n"), 2));
test("generated, vendored and unsupported paths are excluded", () => {
  for (const path of [
    "node_modules/a.ts",
    "src/generated/a.ts",
    "bundle.min.js",
    "a.d.ts",
    "image.png",
    "package-lock.json",
  ])
    assert.equal(languageFor(path), null, path);
  assert.equal(languageFor("src/main.tsx"), "TypeScript");
});
test("only complete selected analyses contribute to evidence", () => {
  const stats = aggregate([
    {
      status: "ready",
      languages: { TypeScript: 80, Python: 20 },
      tags: ["TypeScript"],
    },
    { status: "error", languages: { Rust: 999 }, tags: ["Rust"] },
  ]);
  assert.equal(stats.totalLoc, 100);
  assert.equal(stats.languages[0].percentage, 80);
  assert.equal(stats.analyzedCount, 1);
  assert.deepEqual(stats.tags, ["TypeScript"]);
  assert.equal(stats.personalAdditions, null);
});
test("badges require analyzed evidence", () => {
  assert.equal(badges(aggregate([])).length, 0);
  assert.equal(
    badges(aggregate([{ status: "ready", languages: { Python: 100 } }]))[0]
      .name,
    "First proof",
  );
});
test("similarity compares distribution rather than total LOC", () => {
  const a = aggregate([
    {
      status: "ready",
      languages: { Python: 100, TypeScript: 100 },
      tags: ["Python", "TypeScript"],
    },
  ]);
  const b = aggregate([
    {
      status: "ready",
      languages: { Python: 1000, TypeScript: 1000 },
      tags: ["Python", "TypeScript"],
    },
  ]);
  const c = aggregate([
    { status: "ready", languages: { Rust: 200 }, tags: ["Rust"] },
  ]);
  assert.equal(similarity(a, b).score, 100);
  assert.ok(similarity(a, c).score < 20);
  assert.equal(similarity(a, aggregate([])).score, 0);
});
