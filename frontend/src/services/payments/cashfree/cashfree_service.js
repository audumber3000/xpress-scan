import { api } from '../../../utils/api';
import { load } from '@cashfreepayments/cashfree-js';

class CashfreeService {
    constructor() {
        this.cashfree = null;
    }

    async getCashfree() {
        if (this.cashfree) return this.cashfree;
        
        // Initialize Cashfree SDK
        // In production, use 'production', in development use 'sandbox'
        const isProd = window.location.hostname !== 'localhost';
        this.cashfree = await load({
            mode: isProd ? "production" : "sandbox"
        });
        return this.cashfree;
    }

    async initiateCheckout(planName = 'professional', couponCode = null) {
        try {
            // 1. Create checkout session on backend
            const sessionData = await api.post('/subscriptions/checkout', {
                plan_name: planName,
                coupon_code: couponCode
            });

            if (!sessionData.payment_session_id) {
                console.error("Session data:", sessionData);
                throw new Error("Failed to create payment session - check server logs");
            }

            // 2. Open Cashfree Checkout
            const cashfree = await this.getCashfree();
            let checkoutOptions = {
                paymentSessionId: sessionData.payment_session_id,
                redirectTarget: "_self", // Opens in same tab
            };

            return cashfree.checkout(checkoutOptions);
        } catch (error) {
            console.error("Cashfree Checkout Error:", error);
            throw error;
        }
    }
}

export const cashfreeService = new CashfreeService();
