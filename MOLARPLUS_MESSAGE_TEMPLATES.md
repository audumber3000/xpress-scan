# MolarPlus — Message Templates

> **Variable format:** `{{1}}`, `{{2}}` etc. — Meta-approved syntax.
> **Transactional** = no suffix | **Marketing** = `_mk` suffix
> **All marketing WhatsApp templates have IMAGE as header + buttons.**
>
> **Placeholders to replace before submitting to Meta:**
> - `UPGRADE_LINK` → your pricing/upgrade page URL
> - `DEMO_LINK` → your demo booking link
> - `WEBSITE_LINK` → `https://www.molarplus.com`

---

# SECTION 1: TRANSACTIONAL TEMPLATES

> Triggered automatically by app events. No buttons needed.

---

## T1 — New User Signup

**Template name:** `molarplus_app_welcome`

### WhatsApp
```
HEADER: TEXT

Welcome to MolarPlus, Dr. {{1}}! 🦷

Your account is live. Here's your quick start:
1️⃣ Add your clinic details
2️⃣ Add your first patient
3️⃣ Book your first appointment

Takes less than 5 minutes. We're here if you need anything 🙌

BUTTONS:
[💬 Chat with Us]  →  https://www.molarplus.com/chat
```

### Email
**Subject:** `Welcome to MolarPlus, Dr. {{1}} 🦷`
```
Hi Dr. {{1}},

Your MolarPlus account is live. Here's your quick-start checklist:

✅ Complete your clinic profile
✅ Add your first patient
✅ Book your first appointment
✅ Set up WhatsApp reminders

Each step takes under 2 minutes.

[Go to your dashboard →]

The MolarPlus Team
```

---

## T2 — Subscription Purchased

**Template name:** `molarplus_subscription_confirmed`

### WhatsApp
```
HEADER: TEXT

Dr. {{1}}, payment confirmed! ✅

Plan: {{2}}
Next billing: {{3}}

Your clinic is fully set up. Let's go 🚀

[Go to Dashboard →]
```

> `{{2}}` = plan name | `{{3}}` = next billing date

### Email
**Subject:** `Subscription confirmed, Dr. {{1}} ✅`
```
Hi Dr. {{1}},

Your MolarPlus subscription is active.

Plan: {{2}}
Amount paid: ₹{{3}}
Next billing date: {{4}}

[Go to dashboard →]

Thank you for trusting MolarPlus 🙏

The MolarPlus Team
```

---

## T3 — Top-Up Successful

**Template name:** `molarplus_topup_success`

### WhatsApp
```
HEADER: TEXT

Top-up successful, Dr. {{1}}! ✅

Amount added: ₹{{2}}
Current balance: ₹{{3}}

Your reminders will keep running without interruption 👍
```

> `{{2}}` = amount added | `{{3}}` = new balance

### Email
**Subject:** `Top-up confirmed — ₹{{2}} added`
```
Hi Dr. {{1}},

Your MolarPlus wallet has been topped up.

Amount added: ₹{{2}}
Current balance: ₹{{3}}
Date: {{4}}

[View transaction history →]

The MolarPlus Team
```

---

## T4 — Lab Order Due Tomorrow

> Sent once per order only.

**Template name:** `molarplus_lab_due_tomorrow`

### WhatsApp
```
HEADER: TEXT
⏰ Lab Order Due Tomorrow

Lab order is due for tomorrow ⏰:

*Patient Name*: {{3}}
*Lab*: {{1}}
*Order placed*: {{2}}

Please remind the lab once!
```

> `{{1}}` = lab name | `{{2}}` = order placed date | `{{3}}` = patient name

### Email
**Subject:** `Lab order due tomorrow — {{2}} for {{3}}`
```
Hi,

Just a heads-up — a lab order is due tomorrow.

Patient: {{3}}
Order: {{2}}
Lab: {{4}}
Due date: Tomorrow ({{5}})

[View full order details →]

The MolarPlus Team
```

---

## T5 — Weekly Report

**Template name:** `molarplus_weekly_report_mk`

