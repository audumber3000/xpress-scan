"""MolarPlus's implementation of the ClinoHealth Integration API.

    docs/INTEGRATION_API.md              the reasoning
    docs/integration-api.openapi.yaml    the shapes
    crm-app/                             what the CRM does with them

One contract, implemented by every ClinoHealth product. The CRM's sync
orchestrator is written once against it and takes a per-product config, so
adding brand #4 is a config entry rather than code. If implementing this for a
second product needs the orchestrator changed, the contract was wrong and the
contract is what gets fixed.

Mounted at `/integration/v1`. The version is in the path because a breaking
change means `v2` alongside `v1`, never an edit to `v1` — two products can sit
on different versions during a migration.

    auth.py        service tokens, read and write scopes
    wire.py        money, timestamps, ids, cursors, the error envelope
    vocab.py       MolarPlus's values -> the contract's shared enums
    org.py         the parent-clinic shim: what counts as an account
    plans mirror   core/plans.py — tier, cycle, entitlement, MRR
    aggregates.py  counts and sums, never the rows beneath them
    shapes.py      rows -> the shapes the OpenAPI spec declares
    reads.py       the bulk pull
    panels.py      the four per-account support panels, rendered not synced
    marketing.py   discount codes and broadcast history
    actions.py     the writes, idempotent and audited
    store.py       the idempotency and audit tables

Nothing in this package is reachable from the support console's own routes, and
nothing in those routes is reachable from here. That separation is the point:
the console is a UI backend, this is a stable interface another system depends
on, and they have different reasons to change.
"""
from fastapi import APIRouter

from . import actions, marketing, panels, reads

PREFIX = "/integration/v1"

router = APIRouter()
router.include_router(reads.router)
router.include_router(panels.router)
router.include_router(marketing.router)
router.include_router(actions.router)

__all__ = ["router", "PREFIX"]
