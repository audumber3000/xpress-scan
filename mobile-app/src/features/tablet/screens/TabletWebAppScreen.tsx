import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../../../shared/constants/colors';
import { getWebAppUrl } from '../../../config/api.config';
import { useAuth } from '../../../app/AuthContext';

/**
 * Tablet shell: instead of the phone-only native UI, tablets get the responsive
 * web app (app.molarplus.com) hosted in a WebView. The native app already signed
 * the user in, so we hand its backend JWT to the web app via the existing
 * /auth/callback?token= route (frontend/src/pages/AuthCallback.jsx), which writes
 * localStorage.auth_token, calls /auth/me, and lands on /dashboard already logged in.
 */

// Hosts that must stay inside the WebView (the app itself, Firebase auth, and the
// Cashfree payment gateway). Anything else (tel:, mailto:, wa.me, external sites)
// opens in the system browser.
const IN_APP_HOST_PATTERNS = [
  'molarplus.com',
  'firebaseapp.com',
  'googleapis.com',
  'gstatic.com',
  'cashfree.com',
];

const isInAppUrl = (url: string): boolean => {
  if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
  if (!/^https?:\/\//i.test(url)) return false; // tel:, mailto:, intent:, etc → external
  try {
    const host = new URL(url).hostname;
    return IN_APP_HOST_PATTERNS.some((p) => host === p || host.endsWith(`.${p}`));
  } catch {
    return false;
  }
};

export const TabletWebAppScreen: React.FC = () => {
  const { logout } = useAuth();
  const webRef = useRef<WebView>(null);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const canGoBackRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Build the token-handoff URL once we have the native JWT.
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('access_token');
      const base = getWebAppUrl();
      setHandoffUrl(token ? `${base}/auth/callback?token=${encodeURIComponent(token)}` : `${base}/`);
    })();
  }, [reloadKey]);

  // Belt-and-suspenders: also seed localStorage before the page scripts run, in
  // case the /auth/callback route ever changes.
  const injectedBefore = React.useMemo(() => {
    // handoffUrl carries the token in the query string; pull it back out so we can
    // also write it to localStorage directly.
    const token = handoffUrl?.includes('token=')
      ? decodeURIComponent(handoffUrl.split('token=')[1] || '')
      : '';
    if (!token) return undefined;
    return `try { window.localStorage.setItem('auth_token', ${JSON.stringify(token)}); } catch (e) {} true;`;
  }, [handoffUrl]);

  // Android hardware back navigates the web history first.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onNavStateChange = useCallback(
    (nav: WebViewNavigation) => {
      canGoBackRef.current = nav.canGoBack;
      // Web session expired / logged out → the web app routes itself to /login.
      // Bounce back to the native login by clearing native auth.
      if (/\/login(\?|$|#)/.test(nav.url)) {
        logout();
      }
    },
    [logout],
  );

  const onShouldStart = useCallback((req: ShouldStartLoadRequest): boolean => {
    if (isInAppUrl(req.url)) return true;
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  const onError = useCallback(() => {
    setErrored(true);
    setLoading(false);
  }, []);

  const retry = useCallback(() => {
    setErrored(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {errored ? (
        <View style={styles.center}>
          <WifiOff size={40} color={colors.textMuted} />
          <Text style={styles.errTitle}>Can't reach the workspace</Text>
          <Text style={styles.errSub}>Check your internet connection and try again.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.8}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : handoffUrl ? (
        <WebView
          key={reloadKey}
          ref={webRef}
          source={{ uri: handoffUrl }}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={injectedBefore}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grant"
          // Keyboard: Android resizes the WebView (app.json default "resize") so
          // focused inputs scroll into view; on iOS let JS-focused inputs raise
          // the keyboard and let WKWebView manage its own content insets.
          keyboardDisplayRequiresUserAction={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          onNavigationStateChange={onNavStateChange}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadEnd={() => setLoading(false)}
          onError={onError}
          style={styles.web}
        />
      ) : null}

      {loading && !errored && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your workspace…</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  web: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    gap: 14,
  },
  loadingText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
    backgroundColor: '#F9FAFB',
  },
  errTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 6 },
  errSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});
