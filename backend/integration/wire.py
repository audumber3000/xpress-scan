"""Contract primitives: money, timestamps, identifiers, cursors, errors.

Nothing in here knows what a clinic is. The whole point of the Integration API
is that the CRM receives the same shapes from every ClinoHealth product, so the
encoding rules live in one product-neutral module and the MolarPlus-specific
mapping happens elsewhere.

See docs/INTEGRATION_API.md § Conventions — this file is that section, executable.
"""
import base64
import binascii
import datetime
import json
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Query
from sqlalchemy import tuple_

MICROS = 1_000_000

DEFAULT_LIMIT = 200
MAX_LIMIT = 1000


class ContractError(Exception):
    """An error in the contract's own envelope.

    FastAPI's HTTPException renders `{"detail": ...}`, which is the shape the
    support console's own routes use. The contract specifies
    `{"error": {"code", "message", "details"}}` — a stable machine-readable
    `code` is the part that matters, because the sync branches on it.
    """

    def __init__(self, status: int, code: str, message: str, details: Optional[dict] = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}

    def body(self) -> dict:
        return {"error": {"code": self.code, "message": self.message, "details": self.details}}


def not_found(what: str, ident: str) -> ContractError:
    return ContractError(404, "{}_not_found".format(what), "No {} with id {}".format(what, ident))


# ── Timestamps ───────────────────────────────────────────────────────────────
#
# RFC 3339, always UTC, always with the Z suffix. The database holds naive
# datetimes that are already UTC, so formatting is a suffix and parsing is a
# conversion back to naive — do not let an aware datetime reach a query, or
# Postgres compares a timestamptz against a timestamp and the answer is silently
# shifted by the server's timezone.

def to_rfc3339(value: Optional[datetime.datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return value.replace(microsecond=value.microsecond).strftime("%Y-%m-%dT%H:%M:%S") + (
        ".{:06d}Z".format(value.microsecond) if value.microsecond else "Z"
    )


def parse_rfc3339(raw: Optional[str], field: str = "updated_since") -> Optional[datetime.datetime]:
    """Parse an RFC 3339 timestamp into naive UTC, or raise a 400.

    A malformed `updated_since` must not be treated as absent: that would
    silently return a full snapshot where the caller asked for a delta, and the
    caller would have no way to tell.
    """
    if raw is None or raw == "":
        return None
    text = raw.strip()
    if text.endswith(("Z", "z")):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.datetime.fromisoformat(text)
    except ValueError:
        raise ContractError(
            400, "bad_timestamp",
            "{} must be an RFC 3339 timestamp, e.g. 2026-09-04T10:15:00Z".format(field),
            {"field": field, "value": raw},
        )
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return parsed


def utcnow() -> datetime.datetime:
    return datetime.datetime.utcnow()


# ── Money ────────────────────────────────────────────────────────────────────

def money(amount: Optional[float], currency: Optional[str]) -> Optional[Dict[str, Any]]:
    """`{amount_micros, currency}`, or None.

    None means **unknown**; zero means **zero**. They are different, and for
    `tax_amount` and `discount_amount` on payments taken before those columns
    existed the honest answer is None. Sending 0 to tidy the response turns
    "never recorded" into "there was no tax", and every net-revenue figure
    downstream inherits the error permanently.
    """
    if amount is None:
        return None
    return {
        "amount_micros": int(round(float(amount) * MICROS)),
        "currency": (currency or "INR").upper(),
    }


def micros(amount_micros: int, currency: str) -> Dict[str, Any]:
    """The same shape, for values already computed in micros."""
    return {"amount_micros": int(amount_micros), "currency": (currency or "INR").upper()}


# ── Identifiers ──────────────────────────────────────────────────────────────

def ext_id(value: Any) -> Optional[str]:
    """Every id on the wire is a string, even where the product stores an int.

    The CRM keys `Company.externalIds` on it and must not care whether the next
    product uses UUIDs.
    """
    return None if value is None else str(value)


# ── Cursors ──────────────────────────────────────────────────────────────────
#
# Keyset pagination on `(sort_timestamp, id)`, both encoded. Offset pagination
# is not usable here: the sync pages through a table that is being written to,
# and an offset shifts under an insert, silently skipping a record.
#
# The cursor is opaque to the caller by contract. It is base64url JSON rather
# than something signed because it encodes nothing the caller cannot already
# see, and a tamper-proof cursor would still have to survive a rolling deploy.

def encode_cursor(sort_value: Optional[datetime.datetime], row_id: Any) -> str:
    payload = json.dumps({"t": to_rfc3339(sort_value), "i": str(row_id)}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(raw: Optional[str]) -> Optional[Tuple[Optional[datetime.datetime], str]]:
    if not raw:
        return None
    padded = raw + "=" * (-len(raw) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        return parse_rfc3339(payload["t"], "cursor"), str(payload["i"])
    except (ValueError, KeyError, TypeError, binascii.Error, UnicodeDecodeError):
        raise ContractError(400, "bad_cursor", "cursor is not one this endpoint issued", {"cursor": raw})


def limit_param(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT,
                       description="The server may return fewer; never more."),
) -> int:
    return limit


def _as_id_type(id_expr, value: str):
    """Cast the id half of a cursor back to the column's own type.

    Ids travel as strings by contract, so a cursor over an integer primary key
    comes back as "42". Postgres will not compare that against an integer
    column, and the failure is a 500 on page two of a sync that worked on
    page one.
    """
    try:
        if getattr(id_expr.type, "python_type", None) is int:
            return int(value)
    except (NotImplementedError, AttributeError, ValueError):
        pass
    return value


def apply_keyset(query, sort_expr, id_expr, cursor: Optional[str]):
    """Order by `(sort_expr, id_expr)` and resume after `cursor`.

    The composite comparison is what makes the cursor stable under concurrent
    writes: paging on the timestamp alone either skips or repeats every record
    that shares a timestamp with the last one on the previous page, and bulk
    imports produce a great many of those.

    `sort_expr` is expected to be non-nullable — every caller wraps a nullable
    column in COALESCE — because a NULL on either side of a row comparison
    makes it neither true nor false, and the page would come back empty.
    """
    position = decode_cursor(cursor)
    query = query.order_by(sort_expr.asc(), id_expr.asc())
    if position is not None:
        after_ts, after_id = position
        if after_ts is None:
            raise ContractError(400, "bad_cursor", "cursor carries no position", {"cursor": cursor})
        query = query.filter(tuple_(sort_expr, id_expr) > (after_ts, _as_id_type(id_expr, after_id)))
    return query


def envelope(rows: List[Any], limit: int, serialise, key_of) -> Dict[str, Any]:
    """The envelope every list endpoint returns.

    Callers fetch `limit + 1` rows; the extra one is never serialised, it only
    answers `has_more` without a second COUNT against a table the sync is about
    to read again anyway.

    `serialise` takes the whole visible page rather than one row at a time,
    because the batch is what makes the roll-ups cheap: an account's owner and
    trial flag are one query for the page, not one per account.

    `key_of` returns `(sort_value, id)` for a row — the same pair the ORDER BY
    used, or the cursor points somewhere the next page will not resume from.
    """
    has_more = len(rows) > limit
    visible = rows[:limit]
    return {
        "data": serialise(visible),
        "next_cursor": encode_cursor(*key_of(visible[-1])) if has_more and visible else None,
        "has_more": has_more,
    }
