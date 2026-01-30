# Desktop-App ↔ Web (app.molarplus.com) Parity

Goal: Desktop app should have the same functionality and dashboard UI as the web app.  
**No changes to web frontend or backend** — only desktop-app changes.

---

## Step 1 – Done ✅

### Routes & navigation
- **Removed** marketing routes: `/about`, `/features` (desktop app-only; `/` → `/login`).
- **Added** routes to match web:
  - `/admin` – AdminHub (hub with cards to Attendance, Staff, Clinic, Treatments, Subscription, Templates, Doctors, Permissions)
  - `/admin/staff` – StaffManagement
  - `/admin/treatments` – TreatmentsPricing
  - `/admin/permissions` – PermissionsManagement
  - `/admin/clinic` – ClinicInfo
  - `/admin/templates` – MessageTemplates
  - `/admin/doctors` – ReferringDoctors
  - `/subscription` – Subscription
  - `/inbox` – Inbox placeholder (full Inbox in a later step)
  - `/mail` – Mail placeholder (full Mail in a later step)

### Sidebar (aligned with web)
- **Main menu:** Dashboard, Appointment, Patients, Patient Files, X-ray, Payments, **Inbox (submenu: WhatsApp, Mail)**, Settings.
- **Admin section:** Admin → `/admin` (was `/admin/attendance`).
- Inbox expandable submenu (WhatsApp → `/inbox`, Mail → `/mail`).

### Copied from frontend → desktop
- **Pages:** AdminHub, StaffManagement, TreatmentsPricing, PermissionsManagement, ClinicInfo, MessageTemplates, ReferringDoctors, Subscription.
- **Components:** `components/settings/` (StaffTable, StaffTableHeader, UserDetailsPanel, EditUserTab, PermissionsTab).

### API
- Desktop `utils/api.js` now uses **`/api/v1`** base path (same as web) so all backend calls work.

### Placeholders (for later steps)
- `/inbox` and `/mail` show a short “Coming soon” message until full Inbox/Mail (and inbox components) are added.

---

## Next steps (for you to test first)

- **Step 2:** Copy/align **Settings** page and any remaining settings UI with web.
- **Step 3:** Add full **Inbox** and **Mail** (copy `inbox/*` components from frontend, wire InboxContext, same UI as web).
- **Step 4:** Align **Dashboard** and remaining pages (layout, styles, components) with web.

After you test Step 1, we can do Step 2, then 3, then 4. No web or backend changes.
