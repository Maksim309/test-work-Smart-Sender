import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, subscribeSessionEnd } from "../api";
import { getFingerprint } from "./fingerprint";
import type { User } from "../domain/types";
import { errorMessage } from "../api/client";

interface Auth {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  notice: string;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [logoutNotice, setLogoutNotice] = useState("");

  useEffect(() => subscribeSessionEnd(() => setUser(null)), []);

  const login = async (email: string, password: string) => {
    const sessionVersion = api.beginSession();

    setLogoutNotice("");

    const fingerprint = getFingerprint();
    const { device_session_token } = await api.request<{
      device_session_token: string;
    }>("/auth/login", {
      method: "POST",
      body: { email, password, fingerprint },
      headers: { "X-Captcha-Token": "mock-captcha" },
    });

    api.assertSession(sessionVersion);

    await api.request("/auth/token/issue", {
      method: "POST",
      body: { device_session_token, fingerprint },
    });

    api.assertSession(sessionVersion);
    const currentUser = await api.request<User>("/v1/me", { protected: true });

    api.assertSession(sessionVersion);
    setUser(currentUser);
  };

  const logout = async () => {
    try {
      await api.request("/auth/token/revoke", {
        method: "POST",
        body: { fingerprint: getFingerprint() },
      });
    } catch (error) {
      setLogoutNotice(
        `You have signed out locally, but the server could not confirm sign-out. ${errorMessage(error)}`,
      );
    } finally {
      api.endSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, notice: logoutNotice }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("AuthProvider is required");
  }

  return auth;
}
