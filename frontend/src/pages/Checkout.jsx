import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { notify } from '../utils/notify';
import { api } from '../utils/api';
import { track, EVENTS } from '../analytics/track';
import { ChevronLeft, ShieldCheck, Lock, Tag, CheckCircle2, ArrowRight, X } from 'lucide-react';
import GearLoader from '../components/GearLoader';
import { cashfreeService } from '../services/payments/cashfree/cashfree_service';
import PaymentMarks from '../components/payments/PaymentMarks';
import PaymentHelp from '../components/payments/PaymentHelp';
import { usePlanCatalogue, resolvePlan, planLabel, formatPrice } from '../utils/plans';

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
 * CA$14.60, having just been quoted $10 on the previous screen.
 *
 * Both halves of that are now structural rather than remembered. Every amount
 * comes from the plan catalogue, which serves ONE currency per clinic: rupees
 * in India, dollars everywhere else. There is no conversion left to get wrong,
 * and an Indian clinic cannot be shown a dollar figure because the catalogue it
 * receives does not contain one.
 *
 * GST is added on top for India and shown as its own line, because the total
 * that leaves the account is the number this screen has to be honest about.
 */
const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  // Defaults to the entry plan, not the middle one. Every real entry point
  // sets ?plan=, so a missing param means something went wrong upstream, and
  // the safe direction to fail is the cheapest plan rather than the dearest.
  const planName = queryParams.get('plan') || 'plus';
  const billing = queryParams.get('billing') || 'monthly';
  const isAnnual = billing === 'annual';

  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [discountInfo, setDiscountInfo] = useState(null);

  // A code applied on the Subscription page arrives as ?coupon=. Applied once,
  // on arrival, so nobody has to type it a second time on the screen where they
  // are about to pay. The ref guards React 18's double-invoked effect.
  const preApplied = useRef(false);

  const { catalogue } = usePlanCatalogue();
  const planKey = resolvePlan(planName).key;
  const plan = catalogue.plans.find((p) => p.key === planKey) || catalogue.plans[0];
  const currency = catalogue.currency;
  const money = (amount) => formatPrice(amount, currency);

  const checkoutPlanName = isAnnual ? `${planKey}_annual` : planKey;
  const listPrice = isAnnual ? plan.annual_total : plan.monthly;

  // Discount first, then tax, matching create_checkout_session. Taxing the list
  // price and then discounting would charge GST on money nobody paid.
  const subtotal = discountInfo ? discountInfo.final_amount : listPrice;
  const taxRate = catalogue.tax_rate || 0;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const annualSaving = plan.monthly * 12 - plan.annual_total;

  const setBilling = (next) => {
    const p = new URLSearchParams(location.search);
    p.set('billing', next);
    navigate({ pathname: location.pathname, search: p.toString() }, { replace: true });
  };

  useEffect(() => {
    const fromUrl = queryParams.get('coupon');
    if (!fromUrl || preApplied.current) return;
    preApplied.current = true;
    setCouponCode(fromUrl.toUpperCase());
    setCouponOpen(true);
    applyCoupon(fromUrl.toUpperCase());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCoupon = async (raw) => {
    const value = (raw ?? couponCode).trim().toUpperCase();
    if (!value) return;
    setIsValidating(true);
    try {
      const resp = await api.post('/subscriptions/validate-coupon', {
        code: value,
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

  const handleApplyCoupon = () => applyCoupon();

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
                      SAVE {plan.annual_pct_off}%
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3">
              <Row
                label={`${plan.label}, ${isAnnual ? 'annual' : 'monthly'}`}
                value={money(listPrice)}
              />
              {isAnnual && annualSaving > 0 && (
                <Row
                  label={`${money(plan.monthly)} × 12 if paid monthly`}
                  value={`You save ${money(annualSaving)}`}
                  muted
                />
              )}
              {discountInfo && (
                <div className="flex items-baseline justify-between gap-3 py-1.5 text-green-700">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Tag size={13} /> {couponCode}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    -{money(discountInfo.discount_amount)}
                  </span>
                </div>
              )}
            </div>

            {/* One amount, once. The old layout printed the same figure as
                "Monthly price" and again as "TOTAL TO PAY" at equal weight. */}
            {/* Tax on its own line. A total that silently includes 18% is the
                kind of surprise that turns into a support ticket. */}
            {tax > 0 && (
              <div className="border-t border-gray-100 pt-1.5">
                <Row label={`${catalogue.tax_label || 'Tax'} at ${Math.round(taxRate * 100)}%`} value={money(tax)} />
              </div>
            )}

            <div className="border-t border-gray-200 mt-3 pt-4">
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm font-bold text-gray-900">Total today</span>
                <span className="text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums leading-none">
                  {money(total)}
                </span>
              </div>
              {currency !== 'INR' && (
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  Charged in US dollars. Your bank may add a foreign transaction fee.
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
                Pay {money(total)}
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
                ? `Renews yearly at ${money(plan.annual_total)}${tax > 0 ? ' plus ' + (catalogue.tax_label || 'tax') : ''} until cancelled.`
                : `Renews monthly at ${money(plan.monthly)}${tax > 0 ? ' plus ' + (catalogue.tax_label || 'tax') : ''} until cancelled.`}
              {' '}Manage or cancel any time from Control Center.
            </p>

            <PaymentHelp
              amount={total}
              currency={currency}
              plan={planLabel(checkoutPlanName)}
            />
          </section>

        </div>
      </main>
    </div>
  );
};

export default Checkout;
