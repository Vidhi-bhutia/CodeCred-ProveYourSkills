import { RefreshCw, Info } from "lucide-react";
import type { Stats } from "../api";
export function AnalyticsProgress({ stats }: { stats: Stats | null }) {
  const sync = stats?.sync;
  if (!sync)
    return (
      <div className="sync-panel" role="status">
        <RefreshCw size={18} className="spin" /> Loading your account analytics…
      </div>
    );
  const active = ["queued", "running", "waiting"].includes(sync.state);
  return (
    <section
      className="sync-panel"
      aria-label="GitHub analytics synchronization"
    >
      <div className="sync-panel-title">
        <div>
          {active ? (
            <RefreshCw
              size={19}
              className={sync.state === "waiting" ? "" : "spin"}
            />
          ) : (
            <Info size={19} />
          )}
          <strong>
            {sync.state === "waiting"
              ? "Waiting for GitHub — your progress is saved"
              : sync.state === "queued"
                ? "Your account analysis is queued"
                : sync.state === "running"
                  ? sync.phase === "discovering"
                    ? "Discovering all public repositories…"
                    : "Analyzing your GitHub account…"
                  : sync.state === "completed"
                    ? "GitHub account analytics synchronized"
                    : sync.state === "cancelled"
                      ? "GitHub synchronization paused"
                      : "GitHub synchronization needs attention"}
          </strong>
        </div>
        <span className="pill">
          {active ? "IN PROGRESS" : sync.state.toUpperCase()}
        </span>
      </div>
      <div className="sync-counts" aria-live="polite">
        <span>
          <strong>{sync.discovered}</strong> discovered
        </span>
        <span>
          <strong>{sync.analyzed}</strong> analyzed
        </span>
        <span>
          <strong>{sync.pending}</strong> pending
        </span>
        <span>
          <strong>{sync.skipped}</strong> skipped
        </span>
      </div>
      {active && (
        <>
          <progress
            max={Math.max(1, sync.discovered)}
            value={sync.analyzed + sync.skipped}
          />
          <p>
            All eligible public repositories are included automatically. Figures
            below reflect completed analyses and may be incomplete while
            synchronization runs.
          </p>
        </>
      )}
      {sync.error && (
        <p role="status">
          {sync.error}
          {sync.retryAt && sync.state === "waiting"
            ? ` Next attempt: ${new Date(sync.retryAt).toLocaleTimeString()}.`
            : ""}
        </p>
      )}
      {!!sync.repositories.length && (
        <details>
          <summary>
            Review {sync.repositories.length} skipped or unavailable
            repositories
          </summary>
          <ul>
            {sync.repositories.map((repo) => (
              <li key={repo._id}>
                <strong>{repo.fullName || repo.name}:</strong> {repo.error}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!active && sync.skipped > 0 && (
        <p>
          Code totals cover successfully analyzed repositories. Skipped
          repositories are listed above and contribute no unverified LOC.
        </p>
      )}
    </section>
  );
}
