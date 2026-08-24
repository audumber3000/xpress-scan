import os
import hashlib
import hmac
import requests
import json
from typing import Dict, Any, Optional
from datetime import datetime
from ..payment_provider import BasePaymentProvider

class CashfreeProvider(BasePaymentProvider):
    """
    Cashfree implementation of the Payment Provider
    Docs: https://www.cashfree.com/docs/payments/overview
    """
    
    def __init__(self):
        self.app_id = os.getenv("CASHFREE_APP_ID")
        self.secret_key = os.getenv("CASHFREE_SECRET_KEY")
        self.env = os.getenv("CASHFREE_ENV", "sandbox") # sandbox or production
        
        if not self.app_id or not self.secret_key:
            raise ValueError("Cashfree credentials NOT found in environment variables")
            
        if self.env == "production":
            self.base_url = "https://api.cashfree.com/pg"
        else:
            self.base_url = "https://sandbox.cashfree.com/pg"

    def _get_headers(self):
        return {
            "x-client-id": self.app_id,
            "x-client-secret": self.secret_key,
            "x-api-version": "2023-08-01",
            "Content-Type": "application/json"
        }

    def create_customer(self, name: str, email: str, phone: str, notes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        # Cashfree doesn't strictly require a pre-created customer for sessions/orders,
        # but we can return a unified structure or use their Customer API if needed.
        return {
            "customer_id": phone, # Using phone as default ID
            "customer_name": name,
            "customer_email": email,
            "customer_phone": phone
        }

    def create_order(self, amount: float, customer_id: str, order_id: str, notes: Optional[Dict[str, Any]] = None, currency: str = "INR") -> Dict[str, Any]:
        """
        Create a Cashfree Order.

        `currency` defaults to INR, which is what every existing caller (wallet
        top-ups, Indian subscriptions) wants and what this used to hardcode.
        Anything else requires international collections to be enabled on the
        Cashfree account; see core.plans and CASHFREE_INTERNATIONAL_ENABLED.
        """
        url = f"{self.base_url}/orders"
        
        # Sanitize phone: must be string, digits only, usually 10 for India
        phone = notes.get("phone", "") if notes else "9999999999"
        if not phone:
            phone = "9999999999" # Fallback if missing
        
        # Remove any non-digit characters
        phone = "".join(filter(str.isdigit, str(phone)))
        if len(phone) > 10:
            phone = phone[-10:] # Take last 10 digits
        elif len(phone) < 10:
            phone = phone.zfill(10) # Pad with zeros if too short
            
        email = notes.get("email", "") if notes else "support@molarplus.com"
        if not email or "@" not in email:
            email = "support@molarplus.com" # Fallback
            
        # Cashfree requires {order_id} placeholder in return_url
        return_url = (notes.get("return_url") if notes else None) or os.getenv("CASHFREE_RETURN_URL", "http://localhost:5173/subscription")
        if "{order_id}" not in return_url:
            separator = "&" if "?" in return_url else "?"
            return_url = f"{return_url}{separator}order_id={{order_id}}"

        notify_url = (notes.get("notify_url") if notes else None) or os.getenv("CASHFREE_NOTIFY_URL", "https://api.molarplus.com/api/v1/subscriptions/webhook/cashfree")

        payload = {
            "order_amount": round(float(amount), 2),
            "order_currency": (currency or "INR").upper(),
            "order_id": order_id,
            "customer_details": {
                "customer_id": str(customer_id),
                "customer_phone": phone,
                "customer_email": email
            },
            "order_meta": {
                "return_url": return_url,
                "notify_url": notify_url
            },
            "order_note": notes.get("plan", "Pro Plan Subscription") if notes else "Pro Plan Subscription"
        }
        
        print(f"DEBUG: Cashfree Request Payload: {json.dumps(payload)}")
        
        response = requests.post(url, headers=self._get_headers(), json=payload, timeout=10)
        
        if response.status_code != 200 and response.status_code != 201:
            print(f"DEBUG: Cashfree Error Response ({response.status_code}): {response.text}")
            
        response.raise_for_status()
        return response.json()

    def create_subscription(self, customer_id: str, plan_id: str, notes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Cashfree Subscriptions API (v2) implementation
        Note: Subscriptions usually require a separate setup in Cashfree compared to PG.
        For simple ₹1200/month as requested, we can also use recurring payments if enabled.
        """
        # Placeholder for actual Subscriptions API if the user wants true auto-recurring
        # For now, let's assume we are doing a session-based checkout for the first month.
        return {"message": "Cashfree Subscription API integration in progress"}

    def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        url = f"{self.base_url}/orders/{subscription_id}"
        response = requests.get(url, headers=self._get_headers(), timeout=10)
        response.raise_for_status()
        return response.json()

    def cancel_subscription(self, subscription_id: str, current_cycle: bool = True) -> Dict[str, Any]:
        # Placeholder
        return {"status": "cancelled", "message": "Subscription cancelled locally"}

    def verify_webhook_signature(self, payload: str, signature: str, secret: str) -> bool:
        """Deprecated — use core.cashfree_webhook.verify() at the route.

        This used to `return True` unconditionally while claiming to verify. It
        had no callers, but any future one would have silently accepted forged
        payloads. It now delegates to the real implementation.

        The real check needs the raw request BYTES and the timestamp header,
        which this signature cannot express, so callers should use
        core.cashfree_webhook directly.
        """
        from core.cashfree_webhook import verify

        raw = payload.encode() if isinstance(payload, str) else payload
        ok, _ = verify(raw, signature, "")
        return ok
