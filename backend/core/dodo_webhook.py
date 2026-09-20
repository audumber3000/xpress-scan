"""Dodo Payments webhook authentication.

The sibling of core.cashfree_webhook, with the same contract: fails CLOSED, and
`reason` is for the log only, never for the caller.

Dodo follows the Standard Webhooks spec (standardwebhooks.com):

  * headers `webhook-id`, `webhook-timestamp` (epoch seconds), `webhook-signature`
  * signed content is `{id}.{timestamp}.{raw body}`
  * HMAC-SHA256, keyed with the base64-decoded secret after its `whsec_` prefix
  * the header carries one or more space-separated `v1,<base64 signature>`
    entries, more than one while a secret is being rotated

As with Cashfree, the HMAC must be taken over the RAW bytes. Re-serialising the
parsed JSON changes key order and whitespace and will never match.
"""
import base64
import binascii
import hashlib
import hmac
import logging
import os
import time
from typing import Tuple

logger = logging.getLogger(__name__)

# Five minutes, the Standard Webhooks default, and much tighter than Cashfree's
# 24 hours. Cashfree may reuse the original timestamp on a retry, so a tight
# window there would lose real payments. Here every retry is signed afresh with
# its own timestamp, so the tight window costs nothing.
MAX_AGE_SECONDS = int(os.getenv("DODO_WEBHOOK_MAX_AGE", "300"))

# The same unit guard as core.cashfree_webhook, which learned it the hard way:
# epoch seconds do not reach 1e11 until the year 5138, milliseconds passed it
# in 1973. The spec says seconds; this keeps a change of mind from becoming an
# outage.
_MILLISECOND_THRESHOLD = 100_000_000_000


def get_secret() -> str:
    """The endpoint's signing secret, from its Overview tab in Dodo's dashboard.
    Named as Dodo's own SDKs name it."""
    return os.getenv("DODO_PAYMENTS_WEBHOOK_KEY", "")


def _key(secret: str) -> bytes:
    raw = secret[len("whsec_"):] if secret.startswith("whsec_") else secret
    return base64.b64decode(raw)


def sign(secret: str, webhook_id: str, timestamp: str, raw_body: bytes) -> str:
    """The `v1,...` signature for a payload. Used by verify() and by tests."""
    content = f"{webhook_id}.{timestamp}.".encode() + raw_body
    digest = hmac.new(_key(secret), content, hashlib.sha256).digest()
    return "v1," + base64.b64encode(digest).decode()


def verify(raw_body: bytes, webhook_id: str, signature_header: str, timestamp: str) -> Tuple[bool, str]:
    secret = get_secret()
    if not secret:
        return False, "no webhook secret configured (set DODO_PAYMENTS_WEBHOOK_KEY)"
    if not webhook_id or not signature_header or not timestamp:
        return False, "missing webhook-id, webhook-signature or webhook-timestamp"

    try:
        value = float(int(timestamp))
    except (TypeError, ValueError):
        return False, "malformed timestamp"
    if value >= _MILLISECOND_THRESHOLD:
        value /= 1000.0
    age = time.time() - value
    if age > MAX_AGE_SECONDS:
        return False, f"timestamp too old ({int(age)}s)"
    if age < -MAX_AGE_SECONDS:
        return False, f"timestamp too far in the future ({int(-age)}s)"

    try:
        expected = sign(secret, webhook_id, timestamp, raw_body)
    except (binascii.Error, ValueError):
        return False, "DODO_PAYMENTS_WEBHOOK_KEY is not a valid whsec_ secret"

    # compare_digest, not ==, so a wrong signature can't be recovered by timing.
    for candidate in signature_header.split():
        if hmac.compare_digest(candidate, expected):
            return True, ""
    return False, "signature mismatch"


def verify_request(raw_body: bytes, headers) -> Tuple[bool, str]:
    """Convenience wrapper over a Starlette/FastAPI request's headers."""
    return verify(
        raw_body,
        headers.get("webhook-id", ""),
        headers.get("webhook-signature", ""),
        headers.get("webhook-timestamp", ""),
    )
