/**
 * API Configuration
 * 
 * Update the API_BASE_URL based on your environment:
 * - Development (local): http://localhost:8000
 * - Production: https://xpress-scan-backend-test-env.onrender.com
 * 
 * Note: For iOS simulator, use http://localhost:8000
 * For Android emulator, use http://10.0.2.2:8000
 * For physical device, use your computer's IP address (e.g., http://192.168.1.x:8000)
 */

export const API_CONFIG = {
  // Change this based on your environment
  BASE_URL: 'https://api.molarplus.com',
  
  // Alternative URLs for different platforms
  LOCALHOST: 'http://localhost:8000',
  ANDROID_EMULATOR: 'http://10.0.2.2:8000',
  PRODUCTION: 'https://api.molarplus.com',

  // Nexus micro-service (consent links, notifications, etc.)
  NEXUS_PRODUCTION: 'https://nexus.molarplus.com',
  NEXUS_LOCALHOST: 'http://localhost:8001',
  NEXUS_ANDROID_EMULATOR: 'http://10.0.2.2:8001',
  
  // Timeout settings
  TIMEOUT: 30000, // 30 seconds
};

// Helper to get the Nexus service base URL
export const getNexusBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_NEXUS_API_URL) {
    return process.env.EXPO_PUBLIC_NEXUS_API_URL;
  }
  const isDev = process.env.NODE_ENV === 'development' || __DEV__;
  if (!isDev) return API_CONFIG.NEXUS_PRODUCTION;
  const Platform = require('react-native').Platform;
  if (Platform.OS === 'android') return API_CONFIG.NEXUS_ANDROID_EMULATOR;
  return API_CONFIG.NEXUS_LOCALHOST;
};

// Helper to get the correct URL based on platform
export const getApiBaseUrl = (): string => {
  // 1. Check for environment variable first (standard for Expo)
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('🌐 [CONFIG] Using API URL from environment:', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Use production URL if not explicitly in development
  // In a real Expo app, we might use Updates.releaseChannel or __DEV__
  const isDev = process.env.NODE_ENV === 'development' || __DEV__;
  
  if (!isDev) {
    console.log('🌐 [CONFIG] Using Production API:', API_CONFIG.PRODUCTION);
    return API_CONFIG.PRODUCTION;
  }

  // Platform detection for local development
  const Platform = require('react-native').Platform;
  
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    console.log('🤖 [CONFIG] Development: Android detected - using 10.0.2.2:8000');
    return API_CONFIG.ANDROID_EMULATOR;
  } else if (Platform.OS === 'ios') {
    // iOS simulator can use localhost
    console.log('🍎 [CONFIG] Development: iOS detected - using localhost:8000');
    return API_CONFIG.LOCALHOST;
  }
  
  // Fallback to configured BASE_URL
  console.log('💻 [CONFIG] Using configured BASE_URL:', API_CONFIG.BASE_URL);
  return API_CONFIG.BASE_URL;
};
