import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('support_user');
    const token = localStorage.getItem('support_token');
    if (stored && token) {
      try { setUser(JSON.parse(stored)); } catch { }
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('support_token', token);
    localStorage.setItem('support_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('support_token');
    localStorage.removeItem('support_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
