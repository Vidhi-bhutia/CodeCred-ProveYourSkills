import { useEffect, useState } from "react";
import { api, send, type Stats, type Repo } from "./api";
import { useApp } from "./context";
export function useAnalytics() {
  const { user, version, changed, notify } = useApp();
  const [stats, setStats] = useState<Stats | null>(null),
    [repositories, setRepositories] = useState<Repo[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const [data, repos] = await Promise.all([
          api<Stats>("/analytics"),
          api<Repo[]>("/repositories"),
        ]);
        if (!alive) return;
        setStats(data);
        setRepositories(repos);
        setError("");
        if (["queued", "running", "waiting"].includes(data.sync?.state || ""))
          timer = setTimeout(load, 4000);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [user?.id, version]);
  const refreshGitHub = async () => {
    setRefreshing(true);
    try {
      await api("/analytics/refresh", send("POST"));
      changed();
      notify(
        "GitHub analytics refresh queued. Your featured choices stay unchanged.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };
  return { stats, repositories, loading, error, refreshing, refreshGitHub };
}