### WhatsApp
```
HEADER: TEXT
Weekly Report — Week of {{1}}

📊 *Weekly Summary*

🗓 Appointments: {{1}} ({{2}} vs last week)
👥 New Patients: {{3}} ({{4}} vs last week)
💰 Revenue: ₹{{5}} ({{6}} vs last week)
📉 No-shows: {{7}}

{{8}}

[View Full Report →]
```

> Header `{{1}}` = week date (e.g. `14 Apr 2026`)
> Body: `{{2}}` `{{4}}` `{{6}}` = change e.g. `▲12%` or `▼5%`
> Body `{{8}}` = auto insight e.g. `Great week! 🎉` or `Slight dip — let's bounce back 💪`

### Email
**Subject:** `Your weekly clinic report is ready 📊`
```
Hi Dr. {{1}},

Here's your MolarPlus weekly summary for the week of {{2}}:

                    This Week     Last Week     Change
────────────────────────────────────────────────────
Appointments        {{3}}         {{4}}         {{5}}
New Patients        {{6}}         {{7}}         {{8}}
Revenue (₹)         {{9}}         {{10}}        {{11}}
No-shows            {{12}}        {{13}}        {{14}}

💡 {{15}}

[View detailed report →]

The MolarPlus Team
```

> `{{15}}` = auto insight e.g. `Revenue is up 15% — your busiest week this month!`

---

## T6 — Monthly Clinic Report

**Template name:** `molarplus_monthly_report_mk`

### WhatsApp
```
HEADER: TEXT

📅 *Monthly Report — {{1}}*

👥 Patients
Total: {{2}} | New: {{3}} | Returning: {{4}}

💰 Revenue
Total: ₹{{5}} | Avg per patient: ₹{{6}}
vs Last month: {{7}}

🦷 Top treatments: {{8}}
📉 No-shows: {{9}} ({{10}}% of appointments)

[View Full Report →]
```

> `{{1}}` = month | `{{7}}` = change e.g. `▲18%` | `{{8}}` = top 2–3 treatments

### Email
**Subject:** `{{1}} clinic report — how did your month go?`
```
Hi Dr. {{2}},

Your MolarPlus monthly report for {{1}} is ready.

─── PATIENTS ──────────────────────────────
Total visits:        {{3}}
New patients:        {{4}}
Returning patients:  {{5}}

─── REVENUE ───────────────────────────────
Total revenue:       ₹{{6}}
Avg per patient:     ₹{{7}}
vs Last month:       {{8}}

─── TOP TREATMENTS ────────────────────────
{{9}}

─── NO-SHOWS ──────────────────────────────
{{10}} no-shows ({{11}}% of appointments)

💡 {{12}}

[View full report in app →]

The MolarPlus Team
```

> `{{12}}` = insight e.g. `New patient count is up 22% — your referral game is strong!`

---

## T7 — Monthly Google Review Report

**Template name:** `molarplus_review_report_mk`

### WhatsApp
```
HEADER: TEXT

⭐ *Google Review Report — {{1}}*

Rating: {{2}}/5
New reviews this month: {{3}}
Change: {{4}}

✅ Patients loved: {{5}}, {{6}}
⚠️ Area to watch: {{7}}

💡 Replying to reviews — even a quick "Thank you!" — builds trust fast.

[View & Reply to Reviews →]
```

### Email
**Subject:** `Your Google review report for {{1}} ⭐`
```
Hi Dr. {{2}},

Here's your MolarPlus Google Review summary for {{1}}:

─── OVERVIEW ──────────────────────────────
Current rating:         {{3}}/5 ⭐
New reviews:            {{4}}
Change from last month: {{5}}

─── WHAT PATIENTS ARE SAYING ──────────────
Most praised:    {{6}}, {{7}}
Area to watch:   {{8}}

─── STAR BREAKDOWN ────────────────────────
⭐⭐⭐⭐⭐  {{9}} reviews
⭐⭐⭐⭐    {{10}} reviews
⭐⭐⭐      {{11}} reviews
Below 3    {{12}} reviews

💡 {{13}}

[View and respond to all reviews →]

The MolarPlus Team
```

