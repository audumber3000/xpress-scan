"""Everything the Integration API needs from `main.py`, in one call.

    from integration.mount import mount_integration_api
    mount_integration_api(app)

Two lines in `main.py`, and nothing else about the CRM contract anywhere near
the product's own routes. That separation is deliberate and worth keeping: the
callers are different (another system, not a person), the auth is different
(service tokens, not a user's JWT), the error envelope is different, and the
versioning is different — a breaking change here means `/integration/v2`
alongside `/v1`, while the product's own APIs carry on unversioned.

If this file grows a product-specific branch, that belongs in the package
below, not here.
"""
from fastapi import FastAPI
from fastapi.responses import JSONResponse

import integration
from integration.wire import ContractError


def mount_integration_api(app: FastAPI) -> None:
    app.include_router(integration.router, prefix=integration.PREFIX,
                       tags=["Integration"])

    @app.exception_handler(ContractError)
    def _contract_error(request, exc: ContractError):
        """The contract's error envelope, which is not FastAPI's.

        Product routes answer with {"detail": ...}; the contract specifies
        {"error": {"code", "message", "details"}} because the sync branches on a
        stable machine-readable `code`. Only this exception type is remapped, so
        every other route keeps the shape its clients already expect.
        """
        return JSONResponse(status_code=exc.status, content=exc.body())

    @app.on_event("startup")
    def _ensure_integration_tables():
        """Create the idempotency ledger and audit log if they are missing.

        CREATE TABLE IF NOT EXISTS only — never an ALTER against the production
        schema. A failure here is logged rather than raised: the product must
        still boot and serve patients if the CRM's bookkeeping tables cannot be
        created.
        """
        try:
            from database import engine
            from integration.store import ensure_tables
            ensure_tables(engine)
        except Exception as error:  # pragma: no cover - boot diagnostics only
            print(f"[integration] table check failed: {error}")
