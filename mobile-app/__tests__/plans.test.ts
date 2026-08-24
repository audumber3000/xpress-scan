import {
  PLANS, PLAN_ORDER, resolvePlan, planLabel, planRank, planLimit,
  planAllowsBranches, billingCurrency, formatPrice, planPrice,
  monthlyEquivalent, annualSavingPercent,
} from '../src/shared/constants/plans';
import { planBadge } from '../src/shared/utils/planBadge';

/**
 * The plan catalogue on the phone, and the chip that reads from it.
 *
 * These are not decorative tests. Two of the assertions below cover bugs that
 * were live in the app: `FeatureLock` gating on `plan === 'professional'`, which
 * would have taken multi-branch away from every Pro customer the moment the
 * plans were renamed, and the Profile badge printing "FREE" for every Plus
 * clinic, i.e. for every paying customer.
 */

describe('resolvePlan', () => {
  it('reads the three current plans', () => {
    PLAN_ORDER.forEach((key) => {
      expect(resolvePlan(key)).toEqual({ key, cycle: 'monthly' });
    });
  });

  it('reads every plan name production has ever stored', () => {
    // A phone that has not been opened in a year is still handed these.
    expect(resolvePlan('free').key).toBe('plus');
    expect(resolvePlan('starter').key).toBe('plus');
    expect(resolvePlan('professional').key).toBe('pro');
    expect(resolvePlan('enterprise').key).toBe('growth');
    expect(resolvePlan('professional_annual')).toEqual({ key: 'pro', cycle: 'annual' });
  });

  it('is case and whitespace tolerant', () => {
    expect(resolvePlan('  PRO  ').key).toBe('pro');
    expect(resolvePlan('Professional').key).toBe('pro');
  });

  it('never throws on rubbish, because it runs on read paths', () => {
    expect(resolvePlan(undefined).key).toBe('plus');
    expect(resolvePlan(null).key).toBe('plus');
    expect(resolvePlan('').key).toBe('plus');
    expect(resolvePlan('nonsense_plan').key).toBe('plus');
  });
});

describe('planLabel', () => {
  it('never says "Free" — there is no Free plan any more', () => {
    ['free', 'starter', '', null, undefined, 'rubbish'].forEach((name) => {
      expect(planLabel(name).toLowerCase()).not.toContain('free');
    });
  });

  it('names the annual cycle', () => {
    expect(planLabel('pro_annual')).toBe('Pro, annual');
    expect(planLabel('professional_annual')).toBe('Pro, annual');
  });
});

describe('planAllowsBranches', () => {
  // THE regression this file exists for. The old test was
  // `plan === 'professional'`, so a renamed Pro clinic would have been refused
  // the feature it is paying for.
  it('lets Pro and Growth run branches', () => {
    expect(planAllowsBranches('pro')).toBe(true);
    expect(planAllowsBranches('pro_annual')).toBe(true);
    expect(planAllowsBranches('growth')).toBe(true);
    expect(planAllowsBranches('professional')).toBe(true);
    expect(planAllowsBranches('enterprise')).toBe(true);
  });

  it('holds Plus to its one location', () => {
    expect(planAllowsBranches('plus')).toBe(false);
    expect(planAllowsBranches('free')).toBe(false);
  });

  it('asks the branch limit, not the plan name', () => {
    expect(planLimit('plus', 'branches')).toBe(1);
    expect(planLimit('growth', 'branches')).toBeNull();
  });
});

describe('billing currency', () => {
  // The rule that must never break: an Indian clinic never sees a dollar figure.
  it('bills India in rupees', () => {
    expect(billingCurrency('IN')).toBe('INR');
    expect(billingCurrency('in')).toBe('INR');
  });

  it('treats an unknown country as India, the safer way to be wrong', () => {
    expect(billingCurrency(null)).toBe('INR');
    expect(billingCurrency(undefined)).toBe('INR');
    expect(billingCurrency('')).toBe('INR');
  });

  it('bills everywhere else in dollars', () => {
    expect(billingCurrency('US')).toBe('USD');
    expect(billingCurrency('AE')).toBe('USD');
  });

  it('formats each currency in its own convention', () => {
    expect(formatPrice(3830, 'INR')).toBe('₹3,830');
    expect(formatPrice(38, 'USD')).toBe('$38');
  });

  it('quotes the agreed prices', () => {
    expect(planPrice('plus', 'INR')).toBe(399);
    expect(planPrice('pro', 'INR')).toBe(999);
    expect(planPrice('growth', 'INR')).toBe(1500);
    expect(planPrice('plus', 'USD')).toBe(4);
    expect(planPrice('pro', 'USD')).toBe(8);
    expect(planPrice('growth', 'USD')).toBe(12);
  });

  it('prices every plan in both currencies and both cycles', () => {
    PLAN_ORDER.forEach((key) => {
      (['INR', 'USD'] as const).forEach((cur) => {
        (['monthly', 'annual'] as const).forEach((cycle) => {
          expect(PLANS[key].price[cur][cycle]).toBeGreaterThan(0);
        });
      });
    });
  });

  it('ranks the plans in catalogue order', () => {
    expect(planRank('plus')).toBeLessThan(planRank('pro'));
    expect(planRank('pro')).toBeLessThan(planRank('growth'));
  });
});

