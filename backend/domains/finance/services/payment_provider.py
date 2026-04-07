from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BasePaymentProvider(ABC):
    """
    Abstract base class for payment providers (Razorpay, Cashfree, etc.)
    """
    
    @abstractmethod
    def create_customer(self, name: str, email: str, phone: str, notes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a customer in the payment gateway"""
        pass
    
    @abstractmethod
    def create_subscription(self, customer_id: str, plan_id: str, notes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create a subscription in the payment gateway"""
        pass
    
    @abstractmethod
    def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Get subscription details from the payment gateway"""
        pass
    
    @abstractmethod
    def cancel_subscription(self, subscription_id: str, current_cycle: bool = True) -> Dict[str, Any]:
        """Cancel a subscription in the payment gateway"""
        pass
    
    @abstractmethod
    def verify_webhook_signature(self, payload: str, signature: str, secret: str) -> bool:
        """Verify the webhook signature from the payment gateway"""
        pass

    @abstractmethod
    def create_order(self, amount: float, customer_id: str, order_id: str, notes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create an order for standard checkout (non-recurring)"""
        pass
