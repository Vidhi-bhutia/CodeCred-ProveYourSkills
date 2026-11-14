import { useEffect, useState, useRef } from "react";

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
  const modalRef = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) close();
      if (e.key === "Tab") {
        const items = modalRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), a[href]",
        );
        if (items?.length) {
          const first = items[0],
            last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", listener);
      previousFocus?.focus();
    };
  }, []);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(
      () =>
        Promise.all([
          api(
            `/github/repositories?${new URLSearchParams({ page: String(page), q })}`,
          ),
          api<Repo[]>("/featured"),
        ])
          .then(([data, featured]) => {
            if (!alive) return;
            setRepos((prev) =>
              page === 1 ? data.repositories : [...prev, ...data.repositories],
            );
            setMore(data.hasMore);
            setExisting(featured.map((r) => r.githubId));
            setError("");
          })
          .catch((e) => {
            if (alive) setError(e.message);
          })
          .finally(() => {
            if (alive) setLoading(false);
          }),
      250,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [page, user?.id, q]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api<Repo[]>("/featured", send("POST", { ids: selected }));
      changed();
      notify(
        "Featured repositories updated. Your account analytics are unchanged.",
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
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="featured-title"
      >
        <div className="modal-header">
          <div className="empty-icon">
            <FolderGit2 size={23} />
          </div>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close featured repository selection"
            disabled={busy}
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <h2 id="featured-title">Choose the work that speaks for you.</h2>
        <p>
          Choose one or more repositories for your profile showcase. Analytics
          already include all eligible public repositories, whether featured or
          not.
        </p>
        {!user ? (
          <RequireLogin />
        ) : (
          <>
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Search all discovered GitHub repositories"
                placeholder="Search loaded repositories…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
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
                        disabled={imported || busy}
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
                          {imported && <span className="pill">FEATURED</span>}
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
                  title="No matching repositories yet."
                  text="Repositories appear here as automatic account discovery progresses. Try another search or check sync progress on your dashboard."
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
                  `${selected.length} selected`
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
