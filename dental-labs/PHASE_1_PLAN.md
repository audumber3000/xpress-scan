# MolarPlus Dental Labs — Phase 1 Plan

A new B2B sub-product under MolarPlus for **dental laboratories** (the labs that
manufacture crowns, bridges, dentures, aligners, etc. for dental clinics).
Where MolarPlus serves the clinic, **Dental Labs** serves the lab that the clinic
sends work to. The two products are designed to eventually connect: a MolarPlus
clinic submits a case directly into its lab's Dental Labs account.

---

## 1. What a dental lab actually does (the workflow we are digitising)

A lab is a small B2B manufacturer. The real-world flow:

1. A **dentist/clinic** sends a **case** — a physical impression or a digital
   scan file (STL) — with a prescription ("Rx"): tooth numbers, shade, material,
   product type, due date.
2. The lab **registers** the case, assigns a **job/pan number**, and routes it
   through **production stages** (model → design/CAD → milling/casting →
   ceramic build-up → finishing → QC).
3. The finished prosthetic is **dispatched/delivered** back to the clinic.
4. The lab **bills** the clinic — usually a **monthly statement** of all cases,
   not pay-per-case, with client-specific price lists and credit terms.
5. **Remakes** (rework under warranty) and **adjustments** are tracked because
   they hit margin and quality metrics.

Key truth: the lab's customer is the **dentist, not the patient**. Pricing,
communication, and loyalty all revolve around the dentist relationship.

---

## 2. Competitive landscape (market brainstorm)

| Product | Region/Focus | Strengths | Gaps we can exploit |
|---|---|---|---|
| **LabStar** | US, cloud | Clean case mgmt, statements, doctor portal | Pricey, US-centric pricing/tax, no India GST/UPI |
| **Evident (Lab)** | US, cloud | Digital workflow, integrations | Heavy, enterprise pricing |
| **Magic Touch / DLCPM** | US, on-prem + cloud | Deep features, QuickBooks sync | Dated UX, Windows-first |
| **LabTrac** | US/UK | Long-standing, scheduling | Legacy desktop feel |
| **3Shape / exocad** | Global, CAD/CAM | Design/manufacturing powerhouse | Design tools, NOT lab business mgmt |
| **iTero / Medit** | Global, scanners | Scan capture + case send | Hardware ecosystems, not lab ops |
| **Local/Excel/WhatsApp** | India (most labs today) | Free, familiar | No tracking, no analytics, lost cases, billing chaos |

**Where MolarPlus Dental Labs wins (India-first thesis):**
- Most Indian labs run on **paper registers, Excel, and WhatsApp**. The bar is
  low; a clean, mobile-friendly case tracker + automatic monthly statements is
  already transformational.
- **GST invoicing, INR, UPI/Cashfree** built in (we already have this in
  MolarPlus) — Western tools don't.
- **WhatsApp-native** status updates to dentists (we already run a WhatsApp
  service) — matches how Indian labs actually communicate.
- **Two-sided network**: existing MolarPlus clinics become a built-in funnel of
  dentists who can submit cases digitally.

We deliberately do **not** compete with 3Shape/exocad on CAD — we are the
**business/operations layer**, and we integrate with design files (later phase).

---

## 3. Full feature universe (all phases — the brainstorm)

Grouped so we can clearly draw the Phase 1 line.

**A. Foundation**
- Lab account + onboarding, multi-user roles (owner, manager, technician, front
  desk, accountant, delivery), permissions.

**B. Clients (Dentists/Clinics) — the CRM**
- Client directory, contacts, addresses, per-client price lists, credit terms,
  outstanding balance, statements.

**C. Catalog**
- Product/service types (crown PFM/zirconia/e.max, bridge, RPD/CPD, complete
  denture, implant crown/abutment, veneer, inlay/onlay, night guard, aligner,
  repair), materials, shade systems, unit pricing, turnaround days.

**D. Case / Order management (the core)**
- Create case, job/pan number, client, doctor, patient ref, tooth chart, product
  line items, shade, material, due date, attachments (impression photos / STL),
  notes, priority/rush.
- Status workflow + per-stage history & timestamps.
- Search, filters (status, client, due-today, overdue), case calendar.

**E. Production**
- Department/stage routing, technician assignment, workload board (kanban),
  scheduling, due-date alerts, capacity view.
- Barcode/QR pan tracking of physical cases.

**F. Quality & remakes**
- Remake tracking (reason, fault attribution: lab vs doctor), warranty rules,
  adjustment logging, QC checklist.

**G. Billing**
- Per-case charges from catalog, client price lists, **monthly statements**, GST
  invoices, payments/receipts, ageing/outstanding, credit notes.

**H. Communication**
- Status notifications to dentists (received / in-production / dispatched) via
  WhatsApp/email/SMS, in-app.

**I. Doctor portal / case submission**
- Dentist logs in (or via MolarPlus clinic), submits cases, uploads scans,
  tracks status, downloads statements/invoices. Two-sided.

