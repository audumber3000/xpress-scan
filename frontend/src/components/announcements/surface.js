/**
 * Which MolarPlus the user is actually looking at.
 *
 * Four answers, because each one deserves a different pitch and three of the
 * announcements would be nonsense in the wrong one: do not ask a phone browser
 * to rate the Windows app, and do not offer the desktop installer to somebody
 * already running it.
 */

export const DESKTOP_APP = 'desktop-app';   // our Tauri wrapper
export const MOBILE_APP = 'mobile-app';     // our React Native shell
export const MOBILE_WEB = 'mobile-web';     // a browser on a phone or tablet
export const DESKTOP_WEB = 'desktop-web';   // a browser on a laptop

export const currentSurface = () => {
  if (typeof window === 'undefined') return DESKTOP_WEB;
  if (window.__MOLARPLUS_DESKTOP__) return DESKTOP_APP;
  if (window.ReactNativeWebView) return MOBILE_APP;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return MOBILE_WEB;
  return DESKTOP_WEB;
};

export const currentOs = () => {
  if (typeof window === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|MacIntel/i.test(ua)) return 'mac';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'other';
};
