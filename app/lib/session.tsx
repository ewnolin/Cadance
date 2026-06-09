import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { api, ApiError, type User } from "./api";

interface SessionValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within a <SessionProvider>");
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session on boot. A live cookie returns the user; a 401 (no
  // session) is the expected "logged out" path, not an error.
  useEffect(() => {
    let active = true;
    api.auth
      .me()
      .then((u) => active && setUser(u))
      .catch((err) => {
        if (!active) return;
        if (!(err instanceof ApiError) || err.status !== 401) {
          // Network/other errors: stay logged out, but don't crash boot.
          console.warn("Session restore failed:", err);
        }
        setUser(null);
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.auth.login(email, password));
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setUser(await api.auth.register(email, password));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, signIn, register, signOut }),
    [user, isLoading, signIn, register, signOut]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
