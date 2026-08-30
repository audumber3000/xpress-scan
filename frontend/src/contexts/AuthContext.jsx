import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { askForReviewOnSignIn } from '../utils/desktopReview';
import SessionEndedModal from '../components/common/SessionEndedModal';
import { api } from '../utils/api';
import posthog from 'posthog-js';

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
  // Set only when the clinic ended the session, never on a normal sign-out.
  const [sessionEnded, setSessionEnded] = useState(null);
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

  // A session revoked while the app is open — the owner blocked this device or
  // deactivated this person, and the backend answered 401 on the next request.
  // Signing out here is what actually moves them to the login screen; clearing
  // localStorage alone left the app rendering a dashboard nobody could use.
  useEffect(() => {
    const onExpired = (e) => {
      setUser(null);
      setToken(null);
      // A modal rather than a toast. Being signed out mid-shift is not a
      // passing notice that can scroll away before it is read — it is the end
      // of the session, and the screen should say so and stay saying it.
      setSessionEnded(e?.detail?.reason || 'Your access to this clinic has changed.');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
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

  // Ask desktop users for a Store review, once they are actually in.
  //
  // Deliberately fires on session RESTORE as well as on a fresh credential
  // entry. A desktop user signs in once and stays signed in for months, so
  // counting only fresh sign-ins would mean the threshold is never reached and
  // nobody is ever asked. "Opened the app and got through" is the moment.
  //
  // The ref keeps it to once per mount; utils/desktopReview does the rest
  // (from the second sign-in, once per app version, never within a week,
  // and never again at all once a review has actually been submitted).
  const reviewAskedRef = useRef(false);
  useEffect(() => {
    if (loading || !user || reviewAskedRef.current) return;
    reviewAskedRef.current = true;
    askForReviewOnSignIn();
  }, [user, loading]);

  // Identify user in PostHog when user state changes
  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        role: user.role
      });
      if (user.clinic_id) {
        const c = user.clinic || {};
        // Enrich the clinic group so every PostHog insight can be sliced by
        // plan / trial / size (B2B group analytics).
        posthog.group('clinic', user.clinic_id, {
          name: c.name || `Clinic ${user.clinic_id}`,
          plan: c.subscription_plan || 'plus',
          is_trial: !!c.is_trial,
          trial_days_remaining: c.trial_days_remaining ?? null,
          country: c.country || null,
          created_at: c.created_at || null,
        });
      }
    } else if (!loading) {
      posthog.reset();
    }
  }, [user, loading]);

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
      {sessionEnded && (
        <SessionEndedModal
          reason={sessionEnded}
          // Dismissing only puts them on the login screen the sign-out already
          // moved them to. There is nothing else this button can usefully do.
          onSignIn={() => setSessionEnded(null)}
        />
      )}
    </AuthContext.Provider>
  );
};
