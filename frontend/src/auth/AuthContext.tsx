import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { fetchCurrentUser, loginRequest, registerRequest } from "../lib/authApi";
import type { PublicUser } from "../lib/authApi";
import { tokenStorage } from "../lib/tokenStorage";
import { disconnectSocket } from "../lib/socketClient";

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hasToken = Boolean(tokenStorage.getAccessToken());
    if (!hasToken) {
      setIsLoading(false);
      return;
    }
    fetchCurrentUser()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    // Tear down any stale socket connection (e.g. left over from a
    // previous user's session on this same tab) before the new
    // identity's tokens are written, so it can never keep delivering
    // the previous user's events/rooms into the new session.
    disconnectSocket();
    const result = await loginRequest({ email, password });
    tokenStorage.setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
  }

  async function register(email: string, password: string, name: string) {
    disconnectSocket();
    const result = await registerRequest({ email, password, name });
    tokenStorage.setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
  }

  function logout() {
    disconnectSocket();
    tokenStorage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
