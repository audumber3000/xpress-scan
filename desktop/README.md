# MolarPlus Desktop

A thin [Tauri v2](https://tauri.app) wrapper around the MolarPlus web app at <https://app.molarplus.com>.

There is **no separate desktop codebase**. The desktop app loads the live production web app at runtime — every web deploy is reflected in the desktop app on next launch (or refresh). No bundled HTML/CSS/JS, no native business logic.

> **Bundle identifier:** `com.molarplus.desktop`
> **URL scheme:** `molarplus://` (for password-reset emails, OAuth callbacks, etc.)
> **Window default:** 1400 × 900, min 1024 × 768

---

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| **Rust** (stable) | Tauri's native build toolchain | <https://rustup.rs> |
| **Node.js 18+** | Drives the Tauri CLI (no runtime Node in the app) | <https://nodejs.org> |
| **Xcode CLT** (macOS only) | macOS SDK + `iconutil` | `xcode-select --install` |
| **WebView2** (Windows only, runtime) | Already on Win10 1803+ and all Win11 | bundled by installer if missing |
| **Visual Studio C++ build tools** (Windows builds only) | required by Rust on Windows | Visual Studio Installer |

---

## Local development

```bash
cd desktop
npm install      # installs the Tauri CLI; no app dependencies
npm run dev      # opens a window pointing at https://app.molarplus.com
```

`npm run dev` launches a dev window connected to the **production** URL (`devUrl` is set to `https://app.molarplus.com` in `src-tauri/tauri.conf.json`). There is no local web dev server — this wrapper has no frontend of its own.

If you want to point the wrapper at a staging URL or a localhost web dev server, edit `REMOTE_URL` and `REMOTE_HOST` in [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) and the `devUrl`/`frontendDist` in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json).

---

## Build a local installer (unsigned)

```bash
cd desktop
npm run build
```

Output:
- **macOS:** `src-tauri/target/release/bundle/dmg/MolarPlus_0.1.0_<arch>.dmg`
- **Windows:** `src-tauri/target/release/bundle/msi/MolarPlus_0.1.0_x64_en-US.msi`

