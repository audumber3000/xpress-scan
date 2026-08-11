"""
The appointment lifecycle, in one place.

Before this module the vocabulary was invented at each call site and drifted
badly: production held `accepted`, `confirmed`, `checking` and `rejected`, while
the model comment claimed `confirmed`, `completed`, `cancelled` and `no-show`.
Neither list described what the UI could actually set, and between them there
was no way at all to record whether a patient turned up. 165 of 167 appointments
sat in the past with no terminal state, which made the no-show rate not merely
unreported but unrecordable.

Everything that reads or writes a status now imports from here.
"""

# ── The lifecycle ────────────────────────────────────────────────────────────
#
#   scheduled ──► confirmed ──► arrived ──► completed
#        │             │            │
#        └─────────────┴────────────┴──────► cancelled / no_show
#
SCHEDULED = "scheduled"   # booked, nobody has confirmed it yet
CONFIRMED = "confirmed"   # the patient said they are coming
ARRIVED = "arrived"       # checked in at the desk
COMPLETED = "completed"   # seen
NO_SHOW = "no_show"       # did not come, did not call
CANCELLED = "cancelled"   # called off, by either side

ALL_STATUSES = (SCHEDULED, CONFIRMED, ARRIVED, COMPLETED, NO_SHOW, CANCELLED)

# Still on the books: shows on the calendar, counts toward a busy day, and is
# what "needs an outcome" scans once the day is over.
OPEN_STATUSES = (SCHEDULED, CONFIRMED, ARRIVED)

# Done with, one way or another. Recording one of these is the whole point.
TERMINAL_STATUSES = (COMPLETED, NO_SHOW, CANCELLED)

# The patient was, or should have been, in the building. This is the
# denominator for a no-show rate: cancellations are excluded because a slot
# called off in advance is a different failure from one silently wasted.
ATTENDANCE_STATUSES = (COMPLETED, NO_SHOW)

# The patient was physically in the clinic. This is what "last seen" means, and
# it deliberately excludes anything merely booked: an appointment that was never
# attended must not move a patient's last-visit date.
VISITED_STATUSES = (ARRIVED, COMPLETED)

# ── Legacy vocabulary ────────────────────────────────────────────────────────
# What production actually contained before the migration, and where each value
# lands. `checking` meant checked-in and `rejected` meant declined at booking,
# so neither is lost, only renamed to something a receptionist would recognise.
LEGACY_STATUS_MAP = {
    "accepted": SCHEDULED,
    "checking": ARRIVED,
    "rejected": CANCELLED,
    "pending": SCHEDULED,
    "confirmed": CONFIRMED,
    "completed": COMPLETED,
    "cancelled": CANCELLED,
    "canceled": CANCELLED,
    "no-show": NO_SHOW,
    "no_show": NO_SHOW,
    "noshow": NO_SHOW,
}


def normalize_status(value: str | None) -> str:
    """Map anything we have ever stored onto the current vocabulary.

    Unknown values fall back to `scheduled` rather than raising: a status we do
    not recognise should leave the appointment visible and actionable, never
    swallow it out of the calendar.
    """
    if not value:
        return SCHEDULED
    key = str(value).strip().lower()
    if key in ALL_STATUSES:
        return key
    return LEGACY_STATUS_MAP.get(key, SCHEDULED)


def is_open(value: str | None) -> bool:
    return normalize_status(value) in OPEN_STATUSES


def is_terminal(value: str | None) -> bool:
    return normalize_status(value) in TERMINAL_STATUSES
