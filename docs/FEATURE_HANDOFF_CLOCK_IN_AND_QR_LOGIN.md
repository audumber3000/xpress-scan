# Feature handoff: Clock in / Clock out, and QR login to the mobile app

Written for an AI agent building **pharmacy software**, from a working
implementation in a dental clinic product (MolarPlus). Everything below is
taken from shipped, running code, not from a design document.

Read this as a specification to re-implement, not as code to copy. Where the
original made a mistake and fixed it, the mistake is written down too, because
those are the parts a fresh implementation gets wrong by default.

Vocabulary mapping for the pharmacy app:

| Here (dental) | There (pharmacy) |
|---|---|
| Clinic | Pharmacy / shop / store |
| Clinic owner | Pharmacy owner |
| Staff / employee | Pharmacist, counter staff, delivery staff |
| Patient | Customer |
| Case paper / appointment | Sale / bill / prescription filled |

The **tenant** in both products is the shop. Every table below carries a
`clinic_id`; in the pharmacy app it becomes `pharmacy_id` / `store_id`, and
every query filters on it. Multi-branch chains are the normal case, not the
exception.

---

# Part 1 — Clock in / Clock out (staff attendance)

## 1.1 What the feature actually is

A staff member starts their shift by pressing a button on their phone (or in
the browser). The app reads the phone's GPS, sends it with the request, and the
**server** decides whether they are close enough to the shop to be allowed to
start. The record it writes is what the owner reads at the end of the month to
run payroll.

Three separate jobs live inside it, and they must not be collapsed into one:

1. **The staff member's job** — start my shift, take a break, end my shift.
2. **The owner's job** — see who was in, when, and for how long; correct a
   record; export the month.
3. **The owner's setup job** — drop a pin on the shop and choose how far from
   it still counts as being at work.

Each is a different screen, in a different part of the product, because they
are done at different frequencies by different people. Putting the map on the
same page as the attendance grid pushed the grid 400px down the page, so they
were split.

## 1.2 Data model

### The attendance row

One row per employee per calendar day. Not per punch — per day.

```
attendance
  id
  clinic_id            FK, the tenant                 (→ pharmacy_id)
  user_id              FK, the employee
  date                 DATE (stored as midnight of the calendar day)
  status               'on_time' | 'late' | 'absent' | 'holiday'
  check_in_time        DATETIME, nullable
  check_out_time       DATETIME, nullable
  reason               VARCHAR, nullable   -- why late/absent
  notes                TEXT, nullable      -- what happened on the shift
  marked_by            FK users, nullable  -- SEE BELOW, this is load-bearing
  created_at, updated_at

  -- where they were standing, clock in
  clock_in_latitude    FLOAT
  clock_in_longitude   FLOAT
  clock_in_accuracy    FLOAT   -- the device's own error estimate, in metres
  clock_in_address     VARCHAR -- reverse-geocoded line, when available
  clock_in_distance_m  FLOAT   -- metres from the shop pin, when the pin is set

  -- same five columns again, clock out
  clock_out_latitude, clock_out_longitude, clock_out_accuracy,
  clock_out_address, clock_out_distance_m

  breaks               JSON    -- [{"start": iso, "end": iso|null}, ...]
```

Five decisions in there are worth understanding before you copy the shape:

**`marked_by` is null for a self-service clock-in, and set when somebody marked
it for you.** That single asymmetry is what lets the UI answer the only
question an owner really has: *"was she actually here, or did the front desk
say she was?"* The serializer derives `source: 'mobile' | 'manual'` from it.
Do not add a separate `source` column — a second field that has to be kept in
sync with the first will eventually disagree with it.

**`accuracy` is stored next to every coordinate, always.** A coordinate without
its error estimate cannot be judged. "40 m from the shop" means one thing on a
±5 m fix and nothing at all on a ±200 m fix. The two always travel together,
in the database, in the API response, and on screen.

**Hours worked are NOT stored.** There is no `hours_worked` column, on purpose.
The figure is derived from the two timestamps everywhere it is shown. A stored
total goes stale the instant an owner corrects a clock-in time, and then the
grid and the exported payroll sheet quietly disagree. (In the original, an
early version *did* assign `attendance.hours_worked = ...` — with no such
column, it set a throwaway Python attribute that vanished on commit. Nobody
noticed for a long time.)

**Breaks are a JSON list on the row, not their own table.** A break only ever
belongs to the one shift it was taken in, and is only ever read together with
it. An open break has `end: null`. Break time is **not** subtracted from the
worked hours the grid and exports show — that is a payroll policy decision, and
it should not be slipped in behind a button. Show it as its own number instead,
so a long day and a long lunch do not read alike.

