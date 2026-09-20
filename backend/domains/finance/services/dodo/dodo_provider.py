"""
Dodo Payments: how clinics outside India pay.

Cashfree collects rupees from Indian clinics. Dodo collects US dollars from
everyone else, and as merchant of record it works out and remits any local
sales tax or VAT itself. So this is the dollar twin of CashfreeProvider, shaped
to fit the same rails: one order per billing period, opened at checkout and
settled by a signed webhook or by the return page, whichever lands first.

## One product, our price

A Dodo product normally carries its own price. Ours is a one-time product with
"Pay What You Want" switched on, and every checkout passes the exact amount from
core.plans. That keeps core.plans the only place a price lives. Six fixed-price
products would be a second copy of $4 / $8 / $12 in Dodo's dashboard that drifts
from the first, and our own coupons could never reach it.

`DODO_PRODUCT_ID` is that product. `DODO_PRODUCT_ID_PRO` (and _PLUS, _GROWTH)
optionally gives a plan its own product, so Dodo's receipt names the plan; each
must be set up the same way.

Set the product up in USD, tax-inclusive, with a minimum below the cheapest
thing we sell. Tax-exclusive would have Dodo add local tax on top, and the
clinic would be quoted $4 here and charged $4.80 there.
"""
import logging
import os
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

LIVE = "live_mode"
TEST = "test_mode"
_BASE_URLS = {
    LIVE: "https://live.dodopayments.com",
    TEST: "https://test.dodopayments.com",
}

# Dodo's payment status for money that has actually been taken.
SUCCEEDED = "succeeded"


def is_configured() -> bool:
    """Whether dollar checkout can be offered at all. Without a key and a
    product, an order would be refused by the gateway after the clinic had
    already clicked Pay."""
    return bool(os.getenv("DODO_PAYMENTS_API_KEY") and os.getenv("DODO_PRODUCT_ID"))


def product_for(plan_key: Optional[str]) -> Optional[str]:
    if plan_key:
        specific = os.getenv(f"DODO_PRODUCT_ID_{plan_key.upper()}")
        if specific:
            return specific
    return os.getenv("DODO_PRODUCT_ID")


def to_minor(amount: float) -> int:
    """Dollars to cents. USD only: every amount Dodo sees from us is dollars."""
    return int(round(float(amount) * 100))


def from_minor(amount) -> float:
    return round((amount or 0) / 100.0, 2)


class DodoProvider:
    """Docs: https://docs.dodopayments.com/api-reference"""

    def __init__(self):
        self.api_key = os.getenv("DODO_PAYMENTS_API_KEY")
        if not self.api_key:
            raise ValueError("Dodo Payments credentials NOT found in environment variables")
        # Test mode unless told otherwise, the same default as CASHFREE_ENV, so
        # a box missing the variable can never take real money by accident.
        self.env = os.getenv("DODO_PAYMENTS_ENV", TEST)
        self.base_url = _BASE_URLS.get(self.env, _BASE_URLS[TEST])

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _get(self, path: str) -> Dict[str, Any]:
        response = requests.get(f"{self.base_url}{path}", headers=self._headers(), timeout=10)
        response.raise_for_status()
        return response.json()

    def create_checkout(
        self,
        *,
        amount: float,
        order_id: str,
        plan_key: Optional[str],
        return_url: str,
        cancel_url: Optional[str] = None,
        customer_email: Optional[str] = None,
        customer_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Open a hosted checkout for `amount` US dollars.

        Returns Dodo's response: `session_id` and `checkout_url`.
        """
        product_id = product_for(plan_key)
        if not product_id:
            raise ValueError("DODO_PRODUCT_ID is not set")

        payload: Dict[str, Any] = {
            # `amount` is only honoured on a Pay What You Want product. On a
            # fixed-price one Dodo silently charges the product's own price
            # instead, which is why the product must be set up as described at
            # the top of this module.
            "product_cart": [{"product_id": product_id, "quantity": 1, "amount": to_minor(amount)}],
            "return_url": return_url,
            # Charged in dollars, and only dollars: the clinic was quoted in
            # dollars on our checkout screen, and a currency picker on theirs
            # would put a different number in front of them at the last step.
            "billing_currency": "USD",
            "feature_flags": {
                "allow_currency_selection": False,
                # Our coupons are applied before the amount reaches Dodo. A
                # second discount field on their page would be one we never
                # see, and the payment would no longer match what we booked.
                "allow_discount_code": False,
                # Straight back to our page, as Cashfree does, where the order
                # is verified and the plan switched on.
                "redirect_immediately": True,
            },
            # Our order id rides along so the webhook can find the order it
            # settles, and the rest so an order that was superseded by a later
            # checkout can still be settled correctly (see subscription_service).
            "metadata": {"order_id": order_id, **(metadata or {})},
        }
        if cancel_url:
            payload["cancel_url"] = cancel_url
        if customer_email and "@" in customer_email:
            payload["customer"] = {"email": customer_email, **({"name": customer_name} if customer_name else {})}

        response = requests.post(f"{self.base_url}/checkouts", headers=self._headers(), json=payload, timeout=15)
        if response.status_code >= 400:
            logger.error("dodo checkout for %s failed (%s): %s", order_id, response.status_code, response.text)
        response.raise_for_status()
        return response.json()

    def get_checkout(self, session_id: str) -> Dict[str, Any]:
        """`payment_id` and `payment_status`, both null until the clinic has
        entered its details and paid."""
        return self._get(f"/checkouts/{session_id}")

    def get_payment(self, payment_id: str) -> Dict[str, Any]:
        return self._get(f"/payments/{payment_id}")
