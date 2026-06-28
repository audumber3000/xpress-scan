import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * NavigationGuardContext — a global "unsaved changes" guard.
 *
 * A screen (e.g. an open case paper) registers a blocker describing whether it
 * is dirty and how to save. While that blocker is dirty, ANY attempt to leave —
 * sidebar/header links, programmatic navigations routed through `attemptNavigate`,
 * the browser Back button, or a tab refresh/close — surfaces a single "Save & exit?"
 * prompt instead of silently discarding the work.
 *
 * Why this approach: the app uses <BrowserRouter> (not a data router), so React
 * Router's `useBlocker` is unavailable. Instead we intercept internal <Link>/<a>
 * clicks at the document level and expose `attemptNavigate` for button-driven nav.
 */
const NavigationGuardContext = createContext(null);

export const useNavigationGuard = () => useContext(NavigationGuardContext) || {
  // Safe no-op fallback if used outside the provider.
  registerBlocker: () => () => {},
  attemptNavigate: (fn) => fn(),
  guardedNavigate: () => {},
  shouldBlock: () => false,
};

export function NavigationGuardProvider({ children }) {
  const navigate = useNavigate();
  const blockerRef = useRef(null); // { isDirty, onSave?, onLeave? }
  const [pending, setPending] = useState(null); // the navigation action to run once resolved
  const [saving, setSaving] = useState(false);

  const shouldBlock = useCallback(() => {
    const b = blockerRef.current;
    return !!(b && typeof b.isDirty === 'function' && b.isDirty());
  }, []);

  const registerBlocker = useCallback((blocker) => {
    blockerRef.current = blocker;
    return () => { if (blockerRef.current === blocker) blockerRef.current = null; };
  }, []);

  // Run `performNav` now, or stash it behind the prompt if there are unsaved changes.
  const attemptNavigate = useCallback((performNav) => {
    if (shouldBlock()) setPending(() => performNav);
    else performNav();
  }, [shouldBlock]);

  const guardedNavigate = useCallback((to, opts) => {
    attemptNavigate(() => navigate(to, opts));
  }, [attemptNavigate, navigate]);

  const cancel = useCallback(() => setPending(null), []);

  const resolve = useCallback(async (save) => {
    const action = pending;
    const blocker = blockerRef.current;
    if (save && blocker?.onSave) {
      try {
        setSaving(true);
        await blocker.onSave();
      } catch (e) {
        // Save failed — keep the work and abort the navigation.
        setSaving(false);
        setPending(null);
        return;
      }
      setSaving(false);
    }
    blockerRef.current = null; // disarm so the queued action isn't re-blocked
    setPending(null);
    if (action) action();
  }, [pending]);

  // 1) Intercept internal <Link>/<a> clicks while blocking (covers sidebar, header, etc.)
  useEffect(() => {
    const onClickCapture = (e) => {
      if (!shouldBlock()) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href]');
      if (!a || a.target === '_blank') return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/')) return; // internal app links only
      e.preventDefault();
      e.stopPropagation();
      attemptNavigate(() => navigate(href));
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [shouldBlock, attemptNavigate, navigate]);

  // 2) Warn on full-page unload (refresh / close tab / leave the app)
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (shouldBlock()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [shouldBlock]);

  // 3) Intercept the browser Back button while blocking.
  // The guarded screen pushes a sentinel history entry when it becomes dirty;
  // the first Back pops that sentinel (same URL), letting us prompt instead of
  // actually leaving. On cancel we re-arm the sentinel; on confirm we go back.
  useEffect(() => {
    const onPop = () => {
      if (!shouldBlock()) return;
      setPending(() => () => {
        blockerRef.current = null;
        window.history.back();
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [shouldBlock]);

  // Re-arm the sentinel when the user cancels a Back-initiated prompt.
  const cancelAndRearm = useCallback(() => {
    if (shouldBlock()) {
      try { window.history.pushState(null, '', window.location.href); } catch { /* noop */ }
    }
    setPending(null);
  }, [shouldBlock]);

  return (
    <NavigationGuardContext.Provider value={{ registerBlocker, attemptNavigate, guardedNavigate, shouldBlock }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={cancelAndRearm}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Unsaved changes</h3>
            <p className="text-sm text-gray-500 mt-1">You have unsaved changes in this case paper. What would you like to do?</p>
            <div className="flex flex-col gap-2.5 mt-6">
              <button
                onClick={() => resolve(true)}
                disabled={saving}
                className="w-full px-4 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save & continue'}
              </button>
              <button
                onClick={() => resolve(false)}
                disabled={saving}
                className="w-full px-4 py-2.5 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-60"
              >
                Don't save
              </button>
              <button
                onClick={cancelAndRearm}
                disabled={saving}
                className="w-full px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationGuardContext.Provider>
  );
}
