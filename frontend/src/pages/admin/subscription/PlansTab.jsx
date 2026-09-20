import React, { useRef, useState } from 'react';
import { Zap, Clock, ShieldCheck, CheckCircle2, RefreshCcw, FileText, Lock, BellRing, ArrowRight, ArrowDown, Users } from 'lucide-react';
import { planLabel, resolvePlan, useFeaturedPromo, TRIAL_DAYS, formatPrice, paymentGateway } from '../../../utils/plans';
import PaymentHelp from '../../../components/payments/PaymentHelp';
import CurrentPlanCard from './CurrentPlanCard';
import PromoCodeBox from './PromoCodeBox';
import FeaturedPromoBanner from './FeaturedPromoBanner';
import PlanCards from './PlanCards';
import AddOnsStrip from './AddOnsStrip';

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

// Per currency, because the gateway is only Cashfree in India. A clinic abroad
// pays in dollars through Dodo Payments, so naming Cashfree to them would be
// wrong on the one line that is meant to reassure.
const reassurance = (currency) => {
  const gateway = paymentGateway(currency);
  return [
    // Plans do not renew by themselves: every payment is one order. Saying so is
    // the honest version of "renews until cancelled", which this page used to
    // imply and nothing ever did.
    { icon: <BellRing size={14} />, text: 'Nothing is charged automatically. We remind you 7, 3 and 1 days before your plan ends.' },
    // Promised something the checkout refuses. A paying clinic can move up at any
    // time and cannot move down while the plan it bought is still running, so
    // this says how a smaller plan is actually reached rather than implying a
    // button that is disabled.
    { icon: <RefreshCcw size={14} />, text: 'Move up at any time. To move to a smaller plan, pick it when your current one comes up for renewal.' },
    gateway.key === 'cashfree'
      ? { icon: <FileText size={14} />, text: 'An invoice for every payment, ready to download from Billing History.' }
      : { icon: <FileText size={14} />, text: 'A receipt for every payment, kept in Billing History.' },
    { icon: <Lock size={14} />, text: `Payments handled by ${gateway.label}. We never see or store your card.` },
  ];
};

/**
 * The locked clinic's whole decision, in the banner they read first.
 *
 * A clinic whose trial or plan ended lands here from the view-only lock with
 * one question: carry on, or leave. It used to read "view only", then scroll,
 * then compare three plans, when almost every one of them is a single clinic
 * for whom the answer is plainly Plus. The banner now leads with their own work
 * (the patients and invoices already in MolarPlus) and offers the one plan that
 * fits them as a single tap. Comparing plans is still one tap away.
 */
const LockedDecision = ({ title, renews, records, recommended, onContinue, onCompare }) => {
  const bits = [];
  if (records?.patients) bits.push(`${records.patients.toLocaleString('en-IN')} patient${records.patients === 1 ? '' : 's'}`);
  if (records?.invoices) bits.push(`${records.invoices.toLocaleString('en-IN')} invoice${records.invoices === 1 ? '' : 's'}`);
  const safe = bits.length ? `Your ${bits.join(' and ')} are safe.` : 'Nothing has been deleted.';
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-red-600">
          <Clock size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-red-700">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">
            {safe} Pick up right where you left off.
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            {renews ? `It ended on ${renews}. ` : ''}Until you continue, you can open and read everything but not add new patients, appointments or invoices.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={onContinue}
              className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg bg-[#29828a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f6b72]"
            >
              Continue on {recommended.label} · {formatPrice(recommended.monthly, recommended.currency)}/month <ArrowRight size={14} />
            </button>
            <button
              onClick={onCompare}
              className="inline-flex min-h-[2.25rem] items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              or compare plans <ArrowDown size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlansTab = ({
  subscription, catalogue, usage, lastPayment, clinicName,
  startingTrial, onStartTrial, onChoosePlan, onOpenAddons,
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

  // Actually paying us, right now. Mirrors the guard in
  // subscription_service.create_checkout_session: a trial, a grant and anything
  // expired are all free to buy any plan, including the entry one. Only a live
  // paid plan locks the ones below it.
  const isPaying = !isTrial && !isGranted && !isExpired
    && subscription?.status === 'active'
    && !['migration', 'trial', 'none'].includes(subscription?.provider);
  const renews = fmtDate(subscription?.current_end);

  // The plan a locked clinic is offered in one tap: Pro for a clinic already
  // running more than one branch, Plus for everyone else. A lapsed Pro or Growth
  // buyer is offered what they had, rather than being quietly moved down.
  const branchesUsed = usage?.metrics?.branches?.used || 1;
  const lapsedKey = resolvePlan(lapsedPlan).key;
  const recommendedKey = subscription?.is_trial || subscription?.plan_state === 'trial_ended'
    ? (branchesUsed > 1 ? 'pro' : 'plus')
    : lapsedKey;
  const recommended = catalogue.plans.find((p) => p.key === recommendedKey) || catalogue.plans[0];

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

      {/* Said "you are back on Plus", which read as reassurance while the red
          strip above it said the clinic was view only. Both were describing the
          same clinic. What matters here is not which plan they resolve to, it
          is that writing has stopped and how to start it again, so this says
          that in the same words as the header and the blocked-write modal. */}
      {isExpired && (
        <LockedDecision
          title={subscription?.is_trial || subscription?.plan_state === 'trial_ended'
            ? `Your ${planLabel(lapsedPlan)} trial has ended`
            : `Your ${planLabel(lapsedPlan)} plan has expired`}
          renews={renews}
          records={usage?.records}
          recommended={recommended}
          onContinue={() => choose(recommended.key, 'monthly')}
          onCompare={scrollToPlans}
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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h3 className="text-sm font-bold text-gray-900">Choose your plan</h3>
          {/* A real count, computed on the server and rounded down. Absent until
              there are enough clinics for the number to mean something. */}
          {catalogue.social_proof?.text && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Users size={13} className="text-[#29828a]" /> {catalogue.social_proof.text}
            </p>
          )}
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

        {/* The quote is against Plus, the plan we actually want chosen. This
            priced every promo against Pro, so the headline saving a clinic saw
            was always for the plan above the one being pushed. */}
        <PromoCodeBox
          discount={discount}
          onApply={setDiscount}
          onClear={() => setDiscount(null)}
          planKeyForQuote={catalogue.plans[0]?.key || 'plus'}
        />

        <PlanCards
          catalogue={catalogue}
          currentPlanName={planName}
          cycle={cycle}
          onCycleChange={setCycle}
          onChoose={choose}
          isPaying={isPaying}
          discount={discount}
        />

        {/* Only ever a clinic's own words, with their permission (plans.TESTIMONIAL). */}
        {catalogue.testimonial?.quote && (
          <figure className="mx-auto mt-6 max-w-2xl text-center">
            <blockquote className="text-sm leading-relaxed text-gray-700">“{catalogue.testimonial.quote}”</blockquote>
            <figcaption className="mt-2 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">{catalogue.testimonial.name}</span>
              {[catalogue.testimonial.clinic, catalogue.testimonial.city].filter(Boolean).length > 0 && (
                <>, {[catalogue.testimonial.clinic, catalogue.testimonial.city].filter(Boolean).join(', ')}</>
              )}
            </figcaption>
          </figure>
        )}

        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {reassurance(catalogue.currency).map((r) => (
            <li key={r.text} className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-500">
              <span className="mt-0.5 shrink-0 text-gray-400">{r.icon}</span>
              {r.text}
            </li>
          ))}
        </ul>
      </section>

      <AddOnsStrip onSeeAll={onOpenAddons} />

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
