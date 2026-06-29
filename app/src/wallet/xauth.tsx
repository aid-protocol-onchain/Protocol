import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface XUser {
  id: string;
  handle: string;
  name: string;
  avatar: string;
}

interface XAuthCtx {
  user: XUser | null;
  loading: boolean;
  refresh: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<XAuthCtx>({
  user: null,
  loading: true,
  refresh: () => {},
  signOut: async () => {},
});

// Shared "Sign in with X" session state, read once and consumed by the nav,
// the sign-in button, and the gated Request aid page.
export function XAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<XUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: XUser | null }) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ user, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useXAuth() {
  return useContext(Ctx);
}
