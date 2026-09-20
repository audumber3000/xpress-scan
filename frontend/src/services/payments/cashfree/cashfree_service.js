import { load } from '@cashfreepayments/cashfree-js';

/**
 * Cashfree's checkout, for rupee orders. Opening the order is the server's job
 * and deciding which gateway to use is services/payments/checkout.js's; this
 * only takes a payment session the server already created and shows it.
 */
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

    async open(paymentSessionId) {
        try {
            const cashfree = await this.getCashfree();
            return cashfree.checkout({
                paymentSessionId,
                redirectTarget: "_self", // Opens in same tab
            });
        } catch (error) {
            console.error("Cashfree Checkout Error:", error);
            throw error;
        }
    }
}

export const cashfreeService = new CashfreeService();
