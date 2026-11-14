import type { Stats } from "../api";
import { format } from "../shared";
export function ContributionActivity({ stats }: { stats: Stats | null }) {
  const metrics = [
    ["commits", "Personal commits"],
    ["pullRequests", "PRs created"],
    ["mergedPullRequests", "PRs merged"],
    ["issues", "Issues created"],
    ["closedIssues", "Issues closed"],
  ] as const;
  const days = Array.from({ length: 90 }, (_, index) => {
    const value = new Date();
    value.setUTCDate(value.getUTCDate() - (89 - index));
    return value.toISOString().slice(0, 10);
  });
  const hasActivity = (stats?.activityCoverage.dailyCommits || 0) > 0;
  return (
    <section className="card contribution-card">
      <div className="card-heading">
        <div>
          <h2>Your contribution activity</h2>
          <p>Personal GitHub activity across eligible public repositories.</p>
        </div>
      </div>
      <div className="contribution-metrics">
        {metrics.map(([key, label]) => (
          <div key={key}>
            <span>{label}</span>
            <strong>
              {stats?.[key] === null || stats?.[key] === undefined
                ? "Unavailable"
                : format(stats[key] as number)}
            </strong>
            <small>
              {stats?.activityCoverage[key] || 0} /{" "}
              {stats?.repositoryCount || 0} repositories measured
            </small>
          </div>
        ))}
      </div>
      <div className="activity-calendar">
        <div className="section-heading">
          <h3>Last 90 days</h3>
          <span className="muted">Personal commits · UTC</span>
        </div>
        {hasActivity ? (
          <div
            className="calendar-grid"
            role="img"
            aria-label="Daily personal commit activity for the last 90 days"
          >
            {days.map((day) => {
              const count = stats?.dailyCommits[day] || 0;
              return (
                <span
                  key={day}
                  title={`${day}: ${count} commits`}
                  className={`calendar-day level-${count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : 3}`}
                />
              );
            })}
          </div>
        ) : (
          <p>
            Activity appears after GitHub commit attribution has been verified.
          </p>
        )}
        <div className="collaboration-summary">
          <span>
            <strong>{stats?.collaborativeRepositories ?? "—"}</strong>{" "}
            repositories with multiple public contributors
          </span>
          <span>
            <strong>{stats?.externalContributionRepositories ?? "—"}</strong>{" "}
            external repositories with your commits
          </span>
        </div>
        <p className="caption">
          Contributor counts describe repository-wide participation; they do not
          establish personal collaboration. Commit counts are per repository on
          the default branch; a commit shared by forks can appear more than
          once. Additions and deletions remain unavailable.
        </p>
      </div>
    </section>
  );
}
