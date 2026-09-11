# MolarPlus Dental Labs — Phase 2 Plan: Pilot Hardening

Phase 1 (Phase 1 Plan §4) is built end-to-end: auth + onboarding, clients, catalog,
cases (line items, status workflow, history, attachments), billing-lite, dashboard,
and all frontend pages. **Phase 2 is not new features — it is making Phase 1 real
enough that 1–2 live labs can run their business on it without us babysitting.**

North star: **a real lab onboards in a day (their Excel data + price list imported),
takes cases, the dentist gets a real WhatsApp on dispatch, the monthly statement is
correct and printable, and we never double-bill.** Operational depth (kanban, remakes,
doctor portal) waits until a paying pilot proves the core loop.

---

## 1. What's actually broken or fake today (audit, not spec)

These were found in the current code, not the Phase 1 plan:

| # | Issue | File | Impact |
|---|---|---|---|
| B1 | Notifications are mocked — `print()` only | `domains/notification/routes.py` | The "WhatsApp-native" promise doesn't exist |
| B2 | Case service POSTs to hardcoded `localhost:8001` that nothing serves; failure swallowed; **synchronous 2s timeout blocks the status-update response** | `domains/case/service.py:128` | Every status change is slower and silently un-notified |
| B3 | Duplicate `NOTIFICATION_URL` line | `domains/case/service.py:15,17` | Dead code |
| B4 | Statement generation has **no "invoiced" marker** → regenerating re-bills the same cases | `domains/billing/routes.py:39` | **Double-billing real clients** |
| B5 | Period filter keyed on `received_date`, not delivery | `domains/billing/routes.py:43` | Cases bill in the wrong month |
| B6 | `/outstanding` derives from `delivered totals − payments`, ignoring invoices' `due_amount` | `domains/billing/routes.py:221` | Two sources of truth; numbers disagree |
| B7 | No invoice/statement **PDF** (weasyprint unused) | `requirements.txt` vs `billing/` | Nothing to hand the dentist |
| B8 | Seeded catalog prices all `0`; no bulk price entry/import | `domains/auth/service.py:14` | Manual price setup per product on day one |
| B9 | No data import (clients, price list) | — | High switching cost from Excel |
| B10 | No password reset / forgot-password | `domains/auth/` | Locked-out pilot user = support call |
| B11 | No deploy infra (Dockerfile/Railway), no live URL | — | Can't pilot |
| B12 | No tests on critical flows | — | Regressions during hardening |
| B13 | N+1 queries in billing list/outstanding (per-row client lookup) | `domains/billing/routes.py:126,235` | Slow at real volume |

---

## 2. Milestones (build order)

Ordered by *what unblocks a pilot fastest while protecting trust*. Each milestone is
independently shippable.

### H1 — Billing integrity + invoice/statement PDF  *(no external secrets; do first)*
The get-paid loop must be correct before anyone trusts it.
- **Stop double-billing:** mark cases as invoiced (add `invoice_id` / `invoiced_at` to
  `Case`, or a join). Statement generation excludes already-invoiced cases; regenerate
  is idempotent. Void/regenerate path deletes its line items and unmarks cases.
- **Bill by delivery, not receipt:** period filter on dispatched/delivered date
  (derive from `CaseStatusHistory` or add `delivered_at` to `Case`).
- **One source of truth for outstanding:** compute from invoices (`sum(due_amount)`)
  + un-invoiced delivered work shown separately; payments always reduce an invoice.
- **PDF:** GST invoice + monthly statement via weasyprint, MolarPlus invoice styling,
  lab letterhead (name/address/GSTIN), client + period, per-case lines, subtotal/tax/
  total, amount in words, UPI/bank footer. Download + (later) attach to WhatsApp.
- Fix B13 (eager-load client; one query).

### H2 — Real notifications (WhatsApp + email), async
Deliver the core promise.
- Port MolarPlus's WhatsApp + email service into `domains/notification` as a real
  in-process service (no HTTP-to-self). Delete the `localhost:8001` call (B2) and the
  duplicate line (B3).
- Send on **received** and **dispatched** (configurable), plus "statement ready".
- Run sends in a **background task** so status transitions stay instant; log every
  send to a `notification_log` table (delivered/failed) for support visibility.
- Minimal editable templates; lab can toggle channels in Settings.

### H3 — Onboarding import (kill the Excel switching cost)
- **Import clients** from CSV/Excel: name, clinic, phone, email, GSTIN, address —
  with preview, dedupe on phone, and an error report.
- **Import / bulk-edit price list:** map the lab's product names → catalog, set
  unit prices in one screen (and CSV in). Seed stays, but prices become real fast.
- Sample templates downloadable.

### H4 — Auth & access hardening
- Forgot/reset password (email link, reuse MolarPlus token pattern).
- Staff invite flow + verify `lab_staff` is actually blocked from billing/settings
  (audit `require_role` coverage on every mutating billing/lab route).
- Basic rate-limit on login; lockout message wording.

### H5 — Deploy + reliability (make it live, keep it live)
- Backend container + Railway service, managed Postgres, run Alembic on deploy,
  frontend static build, subdomain (e.g. `labs.molarplus…`), CORS + `VITE_API_URL`,
  secrets in Railway (JWT, DB, WhatsApp, SMTP).
- Smoke tests for the critical path: signup→onboard→client→case→status→statement→
  payment. Sentry-style error logging. Empty/error states + mobile responsiveness
  pass on Cases and Billing.

### → Pilot
Onboard 1–2 real labs with their imported data; weekly feedback loop. Only after a
paying pilot do we open Phase 3 (kanban production board, remakes/QC, doctor portal —
the two-sided moat).

---

## 3. Decisions still open (from Phase 1 §11, now forced by pilot)
- **Case numbering** — keep `{prefix}-{year}-{seq}` or match the lab's existing pan
  format? Ask each pilot lab; make prefix configurable (already is) + optional
  starting offset so it continues their paper register.
- **Payments** — Phase 2 keeps **manual payment recording** (cash/UPI/cheque ref).
  Online UPI/Cashfree collection is deferred unless a pilot lab asks.
- **Deploy target** — Railway (MCP available) as a new service; separate DB per the
  locked Phase 1 boundary.

---

## 4. Explicitly NOT in Phase 2
Kanban production board, technician assignment/scheduling, barcode/QR, remakes/QC,
doctor portal + clinic→lab bridge, logistics, inventory, CAD/CAM/accounting
integrations, mobile app, per-client price tiers, online payment collection,
advanced analytics. All deferred to post-pilot phases.

---

*Phase 1 = build. Phase 2 = make it true. Ship H1→H5, then pilot.*
