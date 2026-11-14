import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Github, ShieldCheck } from "lucide-react";
import { api, send } from "../api";
import { useApp } from "../context";

import { Avatar, Login, RequireLogin, PageHeading } from "../components/ui";
export function SettingsPage({ onboarding = false }: { onboarding?: boolean }) {
  const { user, refresh, notify, changed } = useApp();
  const [form, setForm] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [removeData, setRemoveData] = useState(false),
    [deleteConfirm, setDeleteConfirm] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (user)
      setForm({
        displayName: user.displayName,
        username: user.username,
        bio: user.bio || "",
        location: user.location || "",
        website: user.website || "",
        portfolio: user.portfolio || "",
        linkedin: user.linkedin || "",
        interests: user.interests || "",
        visibility: user.visibility,
        discovery: user.discovery,
      });
  }, [user]);
  if (!user) return <RequireLogin />;
  if (!form) return null;
  const field = (key: string) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/me", send("PATCH", form));
      await refresh();
      changed();
      notify("Your profile and privacy preferences are saved.");
      if (onboarding) navigate("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await api("/me/disconnect", send("POST", { deleteData: removeData }));
      await refresh();
      changed();
      notify("GitHub disconnected. Future synchronization is disabled.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow={
          onboarding ? "LET’S MAKE THIS YOURS" : "YOUR IDENTITY. YOUR RULES."
        }
        title={
          onboarding ? "Welcome to your next chapter." : "Settings & privacy"
        }
        text={
          onboarding
            ? "A few details, then the work can speak for itself."
            : "A thoughtful profile starts with being in control."
        }
      />
      <form className="settings-form" onSubmit={save}>
        <section className="card settings-card">
          <div className="settings-heading">
            <h2>Your developer profile</h2>
            <p>The person behind the projects.</p>
          </div>
          <div className="settings-avatar">
            <Avatar user={user} size={62} />
            <div>
              <strong>{user.displayName}</strong>
              <p>Profile photo from your GitHub account.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Display name
              <input required maxLength={70} {...field("displayName")} />
            </label>
            <label>
              CodeCred username
              <input
                required
                minLength={3}
                maxLength={39}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                {...field("username")}
              />
              <small>Lowercase letters, numbers and hyphens.</small>
            </label>
            <label className="full-width">
              A little about you
              <textarea
                maxLength={280}
                rows={3}
                placeholder="What do you enjoy building?"
                {...field("bio")}
              />
              <small>{form.bio.length}/280</small>
            </label>
            <label>
              Location <span>optional</span>
              <input
                maxLength={100}
                placeholder="Where you build from"
                {...field("location")}
              />
            </label>
            <label>
              Website <span>optional</span>
              <input
                type="url"
                placeholder="https://your-website.dev"
                {...field("website")}
              />
            </label>
            <label>
              Portfolio <span>optional</span>
              <input
                type="url"
                placeholder="https://"
                {...field("portfolio")}
              />
            </label>
            <label>
              LinkedIn <span>optional</span>
              <input
                type="url"
                placeholder="https://linkedin.com/in/…"
                {...field("linkedin")}
              />
            </label>
            <label className="full-width">
              Developer interests <span>optional</span>
              <input
                maxLength={200}
                placeholder="The kinds of problems you like to solve"
                {...field("interests")}
              />
            </label>
          </div>
        </section>
        <section className="card settings-card">
          <div className="settings-heading">
            <h2>Visible on your terms</h2>
            <p>Private by default. Discovery is always your choice.</p>
          </div>
          <div className="setting-row">
            <div>
              <strong>Public profile</strong>
              <p>
                Let anyone view your profile, featured projects, and analytics.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Public profile"
              aria-checked={form.visibility === "public"}
              className={`toggle ${form.visibility === "public" ? "on" : ""}`}
              onClick={() =>
                setForm({
                  ...form,
                  visibility:
                    form.visibility === "public" ? "private" : "public",
                })
              }
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Allow developer discovery</strong>
              <p>
                Allow CodeCred to recommend your public profile to developers
                with similar skills. Private profiles are always excluded.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Allow developer discovery"
              aria-checked={form.discovery}
              className={`toggle ${form.discovery ? "on" : ""}`}
              onClick={() => setForm({ ...form, discovery: !form.discovery })}
            >
              <span />
            </button>
          </div>
        </section>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="save-row">
          <span>
            <ShieldCheck size={15} /> Your preferences take effect when saved.
          </span>
          <button disabled={busy} className="button primary" type="submit">
            {busy
              ? "Saving…"
              : onboarding
                ? "Create my profile"
                : "Save changes"}
            <Check size={16} />
          </button>
        </div>
      </form>
      {!onboarding && (
        <>
          <section className="card settings-card">
            <div className="settings-heading">
              <h2>GitHub connection</h2>
              <p>Your code stays where it belongs.</p>
            </div>
            <div className="connection-account">
              <Github size={26} />
              <div>
                <strong>@{user.githubLogin}</strong>
                <p>
                  {user.connected
                    ? "Connected · public repositories only"
                    : "Disconnected · synchronization disabled"}
                </p>
              </div>
              <span className="pill">
                {user.connected ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
            <div className="connection-controls">
              {user.connected ? (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={removeData}
                      onChange={(e) => setRemoveData(e.target.checked)}
                    />{" "}
                    Also delete synchronized repositories and their analytics
                    when disconnecting.
                  </label>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={disconnect}
                  >
                    Disconnect GitHub
                  </button>
                </>
              ) : (
                <Login label="Reconnect GitHub" />
              )}
              <p className="caption">
                Disconnect removes the stored GitHub token. You can also revoke
                access in GitHub → Settings → Applications.
              </p>
            </div>
          </section>
          <section className="card settings-card danger-zone">
            <div className="settings-heading">
              <h2>Delete your CodeCred account</h2>
              <p>
                Permanently delete your profile, repository analytics, and
                social connections. Your GitHub repositories remain on GitHub.
              </p>
            </div>
            <label className="delete-input">
              Type your CodeCred username to confirm
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={user.username}
              />
            </label>
            <button
              className="button danger"
              disabled={busy || deleteConfirm !== user.username}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/me", send("DELETE"));
                  await refresh();
                  changed();
                  navigate("/");
                  notify("Your CodeCred account has been deleted.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete my account
            </button>
          </section>
        </>
      )}
    </>
  );
}
