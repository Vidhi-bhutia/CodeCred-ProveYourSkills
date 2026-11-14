import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Code2,
  Github,
  Globe,
  MapPin,
  Plus,
  Settings,
  ShieldCheck,
  Star,
  X,
  ExternalLink,
  Heart,
  Copy,
  Lock,
  ChartNoAxesCombined,
} from "lucide-react";
import { api, send, type User, type Repo, type Stats } from "../api";
import { useApp } from "../context";
import { date } from "../shared";
import {
  Avatar,
  Empty,
  ImportButton,
  LanguageChart,
  Methodology,
} from "../components/ui";
import { RepoCard } from "../components/RepoCard";
export function Profile() {
  const { username } = useParams();
  const { user, notify, version, changed } = useApp();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [connections, setConnections] = useState<User[] | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setData(null);
    setError("");
    api(`/profiles/${username}`)
      .then(setData)
      .catch((e) => setError(e.message));
    void api(`/profiles/${username}/view`, send("POST")).catch(() => {});
  }, [username, version]);
  if (error)
    return (
      <Empty icon={Lock} title="This profile isn’t available." text={error} />
    );
  if (!data)
    return (
      <div className="skeleton">
        <div />
        <div />
      </div>
    );
  const owner = user?.id === data.user.id,
    profile: User = data.user,
    stats: Stats = data.analytics;
  async function social(kind: string, enabled: boolean) {
    if (!user) {
      notify("Sign in with GitHub to connect with this developer.");
      return;
    }
    setBusy(true);
    try {
      await api(`/profiles/${username}/${kind}`, send("PUT", { enabled }));
      changed();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="profile-cover">
        <span className="mono">&lt; a little more proof /&gt;</span>
        <Code2 size={130} />
      </div>
      <section className="profile-intro">
        <Avatar user={profile} size={96} />
        <div className="profile-actions">
          {owner ? (
            <Link className="button secondary" to="/settings">
              Edit profile <Settings size={15} />
            </Link>
          ) : (
            <>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => social("follow", !data.isFollowing)}
              >
                {data.isFollowing ? "Following" : "Follow developer"}
                <Plus size={16} />
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => social("kudos", !data.hasKudos)}
              >
                <Heart
                  size={16}
                  fill={data.hasKudos ? "currentColor" : "none"}
                />{" "}
                {data.kudos} kudos
              </button>
            </>
          )}
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                notify("Profile link copied.");
              } catch {
                notify("Copy the profile URL from your address bar.");
              }
            }}
          >
            <Copy size={15} /> Share
          </button>
        </div>
        <h1>
          {profile.displayName}
          <ShieldCheck size={23} />
        </h1>
        <span className="muted">
          @{profile.username} · Joined {date(profile.joinedAt)}
        </span>
        <p className="profile-bio">
          {profile.bio || "A developer story, still being written."}
        </p>
        <div className="profile-links">
          {profile.location && (
            <span>
              <MapPin size={15} />
              {profile.location}
            </span>
          )}
          <a
            href={`https://github.com/${profile.githubLogin}`}
            target="_blank"
            rel="noreferrer"
          >
            <Github size={15} />
            {profile.githubLogin}
            <ArrowUpRight size={12} />
          </a>
          {(profile.website || profile.portfolio) && (
            <a
              href={profile.website || profile.portfolio}
              target="_blank"
              rel="noreferrer"
            >
              <Globe size={15} /> Website
            </a>
          )}
          {profile.linkedin && (
            <a href={profile.linkedin} target="_blank" rel="noreferrer">
              LinkedIn <ArrowUpRight size={12} />
            </a>
          )}
          <span>
            {profile.visibility === "private" ? (
              <Lock size={14} />
            ) : (
              <Globe size={14} />
            )}{" "}
            {profile.visibility} profile
          </span>
        </div>
        <div className="profile-counts">
          <span>
            <strong>{data.kudos}</strong> kudos
          </span>
          {["followers", "following"].map((kind) => (
            <button
              key={kind}
              onClick={async () => {
                try {
                  setConnections(
                    await api(`/profiles/${username}/connections?kind=${kind}`),
                  );
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <strong>{data[kind]}</strong> {kind}
            </button>
          ))}
          <span>
            <strong>{profile.views}</strong> profile views
          </span>
          <a
            href={`https://github.com/${profile.githubLogin}`}
            target="_blank"
            rel="noreferrer"
          >
            Follow on GitHub <ExternalLink size={12} />
          </a>
        </div>
      </section>
      {connections && (
        <div className="connections card">
          <div className="section-heading">
            <h3>Public connections</h3>
            <button
              aria-label="Close connections"
              onClick={() => setConnections(null)}
            >
              <X size={18} />
            </button>
          </div>
          {connections.length ? (
            connections.map((u) => (
              <Link
                key={u.id}
                to={`/u/${u.username}`}
                onClick={() => setConnections(null)}
              >
                <Avatar user={u} size={30} />
                {u.displayName}
                <span className="muted">@{u.username}</span>
              </Link>
            ))
          ) : (
            <p className="muted">No public connections to show.</p>
          )}
        </div>
      )}
      <div className="profile-evidence">
        <div className="card">
          <div className="card-heading">
            <div>
              <h2>Technology fingerprint</h2>
              <p>Evidence from {stats.analyzedCount} analyzed projects.</p>
            </div>
            <ShieldCheck size={20} />
          </div>
          <LanguageChart stats={stats} />
        </div>
        <div className="card">
          <div className="card-heading">
            <div>
              <h2>Proof, earned.</h2>
              <p>Achievements with a reason behind them.</p>
            </div>
            <Star size={19} />
          </div>
          {stats.badges.length ? (
            <div className="badge-list">
              {stats.badges.map((b) => (
                <div key={b.name}>
                  <span>
                    <ShieldCheck size={25} />
                  </span>
                  <div>
                    <strong>{b.name}</strong>
                    <p>{b.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={Star}
              title="Room for your first achievement."
              text="Badges are awarded for measurable repository evidence."
            />
          )}
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>Selected projects</h2>
          <p>The work behind the profile.</p>
        </div>
        {owner && <ImportButton />}
      </div>
      {data.repositories.length ? (
        <div className="repo-grid">
          {data.repositories.map((r: Repo) => (
            <RepoCard key={r._id} repo={r} owner={owner} />
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty
            title="The next great project starts somewhere."
            text="No repositories have been selected for this profile yet."
          />
        </section>
      )}
      <section className="contribution-note">
        <ChartNoAxesCombined size={21} />
        <div>
          <strong>Personal contributions: unavailable</strong>
          <p>
            Verified commit additions, deletions, pull requests and contribution
            history are not yet supported. Repository lines above describe the
            codebase, not personal authorship.
          </p>
        </div>
      </section>
      <Methodology />
    </>
  );
}
