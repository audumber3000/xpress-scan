# Inbox

Email and WhatsApp in one place. **Desktop only.**

## Why desktop only

WhatsApp here is a real WhatsApp Web session (WaSphere, which is Baileys under
the hood). That needs a machine that stays on, session files on disk and a QR to
pair, which a browser tab cannot provide. The email side would work on the web,
but splitting the feature across two shells for one channel is not worth it, so
the whole Inbox is gated to the Tauri app.

The gate is `window.__MOLARPLUS_DESKTOP__`, the same flag `utils/whatsapp.js`
and `components/announcements/surface.js` already use.

## Layout

    inbox/
      index.jsx              the page: channel tabs, list, thread
      components/            presentational, channel-agnostic
      hooks/                 data fetching and connection state
      providers/
        betterbox/           email, phase 1
        wasphere/            whatsapp, phase 2

`components/` must not import from `providers/`. Anything a single vendor needs
lives in that vendor's folder, so a third provider is a new folder rather than a
change to the shared UI. Same rule the backend `domains/inbox/providers/` tree
follows.

## Phase 1

BetterBox only. Gmail API, Google OAuth, no IMAP.
