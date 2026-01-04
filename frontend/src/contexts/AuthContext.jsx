import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext({});

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
    // Get initial session from localStorage
    const getInitialSession = async () => {
      console.log('🔍 [AUTH CONTEXT] Initializing...');
      try {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('user');
        
        console.log('🔍 [AUTH CONTEXT] Stored token:', storedToken ? 'Present' : 'Missing');
        console.log('🔍 [AUTH CONTEXT] Stored user:', storedUser ? 'Present' : 'Missing');
        
        if (storedToken && storedUser) {
          console.log('🔍 [AUTH CONTEXT] Validating token with /auth/me...');
          // Verify token is still valid by calling /auth/me BEFORE setting state
          try {
            const userData = await api.get('/auth/me');
            console.log('✅ [AUTH CONTEXT] Token is valid');
            console.log('✅ [AUTH CONTEXT] User data:', {
              userId: userData.user?.id,
              email: userData.user?.email,
              clinicId: userData.user?.clinic_id
            });
            
            // Token is valid, now set the state
            // Use the user data from the API response if available, otherwise use stored
            const user = userData.user || JSON.parse(storedUser);
            setToken(storedToken);
            setUser(user);
            // Update localStorage with fresh user data
            localStorage.setItem('user', JSON.stringify(user));
            console.log('✅ [AUTH CONTEXT] User state set');
          } catch (error) {
            console.error('❌ [AUTH CONTEXT] Token validation failed:', error);
            console.error('❌ [AUTH CONTEXT] Error message:', error.message);
            // Token is invalid, clear storage and don't set user state
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            console.log('🔍 [AUTH CONTEXT] Cleared invalid token');
          }
        } else {
          // No stored session, user is not authenticated
          console.log('🔍 [AUTH CONTEXT] No stored session, user not authenticated');
          setUser(null);
          setToken(null);
        }
      } catch (error) {
        console.error('❌ [AUTH CONTEXT] Error in getInitialSession:', error);
      } finally {
        setLoading(false);
        console.log('🔍 [AUTH CONTEXT] Initialization complete, loading set to false');
      }
    };

    getInitialSession();
  }, []);

  const signOut = async () => {
    console.log('🚪 [AUTH CONTEXT] Signing out...');
    try {
      // Call backend logout endpoint
      if (token) {
        await api.post('/auth/logout');
        console.log('✅ [AUTH CONTEXT] Backend logout successful');
      }
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Error signing out:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      console.log('✅ [AUTH CONTEXT] Local storage cleared, user signed out');
    }
  };

  // Log state changes
  useEffect(() => {
    console.log('🔄 [AUTH CONTEXT] State changed:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      clinicId: user?.clinic_id,
      hasToken: !!token,
      loading
    });
  }, [user, token, loading]);

  const value = {
    user,
    token,
    loading,
    signOut,
    setUser: (newUser) => {
      console.log('🔧 [AUTH CONTEXT] setUser called:', {
        hasUser: !!newUser,
        userId: newUser?.id,
        email: newUser?.email,
        clinicId: newUser?.clinic_id
      });
      setUser(newUser);
    },
    setToken: (newToken) => {
      console.log('🔧 [AUTH CONTEXT] setToken called:', {
        hasToken: !!newToken,
        tokenLength: newToken?.length
      });
      setToken(newToken);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
