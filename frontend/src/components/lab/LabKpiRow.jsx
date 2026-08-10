import React from 'react';
import { FlaskConical, Timer, Receipt, Factory } from 'lucide-react';
import KpiRow from '../common/KpiRow';
import { formatCompactMoney, formatMoney, formatCount } from '../../utils/currency';

/**
 * KPI cards for the Lab hub.
 *
 * Four cards when there is more than one lab to compare, three when there isn't
 * — a "by lab" card with a single vendor is the spend card again wearing a
 * different hat. KpiRow handles the odd-count layout.
 */

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const ico = (Icon) => <Icon size={15} />;

export function buildLabCards(s) {
  const open = s?.open || {};
  const tat = s?.turnaround || {};
  const spend = s?.spend || {};
  const vendors = s?.vendors || [];

  const overduePct = pct(open.overdue, open.count);
  const billedPct = pct(spend.cases - spend.unbilled_count, spend.cases);

  const cards = [
    {
      key: 'open',
      title: 'Open cases',
      display: formatCount(open.count || 0),
      icon: ico(FlaskConical),
      variant: 'meter',
      badge: open.overdue > 0 ? `${open.overdue} overdue` : null,
      story: open.count === 0
        ? 'Nothing is out with the lab right now.'
        : open.overdue === 0
          ? 'All of them are still within their due date.'
          : `${open.overdue === open.count ? 'All' : open.overdue} past their due date. Oldest is ${open.oldest_overdue_days} days late.`,
      storyShort: open.count === 0 ? 'None out' : `${open.overdue} overdue`,
      meterPercent: overduePct,
      meterTone: overduePct > 0 ? 'warn' : undefined,
      meterLeft: open.count > 0 ? `${overduePct}% overdue` : '',
      meterRight: open.oldest_overdue_days > 0 ? `oldest ${open.oldest_overdue_days}d` : '',
    },
    {
      key: 'turnaround',
      title: 'Turnaround',
      // Unit sits in the story rather than the headline so the number stays
      // scannable next to three other numbers.
      display: tat.completed > 0 ? `${tat.median_days}d` : '—',
      icon: ico(Timer),
      variant: 'spark',
      sparkline: (tat.histogram || []).map((h) => h.cases),
      sparklineHighlight: 'max',
      story: tat.completed > 0
        ? `Half your cases come back within ${tat.median_days} ${tat.median_days === 1 ? 'day' : 'days'}. Slowest took ${tat.max_days}.`
        : 'No case has come back yet, so there is nothing to measure.',
      storyShort: tat.completed > 0 ? `max ${tat.max_days}d` : 'No data yet',
    },
    {
      key: 'spend',
      title: 'Lab spend',
      display: formatCompactMoney(spend.total),
      isMoney: true,
      icon: ico(Receipt),
      variant: 'meter',
      badge: spend.unbilled_count > 0 ? `${spend.unbilled_count} unbilled` : null,
      story: spend.unbilled_count > 0
        ? `${formatMoney(spend.unbilled_amount)} of lab work never reached a patient invoice.`
        : 'Every case has been charged on to a patient.',
      storyShort: spend.unbilled_count > 0
        ? `${formatCompactMoney(spend.unbilled_amount)} unbilled`
        : 'All billed',
      meterPercent: billedPct,
      meterLeft: spend.cases > 0 ? `${billedPct}% billed on` : '',
      meterRight: spend.cases > 0
        ? `${formatCount(spend.cases)} ${spend.cases === 1 ? 'case' : 'cases'}`
        : '',
    },
  ];

  // Only worth a card once there is a comparison to make.
  if (vendors.length > 1) {
    const palette = ['#2a276e', '#9B8CFF', '#c9c3f5'];
    cards.push({
      key: 'vendors',
      title: 'By lab',
      display: formatCount(vendors.length),
      icon: ico(Factory),
      variant: 'breakdown',
      story: `${vendors[0].vendor} takes the largest share of your lab spend.`,
      storyShort: 'labs used',
      rows: vendors.slice(0, 3).map((v, i) => ({
        label: v.vendor,
        value: formatCompactMoney(v.cost),
        color: palette[i] || palette[2],
      })),
    });
  }

  return cards;
}

const LabKpiRow = ({ summary, onSelect }) => (
  <KpiRow cards={buildLabCards(summary)} onSelect={onSelect} />
);

export default LabKpiRow;
