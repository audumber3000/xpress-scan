use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;

const REMOTE_URL: &str = "https://app.molarplus.com";

// Hosts that are allowed to navigate INSIDE the wrapper. Everything else gets
// kicked to the system browser by the `on_navigation` hook below. We match by
// suffix because Google's OAuth flow bounces between several subdomains
// (accounts.google.com, oauth2.googleapis.com, *.googleusercontent.com, ...)
// and a strict allow-list misses any of them.
const ALLOWED_HOST_SUFFIXES: &[&str] = &[
    "molarplus.com",         // app.molarplus.com and any subdomain
    "firebaseapp.com",       // Firebase Auth handler (<project>.firebaseapp.com)
    "google.com",            // accounts.google.com, oauth2.google.com, www.google.com
    "googleapis.com",        // oauth2.googleapis.com — token exchange
    "googleusercontent.com", // OAuth intermediate redirects
    "gstatic.com",           // static assets used by Google sign-in pages
];

fn host_is_allowed(host: Option<&str>) -> bool {
    let Some(h) = host else { return false };
    ALLOWED_HOST_SUFFIXES
        .iter()
        .any(|sfx| h == *sfx || h.ends_with(&format!(".{}", sfx)))
}

// Runs before any page script. Two jobs:
//  1. Unregister any service worker (and its caches) so every web deploy
//     reflects immediately in the desktop wrapper — no stale assets.
//  2. Redirect EXTERNAL target="_blank" anchor clicks (different host) to
//     top-level navigation so the Rust `on_navigation` hook routes them to
//     the system browser. Same-origin _blank links and `window.open` calls
//     are intentionally left untouched so in-app popups (Firebase OAuth,
//     etc.) and same-origin new-window flows continue to work.
const INIT_SCRIPT: &str = r#"
(() => {
  // Signal to the web app that we're running inside the MolarPlus desktop
  // wrapper. The web app should branch on this to use `signInWithRedirect`
  // instead of `signInWithPopup`, since popups don't work in thin webviews.
  try {
    Object.defineProperty(window, '__MOLARPLUS_DESKTOP__', {
      value: { version: '0.1.0', platform: 'tauri' },
      writable: false,
      configurable: false,
    });
  } catch (_) {}

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => { try { r.unregister(); } catch (_) {} }))
        .catch(() => {});
      navigator.serviceWorker.register = () =>
        Promise.reject(new Error('Service workers are disabled in the MolarPlus desktop wrapper.'));
    }
    if (typeof caches !== 'undefined' && caches && caches.keys) {
      caches.keys()
        .then(keys => keys.forEach(k => { try { caches.delete(k); } catch (_) {} }))
        .catch(() => {});
    }
  } catch (_) {}

  const ALLOWED_SUFFIXES = [
    'molarplus.com',
    'firebaseapp.com',
    'google.com',
    'googleapis.com',
    'googleusercontent.com',
    'gstatic.com',
  ];
  const hostAllowed = (host) =>
    ALLOWED_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));

  document.addEventListener('click', (event) => {
    const anchor = event.target && event.target.closest && event.target.closest('a[href]');
    if (!anchor || anchor.target !== '_blank') return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      const dest = new URL(href, location.href);
      if (!hostAllowed(dest.host)) {
        // External link in a new tab — redirect top-level so Rust catches it.
        event.preventDefault();
        window.location.href = dest.href;
      }
      // Allowed hosts: let the webview handle natively.
    } catch (_) {}
  }, true);
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(REMOTE_URL.parse().expect("REMOTE_URL must parse")),
            )
            .title("MolarPlus")
            .inner_size(1400.0, 900.0)
            .min_inner_size(1024.0, 768.0)
            .center()
            .resizable(true)
            .devtools(true)
            .initialization_script(INIT_SCRIPT)
            .on_navigation(|url| {
                if host_is_allowed(url.host_str()) {
                    return true;
                }
                let _ = open::that(url.to_string());
                false
            })
            .build()?;

            // Forward `molarplus://...` deep links into the main window. We map
            // `molarplus://<host><path>?<query>` → `https://app.molarplus.com/<host><path>?<query>`
            // so the web app can handle the route normally.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let Some(deep_url) = event.urls().into_iter().next() else { return };
                let host = deep_url.host_str().unwrap_or("");
                let path = deep_url.path();
                let query = deep_url
                    .query()
                    .map(|q| format!("?{}", q))
                    .unwrap_or_default();
                let target = format!("{}/{}{}{}", REMOTE_URL, host, path, query);
                if let Some(win) = handle.get_webview_window("main") {
                    let escaped = serde_json::to_string(&target).unwrap_or_else(|_| "\"\"".into());
                    let _ = win.eval(&format!("window.location.href = {};", escaped));
                    let _ = win.set_focus();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
