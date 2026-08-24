import { planLabel } from '../constants/plans';

/**
 * The little plan chip, decided in one place.
 *
 * It shows up on the Control Center subscription strip, the Profile row and the
 * Subscription screen itself, and those three disagreeing is exactly the class
 * of bug that had the web header saying "Plus" while the page underneath said
 * "Pro". One function, one answer.
 *
 * ## Which plan name it reads
 *
 * `effective_plan` — what the clinic can use RIGHT NOW — never `plan_name`,
 * which is what they last had. After a trial ends those are different: the
 * stored name still says Pro, and printing that on a clinic that can no longer
 * create a patient is a lie the user can see through.
 *
 * ## Why state beats plan
 *
 * A stopped plan is the more urgent fact, so it wins the chip. Somebody whose
 * renewal failed does not need to be reminded which plan it was; they need to
 * know it is not running.
 */

export interface PlanBadge {
  label: string;
  bg: string;
  fg: string;
  /** True when the clinic is view only — callers may want to lead with it. */
  urgent: boolean;
}

const STOPPED: Record<string, string> = {
  trial_ended: 'Trial ended',
  lapsed: 'Renewal failed',
  grant_ended: 'Renewal due',
};

const DUE = ['renewal_due', 'grant_due'];

interface ClinicLike {
  effective_plan?: string | null;
  subscription_plan?: string | null;
  plan_name?: string | null;
  is_trial?: boolean;
  trial_days_remaining?: number | null;
  plan_state?: string | null;
  plan_state_days?: number | null;
}

const days = (n?: number | null) =>
  typeof n === 'number' && n > 0 ? `${n}d` : 'today';

export function planBadge(clinic?: ClinicLike | null): PlanBadge {
  const state = clinic?.plan_state || 'ok';

  if (STOPPED[state]) {
    return { label: STOPPED[state], bg: '#FEE2E2', fg: '#991B1B', urgent: true };
  }

  if (DUE.includes(state)) {
    return {
      label: `${days(clinic?.plan_state_days)} left`,
      bg: '#FEF3C7', fg: '#92400E', urgent: false,
    };
  }

  if (clinic?.is_trial) {
    const left = clinic?.trial_days_remaining;
    return {
      label: typeof left === 'number' && left > 0 ? `Trial · ${left}d` : 'Trial',
      bg: '#CCFBF1', fg: '#115E59', urgent: false,
    };
  }

  // Falls back through the names in order of how current they are. The last
  // resort resolves to the entry plan rather than showing nothing, because a
  // blank chip reads as a broken screen.
  const name = clinic?.effective_plan || clinic?.subscription_plan || clinic?.plan_name;
  return { label: planLabel(name), bg: '#F3F4F6', fg: '#374151', urgent: false };
}
