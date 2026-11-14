export const API =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_API_URL || "/api";
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      credentials: "include",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error("Cannot reach CodeCred. Make sure the backend is running.");
  }
  const data = await response
    .json()
    .catch(() => ({ error: "The server returned an unexpected response." }));
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Request failed."), {
      status: response.status,
    });
  return data;
}
export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
export type User = {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  location: string;
  portfolio: string;
  website: string;
  linkedin: string;
  interests: string;
  githubLogin: string;
  visibility: "public" | "private";
  discovery: boolean;
  onboarded: boolean;
  connected: boolean;
  views: number;
  joinedAt: string;
};
export type Repo = {
  _id: string;
  githubId: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
  pinned: boolean;
  featured: boolean;
  featuredOrder: number;
  eligible: boolean;
  status: string;
  error?: string;
  loc: number | null;
  languages: Record<string, number>;
  tags: string[];
  syncedAt: string;
  archived: boolean;
  fork: boolean;
};
export type Stats = {
  totalLoc: number;
  languages: { name: string; loc: number; percentage: number }[];
  tags: string[];
  importedCount: number;
  repositoryCount: number;
  featuredCount: number;
  skippedCount: number;
  commits: number | null;
  pullRequests: number | null;
  mergedPullRequests: number | null;
  issues: number | null;
  closedIssues: number | null;
  collaborativeRepositories: number;
  externalContributionRepositories: number;
  activityCoverage: Record<string, number>;
  dailyCommits: Record<string, number>;
  sync?: SyncStatus;
  analyzedCount: number;
  lastSync: string | null;
  badges: { name: string; reason: string }[];
};
export type SyncStatus = {
  state: string;
  phase?: string;
  discovered: number;
  analyzed: number;
  skipped: number;
  pending: number;
  error?: string;
  retryAt?: string;
  completedAt?: string;
  repositories: {
    _id: string;
    name: string;
    fullName: string;
    status: string;
    error: string;
  }[];
};