> `{{13}}` = tip e.g. `3 new 5-star reviews this month — share them on your clinic's WhatsApp status!`

---

---

# SECTION 2: TRIAL FUNNEL TEMPLATES

> 4 messages. Universal — same for all user types.

---

## F1 — Trial Started

**Template name:** `molarplus_trial_started`

### WhatsApp
```
HEADER: TEXT

Dr. {{1}}, your MolarPlus trial is live! 🎉

You've got 7 days — no credit card needed.

Best way to start:
1️⃣ Add your first patient
2️⃣ Book an appointment
3️⃣ Turn on WhatsApp reminders

All 3 take under 5 minutes. Let's go!
```

### Email
**Subject:** `Your 7-day MolarPlus trial has started ✅`
```
Hi Dr. {{1}},

Your free trial is ready. Here's your Day 1 checklist:

✅ Add your clinic details
✅ Add 1 patient and book a test appointment
✅ Enable WhatsApp reminders

Your trial ends on {{2}}. We're here if you need anything.

[Go to MolarPlus →]

The MolarPlus Team
```

> `{{2}}` = trial end date

---

## F2 — Mid Trial (Day 4)

**Template name:** `molarplus_trial_mid`

### WhatsApp
```
HEADER: TEXT

Dr. {{1}}, halfway through your trial 👋

Quick tip: have you tried the *Treatment Planner*?

Create a full plan, share it with your patient, track it visit by visit. Takes 2 minutes to set up.

BUTTONS:
[💬 Need a hand? Click here]  →  https://www.molarplus.com/chat
```

### Email
**Subject:** `Mid-trial check-in — have you tried this yet?`
```
Hi Dr. {{1}},

You're halfway through your MolarPlus trial.

Most dentists love the Treatment Planner:
- Build multi-visit plans in minutes
- Share a clear breakdown with patients
- Track completion visit by visit

Give it a try. It's one of those features you won't want to go back from.

[Try it now →]

Still want a walkthrough? [Book a 15-min call →]

The MolarPlus Team
```

---

## F3 — Trial Ending Today

**Template name:** `molarplus_trial_ending`

### WhatsApp
```
HEADER: TEXT

Dr. {{1}}, your trial ends *today* ⏰

If the last 7 days made even one thing easier — appointments, records, reminders — imagine a full year of that.

Plans start at ₹{{2}}/month. Cancel anytime.

BUTTONS:
[🚀 Upgrade Now]       →  UPGRADE_LINK
[💬 Talk to Us First]  →  https://www.molarplus.com/chat
```

> `{{2}}` = starting price

### Email
**Subject:** `Last day of your trial, Dr. {{1}}`
```
Hi Dr. {{1}},

Today's the last day of your MolarPlus free trial.

Plans start at ₹{{2}}/month — no long-term contracts, cancel anytime.

[Choose a plan →]

Have questions? Just reply to this email.

The MolarPlus Team
```

---

## F4 — After Trial Ended (Didn't Convert)

**Template name:** `molarplus_trial_ended`

### WhatsApp
```
HEADER: TEXT

Hey Dr. {{1}} 👋

Your trial has ended but your account is still there — waiting for you.

If something held you back — pricing, setup, timing — we'd love to help. No pressure at all.

BUTTONS:
[💬 Let's Talk]  →  https://www.molarplus.com/chat
```

### Email
**Subject:** `Did something stop you, Dr. {{1}}?`
```
Hi Dr. {{1}},

Your MolarPlus trial ended and we noticed you haven't upgraded yet — totally okay.

We'd genuinely love to know if something held you back:
- Was it pricing?
- Too complex to get started?
- Just not the right time?

Reply to this email. We'll do what we can to help.

The MolarPlus Team
```

---

---

# SECTION 3: MARKETING TEMPLATES

> All WhatsApp marketing templates have:
> - `HEADER: IMAGE` (upload your creative in Meta)
> - Short body (max 3–4 lines)
> - Buttons (Book Demo / Chat on WhatsApp / Visit Website)
>
> Button placeholders: replace `DEMO_LINK`, `WA_NUMBER`, `WEBSITE_LINK` with actual values.

---

