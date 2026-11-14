import { createContext, useContext } from "react";
import type { User } from "./api";
export type Context = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
  importRepos: () => void;
  version: number;
  changed: () => void;
};

export const Ctx = createContext<Context>(null!);

export const useApp = () => useContext(Ctx);