**A day can legitimately hold more than one row.** Somebody clocks out at 14:00
and comes back at 17:00; the second clock-in opens a fresh record. The reader
picks which one to display: **the still-open one wins, otherwise the most
recently updated**. Without that rule, a day that is still running can render
as finished.

### The shop's pin (on the tenant table)

```
clinics                                   (→ pharmacies)
  latitude           FLOAT, nullable
  longitude          FLOAT, nullable
  geofence_radius_m  INTEGER, default 150
  timings            JSON   -- {"monday": {"open":"09:00","close":"20:00","closed":false}, ...}
  timezone           VARCHAR(50), default 'Asia/Kolkata'  -- IANA
```

`timings` already existed for other reasons (showing opening hours to
customers), and the attendance feature reuses it rather than inventing a second
schedule. That reuse is why "late" means something different on a Saturday.

## 1.3 The geofence rule — the heart of the feature

```
distance = haversine(shop.lat, shop.lng, fix.lat, fix.lng)
radius   = shop.geofence_radius_m or 150
slack    = min(fix.accuracy or 0, 200)      # cap it
allowed  = distance <= (radius + slack)
```

Four deliberate leniencies. Each exists because the cost of a **false refusal**
is a staff member standing at the counter who cannot start their shift, and
that turns a safeguard into a support call:

1. **No pin set → everybody is allowed through.** An owner who has never opened
   the map must not be locking their counter staff out by accident.
2. **The radius is the shop's own setting, not a hardcoded 100 m.** A
   standalone shop and a pharmacy counter inside a hospital on the third floor
   need different numbers. Offer a small set of choices (10 / 50 / 100 / 150 /
   300 / 500 m), not a free-text box. Minimum 10 m, maximum ~2000 m — past a few
   hundred metres it stops being a geofence and becomes a postcode.
3. **The device's own error estimate widens the circle.** A phone indoors
   routinely reports ±50 m. Judging a 60 m reading against a bare 150 m radius
   refuses people who are standing at the till.
4. **The slack is capped at 200 m** so a garbage reading (±5 km) cannot wave
   anything through.

Then the asymmetry that makes the whole thing usable:

- **Clocking IN is refused** outside the fence. `403`, with a message that says
  the number: *"You look about 412 m from the shop. Clock in once you are
  inside, or ask your owner to check the shop's location."*
- **Clocking OUT is never refused.** Somebody who finished their shift and
  walked to the bus stop still has to close it. A geofence that traps them
  clocked-in overnight is a bug wearing a safeguard's clothes.
- **The distance is stored either way**, including when the clock-in was
  allowed. The owner reviewing the week can then see *how far out* an allowed
  check-in was.

**The decision is made on the server. Always.** The client computes the same
thing and shows it as a preview ("Within zone" / "412 m away") *before* anyone
taps, so the state is visible before the decision rather than after it. But the
client's answer is never the answer. A client that decided for itself is
defeated by anyone willing to fake their phone's location, which defeats the
point of recording it at all.

## 1.4 Lateness

Computed, not guessed, and computed in exactly one function shared by every
reader.

```
opening = shop.timings[weekday_of(date)].open     # "09:00", or None if closed
late_by = minutes(check_in_local - opening)       # None if either is missing
status  = 'late' if late_by > GRACE else 'on_time'
GRACE   = 5 minutes
```

- **`None`, not `0`, when it cannot be said honestly.** No clock-in, or no
  configured opening time for that weekday → `None`. Zero would be a claim that
  the person was punctual. `None` means we do not know, and the UI shows
  nothing rather than a green tick nobody earned.
- **No hours configured → `on_time`.** With nothing to be late against, the
  benefit of the doubt goes to the person who turned up.
- **5 minutes of grace**, not zero. A phone that says 09:00:40 for somebody who
  walked in at 08:59 should not start an argument.

The original bug worth avoiding: the clock-in route originally let `status` take
its column default, so **every** phone clock-in was stored as `on_time`,
however late it was. Somebody arriving 102 minutes after opening produced a
green "Present" cell on the owner's grid. A screen where everybody is always on
time is not a screen. Compute the status at write time, with the same helper
the grid uses to display "late by N minutes", so the badge and the number
cannot disagree.

**Ask for the reason before the tap, not after.** The status endpoint returns
`late_now`, `late_by_minutes`, `opening_time` and `grace_minutes`, so the
screen can show the "Why are you late?" box *before* sending. Asking afterwards
means either a second request, or a reason attached to a record that already
says `on_time`. The reason is kept **only** when the stored status is actually
`late` — writing an explanation against an on-time arrival puts an answer next
to a question nobody asked. The field is optional on the wire: refusing a
clock-in over an unfilled text box stops somebody starting work.

