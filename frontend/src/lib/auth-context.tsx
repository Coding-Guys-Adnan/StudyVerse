"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { authApi, type User, type LoginData, type RegisterData } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user on mount with optimistic UI hydration & authoritative verification
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("access_token");
      const cachedUserStr = localStorage.getItem("user");

      if (!token) {
        localStorage.removeItem("user");
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Optimistic UI hydration (non-authoritative) to prevent layout flash
      if (cachedUserStr) {
        try {
          setUser(JSON.parse(cachedUserStr));
        } catch {
          localStorage.removeItem("user");
        }
      }

      try {
        // Authoritative verification via backend JWT and /auth/me
        const res = await authApi.me();
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));
      } catch (err) {
        // Authoritative check failed: clear cached user, clear auth state, redirect to login
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        setUser(null);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [router]);

  const login = useCallback(
    async (data: LoginData) => {
      const res = await authApi.login(data);
      localStorage.setItem("access_token", res.data.access_token);

      const userRes = await authApi.me();
      setUser(userRes.data);
      localStorage.setItem("user", JSON.stringify(userRes.data));

      // Redirect based on role
      if (userRes.data.role === "admin") {
        router.push("/admin");
      } else if (userRes.data.role === "teacher") {
        router.push("/dashboard");
      } else {
        router.push("/portal");
      }
    },
    [router]
  );

  const register = useCallback(
    async (data: RegisterData) => {
      await authApi.register(data);
      // Auto-login after registration
      await login({ email: data.email, password: data.password });
    },
    [login]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
