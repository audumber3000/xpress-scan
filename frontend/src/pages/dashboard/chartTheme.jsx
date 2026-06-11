import React from 'react';

/**
 * Single source of truth for dashboard chart styling so every chart shares the
 * same palette, sizing, axes and gradients. Import these instead of hand-coding
 * colors/sizes per chart.
 */

// Brand-anchored palette. Semantic colors are used consistently:
// positive = good, warning = attention, danger = bad.
export const COLORS = {
  primary: '#2a276e',      // brand navy
  primarySoft: '#9B8CFF',  // lavender
  positive: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  axis: '#9ca3af',
  grid: '#eef0f4',
};

// Single-hue ramp (navy → light) for distribution charts — replaces the old rainbow.
export const RAMP = ['#2a276e', '#514cae', '#7a72d4', '#9B8CFF', '#bcb2ff', '#ddd7fb'];

// Shared geometry so bars/areas line up across cards.
export const CHART_HEIGHT = 240;
export const BAR_SIZE = 28;
export const BAR_RADIUS = [6, 6, 0, 0];

export const GRID_PROPS = {
  strokeDasharray: '3 3',
  stroke: COLORS.grid,
  vertical: false,
};

export const AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 11, fontWeight: 600, fill: COLORS.axis },
};

export const LEGEND_PROPS = {
  iconType: 'circle',
  wrapperStyle: { fontSize: 11, fontWeight: 600, paddingTop: 8 },
};

export const CHART_MARGIN = { left: -18, right: 8, top: 8, bottom: 0 };

/**
 * Reusable gradient defs. Drop <ChartDefs /> once inside any recharts chart and
 * reference the ids below. `area*` fade to transparent (for Area fills); `bar*`
 * are subtle top→bottom shades (for Bar fills).
 */
export const ChartDefs = () => (
  <defs>
    <linearGradient id="areaPrimary" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.28} />
      <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.02} />
    </linearGradient>
    <linearGradient id="areaSoft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.primarySoft} stopOpacity={0.30} />
      <stop offset="100%" stopColor={COLORS.primarySoft} stopOpacity={0.03} />
    </linearGradient>
    <linearGradient id="areaPositive" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.positive} stopOpacity={0.25} />
      <stop offset="100%" stopColor={COLORS.positive} stopOpacity={0.02} />
    </linearGradient>
    <linearGradient id="barPrimary" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={COLORS.primary} stopOpacity={1} />
      <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.82} />
    </linearGradient>
  </defs>
);
