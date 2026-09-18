import { api } from '../../utils/api';
import { cashfreeService } from './cashfree/cashfree_service';

/**
 * Start paying for a plan or an add-on.
 *
 * The server picks the gateway from the clinic's billing currency
 * (core/payment_gateways.py), and this follows its answer rather than
 * guessing: rupees open Cashfree's checkout with a payment session, dollars go
 * to Dodo Payments' hosted page by its checkout URL. Either way the payer comes
 * back to /subscription?order_id=..., where the order is verified.
 */
async function open(session) {
  if (session.provider === 'dodo') {
    if (!session.checkout_url) {
      throw new Error('Failed to create payment session - check server logs');
    }
    window.location.href = session.checkout_url;
    return;
  }
  if (!session.payment_session_id) {
    throw new Error('Failed to create payment session - check server logs');
  }
  return cashfreeService.open(session.payment_session_id);
}

export async function startPlanCheckout(planName, couponCode = null) {
  const session = await api.post('/subscriptions/checkout', {
    plan_name: planName,
    coupon_code: couponCode,
  });
  return open(session);
}

/** An add-on for the clinic currently selected. Same gateways, its own order. */
export async function startAddonCheckout(addonKey, cycle = 'monthly') {
  const session = await api.post('/subscriptions/addons/checkout', {
    addon_key: addonKey,
    cycle,
  });
  return open(session);
}
