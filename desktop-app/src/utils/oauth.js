import { invoke } from '@tauri-apps/api/core';

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
};

/**
 * Start OAuth flow using system browser
 * For Tauri apps, this opens the OAuth URL in the system browser
 * and handles the callback via a local HTTP server
 */
export const startSystemBrowserOAuth = async (oauthUrl) => {
  if (!isTauri()) {
    throw new Error('System browser OAuth is only available in Tauri apps');
  }

  try {
    // Call the Rust command to start OAuth flow
    // This will:
    // 1. Start a local HTTP server on localhost:8080
    // 2. Open the OAuth URL in the system browser
    // 3. Wait for the callback
    // 4. Return the token/fragment from the callback
    const fragment = await invoke('start_google_oauth', { oauthUrl });
    return fragment;
  } catch (error) {
    console.error('🔵 [OAUTH] System browser OAuth error:', error);
    throw error;
  }
};

/**
 * Construct Google OAuth URL directly
 * Since Firebase's handler endpoint doesn't work from system browser,
 * we use Google OAuth directly
 * 
 * Note: You need to add VITE_GOOGLE_OAUTH_CLIENT_ID to your .env file
 * Get it from: Firebase Console → Project Settings → General → Your apps → OAuth 2.0 Client IDs
 * Or from: Google Cloud Console → APIs & Services → Credentials
 */
export const constructFirebaseOAuthUrl = (authDomain, apiKey, redirectUri) => {
  // Get Google OAuth client ID from environment variable
  // If not set, we'll try to construct it or use a fallback
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  
  if (!clientId) {
    console.warn('⚠️ VITE_GOOGLE_OAUTH_CLIENT_ID not set. Using Firebase handler endpoint (may not work).');
    // Fallback to Firebase handler (won't work but at least won't crash)
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    return `https://${authDomain}/__/auth/handler?apiKey=${apiKey}&authType=signInViaRedirect&redirectUrl=${encodedRedirectUri}&providerId=google.com&scopes=openid%20email%20profile&v=9`;
  }
  
  // Use Google OAuth endpoint directly
  const encodedRedirectUri = encodeURIComponent(redirectUri);
  const encodedScopes = encodeURIComponent('openid email profile');
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // Store state for verification (we'll verify it in the callback)
  sessionStorage.setItem('oauth_state', state);
  
  // Google OAuth endpoint
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodedRedirectUri}&response_type=code&scope=${encodedScopes}&state=${state}&access_type=offline&prompt=select_account`;
  
  return url;
};

/**
 * Parse OAuth callback - handles both code (from Google OAuth) and token (from Firebase)
 */
export const parseOAuthCallback = (fragment) => {
  const params = new URLSearchParams(fragment);
  
  // Check for error first
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  
  if (error) {
    throw new Error(errorDescription || error);
  }
  
  // Google OAuth returns 'code' parameter, not tokens directly
  const code = params.get('code');
  const state = params.get('state');
  
  // Verify state (security check)
  const storedState = sessionStorage.getItem('oauth_state');
  if (state && storedState && state !== storedState) {
    throw new Error('Invalid OAuth state parameter');
  }
  sessionStorage.removeItem('oauth_state');
  
  if (code) {
    // We got an authorization code, need to exchange it for tokens
    return {
      code,
      state,
      type: 'code' // Indicates we need to exchange code for token
    };
  }
  
  // Firebase OAuth might return tokens directly in fragment
  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');
  
  if (idToken) {
    return {
      idToken,
      accessToken,
      tokenType: params.get('token_type') || 'Bearer',
      expiresIn: params.get('expires_in'),
      state,
      type: 'token' // Already has token
    };
  }
  
  throw new Error('No authorization code or token found in OAuth callback');
};

/**
 * Exchange Google OAuth code for Firebase ID token
 */
export const exchangeCodeForFirebaseToken = async (code, redirectUri, apiKey) => {
  // Exchange the authorization code with Firebase
  // We need to use Firebase's token endpoint
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to exchange code for token');
  }
  
  const data = await response.json();
  
  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
};
