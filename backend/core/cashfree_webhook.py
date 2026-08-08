"""Cashfree webhook authentication.

Both money webhooks — subscription activation and wallet top-up — must prove a
payload really came from Cashfree before it moves money. This is the single
implementation; do not hand-roll the HMAC at a call site again.

Fails CLOSED. An unverifiable payload is rejected, including when no secret is
configured at all. The previous inline check ran as
`if secret and signature and timestamp:` — omitting the signature header skipped
verification entirely and the forged payload was processed, which meant anyone
could activate a subscription with a plain POST.

Signing scheme (Cashfree PG): base64(HMAC-SHA256(secret, timestamp + raw_body)),
sent as `x-webhook-signature` with `x-webhook-timestamp` in epoch seconds. The
HMAC must be taken over the RAW bytes — re-serialising parsed JSON changes key
order and whitespace and will never match.
"""
import base64
import hashlib
import hmac
import logging
import os
import time
from typing import Tuple

logger = logging.getLogger(__name__)

# Signatures older than this are refused, so an ancient captured payload can't
# be replayed indefinitely.
#
# Deliberately 24h, not the 5-15min a freshness check usually gets. Cashfree
# retries failed deliveries with backoff over hours, and if it reuses the
# original timestamp on those retries, a tight window would reject legitimate
# retries and silently lose real payments. That is a worse failure than a stale
# replay, because replay is already neutralised downstream: the subscription
# handler skips orders it has paid, and wallet credits are row-locked and
# status-guarded. Freshness here is defence in depth, not the primary control.
MAX_AGE_SECONDS = int(os.getenv("CASHFREE_WEBHOOK_MAX_AGE", "86400"))


def get_secret() -> str:
    """Webhook signing secret. Falls back to the API secret key, which is what
    Cashfree signs PG webhooks with when no separate webhook secret is set."""
    return os.getenv("CASHFREE_WEBHOOK_SECRET") or os.getenv("CASHFREE_SECRET_KEY", "")


def verify(raw_body: bytes, signature: str, timestamp: str) -> Tuple[bool, str]:
    """Return (ok, reason). `reason` is for logging only — never return it to the
    caller, or it becomes an oracle for forging signatures."""
    secret = get_secret()
    if not secret:
        return False, "no webhook secret configured (set CASHFREE_WEBHOOK_SECRET)"
    if not signature or not timestamp:
        return False, "missing x-webhook-signature or x-webhook-timestamp"

    try:
        age = time.time() - int(timestamp)
    except (TypeError, ValueError):
        return False, "malformed timestamp"
    if age > MAX_AGE_SECONDS:
        return False, f"timestamp too old ({int(age)}s)"
    if age < -MAX_AGE_SECONDS:
        return False, f"timestamp too far in the future ({int(-age)}s)"

    expected = base64.b64encode(
        hmac.new(secret.encode(), timestamp.encode() + raw_body, hashlib.sha256).digest()
    ).decode()
    # compare_digest, not ==, so a wrong signature can't be recovered by timing.
    if not hmac.compare_digest(expected, signature):
        return False, "signature mismatch"
    return True, ""


def verify_request(raw_body: bytes, headers) -> Tuple[bool, str]:
    """Convenience wrapper over a Starlette/FastAPI request's headers."""
    return verify(
        raw_body,
        headers.get("x-webhook-signature", ""),
        headers.get("x-webhook-timestamp", ""),
    )
