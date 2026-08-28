//! Asking for a Microsoft Store rating, from inside the app.
//!
//! Two routes, tried in order:
//!
//! 1. **The in-app dialog.** `StoreContext::RequestRateAndReviewAppAsync` puts
//!    the rating box on top of the app, so nobody leaves what they were doing.
//!    It only works when the app is a packaged (MSIX) build that was installed
//!    from the Store — a side-loaded MSI, a `tauri dev` run, or a copy someone
//!    downloaded from R2 will fail here, every time, by design.
//!
//! 2. **The Store deep link.** `ms-windows-store://review/?ProductId=…` opens
//!    the Store app on our review page. It works from any Windows build,
//!    packaged or not, which is exactly why it is the fallback rather than a
//!    second-class option.
//!
//! Route 1 failing is the NORMAL case for most of our installs, not an error
//! worth surfacing. We log it and fall through quietly.
//!
//! ## Why this is not a Tauri command
//!
//! `capabilities/default.json` deliberately withholds IPC from the remote
//! origin: the window loads app.molarplus.com, and handing a remote page the
//! ability to invoke native commands is a much larger door than this feature
//! justifies. Instead the web app asks by navigating to a sentinel URL, which
//! `on_navigation` in lib.rs intercepts and cancels — the same trick already
//! used for `/desktop-auth/start`.

/// Product ID for MolarPlus in the Microsoft Store.
///
/// Only read on Windows; `allow(dead_code)` keeps a Mac build quiet without
/// hiding a genuinely unused item on the platform that uses it.
///
/// This is the Store's identifier, not the package identity in
/// tauri.conf.json. It comes from Partner Center → Product identity, and the
/// review deep link is useless if it is wrong: the Store opens on a "we can't
/// find that" page rather than failing loudly.
#[cfg_attr(not(windows), allow(dead_code))]
pub const STORE_PRODUCT_ID: &str = "9N78RX7PHV9K";

/// The Store URI that opens our review page directly.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn review_deep_link() -> String {
    format!("ms-windows-store://review/?ProductId={}", STORE_PRODUCT_ID)
}

/// Ask for a review, preferring the in-app dialog.
///
/// Never returns an error to the caller: there is nothing a user can do about a
/// review prompt that would not open, and nothing worth interrupting them with.
/// The worst outcome is silence.
pub fn request_review(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        match windows_impl::show_in_app_dialog(window) {
            Ok(()) => {
                log_line("in-app review dialog shown");
                return;
            }
            Err(e) => {
                // Expected on every non-Store install. Not a failure.
                log_line(&format!(
                    "in-app review unavailable ({e}); falling back to the Store deep link"
                ));
            }
        }
        open_store_page();
    }

    #[cfg(not(windows))]
    {
        // macOS ships from R2 as an unsigned DMG, not the Mac App Store, so
        // there is no first-party review surface to open. Doing nothing is the
        // honest outcome; opening a Microsoft Store URI on a Mac would just
        // produce an error dialog.
        let _ = window;
        log_line("review prompt skipped: not a Microsoft Store platform");
    }
}

/// Open the Store on our review page, without trying the in-app dialog first.
///
/// Used for the "Rate us" menu item and for support emails, where the person
/// has already decided to leave a review and a dialog that may silently refuse
/// to appear is worse than just taking them there.
#[cfg(windows)]
pub fn open_store_page() {
    let link = review_deep_link();
    if let Err(e) = open::that(&link) {
        log_line(&format!("could not open {link}: {e}"));
    }
}

#[cfg(not(windows))]
pub fn open_store_page() {}

fn log_line(msg: &str) {
    println!("[review] {msg}");
}

#[cfg(windows)]
mod windows_impl {
    use windows::core::Interface;
    use windows::Foundation::AsyncOperationCompletedHandler;
    use windows::Services::Store::{
        StoreContext, StoreRateAndReviewResult, StoreRateAndReviewStatus,
    };
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::IInitializeWithWindow;

    /// Show the Store's own rate-and-review dialog over our window.
    ///
    /// ## The window handle is not optional
    ///
    /// `StoreContext` was designed for UWP, where the system already knows
    /// which window owns a dialog. In a desktop app it does not, so the context
    /// must be told through `IInitializeWithWindow` before any call that shows
    /// UI. Skip it and `RequestRateAndReviewAppAsync` throws
    /// E_NOINTERFACE-flavoured failures that read like the API is missing
    /// rather than like the handle is.
    ///
    /// ## Why we wait for the answer
    ///
    /// Returning immediately would be simpler, but then nobody can tell a
    /// rating that was given from one that was dismissed, and the app would
    /// keep asking someone who has already left five stars. So the completion
    /// handler reports success back into the page, which records it and stops
    /// asking for good.
    ///
    /// The handler, not a blocking `.get()`: the operation only completes when
    /// the person dismisses the dialog, and blocking would freeze the very UI
    /// thread that has to draw it.
    pub fn show_in_app_dialog(window: &tauri::WebviewWindow) -> Result<(), String> {
        // Tauri and this crate may not agree on the exact `windows` version, and
        // HWND changed from a newtype over isize to one over *mut c_void along
        // the way. Going through isize converts correctly under both.
        let raw = window.hwnd().map_err(|e| format!("no window handle: {e}"))?;
        let as_isize = raw.0 as isize;
        let hwnd = HWND(as_isize as *mut core::ffi::c_void);

        let context = StoreContext::GetDefault()
            .map_err(|e| format!("StoreContext unavailable (not a Store install?): {e}"))?;

        let initializer: IInitializeWithWindow = context
            .cast()
            .map_err(|e| format!("StoreContext does not support IInitializeWithWindow: {e}"))?;

        // SAFETY: `hwnd` came from the live window we were handed, and the
        // context is initialised exactly once before any UI call.
        unsafe {
            initializer
                .Initialize(hwnd)
                .map_err(|e| format!("could not attach the dialog to our window: {e}"))?;
        }

        let op = context
            .RequestRateAndReviewAppAsync()
            .map_err(|e| format!("RequestRateAndReviewAppAsync failed: {e}"))?;

        let win = window.clone();
        op.SetCompleted(&AsyncOperationCompletedHandler::<StoreRateAndReviewResult>::new(
            move |sender, _async_status| {
                let rated = sender
                    .as_ref()
                    .and_then(|s| s.GetResults().ok())
                    .and_then(|r| r.Status().ok())
                    .map(|st| st == StoreRateAndReviewStatus::Succeeded)
                    .unwrap_or(false);

                if rated {
                    // Only on Succeeded. CanceledByUser means "not now", which
                    // is not the same as "never" — a network error certainly
                    // is not either, and treating either as a rating would
                    // silently retire the prompt for someone who never left one.
                    super::log_line("review submitted; telling the app to stop asking");
                    let _ = win.eval("window.__molarplusReviewGiven && window.__molarplusReviewGiven();");
                } else {
                    super::log_line("review dialog closed without a rating");
                }
                Ok(())
            },
        ))
        .map_err(|e| format!("could not attach a completion handler: {e}"))?;

        Ok(())
    }
}