describe('the yearly price, explained', () => {
  // An annual total on its own is the number people flinch at: ₹14,400 sits
  // next to ₹1,500 and reads as ten times dearer until you divide it yourself.
  // Every screen showing a yearly figure has to show what it works out to per
  // month, and these are the figures it shows.

  it('works the yearly price back to a monthly one', () => {
    expect(monthlyEquivalent('plus', 'INR')).toBe(319);
    expect(monthlyEquivalent('pro', 'INR')).toBe(799);
    expect(monthlyEquivalent('growth', 'INR')).toBe(1200);
  });

  it('keeps dollars to the cent and rupees whole', () => {
    expect(monthlyEquivalent('plus', 'USD')).toBe(3.17);
    expect(Number.isInteger(monthlyEquivalent('plus', 'INR'))).toBe(true);
  });

  it('always comes out cheaper than paying monthly, in both currencies', () => {
    // If this ever fails, a price change has made the yearly option a worse
    // deal while the screens still recommend it.
    PLAN_ORDER.forEach((key) => {
      (['INR', 'USD'] as const).forEach((cur) => {
        expect(monthlyEquivalent(key, cur)).toBeLessThan(PLANS[key].price[cur].monthly);
      });
    });
  });

  it('computes the saving rather than claiming one', () => {
    expect(annualSavingPercent('plus', 'INR')).toBe(20);
    expect(annualSavingPercent('pro', 'INR')).toBe(20);
    expect(annualSavingPercent('growth', 'INR')).toBe(20);
  });

  it('never advertises a saving that is not there', () => {
    // The web collateral currently prints "20% savings" beside a USD annual
    // price that saves nothing. Computing it is what stops that here.
    PLAN_ORDER.forEach((key) => {
      (['INR', 'USD'] as const).forEach((cur) => {
        expect(annualSavingPercent(key, cur)).toBeGreaterThan(0);
      });
    });
  });

  it('stays honest about rounding', () => {
    // The rounded per-month figure is never the only number shown, because
    // twelve of it is not exactly the annual charge. Guard the gap so it stays
    // small enough that showing both cannot look like a mistake.
    PLAN_ORDER.forEach((key) => {
      const annual = PLANS[key].price.INR.annual;
      expect(Math.abs(monthlyEquivalent(key, 'INR') * 12 - annual)).toBeLessThanOrEqual(12);
    });
  });
});

describe('planBadge', () => {
  // The payloads below are the real shapes /auth/me returned for clinic 2 while
  // it was driven through each state with scripts/plan_state_sandbox.py.

  it('names a healthy plan, and never calls a paying clinic FREE', () => {
    const b = planBadge({ effective_plan: 'plus', plan_state: 'ok' });
    expect(b.label).toBe('Plus');
    expect(b.urgent).toBe(false);
  });

  it('counts a trial down', () => {
    const b = planBadge({
      effective_plan: 'pro', plan_state: 'ok', is_trial: true, trial_days_remaining: 5,
    });
    expect(b.label).toBe('Trial · 5d');
  });

  it('leads with the state when the plan has stopped', () => {
    expect(planBadge({ effective_plan: 'plus', plan_state: 'trial_ended' }))
      .toMatchObject({ label: 'Trial ended', urgent: true });
    expect(planBadge({ effective_plan: 'plus', plan_state: 'lapsed' }))
      .toMatchObject({ label: 'Renewal failed', urgent: true });
  });

  it('warns in the last days without shouting', () => {
    const b = planBadge({ effective_plan: 'plus', plan_state: 'renewal_due', plan_state_days: 2 });
    expect(b.label).toBe('2d left');
    expect(b.urgent).toBe(false);
  });

  it('reads effective_plan, not the stale name the clinic last bought', () => {
    // After a trial ends the server still stores plan_name 'pro' while the
    // clinic can only use Plus. Printing 'Pro' there is a visible lie.
    const b = planBadge({ effective_plan: 'plus', plan_name: 'pro', plan_state: 'ok' });
    expect(b.label).toBe('Plus');
  });

  it('shows something rather than nothing when the clinic is unknown', () => {
    expect(planBadge(null).label).toBe('Plus');
    expect(planBadge(undefined).label).toBe('Plus');
    expect(planBadge({}).label).toBe('Plus');
  });
});
