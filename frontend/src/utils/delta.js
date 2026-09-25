/**
 * How to phrase a period-over-period change.
 *
 * A percentage needs a base big enough to carry one. On a clinic with two
 * patients last week and eighteen this week, "▲ 800%" is arithmetically true
 * and useless: it tells a doctor nothing they didn't already get from the two
 * numbers, and a four-figure percentage over single digits is the single
 * loudest tell that a screen is showing seeded demo data. Under the threshold
 * we show the move itself, which is both smaller and more informative.
 *
 * `previous` may be absent — the Payments and Expenses KPI rows don't compute
 * one. With no base to judge against, the percentage is shown exactly as it
 * was before, rather than guessed at.
 *
 * Lives in utils rather than beside the dashboard's other formatters because
 * MetricCard is shared with Payments and Expenses, and a component in
 * components/common has no business importing out of a page folder.
 */
import { formatCompactMoney } from './currency';

export const SMALL_BASE = 10;

export const describeDelta = ({ change, changeType, previous, value, isMoney }) => {
  if (change === undefined || change === null) return null;

  const pct = Math.abs(Number(change) || 0);
  const up = changeType === 'up';

  // Nothing on either side: there is no comparison to report, so no pill,
  // rather than a "no change" that asserts one.
  if (pct === 0 && Number(value) === 0 && Number(previous) === 0) return null;
  if (pct === 0) return { text: 'no change', tone: 'flat', up };

  const base = Number(previous);
  const current = Number(value);

  if (Number.isFinite(base) && base < SMALL_BASE && Number.isFinite(current)) {
    const move = Math.abs(Math.round(current - base));
    // A move of zero alongside a non-zero percentage means the two rounded to
    // the same whole number. "+0" would be a worse answer than the percentage.
    //
    // A money card has to say so. Rupees and patient counts both arrive here
    // as bare numbers, and "+1200" next to a revenue figure reads as twelve
    // hundred *somethings* — the clinic's first billing month would render its
    // headline change with no symbol and no separator.
    if (move > 0) {
      const amount = isMoney ? formatCompactMoney(move) : String(move);
      return { text: `${up ? '+' : '-'}${amount}`, tone: up ? 'up' : 'down', up };
    }
  }

  return { text: `${pct}%`, tone: up ? 'up' : 'down', up };
};