## 1.5 Timezones

This is where a re-implementation will lose a day of debugging, so do it right
the first time.

- Store timestamps in **UTC**. Run the server in UTC.
- Display everything, and compute every day boundary, in the **shop's own
  timezone**, from the tenant's `timezone` column.
- Naive timestamps read out of the database are treated as UTC, not as
  server-local. Be consistent about this in every reader.

The concrete failure: a "what did I do today" summary was first written with
`datetime.now()` bounds against a mix of columns. In IST that is wrong for five
and a half hours every day — at 00:45 local it is still 19:15 UTC on the
previous date, so a customer served "just now" fell outside "today" and the
shift summary read zero. A test pinned to exactly that hour caught it.

Worse, different columns are stored differently, and one filter cannot serve
all of them. In the original, three kinds coexisted: local `DATE` columns
(compared against the local calendar day), UTC timestamps (needing the local
day converted to UTC bounds), and local naive datetimes (needing local bounds).
Audit your own columns before writing any "today" filter.

## 1.6 API surface

### Staff-facing (any signed-in employee, acts on themselves only)

```
GET  /attendance-mobile/status
POST /attendance-mobile/clock-in     { latitude, longitude, accuracy?, address?, reason? }
POST /attendance-mobile/clock-out    { latitude, longitude, accuracy?, address?, notes? }
POST /attendance-mobile/break/start
POST /attendance-mobile/break/end
GET  /attendance-mobile/history?skip=&limit=
GET  /attendance-mobile/geofence     -- readable by any staff member
PUT  /attendance-mobile/geofence     -- OWNER ONLY  { latitude, longitude, radius_m }
GET  /attendance-mobile/map?lat=&lng= -- static map image proxy, see below
```

**`/status` returns everything the clock screen needs in one call.** This is the
single highest-value design decision in the feature. The screen has three
states — not started, on shift, done for today — and telling them apart used to
need two requests plus a guess, so the screen flickered through a wrong state
on every open. Returning the whole of today means it renders correctly on first
paint.

```jsonc
{
  "is_clocked_in": true,
  "is_done_for_today": false,
  "attendance_id": 1234,
  "clock_in_time": "...", "clock_out_time": null,
  "clock_in_distance_m": 18.4,

  "on_break": false, "break_started_at": null, "break_minutes": 35,

  "geofence_set": true, "geofence_radius_m": 150,
  "clinic_name": "...", "clinic_latitude": 19.07, "clinic_longitude": 72.87,

  "today": { "patients_seen": 4, "patients_registered": 9, "appointments": 6 },

  "late_now": false, "late_by_minutes": 2,
  "opening_time": "09:00", "grace_minutes": 5
}
```

Two further notes on that payload:

- Returning the **pin itself** (not just a `geofence_set` boolean) lets the
  screen draw the map and the radius without a second call.
- `geofence_set` exists so the screen can say *"your shop has not set its
  location yet"* rather than implying a fence that is not actually being
  enforced. A geofence people believe in but which is not running is worse than
  no geofence at all.

**The `today` block — adapt this carefully for pharmacy.** It is what the staff
member has to show for the shift, counted from real records, shown on the
clock-out summary. Here it is three numbers rather than one, because "patients
seen" means different things to different roles and a single figure would be
zero for half the staff — a dentist is measured on who they treated, a
receptionist on who they booked. The screen shows whichever are non-zero, so
nobody is told their shift was empty. It counts **distinct** patients, not rows.

For a pharmacy the equivalents are probably: **bills created**, **items
dispensed**, **prescriptions filled**, **value sold**. Pick the two or three
that differ by role (counter staff vs. pharmacist vs. delivery), count
distinct, and show only the non-zero ones. Do not invent a number you do not
actually record — the original deliberately refused to show a "breaks" figure
in that block while nothing recorded breaks, even though the design asked for
one.

**`/map` is a server-side proxy for a static map image, not a URL the client
builds.** The app can draw a stylised map of its own, which is honest but tells
nobody standing on the street whether the pin is on the right building. This
endpoint returns the real streets. It is a proxy for one reason: the Google
Maps key would otherwise ship inside the app bundle, where anyone can read it
out of the APK and spend the shop's quota. The key never leaves the server.
Implementation notes: it draws the geofence as a ~40-point polygon (Static Maps
has no circle primitive), multiplies the longitude offsets by `cos(latitude)`
so the ring is a circle and not an ellipse, and picks the zoom as
`16 - log2(radius / 150)` clamped to 12–18. Returns **404** when no pin is set
and **503** when no key is configured, so the client falls back to its own
drawing instead of showing a broken image. Cache it `private, max-age=86400`.

