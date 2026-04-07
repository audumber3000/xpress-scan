import { BaseApiService } from '../../../../services/api/base.api';

export interface CheckoutResponse {
  payment_session_id: string;
  order_id: string;
  provider: string;
}

export interface VerifyResponse {
  success: boolean;
  status: string;
  message: string;
}

class PaymentService extends BaseApiService {
  async createCheckoutSession(planName: string, couponCode?: string): Promise<CheckoutResponse> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}/subscriptions/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        plan_name: planName,
        coupon_code: couponCode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create checkout session');
    }

    return response.json();
  }

  async verifyPaymentStatus(orderId: string): Promise<VerifyResponse> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseURL}/subscriptions/verify-status?order_id=${orderId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to verify payment status');
    }

    return response.json();
  }
}

export const paymentService = new PaymentService();
