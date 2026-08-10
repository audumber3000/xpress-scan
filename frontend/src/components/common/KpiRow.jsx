import React from 'react';
import MetricCard from './MetricCard';

/**
 * A row of storytelling KPI cards, however many there are.
 *
 * Card count varies by section — Payments has four, Inventory three, Lab three
 * or four depending on whether there is more than one lab to compare. So the
 * grid is derived from the list rather than fixed at four.
 *
 * The odd-card rule: on the two-column phone/tablet grid, a list with an odd
 * length would leave its last card in a half-width cell with a hole beside it.
 * That card spans both columns instead. Same treatment the dashboard already
 * gives its hero and breakdown cards.
 */

// Tailwind needs whole class names present in the source to emit them, so these
// are written out rather than built by interpolation.
const LG_COLS = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

const KpiRow = ({ cards = [], onSelect, className = '' }) => {
  if (!cards.length) return null;

  const lg = LG_COLS[Math.min(cards.length, 5)] || 'lg:grid-cols-4';
  const oddTail = cards.length % 2 === 1;

  return (
    <div className={`grid grid-cols-2 ${lg} gap-2.5 md:gap-3 ${className}`}>
      {cards.map((card, i) => {
        const { key, ...cardProps } = card;
        const isLast = i === cards.length - 1;
        return (
          <MetricCard
            key={key}
            {...cardProps}
            onClick={onSelect ? () => onSelect(card) : undefined}
            className={oddTail && isLast ? 'col-span-2 lg:col-span-1' : ''}
          />
        );
      })}
    </div>
  );
};

export default KpiRow;
