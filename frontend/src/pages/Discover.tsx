import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Code2,
  Compass,
  Plus,
  Search,
  Sparkles,
  Info,
  Users,
} from "lucide-react";
import { api, send, type User, type Stats } from "../api";
import { useApp } from "../context";
import { format } from "../shared";
import { Avatar, PageHeading, Empty, Methodology } from "../components/ui";
export type Developer = {
  user: User;
  analytics: Stats;
  match: { score: number; explanation: string } | null;
  isFollowing: boolean;
};
export function Discover() {
  const { version } = useApp();
  const [q, setQ] = useState(""),
    [skill, setSkill] = useState(""),
    [items, setItems] = useState<Developer[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    const t = setTimeout(
      () =>
        api<Developer[]>(`/discover?${new URLSearchParams({ q, skill })}`)
          .then((data) => {
            if (live) {
              setItems(data);
              setError("");
            }
          })
          .catch((e) => {
            if (live) setError(e.message);
          })
          .finally(() => {
            if (live) setLoading(false);
          }),
      300,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, skill, version]);
  return (
    <>
      <PageHeading
        eyebrow="FIND YOUR KIND OF BUILDERS"
        title="Great minds. Shared interests."
        text="Meet developers through the technologies and projects you have in common."
      />
      <div className="discover-banner">
        <Compass size={26} />
        <div>
          <strong>Connections with a little more context.</strong>
          <p>
            Matches use evidenced languages, technology overlap, and project
            diversity.
          </p>
        </div>
        <span className="pill">OPT-IN COMMUNITY</span>
      </div>
      <div className="filter-toolbar discover-filters">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search developers"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search names or usernames…"
          />
        </div>
        <div className="search-input">
          <Code2 size={17} />
          <input
            aria-label="Filter by technology"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            placeholder="Language or technology…"
          />
        </div>
      </div>
      <div className="section-heading">
        <h2>Discover developers</h2>
        <span className="muted">Public profiles · discovery enabled</span>
      </div>
      {error ? (
        <div className="error">{error}</div>
      ) : loading ? (
        <div className="skeleton">
          <div />
          <div />
        </div>
      ) : items.length ? (
        <div className="developer-grid">
          {items.map((d) => (
            <DeveloperCard key={d.user.id} developer={d} />
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty
            icon={Users}
            title={
              q || skill
                ? "No builders found for this search."
                : "A community starts with its builders."
            }
            text={
              q || skill
                ? "Try another username or evidenced technology."
                : "Public profiles appear here only when their owners explicitly enable discovery. Yours could be the first."
            }
            action={
              <Link className="button secondary" to="/settings">
                Manage discovery preferences <ArrowUpRight size={16} />
              </Link>
            }
          />
        </section>
      )}
      <Methodology />
    </>
  );
}

export function DeveloperCard({ developer: d }: { developer: Developer }) {
  const { user, notify, changed } = useApp();
  const [busy, setBusy] = useState(false);
  async function follow() {
    if (!user) {
      notify("Sign in with GitHub to follow developers.");
      return;
    }
    setBusy(true);
    try {
      await api(
        `/profiles/${d.user.username}/follow`,
        send("PUT", { enabled: !d.isFollowing }),
      );
      changed();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="developer-card">
      <div className="developer-top">
        <Avatar user={d.user} size={54} />
        {d.match && d.analytics.totalLoc > 0 && (
          <span className="match">
            <Sparkles size={13} />
            {d.match.score}% overlap
          </span>
        )}
      </div>
      <Link to={`/u/${d.user.username}`}>
        <h3>{d.user.displayName}</h3>
      </Link>
      <span className="muted">@{d.user.username}</span>
      <p>{d.user.bio || "Building a developer identity through real work."}</p>
      <div className="tag-row">
        {d.analytics.tags.slice(0, 4).map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
      </div>
      <small>
        {format(d.analytics.totalLoc)} repository lines ·{" "}
        {d.analytics.importedCount} selected projects
      </small>
      {d.match && (
        <div className="match-explanation">
          <Info size={13} />
          {d.match.explanation}
        </div>
      )}
      <div className="developer-actions">
        <Link className="text-link" to={`/u/${d.user.username}`}>
          View profile <ArrowUpRight size={14} />
        </Link>
        <button
          disabled={busy}
          className={`button small ${d.isFollowing ? "secondary" : "primary"}`}
          onClick={follow}
        >
          {d.isFollowing ? <Check size={14} /> : <Plus size={14} />}{" "}
          {d.isFollowing ? "Following" : "Follow"}
        </button>
      </div>
    </article>
  );
}
