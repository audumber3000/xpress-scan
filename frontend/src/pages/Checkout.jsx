import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { notify } from '../utils/notify';
import { api } from '../utils/api';
import { track, EVENTS } from '../analytics/track';
import { ChevronLeft, ShieldCheck, Lock, Tag, CheckCircle2, ArrowRight, X } from 'lucide-react';
import GearLoader from '../components/GearLoader';
import { cashfreeService } from '../services/payments/cashfree/cashfree_service';
import PaymentMarks from '../components/payments/PaymentMarks';
import PaymentHelp from '../components/payments/PaymentHelp';
import { PLAN, inr, localEstimateLabel, needsLocalEstimate } from '../utils/pricing';

/**
 * Checkout.
 *
 * Two things were wrong with the screen this replaces, one cosmetic and one not.
 *
 * The cosmetic one: two tall cards floating in a very wide grey field, a coupon
 * box louder than the payment method, the same amount printed twice at equal
 * weight, and a "secured by" logo hotlinked from cashfree.com that returns 403.
 *
 * The one that mattered: it hardcoded 899 and rendered it against
 * getCurrencySymbol(), which is the currency the clinic *bills patients in*. A
 * Canadian clinic was shown "$899" for a charge that lands as ₹899, roughly
 * CA$14.60, having just been quoted $10 on the previous screen. Amounts now
 * come from pricing.js, are always labelled in rupees because rupees are what
 * Cashfree charges, and carry a clearly approximate local figure underneath.
 */
