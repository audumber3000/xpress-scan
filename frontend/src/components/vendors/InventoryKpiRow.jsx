import React from 'react';
import { Package, AlertTriangle, RefreshCw, Wallet } from 'lucide-react';
import KpiRow from '../common/KpiRow';
import { formatCompactMoney, formatCount } from '../../utils/currency';

/**
 * KPI cards for Inventory.
 *
 * Three cards, not four. A "stock value" card is deliberately absent while any
 * item is unpriced — `price_per_unit` defaults to 0 and almost nothing sets it,
 * so the card would confidently report a near-zero value for a well-stocked
 * clinic. The completeness chip underneath says so instead, and the fourth card
 * appears on its own once everything is priced.
 */

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const ico = (Icon) => <Icon size={15} />;

const PALETTE = ['#2a276e', '#9B8CFF', '#c9c3f5', '#e4e3ee'];

export function buildInventoryCards(s) {
  const items = s?.items || {};
  const att = s?.attention || {};
  const mov = s?.movement || {};
  const setup = s?.setup || {};

  const flagged = (att.low || 0) + (att.expired || 0) + (att.expiring || 0);
  const billedPct = pct(mov.billed, mov.out);

  const cards = [
    {
      key: 'items',
      title: 'Items tracked',
      display: formatCount(items.total || 0),
      icon: ico(Package),
      variant: 'breakdown',
      story: items.total > 0
        ? `${formatCount(items.consumables)} ${items.consumables === 1 ? 'consumable' : 'consumables'} and ${formatCount(items.medications)} ${items.medications === 1 ? 'medication' : 'medications'}.`
        : 'Nothing is being tracked yet.',
      storyShort: items.total > 0 ? `${formatCount(items.consumables)} + ${formatCount(items.medications)} meds` : 'Nothing yet',
      rows: (items.categories || []).slice(0, 3).map((c, i) => ({
        label: c.category,
        value: formatCount(c.count),
        color: PALETTE[i] || PALETTE[3],
      })),
    },
    {
      key: 'attention',
      title: 'Needs attention',
      display: formatCount(flagged),
      icon: ico(AlertTriangle),
      variant: 'meter',
      badge: att.expired > 0 ? `${att.expired} expired` : att.low > 0 ? `${att.low} low` : null,
      badgeTone: att.expired > 0 ? 'bad' : 'warn',
      // "0 expiring" is not good news when nothing has a date — it is the
      // absence of a measurement. The card says which of the two it is, and
      // how much of the shelf the expiry check actually covers.
      story: (() => {
        const covered = att.expiry_tracked || 0;
        const total = items.total || 0;
        const expiryNote = total === 0 ? ''
          : covered === 0 ? ' No expiry dates are recorded, so that check is silent.'
            : covered < total ? ` Expiry is only tracked on ${formatCount(covered)} of ${formatCount(total)} items.`
              : '';
        if (flagged === 0) {
          return (covered < total && total > 0)
            ? `Nothing flagged.${expiryNote}`
            : 'Nothing needs attention right now.';
        }
        return `${formatCount(att.low)} at or below reorder level.${expiryNote}`;
      })(),
      storyShort: flagged === 0 ? 'All clear' : `${formatCount(att.low)} low`,
      meterPercent: pct(flagged, items.total),
      meterTone: 'warn',
      meterLeft: items.total > 0 ? `${pct(flagged, items.total)}% of items` : '',
      meterRight: att.expiry_tracked === 0 ? 'expiry not tracked' : `${formatCount(att.expiry_tracked)} dated`,
    },
    {
      key: 'movement',
      title: 'Movement',
      display: formatCount(mov.total || 0),
      icon: ico(RefreshCw),
      variant: 'meter',
      story: mov.total > 0
        ? `${formatCount(mov.out)} out, ${formatCount(mov.in)} in. ${formatCount(mov.billed)} of the ${formatCount(mov.out)} ${mov.out === 1 ? 'usage was' : 'usages were'} billed.`
        : 'No stock has moved in the last 30 days.',
      storyShort: mov.total > 0 ? `${formatCount(mov.out)} out / ${formatCount(mov.in)} in` : 'No movement',
      meterPercent: billedPct,
      meterLeft: mov.out > 0 ? `${billedPct}% of usage billed` : '',
      meterRight: `last ${mov.window_days || 30} days`,
    },
  ];

  if (setup.value_usable) {
    cards.push({
      key: 'value',
      title: 'Stock value',
      display: formatCompactMoney(setup.priced_value),
      isMoney: true,
      icon: ico(Wallet),
      variant: 'plain',
      story: 'Every tracked item is priced, so this is the full value on the shelf.',
      storyShort: 'on the shelf',
    });
  }

  return cards;
}

/** The nudge that replaces the missing value card. */
export function inventorySetupGap(s) {
  const setup = s?.setup || {};
  if (setup.value_usable || !(setup.unpriced > 0 || setup.undated > 0)) return null;

  const parts = [];
  if (setup.unpriced > 0) parts.push(`${setup.unpriced} ${setup.unpriced === 1 ? 'item has' : 'items have'} no price`);
  if (setup.undated > 0) parts.push(`${setup.undated} no expiry date`);
  return `${parts.join(', ')} — stock value and expiry alerts stay off until they're set`;
}

const InventoryKpiRow = ({ summary, onSelect }) => (
  <KpiRow cards={buildInventoryCards(summary)} onSelect={onSelect} />
);

export default InventoryKpiRow;
