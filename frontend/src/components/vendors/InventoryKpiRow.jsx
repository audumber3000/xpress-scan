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

const ico = (Icon) => <Icon size={15} />;

const PALETTE = ['#2a276e', '#9B8CFF', '#c9c3f5', '#e4e3ee'];

export function buildInventoryCards(s) {
  const items = s?.items || {};
  const att = s?.attention || {};
  const mov = s?.movement || {};
  const setup = s?.setup || {};

  // Distinct items: one that is both low and expired counts once.
  const flagged = att.flagged_items ?? ((att.low || 0) + (att.expired || 0) + (att.expiring || 0));
  const outSeries = mov.out_series || [];

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
      // Three separate reasons, each a count you can act on. It used to be a
      // meter of flagged over all items, which double-counted and said little.
      variant: flagged > 0 ? 'breakdown' : 'plain',
      rows: [
        { label: 'Low stock', value: formatCount(att.low || 0), color: '#d99a1e' },
        { label: 'Expired', value: formatCount(att.expired || 0), color: '#c23b3b' },
        { label: 'Expiring in 30 days', value: formatCount(att.expiring || 0), color: '#8b86dd' },
      ],
      // "0 expiring" is not good news when nothing has a date; it is the
      // absence of a measurement. The story says which of the two it is.
      story: (() => {
        const covered = att.expiry_tracked || 0;
        const total = items.total || 0;
        if (total === 0) return 'Nothing is being tracked yet.';
        if (covered === 0) return 'No expiry dates recorded, so expiry is not being checked.';
        if (covered < total) return `Expiry is tracked on ${formatCount(covered)} of ${formatCount(total)} items.`;
        return flagged === 0 ? 'Nothing needs attention right now.' : 'Every item has an expiry date.';
      })(),
      storyShort: flagged === 0 ? 'All clear' : `${formatCount(att.low || 0)} low`,
    },
    {
      key: 'movement',
      title: 'Used',
      // Items used, not in and out added together.
      display: formatCount(mov.out || 0),
      icon: ico(RefreshCw),
      variant: outSeries.some((v) => v > 0) ? 'spark' : 'plain',
      sparkline: outSeries,
      sparklineLabels: ['4 weeks ago', 'this week'],
      story: mov.total > 0
        ? `${formatCount(mov.in || 0)} received. ${formatCount(mov.billed || 0)} of ${formatCount(mov.out || 0)} uses charged to a patient.`
        : 'No stock has moved in the last 4 weeks.',
      storyShort: mov.total > 0 ? `${formatCount(mov.in || 0)} received` : 'No movement',
    },
  ];

  if (setup.value_usable) {
    cards.push({
      key: 'value',
      title: 'Stock value',
      display: formatCompactMoney(setup.priced_value),
      isMoney: true,
      icon: ico(Wallet),
      variant: (setup.value_by_category || []).length > 1 ? 'breakdown' : 'plain',
      rows: (setup.value_by_category || []).slice(0, 3).map((c, i) => ({
        label: c.category,
        value: formatCompactMoney(c.value),
        color: PALETTE[i] || PALETTE[3],
      })),
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
