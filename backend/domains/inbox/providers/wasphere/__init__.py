"""
WaSphere: the WhatsApp provider. Phase 2, not registered yet.

Upstream is github.com/wasphere/wasphere, MIT, NestJS + Baileys, deployed with
Docker. Three things that shape how it has to be built here:

  1. It is a SERVICE, not a library. It runs as its own process with a REST API,
     signed webhooks and scoped API keys. We talk to it over HTTP; we do not
     import it. On desktop that process is a sidecar next to the Tauri app.
  2. Baileys drives a real WhatsApp Web session, which is why this feature is
     desktop-only: it needs a machine that stays on, with session files on disk
     and a QR to pair.
  3. Baileys is WhatsApp Web emulation, NOT the official Cloud API. It is
     against WhatsApp's terms and a clinic's number can be banned for it. That
     is a product decision, not a technical one, and it must stay a deliberate
     opt-in kept well away from the MSG91 path clinics rely on today.
"""