## M1 — Fresh Grad / Opening New Clinic

**Template name:** `molarplus_freshgrad_mk`

### WhatsApp
```
HEADER: IMAGE

Starting your clinic soon, Dr. {{1}}? 🦷

Build it right from Day 1 — organised records, automated reminders, zero paperwork chaos.

Most new clinics are live on MolarPlus in under 10 minutes.

BUTTONS:
[📅 Book a Free Demo]  →  DEMO_LINK
[💬 Chat with Us]      →  wa.me/WA_NUMBER
```

### Email
**Subject:** `Starting your clinic right, Dr. {{1}} 🦷`
```
Hi Dr. {{1}},

Opening a new clinic is exciting. The admin side — records, appointments, reminders, billing — is where most new dentists struggle.

MolarPlus gets you organised from Day 1, so you can focus on your patients, not paperwork.

Free 7-day trial. No credit card. Setup in 10 minutes.

[Start Free Trial →]

The MolarPlus Team
```

---

## M2 — Experienced / Already Practicing

**Template name:** `molarplus_experienced_mk`

### WhatsApp
```
HEADER: IMAGE

Dr. {{1}}, still managing records the old way? 📋

MolarPlus brings your appointments, patient history, billing, and reminders into one simple app.

Most dentists say: "I wish I had this 5 years ago."

BUTTONS:
[📅 Book a Free Demo]  →  DEMO_LINK
[🌐 See How It Works]  →  WEBSITE_LINK
```

### Email
**Subject:** `For dentists who've outgrown their current system`
```
Hi Dr. {{1}},

Records in one place, reminders in another, billing in a spreadsheet — sound familiar?

MolarPlus brings everything into one place. Clean, simple, built for how dental clinics actually work.

No long setup. No disruption to your workflow. We handle the migration.

[Book a 15-min demo →]

The MolarPlus Team
```

---

## M3 — No-Shows Pain Point

**Template name:** `molarplus_noshows_mk`

### WhatsApp
```
HEADER: IMAGE

Every no-show = lost revenue 😔

MolarPlus sends automatic WhatsApp reminders before every appointment. Patients confirm or reschedule — no calls needed.

Clinics see up to 40% fewer no-shows.

BUTTONS:
[📅 Book a Free Demo]  →  DEMO_LINK
[💬 Chat with Us]      →  wa.me/WA_NUMBER
```

### Email
**Subject:** `Tired of appointment no-shows?`
```
Hi Dr. {{1}},

No-shows are expensive — not just in revenue, but in wasted chair time.

MolarPlus automatically sends WhatsApp reminders before every appointment. Patients can confirm or reschedule with one tap. No calls needed from your team.

Clinics using MolarPlus see up to 40% fewer no-shows.

[See how it works →]

The MolarPlus Team
```

---

## M4 — Paperwork / Admin Pain Point

**Template name:** `molarplus_admin_mk`

### WhatsApp
```
HEADER: IMAGE

How many hours a week goes into admin? 📋

Calls, records, follow-ups, billing — most clinics lose 6–8 hours a week.

MolarPlus brings that down to under 1 hour.

BUTTONS:
[📅 Book a Free Demo]  →  DEMO_LINK
[🌐 Visit Website]     →  WEBSITE_LINK
```

### Email
**Subject:** `6 hours of admin a week — what if it was 1?`
```
Hi Dr. {{1}},

The average dental clinic spends 6–8 hours a week on admin — calls, reminders, updating records, tracking billing.

MolarPlus automates most of it. Most clinics bring that down to under 1 hour a week.

That's time back in your hands.

[Start your free trial →]

The MolarPlus Team
```

---

## M5 — Revenue Tracking

**Template name:** `molarplus_revenue_mk`

### WhatsApp
```
HEADER: IMAGE

Do you know exactly how much your clinic made this month? 💰

MolarPlus gives you a live revenue dashboard — appointments, collections, outstanding payments — all in real time.

No spreadsheets. No guessing.

BUTTONS:
[📅 Book a Free Demo]  →  DEMO_LINK
[💬 Chat with Us]      →  wa.me/WA_NUMBER
```