### Owner-facing

```
GET    /attendance?start_date=&end_date=&user_id=
GET    /attendance/employees
GET    /attendance/week?week_start=YYYY-MM-DD
GET    /attendance/calendar?month=YYYY-MM  |  ?start=&end=   [&user_id=]
GET    /attendance/export?month=YYYY-MM&format=csv|pdf [&user_id=]
POST   /attendance            -- create or update a day (manual marking)
PUT    /attendance/{id}
DELETE /attendance/{id}
```

**One loader behind all four read paths.** The week grid, the month grid, the
CSV and the PDF all call the same range builder, which calls the same
`serialize_day`. The moment "late" or "worked hours" is computed in two places
they drift, and the PDF an owner files starts disagreeing with the screen they
filed it from.

**A day is one of three things, and the difference drives the UI:**

| Value | Meaning | Renders as |
|---|---|---|
| `null` | the day is in the future | nothing, no affordance |
| `{}` | past or present, no record | the empty cell that invites a mark |
| `{...}` | a record | the status cell, clickable for detail |

**Cap the range.** 366 days maximum per request. Nobody asks for two years
deliberately — that is what a mistyped date range looks like, and it is a lot of
rows to build in memory and a lot of columns to draw.

### The serialized day

```jsonc
{
  "id": 1234,
  "status": "late",
  "reason": "Traffic on the highway",
  "notes": "Restocked the fridge line",
  "check_in": "09:22", "check_out": "18:05",     // HH:MM, shop-local
  "worked_minutes": 523,                          // derived, never stored
  "break_minutes": 35,
  "expected_open": "09:00",
  "late_by_minutes": 22,
  "is_open_shift": false,                         // clocked in, never out
  "source": "mobile",                             // 'mobile' | 'manual'
  "marked_by_name": null,                         // who marked it, if manual
  "clock_in": {
    "latitude": 19.07, "longitude": 72.87,
    "accuracy_m": 12, "distance_m": 18.4,
    "address": "Shop 4, Link Road",
    "outside_geofence": false                     // null = never measured
  },
  "clock_out": { ... } | null
}
```

`outside_geofence` is **tri-state**: `true`, `false`, or `null` meaning "we
never measured" (no pin, or no distance recorded). "Not outside" and "we never
checked" are different answers and must not both render as a green tick. Since
clock-out is never *refused* on distance, this field is the only place a
far-away clock-out ever surfaces.

`is_open_shift` — clocked in and never out — is usually somebody who forgot. It
deserves its own visible state rather than a blank clock-out cell that reads
like missing data.

### Per-employee summary for a range

```jsonc
{ "marked_days": 24, "on_time": 19, "late": 4, "absent": 1, "holiday": 0,
  "present": 23, "worked_minutes": 11040, "total_late_minutes": 96 }
```

`present` counts `on_time` and `late` together, because for a payroll total the
question is how many days somebody turned up, not how punctually.

### Exports

Both formats come from the same loader, and they are different shapes on
purpose:

- **CSV — one row per employee per day.** Long, not wide. A grid with a column
  per date cannot be filtered or pivoted, and a month of it does not fit on a
  screen. This is the shape you sort and total in a spreadsheet for payroll.
- **PDF — the grid as it looks on screen**, plus a per-employee summary, plus
  "generated at / generated by". This is the shape you print, sign and file.
- An unmarked past day exports as **"Not marked"**, never blank. A blank cell in
  a printed register reads as a printing fault.

## 1.7 Permissions and scoping

This is a real vulnerability if you get it wrong, and the original shipped it
wrong first.

Attendance is pay data. Every read route originally took a `user_id` from the
query string and honoured it without asking, so **any signed-in staff member
could read a colleague's month**: when they arrived, how long they stayed, where
their phone was standing.

The fix is one function applied to every read route:

```python
def scope_user(current_user, requested_user_id):
    if has_permission(current_user, "view", "attendance"):
        return requested_user_id      # may read anyone, or everyone
    return current_user.id            # own days only, whatever was asked for
```

Owners always pass. Everyone else gets their own row and nobody else's — which
happens to be exactly what the employee's own "My attendance" screen needs, so
one rule serves both cases.

Separately:

- **Setting the pin is owner-only.** It decides whether the rest of the staff
  can start their shift; it is not a setting a counter assistant should be able
  to move to wherever they happen to be standing.
- **The pin gets its own endpoint**, not three more fields on the general
  "update shop" DTO. That DTO is posted by half a dozen screens, and quietly
  widening it would mean any of them could move the geofence as a side effect
  of saving a phone number.

