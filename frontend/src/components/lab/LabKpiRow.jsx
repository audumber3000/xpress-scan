import React from 'react';
import { FlaskConical, Timer, Receipt, Factory } from 'lucide-react';
import KpiRow from '../common/KpiRow';
import { labOpen, labTurnaround, labSpend, labByLab } from '../../assets/kpi';
import { formatCompactMoney, formatCount } from '../../utils/currency';

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
  // In money, like the headline. It used to be billed *case count* over cases.
  const billedAmount = Math.max(0, (spend.total || 0) - (spend.unbilled_amount || 0));
  const recoveredPct = pct(billedAmount, spend.total);

  // Turnaround as three plain buckets instead of four unlabelled bars.
  const bin = (label) => (tat.histogram || []).find((h) => h.label === label)?.cases || 0;
  const tatRows = tat.completed > 0 ? [
    { label: 'Within a week', n: bin('0-7d'), color: '#2f9e6e' },
    { label: '1 to 2 weeks', n: bin('8-14d'), color: '#8b86dd' },
    { label: 'Longer', n: bin('15-30d') + bin('30d+'), color: '#d99a1e' },
  ] : [];

  const cards = [
    {
      key: 'open',
      title: 'Open cases',
      image: labOpen,
      display: formatCount(open.count || 0),
      icon: ico(FlaskConical),
      variant: open.count > 0 ? 'meter' : 'plain',
      badge: open.overdue > 0 ? `${open.overdue} overdue` : null,
      badgeTone: 'bad',
      // The overdue count is on the badge; the story says what is coming next.
      story: open.count === 0
        ? 'Nothing is out with the lab right now.'
        : open.due_soon > 0
          ? `${formatCount(open.due_soon)} due back in the next 3 days.`
          : open.overdue === 0
            ? 'All within their due date, none due in the next 3 days.'
            : 'None due in the next 3 days.',
      storyShort: open.count === 0 ? 'None out' : open.due_soon > 0 ? `${open.due_soon} due soon` : 'none due soon',
      meterPercent: overduePct,
      meterTone: 'warn',
      meterLeft: open.count > 0 ? `${overduePct}% overdue` : '',
      meterRight: open.oldest_overdue_days > 0 ? `oldest ${open.oldest_overdue_days}d late` : '',
    },
    {
      key: 'turnaround',
      title: 'Turnaround',
      image: labTurnaround,
      display: tat.completed > 0 ? `${tat.median_days}d` : '—',
      icon: ico(Timer),
      variant: tatRows.length ? 'breakdown' : 'plain',
      rows: tatRows.map((r) => ({
        label: r.label,
        hint: `${pct(r.n, tat.completed)}%`,
        value: formatCount(r.n),
        color: r.color,
      })),
      // Measured from when a case was created to its last update, so it is
      // an estimate, and says so.
      story: tat.completed > 0
        ? `Typical case back in ${tat.median_days} ${tat.median_days === 1 ? 'day' : 'days'}${tat.approximated ? ' (approx.)' : ''}.`
        : 'No case has come back yet, so there is nothing to measure.',
      storyShort: tat.completed > 0 ? `max ${tat.max_days}d` : 'No data yet',
    },
    {
      key: 'spend',
      title: 'Lab spend',
      image: labSpend,
      display: formatCompactMoney(spend.total),
      isMoney: true,
      icon: ico(Receipt),
      variant: spend.total > 0 ? 'meter' : 'plain',
      story: spend.unbilled_count > 0
        ? `${formatCount(spend.unbilled_count)} ${spend.unbilled_count === 1 ? 'case is' : 'cases are'} not on a patient bill yet.`
        : spend.total > 0 ? 'Every case has been charged on to a patient.' : 'No lab work recorded yet.',
      storyShort: spend.unbilled_count > 0
        ? `${formatCompactMoney(spend.unbilled_amount)} unbilled`
        : 'All billed',
      meterPercent: recoveredPct,
      meterLeft: spend.total > 0 ? `${recoveredPct}% billed to patients` : '',
      meterRight: spend.unbilled_amount > 0 ? `${formatCompactMoney(spend.unbilled_amount)} not billed` : '',
    },
  ];

  // Only worth a card once there is a comparison to make.
  if (vendors.length > 1) {
    const palette = ['#2a276e', '#9B8CFF', '#c9c3f5'];
    const topShare = pct(vendors[0].cost, spend.total);
    cards.push({
      key: 'vendors',
      title: 'By lab',
      image: labByLab,
      // The lab itself, not a count of labs.
      display: vendors[0].vendor,
      icon: ico(Factory),
      variant: 'breakdown',
      story: `${topShare}% of your lab spend goes to ${vendors[0].vendor}.`,
      storyShort: `${topShare}% of spend`,
      rows: vendors.slice(0, 3).map((v, i) => ({
        label: v.vendor,
        hint: `${formatCount(v.cases)} ${v.cases === 1 ? 'case' : 'cases'}`,
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