### Email
**Subject:** `Do you know exactly what your clinic made this month?`
```
Hi Dr. {{1}},

Most clinic owners only find out how their month went at the end of it — and sometimes not even then.

MolarPlus gives you a live dashboard: daily revenue, appointments completed, outstanding payments, and monthly trends.

No spreadsheets. No surprises.

[See the dashboard →]

The MolarPlus Team
```

---

## M6 — General Awareness / Promo

**Template name:** `molarplus_promo_mk`

### WhatsApp
```
HEADER: IMAGE

Run your entire clinic from one app 📱

Appointments · Patient Records · Reminders · Billing · Lab Orders · Reports

MolarPlus — built for dental clinics. Used by dentists across India.

Try it free for 7 days 👇

BUTTONS:
[🚀 Start Free Trial]  →  WEBSITE_LINK
[📅 Book a Demo]       →  DEMO_LINK
```

### Email
**Subject:** `Your whole clinic. One app. Free for 7 days.`
```
Hi Dr. {{1}},

Appointments. Patient records. WhatsApp reminders. Billing. Lab orders. Weekly reports.

MolarPlus handles all of it — so you don't have to.

Free 7-day trial. No credit card. Setup in under 10 minutes.

[Start your free trial →]

The MolarPlus Team
```

---

## M7 — Festival Wishes

**Template name:** `molarplus_festival_mk`

> Create a separate version of this template for each festival (Diwali, Eid, Christmas, New Year, etc.) with a matching image. Body stays the same or lightly customised.

### WhatsApp
```
HEADER: IMAGE  ← (festival-themed creative)

Wishing you and your clinic a wonderful {{1}}! 🎉

May this season bring you full schedules, happy patients, and well-deserved rest.

From all of us at MolarPlus 🦷❤️

BUTTONS:
[🌐 Visit MolarPlus]   →  WEBSITE_LINK
[💬 Say Hi to Us]      →  wa.me/WA_NUMBER
```

> `{{1}}` = festival name e.g. `Diwali`, `Eid`, `New Year`

### Email
**Subject:** `Happy {{1}} from MolarPlus! 🎉`
```
Hi Dr. {{2}},

Wishing you and your team a very happy {{1}}!

Thank you for being part of the MolarPlus family. We hope this season brings you joy, rest, and a full appointment book 😄

Warm wishes,
The MolarPlus Team
```

---

---

# QUICK REFERENCE TABLE

| Template Name | Type | Trigger / Use |
|---|---|---|
| `molarplus_app_welcome` | Transactional | New user signup |
| `molarplus_subscription_confirmed` | Transactional | Subscription purchased |
| `molarplus_topup_success` | Transactional | Wallet top-up |
| `molarplus_lab_due_tomorrow` | Transactional | Lab order due next day |
| `molarplus_weekly_report_mk` | Marketing | Every Monday |
| `molarplus_monthly_report_mk` | Marketing | 1st of every month |
| `molarplus_review_report_mk` | Marketing | 1st of every month |
| `molarplus_trial_started` | Funnel | Day 0 of trial |
| `molarplus_trial_mid` | Funnel | Day 4 of trial |
| `molarplus_trial_ending` | Funnel | Day 7 of trial |
| `molarplus_trial_ended` | Funnel | Day 8 (no conversion) |
| `molarplus_freshgrad_mk` | Marketing | Fresh grad / new clinic |
| `molarplus_experienced_mk` | Marketing | Already practicing |
| `molarplus_noshows_mk` | Marketing | No-show pain point |
| `molarplus_admin_mk` | Marketing | Admin/paperwork pain point |
| `molarplus_revenue_mk` | Marketing | Revenue tracking pain point |
| `molarplus_promo_mk` | Marketing | General awareness / promo |
| `molarplus_festival_mk` | Marketing | Festival wishes |

---

> **Meta submission notes:**
> - All marketing templates need a creative image uploaded in Meta Business Manager
> - For buttons: URL buttons support dynamic links; WhatsApp buttons use phone number
> - Variable count resets per template — `{{1}}` always starts fresh
> - Report templates (weekly/monthly) must be sent via API with real data injected
