# MolarPlus — Future Features Plan

Living document for features discussed but not yet built. Add new entries at the top. Each entry should answer: **what**, **why**, **rough effort**, **cost impact**, **main tradeoff**.

---

## 📱 Push Notifications (FCM-direct)

**What:** Native push notifications for staff (clinic owner, doctors, receptionists) on iOS + Android, delivered via Firebase Cloud Messaging.

**Why:** Replaces SMS/WhatsApp for staff-facing alerts (saves per-message fees), and gives doctors / receptionists real-time visibility into appointments and payments without opening the app.

**First-cut use cases (priority order):**
1. Appointment reminders for staff — "Patient X at 4:00 PM" 30 min before
2. New appointment booked — receptionist books → doctor's phone buzzes
3. Payment received — owner sees real-time UPI/Cashfree confirmation
4. Staff messages / clinic broadcasts — "Closing early today"

**Architecture:**
```
Backend event → FCM Admin SDK → APNs (iOS) / FCM (Android) → Device
```
- Mobile registers FCM token on login → POSTs to backend → stored in `user_devices.fcm_token`
- Backend `push_service.send_to_user(user_id, title, body, data)` wraps FCM Admin SDK
- Hooks into existing `notify_event()` dispatcher (same pattern as SMS/WhatsApp)

**Effort:** ~3-5 dev days
- Mobile: 1-2 days (`expo-notifications` + token registration + foreground/background handlers + new EAS build)
- Backend: 1-2 days (`firebase-admin` dep, `fcm_token` column, push service, event hooks)
- iOS gotcha: APNs Authentication Key (`.p8`) needs to be added once in Firebase console (~3 min on Apple Developer portal)

**Cost:** **₹0 per message.** FCM is free unlimited. APNs is free (included in $99/year Apple Developer account already paid). Negligible backend compute (~10ms per HTTP POST to FCM).

**Net savings:** ~₹300-450/month for a 10-clinic deployment by replacing some staff-facing SMS reminders with push.

**Main tradeoff:** **FCM-direct (recommended)** vs **Expo Push Service**:
- FCM-direct: more setup (~3 days), zero external hop, full control, works even if Expo is down
- Expo Push: 30 min setup, abstracts FCM/APNs, but adds a dependency and rate-limits at high volume

For a paid B2B SaaS where reliability matters, FCM-direct wins.

**Out of scope for v1:** delivery analytics dashboards, A/B testing, in-app banner UX customization, SMS-fallback when push fails.

---

## 📸 Photo-to-Expense (Receipt OCR via Vision LLM)

**What:** User snaps a photo of a bill / receipt → app auto-extracts vendor, date, total, GST number, GST amount, line items → pre-fills the expense form for the user to confirm and save.

**Why:** Receptionists currently retype every petty-cash receipt manually. Photo + auto-fill takes ~5 sec instead of ~60 sec. Same pipeline can later be reused for patient ID cards / Aadhaar (auto-fill new patient registration), insurance cards, referral letters.

**Recommended approach:** **Vision LLM** (Claude Sonnet 4.6 or Haiku 4.5, or GPT-4o), not specialized receipt OCR services.
- Why not Mindee / Veryfi: ~90% as accurate, cost ~₹5-10/scan, vendor lock-in
- Why not on-device ML Kit: free but raw text only, no semantic extraction (you'd need regex per vendor)
- Why vision LLM: ~₹0.20-1 per receipt, handles Hindi/regional language bills, understands context ("discount applied" vs "tax"), prompt is tunable without vendor migration

`OPENAI_API_KEY` already exists in prod `.env` → fastest path is GPT-4o. Worth A/B-testing against Claude Sonnet 4.6 on real Indian receipts before committing — Claude often performs better on Indian bill formats. Adds `ANTHROPIC_API_KEY` to `.env` if we go that route.

**Effort:** ~3-4 dev days
1. Mobile: "Scan Receipt" button on expense form, `expo-camera` + `expo-image-picker`, upload to `POST /api/v1/expenses/scan`
2. Backend: new endpoint takes image, calls vision model, returns structured JSON
3. Mobile: pre-fills expense form with extracted values; user reviews and saves
4. Audit: store original image alongside the expense (R2 already wired)

**Cost:** ~₹100/day for a 10-clinic deployment doing ~20 receipts/day each (~₹3k/month). Way less than staff time saved.

**Main tradeoff:** **Accuracy isn't 100%**. The extracted values **must** appear in an editable form for the user to confirm before saving — never auto-save extracted data. Otherwise a misread "₹1,250" → "₹12,500" silently lands in books. Treat the LLM as "smart pre-fill," not "trusted source."

**Out of scope for v1:** handwritten receipts (lower accuracy, ~80%), batch upload, automatic expense categorization, multi-page bills.

---

## 🐛 Outstanding bugs to investigate

- **Web calendar:** appointments created don't show on the calendar in web frontend. Symptom not yet reproduced — needs the user's exact steps (which view, day/week/month, refresh behavior) before debugging.

---

## 📝 How to use this doc

When a feature is approved to build, move its section to a feature branch's PR description and **delete it from this file** in the same commit. Keeps this doc as the single source of truth for "discussed but not yet started."