const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const planName = queryParams.get('plan') || 'professional';
  const billing = queryParams.get('billing') || 'monthly';
  const isAnnual = billing === 'annual';

  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [discountInfo, setDiscountInfo] = useState(null);

  const checkoutPlanName = isAnnual ? `${planName}_annual` : planName;
  const basePrice = planName === 'professional'
    ? (isAnnual ? PLAN.annualTotal : PLAN.monthly)
    : 0;
  const total = discountInfo ? discountInfo.final_amount : basePrice;
  const localTotal = localEstimateLabel(total);
  const showsFx = needsLocalEstimate();

  const setBilling = (next) => {
    const p = new URLSearchParams(location.search);
    p.set('billing', next);
    navigate({ pathname: location.pathname, search: p.toString() }, { replace: true });
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsValidating(true);
    try {
      const resp = await api.post('/subscriptions/validate-coupon', {
        code: couponCode,
        plan_name: checkoutPlanName,
      });
      if (resp.is_valid) {
        setDiscountInfo(resp);
        notify.done(resp.message);
      } else {
        setDiscountInfo(null);
        notify.problem(resp.message);
      }
    } catch {
      notify.problem('Coupon validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePayNow = async () => {
    setLoading(true);
    track(EVENTS.PAYMENT_BUTTON_CLICKED, {
      plan: checkoutPlanName,
      amount: total,
      has_discount: !!discountInfo,
    });
    try {
      await cashfreeService.initiateCheckout(checkoutPlanName, discountInfo ? couponCode : null);
    } catch (error) {
      notify.problem(error, 'Failed to initiate checkout');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><GearLoader /></div>;
  }

  const Row = ({ label, value, muted }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={`text-sm ${muted ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-bold tabular-nums ${muted ? 'text-gray-400' : 'text-gray-900'}`}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1f3f9] flex flex-col">
      <header className="bg-[#2a276e] text-white flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity min-h-[2.75rem] pr-2"
          >
            <ChevronLeft size={18} />
            <span>MolarPlus Checkout</span>
          </button>
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
            <Lock size={12} /> SECURE PAYMENT
          </span>
        </div>
      </header>

      {/* Constrained and centred. The old page ran the full viewport width with
          roughly 40% of it empty below the fold. */}
      {/* Vertically centred: the content is short and top-aligning it left
          the lower half of a tall viewport empty, which is most of what was
          wrong with the look of the old page. */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-start">

          {/* ── Order summary ── */}
          <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Your plan</h2>

            <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-5">
              {[
                { id: 'monthly', label: 'Monthly' },
                { id: 'annual', label: 'Annual' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBilling(b.id)}
                  className={`px-3.5 py-2 min-h-[2.25rem] rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    (b.id === 'annual') === isAnnual
                      ? 'bg-white text-[#2a276e] border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {b.label}
                  {b.id === 'annual' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
                      SAVE {PLAN.annualPctOff}%
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3">
              <Row
                label={`${planName === 'professional' ? 'Professional' : planName}, ${isAnnual ? 'annual' : 'monthly'}`}
                value={inr(basePrice)}
              />
              {isAnnual && (
                <Row
                  label={`${inr(PLAN.monthly)} × 12 if paid monthly`}
                  value={`You save ${inr(PLAN.annualSave)}`}
                  muted
                />
              )}
              {discountInfo && (
                <div className="flex items-baseline justify-between gap-3 py-1.5 text-green-700">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Tag size={13} /> {couponCode}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    -{inr(discountInfo.discount_amount)}
                  </span>
                </div>
              )}
            </div>

            {/* One amount, once. The old layout printed the same figure as
                "Monthly price" and again as "TOTAL TO PAY" at equal weight. */}
            <div className="border-t border-gray-200 mt-3 pt-4">
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm font-bold text-gray-900">Total today</span>
                <span className="text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums leading-none">
                  {inr(total)}
                </span>
              </div>
              {/* Never bold, never in the button: the rupee figure is what gets
                  charged, this only answers "roughly how much is that". */}
              {localTotal && (
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  {localTotal}. Charged in Indian Rupees, your bank sets the final rate.
                </p>
              )}
            </div>

            {/* Demoted from the loudest element on the page to a link. */}
            <div className="mt-4">
              {!couponOpen && !discountInfo ? (
                <button
                  onClick={() => setCouponOpen(true)}
                  className="text-xs font-bold text-[#2a276e] hover:underline min-h-[2.25rem]"
                >
                  Have a coupon code?
                </button>
              ) : discountInfo ? (
                <p className="text-xs text-green-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> {discountInfo.message}
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    className="flex-1 min-w-0 h-11 px-3 border border-gray-300 rounded-lg text-sm font-semibold outline-none focus:border-[#2a276e] focus:ring-4 focus:ring-[#2a276e]/10 transition-colors"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={isValidating || !couponCode}
                    className="px-4 h-11 rounded-lg text-xs font-bold transition-colors bg-[#2a276e] text-white hover:bg-[#1f1d52] disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {isValidating ? 'Checking' : 'Apply'}
                  </button>
                  <button
                    onClick={() => { setCouponOpen(false); setCouponCode(''); }}
                    aria-label="Cancel coupon"
                    className="w-11 h-11 grid place-items-center text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ── Payment ── */}
          <section className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Payment</h2>

              <div className="border border-[#2a276e] bg-[#2a276e]/[0.04] rounded-xl p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-[#2a276e]">Cashfree Secure Payment</span>
                  <CheckCircle2 size={16} className="text-[#2a276e] flex-shrink-0" />
                </div>
                {/* Marks rather than "Supports UPI, All Cards, Netbanking." in
                    grey italic, which read as a disclaimer. */}
                <PaymentMarks className="mt-3" />
              </div>

              <button
                onClick={handlePayNow}
                className="w-full mt-4 py-4 min-h-[3.25rem] rounded-xl bg-[#2a276e] hover:bg-[#1f1d52] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 group"
              >
                Pay {inr(total)}
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>

              <p className="text-[11px] text-gray-500 text-center mt-2.5">
                You will be taken to Cashfree to complete the payment.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 pt-3.5 border-t border-gray-100 text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-green-600" /> Encrypted</span>
                <span>We never store your card</span>
                <span>Cancel anytime</span>
              </div>
            </div>

            {/* Renewal terms stated before the click, not after. */}
            <p className="text-[11px] text-gray-500 leading-relaxed px-1">
              {isAnnual
                ? `Renews yearly at ${inr(PLAN.annualTotal)} until cancelled.`
                : `Renews monthly at ${inr(PLAN.monthly)} until cancelled.`}
              {' '}Manage or cancel any time from Control Center.
              {showsFx && ' Your bank may add a foreign transaction fee.'}
            </p>

            <PaymentHelp amount={total} plan={isAnnual ? 'Professional annual' : 'Professional monthly'} />
          </section>

        </div>
      </main>
    </div>
  );
};

export default Checkout;
