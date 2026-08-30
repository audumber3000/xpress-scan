"""
The freshness check that rejected every Cashfree payment for three weeks.

Cashfree signs PG webhooks with `x-webhook-timestamp` in MILLISECONDS. The check
read it as seconds, so a payload signed one second ago looked ~56,000 years in
the future and failed the window. From 2026-08-08 (when the check landed) to
2026-08-30 every delivery was rejected 401, and one real payment was lost:
clinic 204 paid Rs 470.82 on 2026-08-29 and all eight attempts bounced.

The signature was never wrong — it is taken over the raw string as sent. Only
the age comparison lacked a unit.
"""
import base64
import hashlib
import hmac
import time

import pytest

from core import cashfree_webhook as cw


SECRET = "test-secret"


def _sign(timestamp: str, body: bytes) -> str:
    return base64.b64encode(
        hmac.new(SECRET.encode(), timestamp.encode() + body, hashlib.sha256).digest()
    ).decode()


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("CASHFREE_WEBHOOK_SECRET", SECRET)


def test_millisecond_timestamp_is_accepted():
    """The unit Cashfree actually sends."""
    body = b'{"data":{"order":{"order_id":"SUB_1_1_abc"}}}'
    ts = str(int(time.time() * 1000))
    ok, reason = cw.verify(body, _sign(ts, body), ts)
    assert ok, reason


def test_second_timestamp_is_still_accepted():
    """Kept working so a gateway changing units cannot repeat the outage."""
    body = b'{"data":{"order":{"order_id":"SUB_1_1_abc"}}}'
    ts = str(int(time.time()))
    ok, reason = cw.verify(body, _sign(ts, body), ts)
    assert ok, reason


def test_the_exact_prod_value_is_no_longer_in_the_future():
    """1787994269280 is the header from clinic 204's lost payment.

    It was reported as 1,786,206,275,096 seconds in the future. Read as
    milliseconds it is 2026-08-29 09:04:29 UTC, 85 seconds after the order was
    created, which is exactly when the customer finished paying.
    """
    age = cw._age_seconds("1787994269280")
    assert age > 0, "a real past payment must not read as future-dated"
    assert cw._age_seconds("1787994269280") == pytest.approx(
        time.time() - 1787994269.280, abs=2
    )


def test_a_genuinely_future_timestamp_is_still_refused():
    """The freshness check must still do its job in the right unit."""
    body = b"{}"
    ts = str(int((time.time() + cw.MAX_AGE_SECONDS * 3) * 1000))
    ok, reason = cw.verify(body, _sign(ts, body), ts)
    assert not ok
    assert "future" in reason


def test_a_stale_timestamp_is_still_refused():
    body = b"{}"
    ts = str(int((time.time() - cw.MAX_AGE_SECONDS * 3) * 1000))
    ok, reason = cw.verify(body, _sign(ts, body), ts)
    assert not ok
    assert "too old" in reason


def test_a_wrong_signature_is_still_refused():
    """The unit fix must not have loosened the thing that actually matters."""
    body = b'{"data":{"order":{"order_id":"SUB_1_1_abc"}}}'
    ts = str(int(time.time() * 1000))
    ok, _ = cw.verify(body, _sign(ts, b"different body"), ts)
    assert not ok


def test_missing_signature_still_fails_closed():
    ts = str(int(time.time() * 1000))
    ok, _ = cw.verify(b"{}", "", ts)
    assert not ok
