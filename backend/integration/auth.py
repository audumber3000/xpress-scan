"""Service-token auth for `/integration/*`, and nothing else.

The contract asks for a single token per product, issued to the CRM. Not an
admin user's credentials: it has to be revocable without locking a person out,
and it has to appear in MolarPlus's own audit log as the CRM rather than as a
human. So this is deliberately a separate mechanism from `routes/auth.py` — the
console's JWTs are not accepted here, and these tokens are not accepted there.

Two scopes, because the contract distinguishes 401 from 403 and a 403 has to be
reachable to mean anything:

    INTEGRATION_TOKENS           read + actions   (the logic functions)
    INTEGRATION_READONLY_TOKENS  read only        (the sync orchestrator)

The orchestrator pulls on a schedule and never needs to change a plan or
suspend anybody, so it gets a token that cannot. Both are comma-separated lists
so a token can be rotated without a window where neither works, and each entry
may carry a label:

    INTEGRATION_TOKENS="crm-sync=s3cr3t,ops-console=0th3r"

The label is what lands in the audit log. The secret never does, and never
reaches a log line anywhere in this package.
"""
import hmac
import logging
import os
from typing import Dict, Optional, Tuple

from fastapi import Header

from .wire import ContractError

log = logging.getLogger("integration.auth")

SCOPE_READ = "read"
SCOPE_WRITE = "write"


def _parse(raw: Optional[str]) -> Dict[str, str]:
    """`"label=secret,secret2"` → `{secret: label}`.

    Keyed on the secret because that is what a request presents. An entry with
    no `=` is a bare secret and is labelled `crm`.
    """
    tokens = {}
    for entry in (raw or "").split(","):
        entry = entry.strip()
        if not entry:
            continue
        label, _, secret = entry.partition("=")
        if not secret:
            label, secret = "crm", label
        tokens[secret] = label.strip() or "crm"
    return tokens


def _configured() -> Tuple[Dict[str, str], Dict[str, str]]:
    # Read at call time rather than import time: the process loads .env before
    # the app starts, and reading here also means a token rotation needs a
    # restart rather than a redeploy.
    return (
        _parse(os.getenv("INTEGRATION_TOKENS")),
        _parse(os.getenv("INTEGRATION_READONLY_TOKENS")),
    )


def _match(presented: str, tokens: Dict[str, str]) -> Optional[str]:
    """Constant-time lookup. `dict.get` would leak the secret's length through
    timing; comparing every entry with `compare_digest` does not."""
    found = None
    for secret, label in tokens.items():
        if hmac.compare_digest(presented, secret):
            found = label
    return found


class Caller(object):
    """Who is calling, for the audit log. Never holds the secret."""

    def __init__(self, label: str, scope: str):
        self.label = label
        self.scope = scope

    def __repr__(self):
        return "Caller({!r}, {!r})".format(self.label, self.scope)


def _authenticate(authorization: Optional[str]) -> Caller:
    full, readonly = _configured()
    if not full and not readonly:
        # Fail closed, and say why. An unconfigured token store must never read
        # as "no auth required" — that is how an internal API ends up open.
        log.error("INTEGRATION_TOKENS is unset; refusing every /integration request")
        raise ContractError(
            503, "integration_not_configured",
            "The Integration API has no service token configured on this deployment.",
        )

    scheme, _, presented = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not presented.strip():
        raise ContractError(401, "unauthenticated", "Authorization: Bearer <service-token> is required")
    presented = presented.strip()

    label = _match(presented, full)
    if label:
        return Caller(label, SCOPE_WRITE)
    label = _match(presented, readonly)
    if label:
        return Caller(label, SCOPE_READ)
    raise ContractError(401, "unauthenticated", "Service token not recognised")


def require_read(authorization: Optional[str] = Header(None)) -> Caller:
    return _authenticate(authorization)


def require_write(authorization: Optional[str] = Header(None)) -> Caller:
    caller = _authenticate(authorization)
    if caller.scope != SCOPE_WRITE:
        raise ContractError(
            403, "insufficient_scope",
            "This token may read the Integration API but not act on it.",
            {"scope": caller.scope},
        )
    return caller