**J. Logistics**
- Pickup/delivery scheduling, driver routes, dispatch slips, courier tracking.

**K. Inventory & materials**
- Stock of blocks/discs/alloys/teeth, consumption per case, reorder alerts,
  vendor POs.

**L. Analytics**
- Revenue, cases/day, turnaround time, on-time %, remake rate, technician
  productivity, top clients, product mix.

**M. Integrations**
- CAD/CAM (3Shape Communicate, exocad, Medit Link), accounting (Tally/QuickBooks),
  intraoral-scanner case inbox.

**N. Mobile app**
- Technician scan-and-advance, owner dashboard, delivery app.

---

## 4. Phase 1 scope (MVP) — what we build first

**Goal of Phase 1:** a single lab can run its day-to-day on this — take in cases,
track them to delivery, communicate status, and bill clients monthly. Nothing
more. This is the smallest thing that replaces the paper register + Excel + ad-hoc
WhatsApp that a typical Indian lab uses today.

**In scope:**

1. **Auth & lab onboarding** — lab owner self-signup → creates the lab.
   **Email/password only — no Google/OAuth/Firebase login.** Mirror MolarPlus's
   `clinic_owner`/onboarding *flow* and the lessons from the clinic signup, but
   strip the social-login paths. Roles: `lab_owner`, `lab_staff`.
2. **Client management** — CRUD for dentist/clinic clients: name, clinic name,
   phone, address, GST, default price tier. Outstanding balance shown.
3. **Product catalog** — CRUD for products/services with material, default price,
   default turnaround (days). Seed a sensible default dental list on onboarding.
4. **Case management (core)** — create/edit/list cases:
   - client, doctor name, patient reference (name/age/sex — no PHI depth),
     received date, **due date**, priority (normal/rush).
   - line items: product + tooth numbers + shade + material + qty + unit price
     (defaults from catalog, editable) → auto case total.
   - attachments: photos / STL upload (basic file store, reuse MolarPlus uploads).
   - **status workflow**: `received → in_production → ready → dispatched →
     delivered` (+ `on_hold`, `cancelled`), with a status-history timeline.
   - list views with filters: All / Due Today / Overdue / by status / by client;
     text search by case no., client, patient.
5. **Status notifications** — on key transitions (received, dispatched), notify
   the dentist via WhatsApp/email (reuse the existing notification + WhatsApp
   services). Keep templates minimal and configurable later.
6. **Billing (lite)** — per-case totals roll up into a **monthly statement** per
   client; generate a GST invoice PDF; record payments; show outstanding. Reuse
   MolarPlus invoicing/PDF + Cashfree where possible.
7. **Dashboard** — counts: cases received today, in production, due today,
   overdue, dispatched this month, revenue this month, top clients. (recharts.)

**Roles in Phase 1:** keep it to `lab_owner` (full) and `lab_staff` (operational,
no billing/settings). Fine-grained permissions are Phase 2.

---

## 5. Explicitly OUT of scope for Phase 1 (later phases)

Deferred so Phase 1 ships fast: dedicated **doctor portal/self-submission**,
**kanban production board + technician assignment/scheduling**, **barcode/QR
tracking**, **remake/QC module**, **logistics/driver routes**, **inventory**,
**CAD/CAM & accounting integrations**, **mobile app**, **advanced analytics**,
**multi-location**, **client-specific price lists** (Phase 1 uses one price per
product; per-client tiers come later).

---

## 6. Phase 1 data model (entities)

Mirrors MolarPlus SQLAlchemy style. Core tables:

- **Lab** — id, name, address, gst_no, phone, email, currency (INR), timezone,
  subscription_plan, created_at.
- **LabUser** — id, lab_id, name, email, password_hash/firebase_uid, role
  (`lab_owner`|`lab_staff`), is_active.
- **Client** — id, lab_id, name (dentist), clinic_name, phone, email, address,
  gst_no, default_price_tier (Phase 1: single tier), outstanding_balance (derived).
- **Product** — id, lab_id, name, category (crown/bridge/denture/…), material,
  unit_price, default_turnaround_days, is_active.
- **Case** — id, lab_id, case_no (auto/pan number), client_id, doctor_name,
  patient_name, patient_age, patient_sex, received_date, due_date, priority,
  status, notes, total_amount (derived), created_by, created_at.
- **CaseItem** — id, case_id, product_id, tooth_numbers (text/JSON), shade,
  material, qty, unit_price, line_total.
- **CaseStatusHistory** — id, case_id, status, changed_by, changed_at, note.
- **CaseAttachment** — id, case_id, file_name, file_path, file_type, uploaded_at.
- **Invoice / Statement** — id, lab_id, client_id, period (month), line refs to
  cases, subtotal, gst, total, status (draft/sent/paid), pdf_path.
- **Payment** — id, lab_id, client_id, invoice_id, amount, method, paid_at.

---

## 7. Backend plan (FastAPI — mirror MolarPlus `domains/` architecture)

