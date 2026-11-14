import { useEffect, useState } from "react";

import { ArrowRight, FolderGit2, Search, RefreshCw, X } from "lucide-react";
import { api, send, type Repo } from "../api";
import { useApp } from "../context";
import { date } from "../shared";
import { RequireLogin, Empty } from "../components/ui";
export function ImportModal({ close }: { close: () => void }) {
  const { user, notify, changed } = useApp();
  const [repos, setRepos] = useState<Repo[]>([]),
    [existing, setExisting] = useState<number[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", listener);
    };
  }, [busy]);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api(`/github/repositories?page=${page}`),
      api<Repo[]>("/repositories"),
    ])
      .then(([data, imported]) => {
        setRepos((prev) =>
          page === 1 ? data.repositories : [...prev, ...data.repositories],
        );
        setMore(data.hasMore);
        setExisting(imported.map((r) => r.githubId));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, user]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await api<Repo[]>(
        "/repositories/import",
        send("POST", { ids: selected }),
      );
      changed();
      notify(
        result.some((r) => r.status === "error")
          ? "Import saved. Some projects could not be analyzed; review their status."
          : "Your selected projects are imported and analyzed.",
      );
      close();
    } catch (e) {
      setError((e as Error).message);
      changed();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <div className="modal-header">
          <div className="empty-icon">
            <FolderGit2 size={23} />
          </div>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close import"
            disabled={busy}
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <h2 id="import-title">Choose the work that speaks for you.</h2>
        <p>
          Select up to 3 public repositories at a time. Only your choices
          contribute to your CodeCred profile.
        </p>
        {!user ? (
          <RequireLogin />
        ) : (
          <>
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Search loaded GitHub repositories"
                placeholder="Search loaded repositories…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={busy}
              />
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="import-list">
              {repos
                .filter((r) =>
                  `${r.name} ${r.description}`
                    .toLowerCase()
                    .includes(q.toLowerCase()),
                )
                .map((r) => {
                  const imported = existing.includes(r.githubId);
                  return (
                    <label
                      className={`import-item ${selected.includes(r.githubId) ? "selected" : ""}`}
                      key={r.githubId}
                    >
                      <input
                        type="checkbox"
                        checked={imported || selected.includes(r.githubId)}
                        disabled={
                          imported ||
                          busy ||
                          (!selected.includes(r.githubId) &&
                            selected.length >= 3)
                        }
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked
                              ? [...prev, r.githubId]
                              : prev.filter((id) => id !== r.githubId),
                          )
                        }
                      />
                      <div>
                        <strong>
                          {r.name}
                          {imported && <span className="pill">IMPORTED</span>}
                        </strong>
                        <p>{r.description || "No description provided."}</p>
                        <span>
                          {r.language || "No primary language"} · ★ {r.stars} ·
                          Updated {date((r as any).updatedAtGithub)}
                        </span>
                      </div>
                    </label>
                  );
                })}
              {loading && (
                <p className="muted">Loading your public repositories…</p>
              )}
              {!loading && !repos.length && !error && (
                <Empty
                  title="No public repositories found."
                  text="Public projects you own or collaborate on will appear here."
                />
              )}
              {more && (
                <button
                  disabled={loading || busy}
                  className="button secondary small"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Load more repositories
                </button>
              )}
            </div>
            <div className="modal-footer">
              <span>
                {busy ? (
                  <>
                    <RefreshCw className="spin" size={15} /> Analyzing source
                    files. This may take a few minutes…
                  </>
                ) : (
                  `${selected.length} of 3 selected`
                )}
              </span>
              <button
                disabled={!selected.length || busy}
                className="button primary"
                onClick={submit}
              >
                {busy ? "Importing…" : "Import selected"}{" "}
                {!busy && <ArrowRight size={16} />}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
