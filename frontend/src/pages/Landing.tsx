import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  FolderGit2,
  ShieldCheck,
  Sparkles,
  Users,
  ChartNoAxesCombined,
  CheckCircle2,
} from "lucide-react";

import { useApp } from "../context";

import { Logo, Login } from "../components/ui";
export function Landing() {
  const { user } = useApp();
  const location = useLocation();
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Logo />
        <div className="landing-links">
          <a href="#how-it-works">How it works</a>
          <Link to="/discover">Discover developers</Link>
          <a href="#principles">Our philosophy</a>
        </div>
        {user ? (
          <Link className="button primary small" to="/dashboard">
            Your dashboard <ArrowUpRight size={16} />
          </Link>
        ) : (
          <Login label="Get started" className="primary small" />
        )}
      </nav>
      {location.search.includes("error=") && (
        <div className="error landing-error">
          GitHub sign-in could not be completed. Check your OAuth configuration
          and try again.
        </div>
      )}
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> A LITTLE LESS CLAIM. A LOT MORE
              PROOF.
            </div>
            <h1>
              Your code speaks.
              <br />
              Give it <em>credibility.</em>
            </h1>
            <p>
              You’ve put in the work. Build a developer identity that shows it —
              with real evidence from the projects you choose.
            </p>
            <div className="hero-buttons">
              <Login />
              <Link className="text-link" to="/discover">
                Explore developers <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-footnote">
              <ShieldCheck size={16} /> Your repositories. Your choice. Always.
            </div>
          </div>
          <div
            className="identity-preview"
            aria-label="Illustration of how CodeCred connects projects to skills"
          >
            <div className="preview-top">
              <span className="overline">THE DEVELOPER BEHIND THE CODE</span>
              <span className="preview-label">PRODUCT PREVIEW</span>
            </div>
            <div className="preview-person">
              <div className="abstract-avatar">
                <Code2 size={34} />
              </div>
              <div>
                <h3>
                  Your next chapter,
                  <br />
                  backed by your work.
                </h3>
                <span className="muted">
                  developer / builder / problem solver
                </span>
              </div>
              <ShieldCheck className="preview-shield" size={28} />
            </div>
            <div className="proof-visual">
              <div>
                <span className="tiny-label">YOUR SELECTED PROJECTS</span>
                <div className="visual-project">
                  <FolderGit2 size={18} />
                  <span>Something you built</span>
                  <CheckCircle2 size={16} />
                </div>
                <div className="visual-project">
                  <FolderGit2 size={18} />
                  <span>Something you contributed to</span>
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="connection-line">
                <span />
                <ChevronRight size={18} />
              </div>
              <div className="evidence-stamp">
                <ShieldCheck size={31} />
                <strong>
                  Evidence,
                  <br />
                  not endorsements.
                </strong>
              </div>
            </div>
            <div className="preview-bottom">
              <span>
                <span className="status-dot" /> Built on real repository
                evidence
              </span>
              <Code2 size={20} />
            </div>
            <div className="floating-note">
              <Sparkles size={19} />
              <span>A profile that speaks for itself.</span>
            </div>
          </div>
        </section>
        <div className="trust-strip">
          <span>BUILT FOR PEOPLE WHO BUILD.</span>
          <span>
            <Check size={16} /> Selective by design
          </span>
          <span>
            <Check size={16} /> Evidence over buzzwords
          </span>
          <span>
            <Check size={16} /> Privacy in your hands
          </span>
          <span className="mono">&lt; show_your_work /&gt;</span>
        </div>
        <section className="how-section" id="how-it-works">
          <div className="section-intro">
            <div>
              <span className="eyebrow">FROM REPOSITORY TO REPUTATION</span>
              <h2>Good work deserves to be seen.</h2>
            </div>
            <p>
              Your GitHub holds the code.
              <br />
              CodeCred helps tell the story.
            </p>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: FolderGit2,
                title: "Choose your best work.",
                text: "Your public repositories are analyzed automatically. Choose favorites for your profile showcase.",
                n: "01",
              },
              {
                icon: ChartNoAxesCombined,
                title: "Let the evidence talk.",
                text: "Turn featured projects into transparent language insights, source-line statistics, and supported skills.",
                n: "02",
              },
              {
                icon: Users,
                title: "Find your kind of builders.",
                text: "Discover developers with overlapping skills and connect through the work you both care about.",
                n: "03",
              },
            ].map((f) => (
              <article key={f.n}>
                <div className="feature-top">
                  <f.icon size={24} />
                  <span>{f.n}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="principles" id="principles">
          <div className="principles-mark">
            <ShieldCheck size={38} />
          </div>
          <div>
            <span className="eyebrow">
              CREDIBILITY STARTS WITH TRANSPARENCY
            </span>
            <h2>Your work. In the right context.</h2>
            <p>
              Repository size isn’t personal authorship. A technology mention
              isn’t proof.
              <br />
              We show what can be measured, explain how, and leave the rest
              unclaimed.
            </p>
          </div>
          <Link to="/discover" className="button secondary">
            Meet the community <ArrowUpRight size={16} />
          </Link>
        </section>
      </main>
      <footer>
        <Logo />
        <span>A little more proof. A lot more you.</span>
        <span>© {new Date().getFullYear()} CodeCred</span>
      </footer>
    </div>
  );
}
