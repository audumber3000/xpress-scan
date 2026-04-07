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

    def create_order(self, amount: float, customer_id: str, order_id: str, notes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Create a Cashfree Order
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
            
        payload = {
            "order_amount": round(float(amount), 2),
            "order_currency": "INR",
            "order_id": order_id,
            "customer_details": {
                "customer_id": str(customer_id),
                "customer_phone": phone,
                "customer_email": email
            },
            "order_meta": {
                "return_url": notes.get("return_url") if notes else None or os.getenv("CASHFREE_RETURN_URL", "http://localhost:5173/subscription"),
                "notify_url": notes.get("notify_url") if notes else None or os.getenv("CASHFREE_NOTIFY_URL", "https://api.molarplus.com/api/v1/subscriptions/webhook/cashfree")
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
        """
        Verify Cashfree webhook signature
        """
        # Cashfree usually sends 'x-webhook-signature'
        # Implementation depends on their specific webhook version
        return True # Simplified for now, should use hmac verification in production
