"""
"Chosen by 250+ dental clinics in 31 countries", computed, never typed.

A trust line on a page that takes money has to be true on the day somebody
reads it, so the numbers come from the clinics table rather than from copy.
Rounded DOWN to a round figure, because "250+" is a claim we can stand behind
and "256" reads as a counter nobody asked for. Below `SOCIAL_PROOF_MIN_CLINICS`
(default 50) it says nothing at all: a small number is not social proof, it is
the opposite.

"Chosen by", not "used by": plenty of those clinics signed up and went quiet,
and the line should not claim more than a signup.

Cached for an hour. It is the same number for everybody and moves by a few a
day, so there is no reason to count the table on every page load.
"""
import os
import time
from typing import Optional

_TTL_SECONDS = 3600
_cache = {"at": 0.0, "value": None}


def _floor_round(n: int) -> int:
    if n >= 1000:
        return n // 100 * 100
    if n >= 100:
        return n // 50 * 50
    return n // 10 * 10


def compute(db) -> Optional[dict]:
    from sqlalchemy import func
    from models import Clinic

    min_clinics = int(os.getenv("SOCIAL_PROOF_MIN_CLINICS", "50"))
    live = (Clinic.status.is_(None)) | (Clinic.status != "deleted")
    # Main clinics only: a group with five branches is one clinic that chose us.
    main = db.query(Clinic).filter(Clinic.parent_clinic_id.is_(None)).filter(live)
    clinics = main.count()
    if clinics < min_clinics:
        return None
    countries = (
        db.query(func.count(func.distinct(func.upper(func.coalesce(Clinic.country, "IN")))))
        .filter(Clinic.parent_clinic_id.is_(None)).filter(live)
        .scalar() or 1
    )
    shown = max(_floor_round(clinics), 1)
    return {
        "clinics": shown,
        "countries": countries,
        "text": "Chosen by {}+ dental clinics in {} {}".format(
            f"{shown:,}", countries, "country" if countries == 1 else "countries"),
    }


def cached(db) -> Optional[dict]:
    now = time.monotonic()
    if _cache["at"] and now - _cache["at"] < _TTL_SECONDS:
        return _cache["value"]
    try:
        value = compute(db)
    except Exception:
        value = None
    _cache.update(at=now, value=value)
    return value
