export const extensions: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  c: "C",
  h: "C",
  cpp: "C++",
  cs: "C#",
  rb: "Ruby",
  php: "PHP",
  swift: "Swift",
  kt: "Kotlin",
  html: "HTML",
  css: "CSS",
  scss: "CSS",
  vue: "Vue",
  svelte: "Svelte",
  sql: "SQL",
  sh: "Shell",
};
export function languageFor(path: string) {
  if (
    /(^|\/)(node_modules|vendor|dist|build|coverage|\.git|\.next|__generated__|generated|third_party|fixtures)(\/|$)/i.test(
      path,
    ) ||
    /(?:\.min\.|\.d\.ts$|\.generated\.|\.lock$|lock\.json$)/i.test(path)
  )
    return null;
  return extensions[path.split(".").pop()?.toLowerCase() || ""] || null;
}
// Physical non-blank source lines. Comments are included; this is codebase size, not authorship.
export function countLines(source: string) {
  return source.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}
export type EvidenceRepo = {
  status?: string | null;
  loc?: number | null;
  languages?: Map<string, number> | Record<string, number> | null;
  tags?: string[] | null;
  syncedAt?: Date | null;
};
export function aggregate(repos: EvidenceRepo[]) {
  const languages: Record<string, number> = {};
  const tags = new Set<string>();
  for (const repo of repos.filter((r) => r.status === "ready")) {
    for (const [language, loc] of repo.languages instanceof Map
      ? repo.languages.entries()
      : Object.entries(repo.languages || {}))
      languages[language] = (languages[language] || 0) + loc;
    repo.tags?.forEach((t) => tags.add(t));
  }
  const totalLoc = Object.values(languages).reduce((a, b) => a + b, 0);
  return {
    totalLoc,
    languages: Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .map(([name, loc]) => ({
        name,
        loc,
        percentage: totalLoc ? Math.round((loc / totalLoc) * 1000) / 10 : 0,
      })),
    tags: [...tags],
    importedCount: repos.length,
    analyzedCount: repos.filter((r) => r.status === "ready").length,
    personalAdditions: null,
    personalDeletions: null,
    commits: null,
    pullRequests: null,
    issues: null,
    lastSync:
      repos
        .map((r) => r.syncedAt)
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a))[0] || null,
  };
}
export function badges(stats: ReturnType<typeof aggregate>) {
  const result = [];
  if (stats.analyzedCount)
    result.push({
      name: "First proof",
      reason: "Imported and analyzed your first selected repository.",
    });
  if (stats.languages.filter((l) => l.loc >= 100).length >= 3)
    result.push({
      name: "Polyglot",
      reason:
        "At least 100 source lines in each of three languages across selected repositories.",
    });
  if (stats.analyzedCount >= 5)
    result.push({
      name: "Project builder",
      reason: "Five selected repositories successfully analyzed.",
    });
  return result;
}
export function similarity(
  a: ReturnType<typeof aggregate>,
  b: ReturnType<typeof aggregate>,
) {
  if (!a.totalLoc || !b.totalLoc)
    return { score: 0, explanation: "More repository evidence needed" };
  const names = new Set([...a.languages, ...b.languages].map((l) => l.name));
  let dot = 0,
    aa = 0,
    bb = 0;
  for (const name of names) {
    const x = (a.languages.find((l) => l.name === name)?.loc || 0) / a.totalLoc;
    const y = (b.languages.find((l) => l.name === name)?.loc || 0) / b.totalLoc;
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  const union = new Set([...a.tags, ...b.tags]);
  const overlap = a.tags.filter((t) => b.tags.includes(t));
  const language = dot / Math.sqrt(aa * bb),
    stack = union.size ? overlap.length / union.size : 0;
  const diversity =
    1 -
    Math.abs(a.languages.length - b.languages.length) /
      Math.max(a.languages.length, b.languages.length, 1);
  return {
    score: Math.round((0.65 * language + 0.25 * stack + 0.1 * diversity) * 100),
    explanation: overlap.length
      ? `Shared evidence in ${overlap.slice(0, 3).join(", ")}`
      : "Similar language distribution and project diversity",
  };
}
