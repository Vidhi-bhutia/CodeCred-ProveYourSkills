import { useEffect, useState } from "react";

import { Search, ShieldCheck } from "lucide-react";
import { api, type Repo } from "../api";
import { useApp } from "../context";

import {
  RequireLogin,
  PageHeading,
  Empty,
  ImportButton,
  Methodology,
} from "../components/ui";
import { RepoCard } from "../components/RepoCard";
export function Repositories() {
  const { user, version } = useApp();
  const [repos, setRepos] = useState<Repo[]>([]),
    [q, setQ] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (user)
      api<Repo[]>("/repositories")
        .then(setRepos)
        .catch((e) => setError(e.message));
  }, [user, version]);
  if (!user) return <RequireLogin />;
  const filtered = repos.filter((r) =>
    `${r.name} ${r.description}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="A CURATED PICTURE OF YOUR WORK"
        title="Selected projects"
        text="Choose what represents you. Only these projects count toward your evidence."
        action={<ImportButton />}
      />
      <div className="info-strip">
        <ShieldCheck size={20} />
        <span>
          Your GitHub stays on GitHub. We analyze selected public projects
          without storing their source code.
        </span>
      </div>
      <div className="filter-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            placeholder="Find a selected project…"
            aria-label="Find a selected project"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span>{repos.length} selected projects</span>
      </div>
      {error && <div className="error">{error}</div>}
      {filtered.length ? (
        <div className="repo-grid">
          {filtered.map((r) => (
            <RepoCard key={r._id} repo={r} />
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty
            title={
              q ? "No matching projects." : "Be intentional about your story."
            }
            text={
              q
                ? "Try a different project name."
                : "Import a public repository you own or contribute to. Nothing is selected automatically."
            }
            action={!q && <ImportButton />}
          />
        </section>
      )}
      <Methodology />
    </>
  );
}
