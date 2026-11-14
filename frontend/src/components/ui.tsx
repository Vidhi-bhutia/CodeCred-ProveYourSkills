import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Code2,
  FolderGit2,
  Github,
  Plus,
  ShieldCheck,
  ChartNoAxesCombined,
} from "lucide-react";
import { API, type User, type Stats } from "../api";
import { useApp } from "../context";
import { colors, format } from "../shared";
export function Logo() {
  return (
    <Link className="logo" to="/">
      <span className="logo-icon">
        <Code2 size={23} />
      </span>
      codecred<span className="logo-period">.</span>
    </Link>
  );
}

export function Avatar({
  user,
  size = 40,
}: {
  user: Pick<User, "avatar" | "displayName">;
  size?: number;
}) {
  return user.avatar ? (
    <img
      className="avatar"
      width={size}
      height={size}
      src={user.avatar}
      alt={user.displayName}
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className="avatar initials" style={{ width: size, height: size }}>
      {user.displayName.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function Login({
  label = "Continue with GitHub",
  className = "primary",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <a className={`button ${className}`} href={`${API}/auth/github`}>
      <Github size={18} />
      {label}
      <ArrowUpRight size={16} />
    </a>
  );
}

export function RequireLogin() {
  return (
    <div className="sign-in-state">
      <div className="empty-icon">
        <Github size={30} />
      </div>
      <h2>Your developer story starts here.</h2>
      <p>
        Connect GitHub to choose your projects and build your evidence-backed
        profile.
      </p>
      <Login />
      <p className="caption">
        Only public repository access. Nothing is imported automatically.
      </p>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}

export function Empty({
  icon: Icon = FolderGit2,
  title,
  text,
  action,
}: {
  icon?: typeof FolderGit2;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function ImportButton() {
  const { importRepos } = useApp();
  return (
    <button className="button primary" onClick={importRepos}>
      <Plus size={17} /> Import repository
    </button>
  );
}

export function LanguageChart({ stats }: { stats: Stats | null }) {
  if (!stats?.totalLoc)
    return (
      <Empty
        icon={ChartNoAxesCombined}
        title="Your fingerprint is waiting."
        text="Import a repository to see your real language distribution. No estimates, no invented numbers."
      />
    );
  return (
    <div className="language-chart">
      <div className="chart-head">
        <div>
          <span className="tiny-label">SELECTED CODEBASE SIZE</span>
          <strong>
            {format(stats.totalLoc)} <small>lines</small>
          </strong>
        </div>
        <span className="pill">
          <ShieldCheck size={13} /> ANALYZED
        </span>
      </div>
      <div className="distribution-bar">
        {stats.languages.map((l, i) => (
          <div
            key={l.name}
            style={{
              width: `${l.percentage}%`,
              background: colors[i % colors.length],
            }}
            title={`${l.name}: ${l.percentage}%`}
          />
        ))}
      </div>
      <div className="language-rows">
        {stats.languages.map((l, i) => (
          <div key={l.name}>
            <span>
              <i style={{ background: colors[i % colors.length] }} />
              {l.name}
            </span>
            <strong>
              {format(l.loc)} <small>LOC</small>
            </strong>
            <span>{l.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Methodology() {
  return (
    <details className="methodology" id="methodology">
      <summary>
        <ShieldCheck size={17} />
        <span>A note on what the numbers mean</span>
        <Plus size={16} />
      </summary>
      <div>
        <p>
          We count physical, non-blank source lines (including comments) in
          supported source files from your selected public repositories at a
          specific commit. Common dependency, build, generated, binary, minified
          and lock files are excluded using path and content heuristics.
          Heuristics cannot identify every generated or vendored file. Language
          percentages use these same line counts.
        </p>
        <p>
          Repository codebase size is shared project evidence, not the amount of
          code you personally wrote. Personal commit additions, deletions, pull
          requests, issues and contribution calendars are currently unavailable.
          We don’t substitute repository activity for personal activity.
        </p>
        <p>
          Language tags need at least 20 eligible lines. Framework tags require
          implementation evidence, not README mentions. Similarity uses language
          distribution (65%), tag overlap (25%) and language diversity (10%); it
          does not measure ability or rank developers. Analysis is bounded to
          350 eligible files, 500 KB per file, and 8 MB total; over-limit
          repositories display no partial statistics.
        </p>
      </div>
    </details>
  );
}
