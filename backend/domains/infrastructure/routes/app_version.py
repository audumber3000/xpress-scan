"""What the mobile app must be running, and what it should be running.

Deliberately unauthenticated. A build old enough to be forced off is exactly the
build whose sign-in may already have stopped working, so gating this behind a
token would mean the users most in need of the message are the ones who cannot
receive it.

Nothing here identifies a clinic or a user. It answers one question — "is this
version still allowed" — and the only input is a platform and a version string.
"""
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from database import get_db
from models import AppVersion

logger = logging.getLogger(__name__)
router = APIRouter()

# Where a user is sent to update. Overridable per row in the DB; these are the
# fallbacks so a fresh install still has somewhere to go.
DEFAULT_STORE_URLS = {
    "ios": "https://apps.apple.com/app/molarplus/id6765472713",
    "android": "https://play.google.com/store/apps/details?id=com.molarplus.app",
}


class VersionCheck(BaseModel):
    action: str                      # 'force' | 'nudge' | 'none'
    min_supported: str
    latest: str
    message: Optional[str] = None
    store_url: Optional[str] = None


def _parse(version: str) -> tuple:
    """'3.17.0' → (3, 17, 0), for comparison that understands numbers.

    String comparison would put '3.9.0' above '3.10.0', which is the classic
    way a version gate locks out the wrong half of your users. Anything
    unparseable becomes (0, 0, 0), which is below every real floor — but see
    the caller: an unreadable version is treated as "let them in", because
    guessing wrong in the other direction bricks the app.
    """
    parts = []
    for chunk in str(version or "").split(".")[:3]:
        digits = "".join(c for c in chunk if c.isdigit())
        parts.append(int(digits) if digits else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts)


@router.get("/version", response_model=VersionCheck)
def check_version(
    platform: str = Query(..., pattern="^(ios|android)$"),
    version: str = Query(..., description="The running build, e.g. 3.17.0"),
    db=Depends(get_db),
):
    """Tell a mobile client whether it may keep running.

    `force` is a wall the user cannot dismiss, so it is only ever returned when
    a row genuinely says so. Every uncertain case — no row, an unreadable
    version, a database that will not answer — resolves to `none`. A version
    check that locks people out when something goes wrong on our side is worse
    than the old build it was trying to stop.
    """
    try:
        row = db.query(AppVersion).filter(AppVersion.platform == platform).first()
    except Exception as exc:
        logger.warning("app version check failed for %s: %s", platform, exc)
        row = None

    if not row:
        # Nothing configured for this platform yet: everybody is welcome.
        return VersionCheck(
            action="none", min_supported="0.0.0", latest="0.0.0",
            store_url=DEFAULT_STORE_URLS.get(platform),
        )

    running = _parse(version)
    store_url = row.store_url or DEFAULT_STORE_URLS.get(platform)

    # A version we cannot read is not evidence of an old build; it is evidence
    # of a bad string. Let it through.
    if running == (0, 0, 0):
        action = "none"
    elif running < _parse(row.min_supported):
        action = "force"
    elif running < _parse(row.latest):
        action = "nudge"
    else:
        action = "none"

    return VersionCheck(
        action=action,
        min_supported=row.min_supported,
        latest=row.latest,
        message=row.message,
        store_url=store_url,
    )
