import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "./config.js";
import { countLines, languageFor } from "./analytics.js";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAt?: Date,
  ) {
    super(message);
  }
}
export function encrypt(token: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(config.encryptionKey, "hex"),
      iv,
    );
  return [
    iv.toString("hex"),
    cipher.update(token, "utf8", "hex") + cipher.final("hex"),
    cipher.getAuthTag().toString("hex"),
  ].join(":");
}
export function decrypt(value: string) {
  const [iv, data, tag] = value.split(":");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(config.encryptionKey, "hex"),
    Buffer.from(iv, "hex"),
  );
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return cipher.update(data, "hex", "utf8") + cipher.final("utf8");
}
export async function github<T = any>(path: string, token: string): Promise<T> {
  return (await githubPage<T>(path, token)).data;
}
export function linkPage(link: string | null, relation: string) {
  const url = link
    ?.split(",")
    .find((part) => part.includes(`rel="${relation}"`))
    ?.match(/<([^>]+)>/)?.[1];
  return url ? Number(new URL(url).searchParams.get("page")) || null : null;
}
export async function githubPage<T = any>(
  path: string,
  token: string,
): Promise<{ data: T; next: number | null; last: number | null }> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Invalid GitHub API path");
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CodeCred",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401)
    throw new HttpError(
      401,
      "GitHub authorization expired. Reconnect GitHub in Settings.",
    );
  if (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  )
    throw new HttpError(
      429,
      "GitHub request limit reached. Please try again later.",
      new Date(
        Math.max(
          Date.now() + 60000,
          Number(response.headers.get("x-ratelimit-reset") || 0) * 1000,
          Date.now() + Number(response.headers.get("retry-after") || 0) * 1000,
        ),
      ),
    );
  if (!response.ok)
    throw new HttpError(
      response.status === 404 ? 404 : response.status === 403 ? 403 : 502,
      `GitHub could not complete this request (${response.status}).`,
    );
  return {
    data: response.status === 204 ? ([] as T) : ((await response.json()) as T),
    next: linkPage(response.headers.get("link"), "next"),
    last: linkPage(response.headers.get("link"), "last"),
  };
}
export function metadata(repo: any) {
  return {
    githubId: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || "",
    url: repo.html_url,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    archived: repo.archived,
    fork: repo.fork,
    updatedAtGithub: repo.updated_at,
    pushedAtGithub: repo.pushed_at,
  };
}
export async function analyze(
  repo: any,
  token: string,
  checkpoint: () => Promise<void> = async () => {},
) {
  if (!repo.size)
    return {
      loc: 0,
      languages: {},
      tags: [],
      analyzedFiles: 0,
      excludedFiles: 0,
      analyzedSha: null,
    };
  const commit = await github(
    `/repos/${repo.full_name}/commits/${encodeURIComponent(repo.default_branch)}`,
    token,
  );
  const tree = await github(
    `/repos/${repo.full_name}/git/trees/${commit.commit.tree.sha}?recursive=1`,
    token,
  );
  if (tree.truncated)
    throw new HttpError(
      422,
      "Repository tree exceeds the analysis limit. No partial statistics are displayed.",
    );
  const files = tree.tree.filter(
    (f: any) => f.type === "blob" && languageFor(f.path),
  );
  if (
    files.length > 350 ||
    files.some((f: any) => f.size > 500000) ||
    files.reduce((n: number, f: any) => n + (f.size || 0), 0) > 8000000
  )
    throw new HttpError(
      422,
      "Repository exceeds MVP limits (350 source files, 500 KB per file, 8 MB total). No partial statistics are displayed.",
    );
  const languages: Record<string, number> = {};
  const tags = new Set<string>();
  let analyzedFiles = 0;
  // Bounded sequential requests respect GitHub secondary limits. Source exists only in memory.
  for (const file of files) {
    await checkpoint();
    const blob = await github(
      `/repos/${repo.full_name}/git/blobs/${file.sha}`,
      token,
    );
    if (blob.encoding !== "base64")
      throw new HttpError(
        422,
        "Unsupported file encoding. Analysis could not be verified.",
      );
    const source = Buffer.from(blob.content, "base64").toString("utf8");
    if (
      source.includes("\0") ||
      /(?:@generated|automatically generated|do not edit|auto-generated)/i.test(
        source.slice(0, 1000),
      )
    )
      continue;
    // Skip compressed/minified source, even when its filename does not indicate it.
    if (source.split("\n").some((line) => line.length > 2000)) continue;
    const language = languageFor(file.path)!;
    const loc = countLines(source);
    languages[language] = (languages[language] || 0) + loc;
    analyzedFiles++;
    if (
      /\.(tsx|jsx)$/.test(file.path) &&
      /(?:from\s*['"]react['"]|React\.)/.test(source) &&
      loc >= 10
    )
      tags.add("React");
    if (
      language === "Python" &&
      /(?:from django|import django)/.test(source) &&
      loc >= 10
    )
      tags.add("Django");
    if (
      ["JavaScript", "TypeScript"].includes(language) &&
      /(?:from\s*['"]express['"]|require\(['"]express['"]\))/.test(source) &&
      loc >= 10
    )
      tags.add("Express");
  }
  Object.entries(languages)
    .filter(([, loc]) => loc >= 20)
    .forEach(([name]) => tags.add(name));
  return {
    loc: Object.values(languages).reduce((a, b) => a + b, 0),
    languages,
    tags: [...tags],
    analyzedFiles,
    excludedFiles:
      tree.tree.filter((f: any) => f.type === "blob").length - analyzedFiles,
    analyzedSha: commit.sha,
  };
}
