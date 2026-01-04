import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('user');
      const token = await SecureStore.getItemAsync('auth_token');
      
      if (storedUser && token) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
        
        // Verify token is still valid
        try {
          const { data } = await api.get('/auth/me');
          setUser(data);
          await SecureStore.setItemAsync('user', JSON.stringify(data));
        } catch (error) {
          // Token invalid, clear storage
          await SecureStore.deleteItemAsync('auth_token');
          await SecureStore.deleteItemAsync('user');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
        device_data: {
          device_type: 'mobile',
          device_platform: 'ios', // or 'android'
          device_os: 'iOS', // or 'Android'
          device_name: 'Mobile Device'
        }
      });

      const data = response.data;
      
      if (!data || !data.access_token) {
        return { success: false, error: 'Invalid response from server' };
      }

      await SecureStore.setItemAsync('auth_token', data.access_token);
      await SecureStore.setItemAsync('user', JSON.stringify(data.user));
      
      setUser(data.user);
      setIsAuthenticated(true);
      
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const loginWithGoogle = async (idToken) => {
    try {
      const response = await api.post('/auth/oauth', {
        id_token: idToken,
        device_data: {
          device_type: 'mobile',
          device_platform: Platform.OS === 'ios' ? 'iOS' : 'Android',
          device_os: Platform.OS === 'ios' ? 'iOS' : 'Android',
          device_name: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} Device`
        }
      });

      const data = response.data;
      
      // Backend returns 'token' not 'access_token' for OAuth
      const token = data.token || data.access_token;
      
      if (!data || !token) {
        return { success: false, error: 'Invalid response from server' };
      }

      await SecureStore.setItemAsync('auth_token', token);
      await SecureStore.setItemAsync('user', JSON.stringify(data.user));
      
      setUser(data.user);
      setIsAuthenticated(true);
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message || 'Google login failed' };
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const isAdmin = () => {
    if (!user) return false;
    return user.role === 'clinic_owner' || user.role === 'doctor';
  };

  const isEmployee = () => {
    if (!user) return false;
    return user.role === 'receptionist' || user.role === 'staff';
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    loginWithGoogle,
    logout,
    isAdmin,
    isEmployee,
    refreshUser: loadUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

