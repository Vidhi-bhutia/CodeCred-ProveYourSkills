import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { X, Info } from "lucide-react";
import { api, type User } from "./api";
import { createRoot } from "react-dom/client";
import { Ctx } from "./context";
import { Logo } from "./components/ui";
import { Shell } from "./components/Shell";
import { ImportModal } from "./components/ImportModal";
import "./styles.css";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { Repositories } from "./pages/Repositories";
import { Discover } from "./pages/Discover";
import { Profile } from "./pages/Profile";
import { SettingsPage } from "./pages/SettingsPage";
function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(false),
    [version, setVersion] = useState(0);
  const refresh = async () => {
    try {
      setUser(await api("/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const changed = () => setVersion((v) => v + 1);
  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        refresh,
        notify: setToast,
        importRepos: () => setModal(true),
        version,
        changed,
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<Shell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/repositories" element={<Repositories />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/onboarding" element={<SettingsPage onboarding />} />
            <Route path="/u/:username" element={<Profile />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="not-found">
                <Logo />
                <h1>This page took a wrong turn.</h1>
                <Link className="button primary" to="/">
                  Back to CodeCred
                </Link>
              </div>
            }
          />
        </Routes>
        {modal && <ImportModal close={() => setModal(false)} />}{" "}
        {toast && (
          <div className="toast" role="status">
            <Info size={18} />
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </BrowserRouter>
    </Ctx.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
