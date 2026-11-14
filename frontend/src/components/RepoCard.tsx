import { useState } from "react";

import {
  ArrowUpRight,
  FolderGit2,
  Star,
  GitFork,
  RefreshCw,
  Trash2,
  Pin,
  Info,
  CheckCircle2,
} from "lucide-react";
import { api, send, type Repo } from "../api";
import { useApp } from "../context";
import { format, date } from "../shared";

export function RepoCard({
  repo,
  owner = true,
}: {
  repo: Repo;
  owner?: boolean;
}) {
  const { notify, changed } = useApp();
  const [busy, setBusy] = useState(false);
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await api(`/repositories/${repo._id}${path}`, send(method, body));
      changed();
      notify(
        method === "DELETE"
          ? "Removed from Featured. Account analytics are unchanged."
          : "Showcase updated. Account analytics are unchanged.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="repo-card">
      <div className="repo-title">
        <span className="repo-symbol">
          <FolderGit2 size={20} />
        </span>
        <a href={repo.url} target="_blank" rel="noreferrer">
          {repo.name}
          <ArrowUpRight size={15} />
        </a>
        {repo.featured && <Pin size={14} />}
      </div>
      <p>{repo.description || "No repository description provided."}</p>
      <div className="tag-row">
        {repo.tags?.map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
        {repo.archived && <span className="tag">Archived</span>}
        {repo.fork && <span className="tag">Fork · codebase evidence</span>}
      </div>
      <div className="repo-metrics">
        <span>
          <span className="language-dot" />
          {repo.language || "No primary language"}
        </span>
        <span>
          <Star size={13} />
          {format(repo.stars || 0)}
        </span>
        <span>
          <GitFork size={13} />
          {format(repo.forks || 0)}
        </span>
        <strong>
          {repo.status === "ready"
            ? `${format(repo.loc || 0)} lines`
            : "LOC unavailable"}
        </strong>
      </div>
      {repo.status === "ready" &&
        Object.keys(repo.languages || {}).length > 0 && (
          <details className="repo-languages">
            <summary>Language evidence</summary>
            {Object.entries(repo.languages).map(([name, loc]) => (
              <div key={name}>
                <span>{name}</span>
                <span>
                  {format(loc)} lines ·{" "}
                  {repo.loc ? Math.round((loc / repo.loc) * 100) : 0}%
                </span>
              </div>
            ))}
          </details>
        )}
      <div className="repo-bottom">
        <span
          className={`sync-status ${["error", "skipped"].includes(repo.status) ? "failed" : ""}`}
        >
          {repo.status === "ready" ? (
            <>
              <CheckCircle2 size={12} /> Synced {date(repo.syncedAt)}
            </>
          ) : repo.status === "error" ? (
            <>
              <Info size={13} /> Analysis unavailable
            </>
          ) : (
            <>
              <RefreshCw size={12} /> {repo.status}
            </>
          )}
        </span>
        {owner && (
          <div className="icon-actions">
            <button
              disabled={busy}
              title={repo.featured ? "Remove from Featured" : "Add to Featured"}
              aria-label={
                repo.featured ? "Remove from Featured" : "Add to Featured"
              }
              onClick={() => action("", "PATCH", { pinned: !repo.featured })}
            >
              <Pin size={14} />
            </button>
            <button
              disabled={busy}
              title="Refresh statistics"
              aria-label="Refresh statistics"
              onClick={() => action("/refresh", "POST")}
            >
              <RefreshCw size={14} className={busy ? "spin" : ""} />
            </button>
            <button
              disabled={busy}
              title="Remove from Featured"
              aria-label="Remove from Featured"
              onClick={() => action("", "DELETE")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {repo.error && <p className="repo-error">{repo.error}</p>}
    </article>
  );
}
