import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Code2,
  FolderGit2,
  Plus,
  Sparkles,
  Info,
  Eye,
  ChartNoAxesCombined,
} from "lucide-react";
import { api, type Repo, type Stats } from "../api";
import { useApp } from "../context";
import { format } from "../shared";
import {
  Avatar,
  RequireLogin,
  PageHeading,
  ImportButton,
  LanguageChart,
  Methodology,
} from "../components/ui";
import { RepoCard } from "../components/RepoCard";
import { DeveloperCard, type Developer } from "./Discover";
export function Dashboard() {
  const { user, version, notify, importRepos } = useApp();
  const [stats, setStats] = useState<Stats | null>(null),
    [repos, setRepos] = useState<Repo[]>([]),
    [developers, setDevelopers] = useState<Developer[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (user)
      Promise.all([
        api<Stats>("/analytics"),
        api<Repo[]>("/repositories"),
        api<Developer[]>("/discover"),
      ])
        .then(([s, r, d]) => {
          setStats(s);
          setRepos(r);
          setDevelopers(
            d.filter((item) => item.match && item.match.score > 0).slice(0, 2),
          );
          setError("");
        })
        .catch((e) => setError(e.message));
  }, [user, version]);
  if (!user) return <RequireLogin />;
  return (
    <>
      <PageHeading
        eyebrow="YOUR DEVELOPER WORKSPACE"
        title={`Looking good, ${user.displayName.split(" ")[0]}.`}
        text="Your work, your skills, your story. All in one place."
        action={<ImportButton />}
      />
      {error && <div className="error">{error}</div>}
      <section className="welcome-banner">
        <div>
          <span className="pill light">
            <Sparkles size={13} /> YOUR NEXT CHAPTER
          </span>
          <h2>Good code deserves a great identity.</h2>
          <p>
            {repos.length
              ? "Keep building your proof. Every selected project adds context to your story."
              : "Bring your best work into the spotlight. Start with a project you’re proud of."}
          </p>
          <button
            className="text-link"
            onClick={() =>
              notify(
                "Choose repositories with meaningful implementation. Only selected, successfully analyzed projects contribute to your skill proof.",
              )
            }
          >
            What makes a strong profile? <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="banner-art">
          <div>
            <Code2 size={39} />
          </div>
          <span>
            <CheckCheck size={14} /> BACKED BY YOUR WORK
          </span>
        </div>
      </section>
      <div className="stat-grid">
        {[
          {
            icon: FolderGit2,
            label: "Selected projects",
            value: stats ? String(stats.importedCount) : "—",
            detail: "Curated by you",
          },
          {
            icon: Code2,
            label: "Analyzed source lines",
            value: stats ? format(stats.totalLoc) : "—",
            detail: "Repository size · not authorship",
          },
          {
            icon: ChartNoAxesCombined,
            label: "Evidenced languages",
            value: stats ? String(stats.languages.length) : "—",
            detail: "From analyzed projects",
          },
          {
            icon: Eye,
            label: "Profile views",
            value: format(user.views),
            detail: "Self-visits excluded",
          },
        ].map((s) => (
          <div className="stat" key={s.label}>
            <div>
              <span>{s.label}</span>
              <s.icon size={18} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.detail}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Your technology fingerprint</h2>
              <p>The languages behind your selected work.</p>
            </div>
            <span className="icon-label">
              <ChartNoAxesCombined size={18} />
            </span>
          </div>
          <LanguageChart stats={stats} />
          <div className="card-foot">
            <Info size={14} />
            <span>Based on non-blank source lines, including comments.</span>
          </div>
        </section>
        <section className="card profile-health">
          <div className="card-heading">
            <div>
              <h2>Make it yours</h2>
              <p>A little context goes a long way.</p>
            </div>
            <span className="pill">YOUR PROFILE</span>
          </div>
          <div className="health-person">
            <Avatar user={user} size={48} />
            <div>
              <strong>{user.displayName}</strong>
              <span>@{user.username}</span>
            </div>
          </div>
          {[
            { done: user.onboarded, text: "Add your story", link: "/settings" },
            {
              done: repos.length > 0,
              text: "Select your first project",
              link: "/repositories",
            },
            {
              done: user.visibility === "public",
              text: "Make your profile public",
              link: "/settings",
            },
            {
              done: user.discovery,
              text: "Opt in to developer discovery",
              link: "/settings",
            },
          ].map((item) => (
            <Link className="checklist-item" to={item.link} key={item.text}>
              <span
                className={item.done ? "check-circle done" : "check-circle"}
              >
                {item.done ? <Check size={12} /> : null}
              </span>
              {item.text}
              <ChevronRight size={14} />
            </Link>
          ))}
          <Link className="button secondary full" to={`/u/${user.username}`}>
            View your profile <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      <section className="projects-section">
        <div className="section-heading">
          <div>
            <h2>
              Selected projects <span className="count">{repos.length}</span>
            </h2>
            <p>A curated collection. A clearer picture of you.</p>
          </div>
          <Link className="text-link" to="/repositories">
            All projects <ArrowRight size={16} />
          </Link>
        </div>
        {repos.length ? (
          <div className="repo-grid">
            {repos.slice(0, 2).map((r) => (
              <RepoCard key={r._id} repo={r} />
            ))}
          </div>
        ) : (
          <div className="empty-project">
            <div className="empty-icon">
              <FolderGit2 size={24} />
            </div>
            <div>
              <h3>Your best work belongs here.</h3>
              <p>
                Choose a public GitHub repository to start building your skill
                proof.
              </p>
            </div>
            <button className="button secondary" onClick={importRepos}>
              <Plus size={16} /> Choose a project
            </button>
          </div>
        )}
      </section>
      <section className="similar-section">
        <div className="section-heading">
          <div>
            <h2>Developers Like You</h2>
            <p>Shared technologies. A starting point for a connection.</p>
          </div>
          <Link className="text-link" to="/discover">
            Explore developers <ArrowRight size={16} />
          </Link>
        </div>
        {developers.length ? (
          <div className="repo-grid">
            {developers.map((developer) => (
              <DeveloperCard key={developer.user.id} developer={developer} />
            ))}
          </div>
        ) : (
          <div className="empty-project">
            <div className="empty-icon">
              <Sparkles size={23} />
            </div>
            <div>
              <h3>
                {user.discovery && user.visibility === "public"
                  ? "Your next connection is still taking shape."
                  : "Find people who build like you."}
              </h3>
              <p>
                {user.discovery && user.visibility === "public"
                  ? "Matches appear when you and other opted-in developers have repository evidence in common."
                  : "Make your profile public and explicitly enable discovery to see personalized matches."}
              </p>
            </div>
            <Link className="button secondary" to="/settings">
              Discovery settings <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
      </section>
      <Methodology />
    </>
  );
}
