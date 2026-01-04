import os
import razorpay
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import json

class RazorpayService:
    """Service for managing Razorpay subscriptions"""
    
    def __init__(self):
        self.key_id = os.getenv("RAZORPAY_KEY_ID")
        self.key_secret = os.getenv("RAZORPAY_KEY_SECRET")
        
        if not self.key_id or not self.key_secret:
            raise ValueError("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables")
        
        self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
        
        # Plan IDs mapping (configure these in Razorpay dashboard)
        self.PLANS = {
            "professional": os.getenv("RAZORPAY_PLAN_PROFESSIONAL", "plan_professional_monthly"),
            "enterprise": os.getenv("RAZORPAY_PLAN_ENTERPRISE", "plan_enterprise_monthly"),
        }
    
    def create_customer(self, name: str, email: str, contact: Optional[str] = None, notes: Optional[Dict] = None) -> Dict[str, Any]:
        """Create a Razorpay customer"""
        try:
            customer_data = {
                "name": name,
                "email": email,
            }
            
            if contact:
                customer_data["contact"] = contact
            if notes:
                customer_data["notes"] = notes
            
            customer = self.client.customer.create(customer_data)
            return customer
        except Exception as e:
            raise Exception(f"Error creating Razorpay customer: {str(e)}")
    
    def create_subscription(self, customer_id: str, plan_id: str, total_count: int = 12, start_at: Optional[int] = None) -> Dict[str, Any]:
        """
        Create a subscription in Razorpay
        total_count: Number of billing cycles (use 999999 for indefinite)
        start_at: Unix timestamp for subscription start (None for immediate start)
        """
        try:
            subscription_data = {
                "plan_id": plan_id,
                "customer_notify": 1,
                "total_count": total_count,  # 999999 for indefinite monthly billing
                "quantity": 1,
            }
            
            if start_at:
                subscription_data["start_at"] = start_at
            
            subscription = self.client.subscription.create(subscription_data)
            return subscription
        except Exception as e:
            raise Exception(f"Error creating Razorpay subscription: {str(e)}")
    
    def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Get subscription details from Razorpay"""
        try:
            subscription = self.client.subscription.fetch(subscription_id)
            return subscription
        except Exception as e:
            raise Exception(f"Error fetching Razorpay subscription: {str(e)}")
    
    def pause_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Pause a subscription"""
        try:
            subscription = self.client.subscription.pause(subscription_id, {"pause_at": "now"})
            return subscription
        except Exception as e:
            raise Exception(f"Error pausing Razorpay subscription: {str(e)}")
    
    def resume_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Resume a paused subscription"""
        try:
            subscription = self.client.subscription.resume(subscription_id, {"resume_at": "now"})
            return subscription
        except Exception as e:
            raise Exception(f"Error resuming Razorpay subscription: {str(e)}")
    
    def cancel_subscription(self, subscription_id: str, cancel_at_cycle_end: bool = False) -> Dict[str, Any]:
        """
        Cancel a subscription
        cancel_at_cycle_end: If True, cancel at end of current billing cycle. If False, cancel immediately.
        """
        try:
            if cancel_at_cycle_end:
                subscription = self.client.subscription.cancel(subscription_id, {"cancel_at_cycle_end": 1})
            else:
                subscription = self.client.subscription.cancel(subscription_id)
            return subscription
        except Exception as e:
            raise Exception(f"Error cancelling Razorpay subscription: {str(e)}")
    
    def get_all_subscriptions(self, customer_id: Optional[str] = None, count: int = 10, skip: int = 0) -> Dict[str, Any]:
        """Get all subscriptions, optionally filtered by customer"""
        try:
            params = {"count": count, "skip": skip}
            if customer_id:
                params["customer_id"] = customer_id
            
            subscriptions = self.client.subscription.all(params)
            return subscriptions
        except Exception as e:
            raise Exception(f"Error fetching subscriptions: {str(e)}")
    
    def verify_webhook_signature(self, payload: str, signature: str, secret: str) -> bool:
        """Verify Razorpay webhook signature"""
        try:
            self.client.utility.verify_webhook_signature(payload, signature, secret)
            return True
        except Exception as e:
            return False
    
    def get_plan_id(self, plan_name: str) -> Optional[str]:
        """Get Razorpay plan ID for a plan name"""
        return self.PLANS.get(plan_name)
    
    @staticmethod
    def parse_subscription_status(razorpay_status: str) -> str:
        """Map Razorpay subscription status to our status"""
        status_mapping = {
            "created": "active",
            "authenticated": "active",
            "active": "active",
            "pending": "active",
            "halted": "paused",
            "paused": "paused",
            "cancelled": "cancelled",
            "completed": "expired",
            "expired": "expired"
        }
        return status_mapping.get(razorpay_status, "active")



