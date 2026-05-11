import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "../api/client";

interface Facilitator { id: number; email: string }
interface AuthCtx {
  facilitator: Facilitator | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [facilitator, setFacilitator] = useState<Facilitator | null>(() => {
    const raw = localStorage.getItem("facilitator");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("facilitator_token", data.token);
    localStorage.setItem("facilitator", JSON.stringify(data.facilitator));
    setFacilitator(data.facilitator);
  }

  async function register(email: string, password: string) {
    const { data } = await api.post("/auth/register", { email, password });
    localStorage.setItem("facilitator_token", data.token);
    localStorage.setItem("facilitator", JSON.stringify(data.facilitator));
    setFacilitator(data.facilitator);
  }

  function logout() {
    localStorage.removeItem("facilitator_token");
    localStorage.removeItem("facilitator");
    setFacilitator(null);
  }

  return <AuthContext.Provider value={{ facilitator, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
