import { useState } from "react";
import {
  Search,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { api, send } from "../api";
import { useApp } from "../context";
import { useAnalytics } from "../useAnalytics";
import {
  RequireLogin,
  PageHeading,
  Empty,
  FeatureButton,
  Methodology,
} from "../components/ui";
import { RepoCard } from "../components/RepoCard";
import { AnalyticsProgress } from "../components/AnalyticsProgress";
export function Repositories() {
  const { user, notify, changed } = useApp();
  const { stats, repositories, error, refreshing, refreshGitHub } =
    useAnalytics();
  const [q, setQ] = useState(""),
    [tab, setTab] = useState<"all" | "featured">("featured"),
    [ordering, setOrdering] = useState(false);
  if (!user) return <RequireLogin />;
  const featured = repositories.filter((repo) => repo.featured);
  const filtered = (tab === "featured" ? featured : repositories).filter(
    (repo) =>
      `${repo.name} ${repo.description}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  async function move(id: string, direction: number) {
    const ids = featured.map((repo) => repo._id),
      index = ids.indexOf(id),
      next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setOrdering(true);
    try {
      await api("/featured/order", send("PUT", { ids }));
      changed();
      notify("Featured repository order updated.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setOrdering(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT EVIDENCE · PERSONAL SHOWCASE"
        title="Your repositories"
        text="All eligible repositories power analytics. Feature a few to tell your story."
        action={<FeatureButton />}
      />
      <div className="info-strip">
        <ShieldCheck size={20} />
        <span>
          Featuring, unfeaturing, or reordering a project never changes its
          analytics. Your source code stays on GitHub.
        </span>
      </div>
      <AnalyticsProgress stats={stats} />
      <div
        className="repository-tabs"
        role="tablist"
        aria-label="Repository views"
      >
        <button
          role="tab"
          aria-selected={tab === "featured"}
          className={tab === "featured" ? "active" : ""}
          onClick={() => setTab("featured")}
        >
          Featured Repositories <span>{featured.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "all"}
          className={tab === "all" ? "active" : ""}
          onClick={() => setTab("all")}
        >
          All account repositories <span>{repositories.length}</span>
        </button>
      </div>
      <div className="filter-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Find a repository"
            placeholder="Find a repository…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          className="button secondary"
          disabled={
            refreshing ||
            ["queued", "running", "waiting"].includes(stats?.sync?.state || "")
          }
          onClick={refreshGitHub}
        >
          <RefreshCw size={15} /> Refresh GitHub Analytics
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {filtered.length ? (
        <div className="repo-grid">
          {filtered.map((repo) => (
            <div className="repository-item" key={repo._id}>
              <RepoCard repo={repo} />
              {tab === "featured" && (
                <div className="reorder-controls">
                  <span>Showcase position {featured.indexOf(repo) + 1}</span>
                  <button
                    disabled={ordering || featured.indexOf(repo) === 0}
                    aria-label={`Move ${repo.name} earlier`}
                    title="Move earlier"
                    onClick={() => move(repo._id, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    disabled={
                      ordering || featured.indexOf(repo) === featured.length - 1
                    }
                    aria-label={`Move ${repo.name} later`}
                    title="Move later"
                    onClick={() => move(repo._id, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty
            title={
              q
                ? "No matching repositories."
                : tab === "featured"
                  ? "Your best work deserves the spotlight."
                  : "Your GitHub account is being discovered."
            }
            text={
              q
                ? "Try another repository name."
                : tab === "featured"
                  ? "Choose projects for your profile showcase. Your account analytics work with no featured repositories."
                  : "Eligible public repositories appear automatically. Check synchronization progress above."
            }
            action={tab === "featured" && !q && <FeatureButton />}
          />
        </section>
      )}
      <Methodology />
    </>
  );
}
