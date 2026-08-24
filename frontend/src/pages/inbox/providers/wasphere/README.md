# WaSphere (WhatsApp) — phase 2, not built

Upstream: https://github.com/wasphere/wasphere · MIT · NestJS + Baileys

- A **service**, not a library. REST API, signed webhooks, scoped API keys,
  multi-session. We talk to it over HTTP; on desktop it is a sidecar process.
- Baileys is WhatsApp Web emulation, **not** the official Cloud API. It breaks
  WhatsApp's terms and a clinic's number can be banned. Must stay a deliberate,
  default-off opt-in, entirely separate from the MSG91 path clinics use today.
