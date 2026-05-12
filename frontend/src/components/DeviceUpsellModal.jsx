import React, { useEffect, useState } from 'react';
import { Laptop, Smartphone, X, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'mp_device_upsell_v1';
const REMINDER_AFTER_DAYS = 7;

/**
 * Shows a one-time upsell after the user lands inside the app:
 *  - On a laptop/desktop browser → "Try the desktop app" with the Mac/Windows installer.
 *  - On a mobile browser → "Get the mobile app" with App Store + Play Store badges.
 *
 * Suppresses itself when:
 *  - Already running inside the MolarPlus desktop wrapper (window.__MOLARPLUS_DESKTOP__).
 *  - Already running inside the React Native mobile app (window.ReactNativeWebView).
 *  - The user dismissed it in the last 7 days.
 *  - The user clicked "Don't show again."
 */
const DeviceUpsellModal = () => {
  const [variant, setVariant] = useState(null); // 'desktop' | 'mobile' | null

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already inside one of our native shells → don't pitch a download.
    if (window.__MOLARPLUS_DESKTOP__) return;
    if (window.ReactNativeWebView) return;

    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) { /* corrupt → treat as fresh */ }

    if (saved.permanent) return;
    if (saved.dismissedAt && Date.now() - saved.dismissedAt < REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000) return;

    const ua = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isMacOrWin = /Macintosh|MacIntel|Windows/i.test(ua);

    // Small delay so the user sees the page they logged into before the modal appears.
    const t = setTimeout(() => {
      if (isMobile) setVariant('mobile');
      else if (isMacOrWin) setVariant('desktop');
    }, 900);

    return () => clearTimeout(t);
  }, []);

  const close = (permanent = false) => {
    setVariant(null);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ dismissedAt: Date.now(), permanent })
      );
    } catch (_) {}
  };

  if (!variant) return null;

  const isDesktop = variant === 'desktop';
  const isMac = isDesktop && /Macintosh|MacIntel/i.test(navigator.userAgent);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={() => close(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={() => close(false)}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Visual header */}
        <div className="relative bg-gradient-to-br from-[#2a276e] to-[#1a1548] px-8 pt-10 pb-8 text-center text-white overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute -bottom-12 -left-10 w-40 h-40 bg-white/5 rounded-full" />

          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              {isDesktop ? (
                <Laptop className="w-10 h-10 text-[#2a276e]" strokeWidth={1.8} />
              ) : (
                <Smartphone className="w-10 h-10 text-[#2a276e]" strokeWidth={1.8} />
              )}
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-amber-900" strokeWidth={2.5} />
            </div>
          </div>

          <h2 className="relative text-2xl font-bold mb-2">
            {isDesktop
              ? 'MolarPlus runs faster as an app.'
              : 'MolarPlus fits in your pocket.'}
          </h2>
          <p className="relative text-sm text-white/80 leading-relaxed">
            {isDesktop
              ? 'Skip the browser tabs. Launch in one click, stay signed in, and keep your clinic always one keystroke away.'
              : 'Capture intraoral photos, book appointments, and check today\'s schedule — wherever the patient is.'}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {isDesktop ? (
            <div className="space-y-3">
              <a
                href={isMac
                  ? 'https://pub-376f22e59eee415286747973b95ba075.r2.dev/MolarPlus-mac.dmg'
                  : 'https://pub-376f22e59eee415286747973b95ba075.r2.dev/MolarPlus-windows.msi'}
                className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-[#2a276e] text-white rounded-xl font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
                onClick={() => close(false)}
              >
                <Laptop className="w-5 h-5" />
                {isMac ? 'Download for Mac' : 'Download for Windows'}
              </a>
              <p className="text-xs text-gray-400 text-center">
                Free • {isMac ? 'macOS 10.15+' : 'Windows 10/11'} • Auto-updating
              </p>
            </div>
          ) : (
            <div className="flex gap-3 items-center justify-center">
              <a
                href="https://apps.apple.com/app/molarplus"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download on the App Store"
                onClick={() => close(false)}
                className="hover:opacity-80 transition-opacity"
              >
                <img src="/badges/app-store.svg" alt="Download on the App Store" className="h-11 w-auto" />
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.molarplus.app&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get it on Google Play"
                onClick={() => close(false)}
                className="hover:opacity-80 transition-opacity"
              >
                <img src="/badges/google-play.svg" alt="Get it on Google Play" className="h-14 w-auto" />
              </a>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between text-xs">
            <button
              onClick={() => close(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Maybe later
            </button>
            <button
              onClick={() => close(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              Don't show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceUpsellModal;
