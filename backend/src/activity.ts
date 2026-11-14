import { githubPage, HttpError } from "./github.js";
let nextSearch = 0;
async function searchCount(query: string, token: string) {
  // Search has a separate, much smaller quota than core API calls.
  const delay = Math.max(0, nextSearch - Date.now());
  nextSearch = Math.max(nextSearch, Date.now()) + 2200;
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const { data } = await githubPage(
    `/search/issues?q=${encodeURIComponent(query)}&per_page=1`,
    token,
  );
  return data.incomplete_results ? null : (data.total_count as number);
}
export async function repositoryActivity(
  repo: any,
  login: string,
  token: string,
) {
  const unavailable: string[] = [];
  async function measurable(name: string, fn: () => Promise<number | null>) {
    try {
      const result = await fn();
      if (result === null) unavailable.push(name);
      return result;
    } catch (error) {
      if (
        error instanceof HttpError &&
        (error.status === 401 || error.status === 429 || error.status >= 500)
      )
        throw error;
      unavailable.push(name);
      return null;
    }
  }
  const commits = await measurable("commits", async () => {
    if (!repo.size) return 0;
    const page = await githubPage(
      `/repos/${repo.full_name}/commits?author=${encodeURIComponent(login)}&per_page=1`,
      token,
    );
    return page.last ?? page.data.length;
  });
  const base = `repo:${repo.full_name} author:${login}`;
  const pullRequests = await measurable("pullRequests", () =>
    searchCount(`${base} is:pr`, token),
  );
  const mergedPullRequests = await measurable("mergedPullRequests", () =>
    searchCount(`${base} is:pr is:merged`, token),
  );
  const issues = await measurable("issues", () =>
    searchCount(`${base} is:issue`, token),
  );
  const closedIssues = await measurable("closedIssues", () =>
    searchCount(`${base} is:issue is:closed`, token),
  );
  const contributors = await measurable("contributors", async () => {
    if (!repo.size) return 0;
    const page = await githubPage(
      `/repos/${repo.full_name}/contributors?per_page=1&anon=false`,
      token,
    );
    return page.last ?? page.data.length;
  });
  let dailyCommits: Record<string, number> | null = {};
  try {
    if (repo.size) {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      let page: number | null = 1;
      const visited = new Set<number>();
      const seen = new Set<string>();
      while (page !== null) {
        if (visited.has(page)) throw new Error("Repeating commit page");
        visited.add(page);
        const result: {
          data: any[];
          next: number | null;
          last: number | null;
        } = await githubPage(
          `/repos/${repo.full_name}/commits?author=${encodeURIComponent(login)}&since=${since}&per_page=100&page=${page}`,
          token,
        );
        for (const commit of result.data) {
          const day = commit.commit?.author?.date?.slice(0, 10);
          if (day && !seen.has(commit.sha)) {
            seen.add(commit.sha);
            dailyCommits[day] = (dailyCommits[day] || 0) + 1;
          }
        }
        page = result.next;
      }
    }
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 401 || error.status === 429 || error.status >= 500)
    )
      throw error;
    dailyCommits = null;
    unavailable.push("dailyCommits");
  }
  return {
    commits,
    pullRequests,
    mergedPullRequests,
    issues,
    closedIssues,
    contributors,
    dailyCommits,
    external: repo.owner?.login?.toLowerCase() !== login.toLowerCase(),
    unavailable,
  };
}
