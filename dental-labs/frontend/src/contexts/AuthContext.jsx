/**
 * AuthContext — manages user session state for Dental Labs.
 *
 * Stripped from MolarPlus: no Firebase, no PostHog, no multi-clinic switching.
 * Added: lab object alongside user.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../utils/api";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem("auth_token");
      const storedUser = localStorage.getItem("user");

      if (!storedToken || !storedUser) {
        setLoading(false);
        return;
      }

      // Optimistically restore
      setToken(storedToken);
      setUser(JSON.parse(storedUser));

      // Validate in background
      try {
        const data = await api.get("/auth/me");
        const freshUser = data.user || data;
        setUser(freshUser);
        localStorage.setItem("user", JSON.stringify(freshUser));
      } catch (error) {
        if (error.isAuthError) {
          setUser(null);
          setToken(null);
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (email, password) => {
    const data = await api.post("/auth/login", { email, password });
    const { token: newToken, user: newUser } = data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("auth_token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    return newUser;
  };

  const register = async (email, password, firstName, lastName) => {
    const data = await api.post("/auth/register", {
      email,
      password,
      first_name: firstName,
      last_name: lastName,
    });
    const { token: newToken, user: newUser } = data;
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("auth_token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    return newUser;
  };

  const completeOnboarding = async (labData) => {
    const data = await api.post("/auth/onboarding", labData);
    const freshUser = data.user;
    setUser(freshUser);
    localStorage.setItem("user", JSON.stringify(freshUser));
    return data.lab;
  };

  const signOut = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await api.get("/auth/me");
      const freshUser = data.user || data;
      setUser(freshUser);
      localStorage.setItem("user", JSON.stringify(freshUser));
      return freshUser;
    } catch (error) {
      console.warn("[AuthContext] refreshUser failed:", error.message);
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    completeOnboarding,
    signOut,
    refreshUser,
    isAuthenticated: !!user,
    isOnboarded: !!user?.lab_id,
    lab: user?.lab || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
