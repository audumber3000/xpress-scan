"""
What a clinic gets the moment it exists, and the one date the intro cohort ends.

Every clinic must own exactly one subscription row from the second onboarding
finishes. That invariant is the whole point of this module, because breaking it
is what caused the incident this file was written for:

  Onboarding wrote `clinics.subscription_plan = 'free'` and created no
  subscription row at all. `LEGACY_ALIASES` maps `free` onto `plus`, so the
  clinic read as Plus everywhere, and `plan_state.evaluate(None)` reports `ok`
  with no end date for a clinic with no row. The result was a plan that was
  free, unbilled, unexpiring, and invisible to every warning the state machine
  can raise. Nineteen clinics arrived in that state between 25 and 29 Aug 2026,
  which was every single signup in the window.

The failure was silent because "no row" is indistinguishable from "fine" to
everything downstream. So the fix is not a better default somewhere: it is that
no code path can produce a clinic without a row. `provision_new_clinic` is the
only writer, `user_service.complete_onboarding` is the only caller, and it runs
in the same transaction as the clinic INSERT.

## What a new clinic gets

Seven days of Plus, as a trial. `is_trial` and `trial_used` are both set, which
means two things worth being explicit about rather than discovering later:

  * it CONSUMES the one-per-clinic trial, so a clinic that signs up now cannot
    also take the 7-day Pro trial afterwards, and
  * on day 8 `plan_state` returns TRIAL_ENDED, which BLOCKS new records. The
    clinic goes read-only until it pays.

That is deliberate, and it is the reason the Cashfree webhook fix ships in the
same change: a lock is only acceptable if the way out of it works, and it did
not. Every webhook had been rejected since 2026-08-08.

## The intro grant, and why it is a constant and not a computation

`INTRO_GRANT_END` is the date the free-to-Plus cohort runs to. It is moved BY
HAND. Nothing rolls it forward, and that is a choice: a rolling window would
quietly re-grant the whole estate every time somebody deployed, and the estate
has never been invoiced.

It is not what new signups get — they get the trial above. It lives here
because the backfill migration and any future grant have to agree with each
other about one date, and a date that appears in two files eventually appears
as two dates.
"""
import datetime as dt
import logging
import os
from typing import Optional

from core import plans

logger = logging.getLogger(__name__)

# ── What a brand-new clinic gets ─────────────────────────────────────────────
SIGNUP_PLAN = plans.DEFAULT_PLAN     # Plus
SIGNUP_TRIAL_DAYS = 7
SIGNUP_PROVIDER = "trial"

# ── The intro cohort ─────────────────────────────────────────────────────────
#
# Every clinic that existed on 2026-08-24 was granted Plus to this date by
# 2026_08_23_plans_v2_free_to_plus.sql, and the nineteen the bug missed were
# backfilled onto the same date by 2026_08_30_signup_subscription_backfill.sql
# so the cohort has one cutover instead of two.
#
# Moving it is a business decision with a support cost, so it is an env var
# with a hardcoded fallback rather than something computed from `now`.
INTRO_GRANT_END = dt.datetime.fromisoformat(
    os.getenv("INTRO_GRANT_END", "2026-09-30T23:59:59")
)
INTRO_GRANT_PROVIDER = "migration"   # what makes plan_state treat it as a grant


def signup_trial_end(now: Optional[dt.datetime] = None) -> dt.datetime:
    return (now or dt.datetime.utcnow()) + dt.timedelta(days=SIGNUP_TRIAL_DAYS)


def provision_new_clinic(db, clinic, user_id: Optional[int] = None, now=None):
    """Give a freshly created clinic its subscription row. The only writer.

    Idempotent: if the clinic somehow already has a row, that row is returned
    untouched. Re-provisioning would hand out a second trial, and a function
    that silently resets a paying customer to a trial is a worse bug than the
    one this module exists to fix.

    Raises nothing it can avoid, but does NOT swallow database errors. A clinic
    without a subscription row is the incident; failing loudly at signup is
    recoverable, and shipping another row-less clinic is not.
    """
    from models import Subscription

    now = now or dt.datetime.utcnow()
    clinic_id = getattr(clinic, "id", clinic)

    existing = (
        db.query(Subscription)
        .filter(Subscription.clinic_id == clinic_id)
        .order_by(Subscription.id.desc())
        .first()
    )
    if existing is not None:
        logger.info("clinic %s already has subscription %s; not provisioning", clinic_id, existing.id)
        return existing

    end = signup_trial_end(now)
    sub = Subscription(
        clinic_id=clinic_id,
        user_id=user_id,
        plan_name=plans.stored_name(SIGNUP_PLAN),
        status="active",
        provider=SIGNUP_PROVIDER,
        is_trial=True,
        # Consumed here, not on the /start-trial route. A clinic that is handed
        # a trial at signup has had its one trial; leaving this False would let
        # it take a second one the moment the first expired.
        trial_used=True,
        current_start=now,
        current_end=end,
        trial_ends_at=end,
        quantity=1,
    )
    db.add(sub)
    db.flush()   # so the caller sees sub.id inside the same transaction

    # The column /auth/me and the mobile header read. It has to agree with the
    # row or the two disagree on screen, which is the bug plans.effective_plan
    # was written to end.
    if hasattr(clinic, "subscription_plan"):
        clinic.subscription_plan = plans.stored_name(SIGNUP_PLAN)

    logger.info(
        "provisioned clinic %s on %s until %s", clinic_id, plans.stored_name(SIGNUP_PLAN), end.isoformat()
    )
    return sub
