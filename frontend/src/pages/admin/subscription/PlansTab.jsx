import React, { useRef, useState } from 'react';
import { Zap, Clock, ShieldCheck, CheckCircle2, RefreshCcw, FileText, Lock } from 'lucide-react';
import { planLabel, resolvePlan, useFeaturedPromo, TRIAL_DAYS } from '../../../utils/plans';
import PaymentHelp from '../../../components/payments/PaymentHelp';
import CurrentPlanCard from './CurrentPlanCard';
import PromoCodeBox from './PromoCodeBox';
import FeaturedPromoBanner from './FeaturedPromoBanner';
import PlanCards from './PlanCards';

/**
 * Manage Subscription.
 *
 * Reads top to bottom as one argument: here is what you are on and how much of
 * it you are using, here is what else there is (at whatever price your code
 * gets you), here is what every plan includes whatever you pick, and here is
 * how to reach a human if the money goes wrong.
 *
 * The order is deliberate. Usage comes before prices because the honest reason
 * to upgrade is running out of something, not being asked. "Included in every
 * plan" comes after the cards because its job is to stop a small clinic
 * worrying that the cheapest option is a stripped one.
 */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

/**
 * One coloured strip at the top, for whichever state actually applies.
 *
 * `icon` takes a rendered element rather than a component: this project's
 * eslint config has no react plugin, so a capitalised component passed as a
 * prop is never seen as used and reports as dead code.
 */
const StatusBanner = ({ tone, icon, title, body }) => {
  const tones = {
    teal: 'border-[#29828a]/30 bg-[#29828a]/5 text-[#29828a]',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{body}</p>
        </div>
      </div>
    </div>
  );
};

const REASSURANCE = [
  { icon: <RefreshCcw size={14} />, text: 'Cancel any time. Downgrades take effect at your next renewal, never mid-month.' },
  { icon: <FileText size={14} />, text: 'A GST invoice for every payment, so a registered clinic can claim input credit.' },
  { icon: <Lock size={14} />, text: 'Payments handled by Cashfree. We never see or store your card.' },
];

const PlansTab = ({
  subscription, catalogue, usage, lastPayment, clinicName,
  startingTrial, onStartTrial, onChoosePlan,
}) => {
  const [cycle, setCycle] = useState('monthly');
  const [discount, setDiscount] = useState(null);
  const featured = useFeaturedPromo();
  const plansRef = useRef(null);

  const planName = subscription?.effective_plan || subscription?.plan_name;
  const lapsedPlan = subscription?.plan_name;
  const { key: planKey } = resolvePlan(planName);
  const isExpired = subscription?.is_expired === true;
  const isTrial = subscription?.is_trial === true && subscription?.status === 'active' && !isExpired;
  const isGranted = subscription?.provider === 'migration';
  const currentPlan = catalogue.plans.find((p) => p.key === planKey) || catalogue.plans[0];
  const renews = fmtDate(subscription?.current_end);

  const scrollToPlans = () =>
    plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // The code travels with the choice, so nobody types it twice.
  const choose = (key, billing) => onChoosePlan(key, billing, discount?.code || null);

  return (
    <div className="space-y-6">
      {isTrial && (
        <StatusBanner
          tone="teal"
          icon={<Zap size={16} />}
          title={`Your ${TRIAL_DAYS}-day ${planLabel(planName)} trial is running${
            subscription?.trial_days_remaining != null
              ? subscription.trial_days_remaining === 0
                ? ', and ends today'
                : `, ${subscription.trial_days_remaining} day${subscription.trial_days_remaining !== 1 ? 's' : ''} left`
              : ''
          }`}
          body={renews
            ? `Everything is unlocked until ${renews}. Pick a plan before then to carry straight on.`
            : 'Everything is unlocked. Pick a plan to carry straight on.'}
        />
      )}

      {isExpired && (
        <StatusBanner
          tone="red"
          icon={<Clock size={16} />}
          title={`Your ${planLabel(lapsedPlan)} plan has expired`}
          body={renews
            ? `It ran out on ${renews}, so you are back on ${planLabel(planName)}. Nothing has been deleted. Choose a plan below to pick up where you left off.`
            : `You are back on ${planLabel(planName)}. Nothing has been deleted.`}
        />
      )}

      {isGranted && !isExpired && (
        <StatusBanner
          tone="amber"
          icon={<ShieldCheck size={16} />}
          title={`You are on ${currentPlan.label} at no charge`}
          body={renews
            ? `Nothing to pay until ${renews}. We moved every existing clinic across when the plans changed, so you keep working exactly as before.`
            : 'We moved every existing clinic across when the plans changed, so you keep working exactly as before.'}
        />
      )}

      <CurrentPlanCard
        subscription={subscription}
        catalogue={catalogue}
        usage={usage}
        lastPayment={lastPayment}
        clinicName={clinicName}
        startingTrial={startingTrial}
        onStartTrial={onStartTrial}
        onChoosePlan={choose}
        onSeePlans={scrollToPlans}
      />

      <section ref={plansRef} className="scroll-mt-4">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-900">Choose your plan</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
            Plus is for a single clinic running smoothly. Pro is for a clinic managing several
            branches. Growth is for a group that keeps adding them.
          </p>
        </div>

        {/* The running campaign, if there is one. Applying it fills the box
            below rather than bypassing it, so the applied state is identical
            however the code arrived. */}
        <FeaturedPromoBanner
          promo={featured}
          applied={!!discount}
          onApply={(p) => setDiscount({
            code: p.code,
            percent: p.discount_percent || null,
            flat: p.discount_flat || null,
            expiresAt: p.expires_at || null,
            usesLeft: p.uses_left ?? null,
          })}
        />

        <PromoCodeBox
          discount={discount}
          onApply={setDiscount}
          onClear={() => setDiscount(null)}
          planKeyForQuote={catalogue.plans[1]?.key || 'pro'}
        />

        <PlanCards
          catalogue={catalogue}
          currentPlanName={planName}
          cycle={cycle}
          onCycleChange={setCycle}
          onChoose={choose}
          discount={discount}
        />

        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {REASSURANCE.map((r) => (
            <li key={r.text} className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-500">
              <span className="mt-0.5 shrink-0 text-gray-400">{r.icon}</span>
              {r.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-bold text-gray-900">Included in every plan, whichever you pick</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
          Nothing clinical sits behind a higher plan. The plans differ only in how much your clinic
          can grow into: branches, staff, patients and storage.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(catalogue.included_in_every_plan || []).map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-gray-600">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#29828a]" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <PaymentHelp
        amount={currentPlan.monthly}
        currency={currentPlan.currency}
        plan={currentPlan.label}
      />
    </div>
  );
};

export default PlansTab;