## 1.8 The manual-marking bug you must not reproduce

The owner's grid lets you mark somebody present/late/absent by hand. The
original "create or update" handler assigned **every** field unconditionally
from the request model — and `check_in_time` / `check_out_time` default to
`None` on that model. The web grid sends only a status and a reason.

So marking somebody "late" **silently erased the clock-in and clock-out their
phone had recorded.** It went unnoticed while the web screen displayed neither.
Once the screen started showing both, an owner opening a day to look at it and
pressing Save would have destroyed the very record they came to read.

The fix: only overwrite what the caller actually sent.

```python
sent = payload.dict(exclude_unset=True)     # distinguishes "not sent" from "sent as null"
for field in ("status", "check_in_time", "check_out_time", "reason", "notes"):
    if field in sent:
        setattr(existing, field, sent[field])
existing.marked_by = current_user.id
```

`exclude_unset` is what makes "clear this time deliberately" still work while
"I did not mention this field" leaves it alone. Any partial-update endpoint in
your pharmacy app needs the same treatment.

## 1.9 Client behaviour

### The mobile clock screen

One screen, three faces, chosen by what `/status` returned:

| State | Layout |
|---|---|
| **Not started** | map full-bleed, "Within zone / 412 m away" chip, **Clock In** |
| **On shift** | map shrinks to a card, running shift timer, **Take a break**, **End Shift** |
| **Done for today** | the day's summary, no buttons |

Rules that matter:

- **Nothing is optimistic.** Attendance is a record an owner will read as
  evidence. Every button waits for the server rather than showing a tick it
  might have to take back.
- **Read the location when the screen opens**, and refresh every ~20s while it
  stays open. The original was two lines of text and a button — you pressed it
  and found out. When the answer was "too far away" there was nothing on screen
  to argue with: no sense of how far, in which direction, or whether the shop's
  own pin was wrong.
- **A distance refusal gets its own panel, not a red toast.** It is an answer,
  not a fault. Give it a distinct error class on the client (`403` →
  `OutsideGeofenceError`) so it can never be styled as a network failure.
- Use **balanced** GPS accuracy, not highest. Balanced is ~10–100 m and arrives
  in a second or two; highest spins the GPS chip hunting sub-10 m precision that
  tells an owner nothing extra, and a clock screen that takes fifteen seconds
  is a feature nobody uses twice.
- **Foreground, one-shot reads only. Never a background watcher.** Google Play
  requires a separate review with a filmed justification for background
  location and rejects it for apps that do not need it to function; Apple takes
  the same line. And a pharmacy app that follows staff around when it is closed
  is not a thing worth having built.
- **Everything about location fails soft.** Refused permission, location
  services off, a basement with no signal — all return null and every caller
  carries on. Location is evidence, never a gate on getting work done. The one
  exception is the clock-in geofence, and that refusal comes from the server.

### The web clock modal

Deliberately enforces **the same rules** the phone does, because both write to
one attendance record. A staff member who could clock in from home on a laptop
would make the geofence on the app pointless.

## 1.10 Where each option is shown

This is the placement question, answered exactly as the dental product answers
it. Translate the nouns, keep the structure.

### Web

