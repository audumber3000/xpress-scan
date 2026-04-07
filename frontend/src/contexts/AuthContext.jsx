import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext({});

const normalizePermissions = (permissions) => {
  if (!permissions || typeof permissions !== 'object') return {};

  const normalized = {};
  Object.entries(permissions).forEach(([moduleKey, modulePerms]) => {
    if (!modulePerms || typeof modulePerms !== 'object') return;
    normalized[moduleKey] = {
      ...modulePerms,
      read: modulePerms.read === true || modulePerms.view === true,
    };
  });

  return normalized;
};

const normalizeUser = (user) => {
  if (!user) return user;
  return {
    ...user,
    permissions: normalizePermissions(user.permissions),
  };
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const storedToken = localStorage.getItem('auth_token');
      const storedUserRaw = localStorage.getItem('user');

      if (!storedToken || !storedUserRaw) {
        // Nothing in storage — definitely not logged in
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      // Optimistically restore from storage immediately so the UI doesn't flash
      const storedUser = normalizeUser(JSON.parse(storedUserRaw));
      setToken(storedToken);
      setUser(storedUser);

      // Then validate in the background
      try {
        const userData = await api.get('/auth/me');
        const apiUser = userData.user || userData;
        const freshUser = normalizeUser({ ...storedUser, ...apiUser });
        setUser(freshUser);
        localStorage.setItem('user', JSON.stringify(freshUser));
      } catch (error) {
        if (error.isAuthError) {
          // Real 401 — token is genuinely invalid/expired, log out
          setUser(null);
          setToken(null);
        }
        // Any other error (network down, timeout, server hiccup):
        // keep the optimistically restored user — do NOT log out
        console.warn('[AuthContext] /auth/me failed with non-401 error, keeping stored session:', error.message);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();
  }, []);

  // Re-fetch fresh permissions whenever the user returns to this tab.
  // Handles: (a) backend was down on initial load, (b) admin updated permissions in another tab.
  useEffect(() => {
    const handleFocus = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (!storedToken) return;
      try {
        const userData = await api.get('/auth/me');
        const apiUser = userData.user || userData;
        setUser(prev => {
          if (!prev) return prev;
          const freshUser = normalizeUser({ ...prev, ...apiUser, clinic: apiUser.clinic || prev.clinic });
          localStorage.setItem('user', JSON.stringify(freshUser));
          return freshUser;
        });
      } catch {
        // Silent — keep current user if refresh fails
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const signOut = async () => {
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await api.get('/auth/me');
      const apiUser = userData.user || userData;
      
      // Merge with existing user to keep token and ensure clinic info is present
      const freshUser = normalizeUser({ 
        ...user, 
        ...apiUser,
        clinic: apiUser.clinic || user?.clinic // Preserve clinic info if returned
      });
      
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
      return freshUser;
    } catch (error) {
      console.warn('[AuthContext] refreshUser failed:', error.message);
    }
  };

  const value = {
    user,
    token,
    loading,
    signOut,
    refreshUser,
    setUser: (newUser) => {
      const normalizedUser = normalizeUser(newUser);
      setUser(normalizedUser);
      if (normalizedUser) localStorage.setItem('user', JSON.stringify(normalizedUser));
    },
    setToken: (newToken) => {
      setToken(newToken);
    },
    switchClinic: async (clinicId) => {
      try {
        const response = await api.post(`/auth/switch-clinic/${clinicId}`);
        const { user: apiUser, token: newToken, clinic: newClinic } = response;
        
        // Construct full user object with token and active clinic info
        const userData = normalizeUser({ 
          ...(apiUser || response), 
          token: newToken || token,
          clinic: newClinic 
        });
        
        if (newToken) {
          setToken(newToken);
          localStorage.setItem('auth_token', newToken);
        }
        
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        return true;
      } catch (error) {
        console.error('[AuthContext] Failed to switch clinic:', error);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
