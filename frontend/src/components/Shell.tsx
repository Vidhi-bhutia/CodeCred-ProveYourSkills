import { useEffect, useState } from "react";
import { NavLink, useLocation, Outlet } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronRight,
  Code2,
  Compass,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { api, send } from "../api";
import { useApp } from "../context";

import { Logo, Avatar, Login } from "../components/ui";
export function Shell() {
  const { user, loading, notify, refresh } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const nav = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Overview" },
    {
      to: user ? `/u/${user.username}` : "/dashboard",
      icon: Code2,
      label: "My profile",
    },
    { to: "/repositories", icon: FolderGit2, label: "Repositories" },
    { to: "/discover", icon: Compass, label: "Discover developers" },
  ];
  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Logo />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <NavLink key={n.label} to={n.to} onClick={() => setOpen(false)}>
              <n.icon size={19} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <ShieldCheck size={21} />
          </div>
          <strong>Built on proof.</strong>
          <p>A few great projects say more than a hundred skill claims.</p>
          <a href="/dashboard#methodology">
            How we measure <ArrowUpRight size={13} />
          </a>
        </div>
        <div className="sidebar-bottom">
          <NavLink to="/settings">
            <Settings size={18} /> Settings & privacy
          </NavLink>
          {user ? (
            <>
              <div className="sidebar-user">
                <Avatar user={user} />
                <div>
                  <strong>{user.displayName}</strong>
                  <span>@{user.username}</span>
                </div>
                <button
                  title="Log out"
                  aria-label="Log out"
                  onClick={async () => {
                    try {
                      await api("/auth/logout", send("POST"));
                      await refresh();
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  <LogOut size={17} />
                </button>
              </div>
            </>
          ) : (
            <Login label="Sign in with GitHub" className="secondary small" />
          )}
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-panel">
        <header className="app-header">
          <div>
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} />{" "}
              <strong>
                {location.pathname === "/discover"
                  ? "Discover"
                  : location.pathname === "/repositories"
                    ? "Repositories"
                    : location.pathname === "/settings"
                      ? "Settings"
                      : location.pathname.startsWith("/u/")
                        ? "Developer profile"
                        : location.pathname === "/onboarding"
                          ? "Welcome to CodeCred"
                          : "Overview"}
              </strong>
            </span>
          </div>
          <div className="header-right">
            <span className="header-message">
              <span className="status-dot" /> A reputation built on real work
            </span>
            {user && <Avatar user={user} size={32} />}
          </div>
        </header>
        <main className="app-content">
          {loading ? (
            <div className="skeleton">
              <div />
              <div />
              <div />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <div className="app-footer">
          <span>Made for the work behind the title.</span>
          <span>
            <ShieldCheck size={13} /> Evidence you can explain.
          </span>
        </div>
      </div>
    </div>
  );
}