| What | Where | Why there |
|---|---|---|
| **Clock in / Clock out** | Header → avatar → profile dropdown → **first item** | Twice a day, every day, by everyone. It is the single most-used thing in that menu, so nothing sits above it. |
| **Attendance grid** (the owner's week/month) | Control Center → **Team** → *Attendance* tab | Read weekly by managers, not daily by staff. It belongs in admin, not in the personal menu. |
| **Shop location / geofence** | Control Center → **Team** → *Location* tab | Set once, rarely revisited. Its own tab, not a card stacked on top of the grid. |
| **My attendance** (own history) | reachable through the same grid, scoped to self | One screen, two audiences, via the permission scope. |

The **Team** section is one page with a tab strip — *Staff | Attendance |
Location* — a plain title, a one-line description, and the content sitting
directly on the page background with no wrapper card. The table is the content;
boxing it inside a second card just adds a frame around a frame.

Critically: **Attendance is a tab of Team, not its own top-level admin menu
item.** It was listed in both places at first, and that made one section read as
three. Pick one home for each thing.

### Mobile

| What | Where |
|---|---|
| **Clock in / out** (staff) | Employee home → quick-action tile, *"Clock in / out"* |
| **Clock in / out** (owner) | Profile → *"Clock In / Clock Out"*, subtitle *"Start or end your day at the shop"* |
| **My shift** (admin hub) | Admin hub → config row, *"My shift"*, subtitle *"Clock in and out from the shop"* |
| **My attendance** | Employee home → *"My attendance"* |
| **Attendance** (owner's view) | Admin hub → *"Attendance"*, subtitle *"Daily staff check-in & leave"* |

The owner reaches their *own* clock from their profile, and their *staff's*
attendance from the admin hub. Those are two different intents and they get two
different doors.

---

# Part 2 — Log in to the mobile app by scanning a QR

## 2.1 What it is, and why it exists

A staff member installs the app and is immediately asked for an email and a
password they either do not have or cannot type on a phone keyboard. So:

The web shows a QR. The phone scans it on its sign-in screen and is in. No
email, no password.

Two audiences, one mechanism:

- **Yourself** — you are already signed in on the shop's desktop; you open your
  own profile menu and scan.
- **Somebody you manage** — the owner opens that staff member's record and shows
  a code for them, standing next to them, setting up their phone.

That second case is the one that makes the feature worth building. It is how a
new hire gets onto the app on their first morning without an email round-trip.

## 2.2 The security model

This is most of the feature. A QR that logs somebody in is a credential on a
screen, and it has to be built like one.

```
phone_login_codes
  id
  code_hash        VARCHAR(64) NOT NULL UNIQUE INDEX   -- SHA-256 of the code
  user_id          FK users, indexed        -- who it signs in
  clinic_id        FK, indexed              -- the tenant  (→ pharmacy_id)
  issued_by        FK users, NOT NULL       -- who put it on screen
  created_at       NOT NULL
  expires_at       NOT NULL
  used_at          nullable
  used_device_id   FK user_devices, nullable
  used_device_name VARCHAR, nullable
```

The rules, each with the reason it exists:

1. **The QR carries a one-time code, never a password and never a session
   token.** 256 bits of randomness (`secrets.token_urlsafe(32)`).
2. **Only the SHA-256 is stored.** A database read — a leaked backup, a SQL
   injection, a support engineer with a console — cannot be turned into a
   login. Look the code up *by its hash*.
3. **Two-minute TTL, single use.** `CODE_TTL_SECONDS = 120`.
4. **Issuing a new code retires the issuer's previous live one.** The web panel
   replaces its code every two minutes while it stays open; without this, every
   replaced code would stay valid until its own expiry and a screen left open
   for an hour would leave thirty working codes behind it. Scope the retirement
   to `(user_id, issued_by)` so two managers setting up two phones do not
   cancel each other.
5. **Seniority rule.** Showing a code for somebody else requires the
   manage-staff permission **and** the target's role must be one the issuer
   could assign themselves. A manager who could show a code for the owner could
   sign in as the owner. Same rule as handing out a role, deliberately — one
   idea, one implementation.
6. **Redeeming goes through every check a password login does**: deactivated
   accounts, blocked devices, failed-attempt throttling, the audit trail, and a
   session bound to the device.
7. **Row lock on redeem** (`SELECT ... FOR UPDATE`) so two phones scanning the
   same code at the same instant cannot both get in.
8. **Rate-limit redeem attempts by IP.** The codes cannot realistically be
   guessed, so this is about noise rather than brute force — but it costs
   nothing and a public unauthenticated endpoint should have one.
9. **Deactivated account → refused** at issue time *and* at redeem time.
10. **Audit everything**: issuing a code for somebody else, a successful QR
    sign-in (recording who showed it), a blocked sign-in, a blocked device.

## 2.3 The QR payload

```
molarplus://login?code=<the 256-bit code>       →  yourpharmacy://login?code=...
```

Two reasons it is a **registered custom scheme** rather than a bare code:

- The phone's own camera app can open a scanned code straight into the app. The
  user does not have to know to open the app first.
- The in-app scanner can reject a QR that is not yours with a useful message
  (*"That isn't a sign-in code — open Log in to mobile app on the website"*)
  instead of silently doing nothing at a restaurant menu.

The server **strips the prefix if present** on redeem, so the app can send the
whole scanned string and never has to parse it correctly.

Render the QR **server-side as an SVG data URI** and return it in the response.
The client then just renders an `<img src={...}>`. This keeps the code itself
out of client-side QR-generation libraries and out of any client logging.

## 2.4 API

```
POST /auth/phone-login/code              (authenticated)
     { user_id?: number }                -- omit or send your own id for yourself
  →  { id, qr: "data:image/svg+xml;base64,...", expires_in: 120, for_name }

GET  /auth/phone-login/code/{id}         (authenticated, issuer only)
  →  { status: "waiting", expires_in: 87 }
  |  { status: "expired" }
  |  { status: "used", used_at, device_name, blocked }

POST /auth/phone-login/code/{id}/block   (authenticated, issuer only)
  →  { blocked: true }

POST /auth/phone-login/redeem            (UNAUTHENTICATED — this is the phone)
     { code: "<scanned string>", device: { device_name, device_type, device_platform, lat?, lng?, accuracy? } }
  →  the exact same auth response a password login returns (token + user)
```

`GET /code/{id}` is scoped to `issued_by == current_user.id`. Only the person
who showed a code may ask what happened to it.

## 2.5 The "Not them?" loop — the part that makes it safe to use

This is the design detail that most re-implementations miss, and it is what
turns a risky feature into a defensible one.

While a code is on screen, the web panel **polls every 2.5 seconds** asking
whether it has been used. The instant it is, the panel stops showing a QR and
says:

> ✅ **Signed in on Redmi Note 12**
> Priya can use the app on that phone now.
> *Not them? Block that phone*

One tap blocks **exactly the device that used that code**. Because tokens are
bound to their device and the device is checked on every request, blocking
signs that phone out immediately and stops it signing in again until an owner
unblocks it under Devices.

So the owner standing next to their new hire gets live confirmation that the
right phone got in, and a single undo if it was not. Without that loop, showing
a QR on a screen in a shop is a thing you have to *hope* went right.

The confirmation dialog says exactly what will happen: *"Redmi Note 12 will be
signed out now and won't be able to sign in again until it's unblocked in
Control Center → Devices."*

## 2.6 Client behaviour

### Web panel

- Issue a code on mount. Show it with a **countdown** ("Refreshes in 1:47").
- **Re-issue 5 seconds before expiry**, so there is never a dead QR on screen.
  The server retires the old one as it issues the new.
- Poll for use every 2.5s. **A missed poll is not worth a message** — swallow it
  and try again on the next tick.
- Alongside the QR, show the three steps in plain words:
  1. Install the app from the App Store or Google Play (real links).
  2. Open it and tap **Scan QR to log in** on the sign-in screen.
  3. Point the camera at this code. That's it, no password needed.
- Footnote: *"The code works once and changes every two minutes. Only show it to
  Priya."*
- Clean up timers on unmount and guard every `setState` after an await with an
  `alive` ref.

### Mobile scanner

- A dedicated full-screen camera screen with a framed cutout, a torch toggle,
  and a close button.
- **Guard against repeat scans with a ref.** The camera reports the same code
  many times a second; one redeem is plenty, and the second one would hit an
  already-used code and show a scary error.
- QR barcode type only.
- Reject a non-matching prefix with a helpful message and a **Scan again**
  button — do not just keep scanning silently.
- Ask for camera permission on mount. If permanently denied, show a **Open
  Settings** button instead of asking again. Say why you need it: *"only used
  while this screen is open."*
- Send the **device model** with the redeem (`Device.modelName`) so the web
  panel can say *"Signed in on Redmi Note 12"* rather than "a phone". Attach a
  location fix **only if permission was already granted** — never prompt for
  location during a sign-in.
- On success, do nothing. Flipping the auth context replaces the whole
  navigation stack, exactly as a password sign-in does.

### Deep link handling

Handle both `getInitialURL()` (app opened cold by the link) and the `url`
event (app already running). Two rules:

- **Hold the link until the startup session check has settled**, so it cannot
  race the restore of an existing session.
- If somebody is **already signed in**, do not silently swap accounts. Say
  *"This phone is already signed in. Sign out first to use this code."*

## 2.7 Where each option is shown

### Web

| What | Where | Notes |
|---|---|---|
| **Log in to mobile app** (for yourself) | Header → avatar → profile dropdown → **second item**, right under Clock in/out | Opens a small modal containing the QR panel. Everyone sees it; no permission needed for your own account. |
| **Phone login** (for a staff member) | Control Center → Staff → open a person → **Phone login** tab | A tab in the person's detail drawer, beside *Edit* and *Permissions* |

**Hide the tab where the server would say no.** It only appears when the
account is active *and* the viewer is allowed to manage that role. Offering it
elsewhere is a button that errors — a door that never opens is worse than no
door. (The same panel is reused for both cases; it takes an optional `userId`
and `personName` and the copy adapts: "your account" vs "Priya's account".)

### Mobile

| What | Where |
|---|---|
| **Scan QR to log in** | Login screen, as the **last** provider pill, under *Continue with Google* and *Continue with Email* |
| (implicit) | Any `yourpharmacy://login?code=...` link opened from the system camera |

---

# Part 3 — Default image for the pharmacy shop

You asked for this as well, so here is the pattern the dental product uses,
adapted.

## 3.1 The principle

**Never render an empty box, and never render a broken image.** Every place a
shop, a person or a product can appear must resolve to *something*, through a
single shared helper. Reading the raw field directly at each call site is how
the original header ended up ignoring uploaded photos entirely — it only ever
checked one of the three shapes an avatar could arrive in, so a picture set on
the profile page changed nothing anywhere else in the app.

## 3.2 The resolver pattern

One function, used everywhere. It checks the possible "real image" fields in
order, then falls back to a generated one. It **never returns empty**.

```js
export const resolveShopImage = (shop, size = 80) => {
  const uploaded =
    shop?.logo_url ||
    shop?.image_url ||
    shop?.photo_url;                  // every shape your endpoints actually return
  if (uploaded) return uploaded;
  return generateShopPlaceholder(shop?.name || shop?.id || 'Pharmacy', size);
};
```

Write down every field name your API has ever used for the same idea, and check
them all in one place. That list only ever grows, and it should grow in exactly
one file.

## 3.3 What the fallback should be

The dental app uses two generators, and the choice between them matters:

**For people** — a deterministic cartoon avatar from the name or email as a
seed, so the same person always gets the same face:

```
https://api.dicebear.com/9.x/avataaars/svg?seed=<seed>&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear&radius=50&size=<px>
```

**For anything else, including a shop** — initials on the brand colour:

```
https://ui-avatars.com/api/?name=<INITIALS>&background=<brand hex>&color=fff&size=80&rounded=true&bold=true
```

Initials are taken as the **first letters of the first two words** — "Apollo
Medicals" → "AM", "Shree Krishna Pharmacy" → "SK" — falling back to `?` when
there is nothing to use.

For a **pharmacy shop specifically**, I would recommend a third option over
both, and it is cheap to do:

> **A local, inline SVG**: a neutral storefront or mortar-and-pestle glyph on a
> soft tint of your brand colour, with the shop's initials centred over it.

Three reasons to prefer local over the hosted services above:

1. **It works offline and in the POS.** A pharmacy counter is a place where the
   internet goes down and the billing screen still has to work. An external
   avatar URL renders as a broken image at exactly the wrong moment.
2. **No third-party request per render.** You are not sending your customers'
   or shops' names to an avatar service on every page load — which in a
   pharmacy, near health data, is a question you do not want to have to answer.
3. **It is brand-consistent** and does not change when someone else's API
   changes its default style.

Keep the same *shape* as above — one resolver, deterministic from the name,
never empty — and only swap what the fallback renders.

## 3.4 Where the default shows up

Anywhere the shop can appear before the owner has uploaded a logo:

- The shop switcher / branch picker
- The header, beside the shop name
- Invoices and bill PDFs (**check this one explicitly** — a generated SVG or an
  external URL may not render in your PDF engine; for print, fall back to plain
  text initials in a bordered box rather than a missing image)
- Onboarding, before any logo has been uploaded
- The owner's shop-settings page, as the "click to upload" target

## 3.5 One more thing worth copying

Make the **upload path and the default path the same component**. The
placeholder *is* the upload button when no image is set. That way the owner
discovers they can change it by looking at the thing that bothers them, and you
do not build two separate UI states for one field.

---

# Part 4 — Build order

If you are implementing both features in the pharmacy app, this order keeps you
shippable at every step:

1. **Shop pin + radius** — the tenant columns, the owner-only endpoint, the map
   picker. Nothing depends on it yet, and clock-in works without it (everyone is
   allowed through), so it can ship alone.
2. **The attendance row + clock in / out / status** — with the geofence rule and
   the computed status. Ship the mobile screen against it.
3. **The owner's grid** — the shared range loader and `serialize_day` from day
   one. Do not let the grid compute anything for itself.
4. **Breaks** — additive, JSON column, two endpoints.
5. **Exports** — CSV then PDF, both off the same loader.
6. **Manual marking** — with `exclude_unset` from the first commit, not as a
   later fix.
7. **QR login** — independent of all of the above. It is roughly a day's work
   and it makes onboarding staff onto the phone app dramatically easier, which
   in turn is what makes the clock-in feature actually get used.

## Non-negotiables, collected

- The geofence decision is the server's. The client's copy is a preview.
- `accuracy` travels with every coordinate, everywhere.
- Worked hours are derived, never stored.
- Clocking out is never refused.
- One serializer behind every screen and every export.
- `marked_by` null vs. set is the only source-of-truth for self vs. manual.
- Scope every attendance read by permission, not by the query string.
- Partial updates use `exclude_unset`.
- Store UTC, display and bucket days in the shop's timezone.
- QR codes: hashed at rest, two minutes, single use, device-bound, revocable in
  one tap by whoever showed them.
- Never render an empty or broken image; one resolver, no exceptions.