This produces an **unsigned** installer — fine for testing, but macOS Gatekeeper will warn users on first open (right-click → Open) and Windows SmartScreen will likely block it. See [Code signing](#code-signing) below for the production setup.

---

## How it works

| Concern | Implementation |
|---|---|
| **Loads the remote app** | `WebviewUrl::External("https://app.molarplus.com")` — see [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) |
| **External links** (any host ≠ `app.molarplus.com`) | Caught by the Rust `on_navigation` hook, opened in the user's default browser via the [`open`](https://crates.io/crates/open) crate. `target="_blank"` clicks are normalized into top-level navigation by an injected JS hook so the Rust side can intercept them. |
| **Service worker stripped inside the wrapper** | An `initialization_script` in `lib.rs` unregisters any active SW and clears `caches.*` on every page load — guarantees that web deploys reflect immediately, no stale assets. |
| **`molarplus://` deep links** | `tauri-plugin-deep-link` registers the scheme on macOS (`Info.plist`) and Windows (NSIS registry). When invoked, the URL is mapped to `https://app.molarplus.com/<host><path>?<query>` and the main window navigates there. |
| **Auto-updater** | `tauri-plugin-updater` configured with a GitHub Releases endpoint. Disabled by default until signing keys are wired in (see below). |
| **Cookies / auth** | Tauri's webview keeps its own cookie jar, separate from the user's browser. Users log in once inside the desktop app and stay logged in. This is correct behavior, not a bug. |

> ⚠️ **macOS uses WKWebView (Safari engine).** If a feature works in Chrome but not Safari, it will break in the macOS desktop build. Test `app.molarplus.com` in Safari before relying on the macOS wrapper.

---

## Icons

The icons in `src-tauri/icons/` are the **real MolarPlus brand mark** (the navy tooth + sparkle), derived from the mobile app's 1024×1024 adaptive icon at [`mobile-app/assets/adaptive-icon.png`](../mobile-app/assets/adaptive-icon.png) — same mark that ships on iOS and Android. So the icon is consistent across all three platforms.

To re-sync after the mobile icon is updated:

```bash
python3 src-tauri/icons/generate.py
```

The script uses `sips` + `iconutil` (both ship with macOS) to derive all PNG sizes, the `.icns` (macOS), and a multi-resolution `.ico` (Windows) from the single master PNG.

If you ever want to point at a different source PNG (e.g. a desktop-specific variant), edit the `SOURCE = ...` line at the top of [`src-tauri/icons/generate.py`](src-tauri/icons/generate.py) and re-run.

---

## Releasing (CI/CD → Cloudflare R2)

Releases are produced by [.github/workflows/desktop-release.yml](../.github/workflows/desktop-release.yml). The workflow only fires on tags matching **`desktop-v*`**, so it is fully isolated from web-app CI. Installers go straight to **Cloudflare R2** so the marketing site can serve them via direct download links — no GitHub Releases involved.

### Cut a release

```bash
# 1. Bump the version in two places (must match):
#    - desktop/src-tauri/tauri.conf.json   ("version": "0.2.0")
#    - desktop/src-tauri/Cargo.toml         (version = "0.2.0")

# 2. Commit, then tag and push:
git commit -am "desktop: release v0.2.0"
git tag desktop-v0.2.0
git push origin main --tags
```

The workflow:
1. Builds the macOS Universal binary (aarch64 + x86_64) and the Windows x86_64 installer in parallel.
2. Signs each one if the relevant GitHub secrets exist (see below); otherwise produces unsigned artifacts.
3. Uploads each installer to R2 under **two** keys:
   - `MolarPlus-mac.dmg` / `MolarPlus-windows.msi` — the **stable** filename the marketing-site download button points at. Overwritten on every release.
   - `MolarPlus-mac-desktop-vX.Y.Z.dmg` / `MolarPlus-windows-desktop-vX.Y.Z.msi` — the **versioned** archive. Never overwritten. Useful for rollbacks and audit.

The first run with no secrets configured is the expected smoke test — it will fail at the R2 upload step (no R2 credentials yet). Once secrets are in place, you'll get a clean unsigned-but-uploaded build, and signing kicks in once those certs are added.

### Marketing site download buttons

The bucket is exposed publicly at `https://pub-376f22e59eee415286747973b95ba075.r2.dev`, so the marketing site uses these permanent URLs:

```html
<a href="https://pub-376f22e59eee415286747973b95ba075.r2.dev/MolarPlus-mac.dmg" download>Download for Mac</a>
<a href="https://pub-376f22e59eee415286747973b95ba075.r2.dev/MolarPlus-windows.msi" download>Download for Windows</a>
```

These never change between releases. Browsers will revalidate against R2 on each click (the upload step sets `Cache-Control: public, no-cache`), so users always get the latest installer the moment CI finishes pushing v0.2.0 — no manual cache purge needed.

> If you later map a prettier custom domain (e.g. `downloads.molarplus.com`) to this bucket in Cloudflare, just swap the host in the URLs above. No CI changes needed.

---

## GitHub secrets (one place, configured once)

All secrets live under **Settings → Secrets and variables → Actions** on the `audumber3000/xpress-scan` repo. The CI workflow reads them as env vars only inside the runner — they never end up in the installer or on R2.

### Cloudflare R2 (required — without these, CI fails at upload)

The desktop installer is published to a dedicated R2 bucket: **`molarplus-installers`** (public, served from `https://pub-376f22e59eee415286747973b95ba075.r2.dev`). Reuses the same account-wide R2 API token that the backend already uses — no new Cloudflare credentials to issue.

The bucket name is hardcoded in the workflow (it's not sensitive and never changes), so only three GitHub Actions secrets are required:

| Secret | Value | Reused from |
|---|---|---|
| `R2_ACCESS_KEY_ID` | the existing account-wide R2 access key | backend `.env` |
| `R2_SECRET_ACCESS_KEY` | the existing account-wide R2 secret key | backend `.env` |
| `R2_ENDPOINT_URL` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | backend `.env` |

To copy the values: open the production backend `.env` and copy the matching lines into **Settings → Secrets and variables → Actions** on the GitHub repo.

## Code signing

These secrets gate signing. The CI workflow reads them as environment variables; if any are missing, the affected signing step is skipped (the build still succeeds, but the installer is unsigned and Gatekeeper / SmartScreen will warn users on first launch).

### macOS (Apple Developer ID — $99/yr)

1. In your Apple Developer account, create a **Developer ID Application** certificate.
2. Export it from Keychain as a `.p12` with a password.
3. Base64-encode the `.p12`: `base64 -i cert.p12 | pbcopy`.
4. Add these GitHub secrets:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | the base64 string from step 3 |
| `APPLE_CERTIFICATE_PASSWORD` | password used when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: MolarPlus Inc (TEAMID)` |
| `APPLE_ID` | the Apple ID email used for notarization |
| `APPLE_PASSWORD` | an app-specific password generated at <https://appleid.apple.com> |
| `APPLE_TEAM_ID` | your Apple Developer team ID (10 chars) |

### Windows (EV or standard code signing certificate)

1. Obtain a code signing certificate (EV recommended to skip SmartScreen warm-up). Export as `.pfx`.
2. Base64-encode it: `base64 -w 0 cert.pfx | pbcopy` (or `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))` in PowerShell).
3. Add these GitHub secrets:

| Secret | Value |
|---|---|
| `WINDOWS_CERTIFICATE` | the base64 string from step 2 |
| `WINDOWS_CERTIFICATE_PASSWORD` | password used when exporting the `.pfx` |

### Updater signing keys (required for auto-updates)

Generate a key pair locally:

```bash
cd desktop
npx @tauri-apps/cli signer generate -w ~/.tauri/molarplus.key
```

This prints the **public key** (a short minisign line) and writes the **private key** to the path you chose (with a password you'll set interactively).

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | the **contents** of `~/.tauri/molarplus.key` (the whole file) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the password you set during `signer generate` |

Then in `src-tauri/tauri.conf.json`:
1. Paste the public key into `plugins.updater.pubkey`.
2. Replace the `REPLACE_OWNER/REPLACE_REPO` placeholders in `plugins.updater.endpoints` with the real GitHub repo path.
3. Flip `bundle.createUpdaterArtifacts` from `false` to `true` so each build emits a `latest.json`.

Until you do all three, the updater plugin is loaded but no `latest.json` is produced and no auto-update check fires at runtime.

---

## What this wrapper deliberately does NOT include

The spec was: **minimal**. These can be added later if customers ask, but are out of scope today:
- System tray icon
- Custom title bar (we use native OS chrome)
- Native notifications integration
- Analytics SDKs
- Bundled assets / offline mode
- Any IPC bridge to the web app (`app.molarplus.com` cannot call Tauri commands; the wrapper only intercepts navigation and deep links)

---

## Troubleshooting

**`npm run dev` opens a blank window** — check that <https://app.molarplus.com> is reachable from your network. The wrapper has no fallback content.

**Service worker still serving stale assets after a web deploy** — the SW unregister runs on every load, so the second launch should be clean. If it persists, fully quit the app (Cmd+Q on Mac, full close on Windows) and reopen.

**macOS build fails with "unable to find icon.icns"** — re-run `python3 src-tauri/icons/generate.py` (it requires `iconutil`, which ships with Xcode CLT).

**Windows build fails with "linker `link.exe` not found"** — install the Visual Studio "Desktop development with C++" workload.

**Deep link `molarplus://...` does nothing** — on macOS the scheme is registered when the app is first launched (LaunchServices). On Windows it's registered by the MSI installer. Reinstall after changing the scheme.
