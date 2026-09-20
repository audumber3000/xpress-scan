"""Which payment gateway a clinic pays through.

Decided by billing currency and nothing else, so it can never disagree with the
price the clinic was shown: rupees go through Cashfree, dollars through Dodo
Payments. core.plans decides the currency; this only maps it.

Mirrored for display in frontend/src/utils/plans.js (`paymentGateway`). The
checkout follows whatever the server answers, so the mirror only ever affects
wording.
"""
from core import plans

CASHFREE = "cashfree"
DODO = "dodo"


def for_currency(currency: str) -> str:
    return CASHFREE if currency == plans.INR else DODO


def for_clinic(clinic) -> str:
    return for_currency(plans.billing_currency(clinic))


def available(gateway: str) -> bool:
    """Cashfree is always set up; the backend refuses to boot without it
    (preflight). Dodo is optional until its keys are in the environment."""
    if gateway == DODO:
        from domains.finance.services.dodo.dodo_provider import is_configured
        return is_configured()
    return True
