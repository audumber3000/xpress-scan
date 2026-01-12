/**
 * API Configuration
 * 
 * Update the API_BASE_URL based on your environment:
 * - Development (local): http://localhost:8000
 * - Production: https://xpress-scan.onrender.com
 * 
 * Note: For iOS simulator, use http://localhost:8000
 * For Android emulator, use http://10.0.2.2:8000
 * For physical device, use your computer's IP address (e.g., http://192.168.1.x:8000)
 */

export const API_CONFIG = {
  // Change this based on your environment
  BASE_URL: 'http://localhost:8000',
  
  // Alternative URLs for different platforms
  LOCALHOST: 'http://localhost:8000',
  ANDROID_EMULATOR: 'http://10.0.2.2:8000',
  PRODUCTION: 'https://xpress-scan.onrender.com',
  
  // Timeout settings
  TIMEOUT: 30000, // 30 seconds
};

// Helper to get the correct URL based on platform
export const getApiBaseUrl = (): string => {
  // Platform detection
  const Platform = require('react-native').Platform;
  
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    console.log('🤖 [CONFIG] Android detected - using 10.0.2.2:8000');
    return API_CONFIG.ANDROID_EMULATOR;
  } else if (Platform.OS === 'ios') {
    // iOS simulator can use localhost
    console.log('🍎 [CONFIG] iOS detected - using localhost:8000');
    return API_CONFIG.LOCALHOST;
  }
  
  // Fallback to configured BASE_URL
  console.log('💻 [CONFIG] Using configured BASE_URL:', API_CONFIG.BASE_URL);
  return API_CONFIG.BASE_URL;
};
