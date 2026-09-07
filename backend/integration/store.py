"""The two tables the Integration API owns: idempotency and audit.

Both are new tables rather than columns on existing ones, and both are created
with `CREATE TABLE IF NOT EXISTS` at startup — the same pattern
`marketing_campaigns` already uses in `main.py`. That constraint is not
cosmetic: this app reads MolarPlus's production database, SQLAlchemy's
`create_all` never ALTERs, and docs/DEPLOYMENT.md records an outage caused by a
column existing in `models.py` and not in production. New tables are safe;
altered ones are not.

**Idempotency.** The contract requires that replaying an `Idempotency-Key`
returns the original result without repeating the side effect. The sync retries
on network failure, and a lost response must not change a plan twice. Stored in
the database rather than in memory because the retry may reach a different
worker, and because a restart between the write and the retry is exactly when
this matters.

**Audit.** Twenty's own event-log module is enterprise-licensed, so operational
writes are logged here instead. That is the better place anyway: it captures
the write where it happens, with the row as it was before it, and it survives
the CRM being rebuilt.
"""
import datetime
import hashlib
import json
import logging
from typing import Any, Dict, Optional

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text, inspect

from models import Base

log = logging.getLogger("integration.store")


class IntegrationIdempotency(Base):
    __tablename__ = "integration_idempotency"

    key = Column(String(200), primary_key=True)
    # The endpoint and a hash of the body are stored alongside the key so a key
    # reused for a *different* request is a loud 409 rather than a silent
    # replay of the wrong response — the failure mode that makes idempotency
    # keys worse than none at all.
    endpoint = Column(String(120), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)
    status_code = Column(Integer, nullable=False)
    response_body = Column(JSON, nullable=True)
    # Replay must return what the first call returned, headers included. The
    # plan action reports whether it left a provider mandate behind in one, and
    # recomputing that on replay would answer about the state *after* the
    # change rather than the state the caller was told about.
    response_headers = Column(JSON, nullable=True)
    caller = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class IntegrationAuditLog(Base):
    """Every write the CRM makes to MolarPlus, and why.

    `reason` is required on suspend by the contract, because suspending cuts a
    real business off from its own software and six months later somebody will
    need to know why. `before` and `after` hold only the fields the action
    touched — enough to answer "what changed", not a row snapshot.
    """
    __tablename__ = "integration_audit_log"

    id = Column(Integer, primary_key=True)
    at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    caller = Column(String(120), nullable=False)
    action = Column(String(60), nullable=False)
    account_id = Column(String(60), nullable=True, index=True)
    clinic_id = Column(Integer, nullable=True, index=True)
    reason = Column(Text, nullable=True)
    before = Column(JSON, nullable=True)
    after = Column(JSON, nullable=True)


TABLES = (IntegrationIdempotency, IntegrationAuditLog)


def ensure_tables(engine) -> None:
    """Create the two tables if they are missing. Never alters anything."""
    try:
        existing = set(inspect(engine).get_table_names())
        for model in TABLES:
            if model.__tablename__ not in existing:
                model.__table__.create(bind=engine)
                log.info("created %s", model.__tablename__)
    except Exception as exc:  # noqa: BLE001 - a failure here must not take the API down
        log.error("integration table check failed: %s", exc)


def fingerprint(payload: Optional[Dict[str, Any]]) -> str:
    """A stable hash of a request body, so key reuse can be detected."""
    canonical = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def record(db, caller, action: str, account_id: Optional[str], clinic_id: Optional[int],
           reason: Optional[str] = None, before: Optional[dict] = None,
           after: Optional[dict] = None) -> None:
    """Write one audit row. Flushed with the caller's transaction, not committed
    here — an audit row for a change that then rolled back would be a lie."""
    db.add(IntegrationAuditLog(
        caller=getattr(caller, "label", str(caller)),
        action=action,
        account_id=account_id,
        clinic_id=clinic_id,
        reason=reason,
        before=before,
        after=after,
    ))