Stack: **FastAPI + SQLAlchemy + JWT**, clean architecture
(`routes/ → services/ → repositories/`), API prefix `/api/v1`. Reuse MolarPlus
conventions (DTOs, `require_role`, dependency injection, notifications, uploads).

Proposed domains under `dental-labs/backend/domains/`:

- `auth/` — register lab owner, **email/password login only (no OAuth/Firebase)**,
  onboarding (`/labs/onboarding`), `require_role("lab_owner")`. Reuse MolarPlus's
  JWT + `require_role` + onboarding patterns, minus the social-login code.
- `lab/` — lab profile, settings, staff (LabUser CRUD).
- `client/` — client CRUD, outstanding balance.
- `catalog/` — product CRUD, default-catalog seeding on onboarding.
- `case/` — case + case items + status transitions + history + attachments;
  list/filter/search endpoints. **The heart of the product.**
- `billing/` — monthly statement generation, invoice PDF, payments.
- `notification/` — thin adapter over the existing notification + WhatsApp
  services for status updates.
- `dashboard/` — aggregate counts/metrics.

**Decided: separate DB.** Dental Labs runs its own schema/service so it can
evolve independently of MolarPlus. We **reuse the auth, notification, WhatsApp,
and payment code** by copying the proven modules — code reuse, not a shared
database. Phase 1 is **standalone** (no MolarPlus-clinic case submission yet).

---

## 8. Frontend plan (React 19 + Vite + Tailwind v4 + react-router v7)

Reuse MolarPlus's component language (Tailwind, lucide-react icons, recharts,
react-hook-form, axios `api` util, react-toastify, the `#2a276e` brand purple).

Pages (Phase 1):
- **Auth** — Login, Signup (lab owner), Lab Onboarding wizard (reuse the clinic
  onboarding multi-step pattern). **Email/password forms only — no "Continue with
  Google" button.**
- **Dashboard** — metric cards + simple charts (cases by status, revenue MTD).
- **Cases** — list with filter tabs (All/Due Today/Overdue/status), search, the
  **New Case** form (client picker, line items with catalog autofill, tooth
  selection, due date, attachments), **Case Detail** (status timeline +
  advance-status action + attachments + edit).
- **Clients** — list + detail (client info, their cases, outstanding, statement).
- **Catalog** — product list + add/edit.
- **Billing** — per-client monthly statements, generate/download invoice, record
  payment, outstanding list.
- **Settings** — lab profile, staff management.

Shared: app shell/nav, `Patient/ClientAvatar` (we can reuse the avatar work just
done on mobile), data fetching via the axios `api` wrapper, auth context.

---

## 9. Reuse from MolarPlus (don't rebuild)

- **Auth** — JWT + `require_role` + onboarding flow (and the recently-fixed
  "self-signup is always the owner" lesson). **Email/password only — do NOT port
  the Firebase/Google OAuth paths.**
- **Notifications + WhatsApp service** — status updates to dentists.
- **Invoicing / PDF / GST / Cashfree (UPI)** — billing module.
- **File uploads** — case attachments / STL.
- **Country/currency/tax config** (`core/countries`) — INR/GST defaults.
- **Frontend kit** — Tailwind theme, components, charts, toast, api util.

---

## 10. Phase 1 build order (milestones)

1. **M0 — Scaffold**: backend FastAPI app + DB + auth (copied/adapted from
   MolarPlus); frontend Vite app + shell + login. *(folders created; this plan)*
2. **M1 — Lab onboarding + staff**: owner signup → create lab → seed default
   catalog → invite staff.
3. **M2 — Clients + Catalog CRUD.**
4. **M3 — Cases (core)**: create/list/detail, line items, attachments, status
   workflow + history. *(biggest milestone)*
5. **M4 — Notifications**: WhatsApp/email on received + dispatched.
6. **M5 — Billing-lite**: monthly statement + GST invoice PDF + payments.
7. **M6 — Dashboard + polish**, then pilot with 1–2 real labs.

---

## 11. Decisions

**Locked:**
1. **DB/service boundary** — **Separate DB** for Dental Labs. It owns its own
   schema and migrations; we reuse MolarPlus *code* (auth, notifications,
   WhatsApp, billing) by copying the proven modules, not the database.
2. **Clinic ↔ Lab link** — **Standalone** for Phase 1. No MolarPlus-clinic
   case submission yet; the clinic→lab bridge is a later phase.
3. **Pricing model** — **One price per product** in Phase 1. Per-client price
   tiers are deferred to a later phase.

**Still open:**
4. **Case numbering** — auto-increment per lab, or a pan-number format labs
   already use?
5. **Deployment** — new service in the existing docker-compose/deploy.sh, new
   subdomain (e.g. `labs.molarplus...`)?
6. **Folder name** — created as `dental-labs/` (kebab-case, matching repo
   conventions like `mobile-app/`, `nexus-service/`). Rename if you prefer.

---

*Scaffold created: `dental-labs/frontend/` and `dental-labs/backend/`. This
document is the Phase 1 plan only; Phases 2+ are sketched in §3/§5 for context.*
