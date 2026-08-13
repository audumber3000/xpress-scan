import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList,
  AreaChart, Area, PieChart, Pie, ReferenceLine,
} from 'recharts';
import { api } from '../../utils/api';
import GearLoader from '../GearLoader';
import { formatMoney, formatCompactMoney, formatCount } from '../../utils/currency';
import { useBreakpoint } from '../../utils/useBreakpoint';

const DEFAULT_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 days' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

const NAVY = '#2a276e';
const LAV = '#9B8CFF';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GREEN = '#16a34a';

// Ageing buckets get progressively hotter, because "how old" is the whole point
// of that chart. Every other chart is single-hue unless the data says otherwise.
const AGEING_COLORS = [NAVY, AMBER, AMBER, RED];

// A little air above the tallest column. Without it recharts puts dataMax flush
// against the top of the plot area and the biggest bar reads as clipped.
const HEADROOM = [
  (min) => (min < 0 ? Math.floor(min * 1.12) : 0),
  (max) => Math.ceil(max * 1.08),
];

/**
 * The right drawer behind a KPI card, on any screen.
 *
 * Payments, Lab, Inventory and Expenses all use this one component. Two things
 * differ between them:
 *
 *   Where the payload comes from. Pass `endpoint` and it is fetched; pass
 *   `data` and it is used as-is. The second exists because the Expenses page
 *   already holds every row its cards were computed from, so a round trip would
 *   only introduce a way for the drawer and the card above it to disagree.
 *
 *   What the chart is. `data.chart` picks it: bar, hbar, area, donut or
 *   waterfall. This used to be a bar chart in every case, which meant a
 *   part-of-whole (where did the money go), a ranking (who do I owe most) and a
 *   trend (is spending rising) were all drawn as the same upright bars — the
 *   one shape that answers none of those three questions well.
 *
 * `period` is deliberately independent of the page's own date filters: the page
 * filter narrows *which records* you're looking at, this one only controls the
 * chart's x-axis. Inheriting a one-day page filter would leave every chart with
 * a single bar. Record filters (search, status, …) *are* inherited, so the
 * drawer always describes the same population as the card that opened it.
 */
const KpiDetailDrawer = ({
  card,
  filters,
  endpoint = '/invoices/kpi-detail',
  data: providedData,
  onPeriodChange,
  rowLabel,
  onClose,
}) => {
  const [period, setPeriod] = useState('all');
  const [fetched, setFetched] = useState(null);
  // Which bar or wedge was clicked. The rows already carry the bucket they
  // belong to, so narrowing the list is local: selecting should feel instant,
  // and a round trip to re-filter data already on screen would not.
  const [picked, setPicked] = useState(null);
  const [loading, setLoading] = useState(false);
  const bp = useBreakpoint();

  const metric = card?.key;
  const local = providedData !== undefined;
  const data = local ? providedData : fetched;

  const load = useCallback(async () => {
    if (!metric || local) return;
    setLoading(true);
    try {
      const params = { metric, period, ...(filters || {}) };
      setFetched(await api.get(endpoint, { params }));
    } catch {
      setFetched(null);
    } finally {
      setLoading(false);
    }
  }, [metric, period, filters, endpoint, local]);

  useEffect(() => { load(); }, [load]);

  // Reset to All time whenever a different card opens, so the drawer never
  // inherits the last card's window.
  useEffect(() => { setPeriod('all'); }, [metric]);
  useEffect(() => { onPeriodChange?.(period); }, [period, onPeriodChange]);

  // A selection made in one window means nothing in another.
  useEffect(() => { setPicked(null); }, [metric, period]);

  // Escape closes, and the page behind shouldn't scroll while it's open.
  useEffect(() => {
    if (!card) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [card, onClose]);

  if (!card) return null;

  const series = data?.series || [];
  const allRows = data?.rows || [];
  // Rows carry the bar they belong to. Falls back to showing everything when a
  // payload has not filled `bucket` in, so an older endpoint degrades to the
  // previous behaviour rather than an empty list.
  const canFilter = allRows.some((r) => r.bucket);
  const rows = picked && canFilter ? allRows.filter((r) => r.bucket === picked) : allRows;
  // A payload can name its own series — `bars: [{ key, label, color }]` — which
  // is what lets one chart carry four expense groups or five payment modes.
  // `keys` is the older cash/digital shape and is still honoured, so the
  // endpoints that predate this keep working untouched.
  const bars = data?.bars
    || ((data?.keys || []).length > 1
      ? [{ key: 'cash', label: 'Cash', color: NAVY }, { key: 'digital', label: 'Digital', color: LAV }]
      : null);
  const stacked = (bars?.length || 0) > 1;
  // Whether the y-axis is currency. Declared by the card, because only the card
  // knows — 'count of open lab cases' and 'rupees owed' are both plain numbers
  // to this component. The payload may override per response.
  const money = data?.is_money ?? card.isMoney ?? false;
  const chart = data?.chart || 'bar';
  const periods = data?.periods === false ? null : (data?.periods || DEFAULT_PERIODS);
  const chartHeight = bp === 'mobile' ? 170 : bp === 'tablet' ? 200 : 230;

  const axisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 10, fontWeight: 600, fill: '#9ca3af' },
  };

  const fmtValue = (v) => (money ? formatCompactMoney(v) : formatCount(v));
  const fmtFull = (v) => (money ? formatMoney(v) : formatCount(v));

  // White, not black. The dark tooltip was legible against a chart and nothing
  // else — over a pale grid it read as a hole punched in the drawer, and the
  // muted secondary text inside it fell below contrast entirely.
  const tooltipStyle = {
    contentStyle: {
      borderRadius: 10,
      border: '1px solid #e5e7eb',
      background: '#fff',
      color: '#111827',
      fontSize: 11,
      boxShadow: '0 8px 24px rgba(17, 24, 39, 0.12)',
      padding: '8px 10px',
    },
    labelStyle: { color: '#6b7280', fontSize: 10, fontWeight: 700, marginBottom: 2 },
    itemStyle: { color: '#111827', fontSize: 11, fontWeight: 600, padding: 0 },
    cursor: { fill: 'rgba(42, 39, 110, 0.06)' },
  };

  const select = (label) => {
    if (!canFilter || !label) return;
    setPicked((prev) => (prev === label ? null : label));
  };

  const dim = (label) => (picked && label !== picked ? 0.28 : 1);

  // ── Chart bodies ───────────────────────────────────────────────────────────

  /**
   * A ranking. Horizontal, because the labels are names and names read across.
   *
   * Height follows the number of bars rather than sitting at a fixed block, so
   * two payees do not get 230px of chart with 130px of white space in it.
   */
  const HorizontalBars = () => (
    <ResponsiveContainer width="100%" height={Math.min(Math.max(series.length * 38 + 24, 110), 340)}>
      <BarChart
        layout="vertical"
        data={series}
        margin={{ left: 0, right: 44, top: 4, bottom: 4 }}
        onClick={(e) => select(e?.activeLabel)}
        style={{ cursor: canFilter ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={fmtValue} hide />
        <YAxis
          type="category"
          dataKey="label"
          {...axisProps}
          width={bp === 'mobile' ? 84 : 116}
          tick={{ fontSize: 10, fontWeight: 600, fill: '#4b5563' }}
        />
        <Tooltip {...tooltipStyle} formatter={(v) => [fmtFull(v), 'Total']} />
        <Bar dataKey="total" barSize={16} radius={[0, 3, 3, 0]}>
          {series.map((s, i) => (
            <Cell key={i} fill={s.color || NAVY} fillOpacity={dim(s.label)} />
          ))}
          <LabelList
            dataKey="total"
            position="right"
            formatter={(v) => fmtValue(v)}
            style={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  /**
   * A trend over time. Filled, because the area under a collections line is the
   * money collected. Stacks when the payload names more than one series, so a
   * cash/digital split reads as one total with its composition inside it.
   */
  const TrendArea = () => {
    const strokeOf = (i) => bars?.[i]?.color || (data?.tone === 'bad' ? RED : NAVY);
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart
          data={series}
          margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
          onClick={(e) => select(e?.activeLabel)}
          style={{ cursor: canFilter ? 'pointer' : 'default' }}
        >
          <defs>
            {(bars || [{ key: 'total' }]).map((b, i) => (
              <linearGradient key={b.key} id={`kpiArea_${b.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeOf(i)} stopOpacity={stacked ? 0.55 : 0.28} />
                <stop offset="100%" stopColor={strokeOf(i)} stopOpacity={stacked ? 0.25 : 0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} width={money ? 52 : 30} tickFormatter={fmtValue} allowDecimals={false} />
          <Tooltip
            {...tooltipStyle}
            cursor={{ stroke: '#c9c3f5' }}
            formatter={(v, n) => [fmtFull(v), bars?.find((b) => b.key === n)?.label || 'Total']}
          />
          {data?.average > 0 && !stacked && (
            <ReferenceLine
              y={data.average}
              stroke="#9ca3af"
              strokeDasharray="4 4"
              label={{
                value: `avg ${fmtValue(data.average)}`,
                position: 'insideTopRight',
                fontSize: 9,
                fill: '#9ca3af',
              }}
            />
          )}
          {(bars || [{ key: 'total' }]).map((b, i) => (
            <Area
              key={b.key}
              type="monotone"
              dataKey={b.key}
              stackId={stacked ? 'a' : undefined}
              stroke={strokeOf(i)}
              strokeWidth={2}
              fill={`url(#kpiArea_${b.key})`}
              dot={stacked ? false : { r: 2.5, strokeWidth: 0, fill: strokeOf(i) }}
              activeDot={{ r: 4 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  /**
   * Two or more measures side by side per period — the shape a P&L is read in.
   *
   * Revenue next to profit, month by month, is the one view that answers "is
   * this business working" without arithmetic. A single line of net would hide
   * whether a bad month was weak income or heavy spending.
   *
   * A bar may recolour per period (`negativeKey`), so a loss month shows red
   * without needing a second series that is empty most of the time.
   */
  const GroupedBars = () => (
    <ResponsiveContainer width="100%" height={chartHeight + 10}>
      <BarChart
        data={series}
        margin={{ left: 0, right: 8, top: 16, bottom: 0 }}
        barGap={3}
        onClick={(e) => select(e?.activeLabel)}
        style={{ cursor: canFilter ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval={0} />
        <YAxis {...axisProps} width={money ? 52 : 30} tickFormatter={fmtValue} domain={HEADROOM} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v, n) => [fmtFull(v), bars?.find((b) => b.key === n)?.label || n]}
        />
        <ReferenceLine y={0} stroke="#9ca3af" />
        {(bars || []).map((b) => (
          <Bar key={b.key} dataKey={b.key} barSize={18} radius={[3, 3, 0, 0]}>
            {series.map((s, i) => (
              <Cell
                key={i}
                fill={b.negativeKey && Number(s[b.key]) < 0 ? RED : b.color}
                fillOpacity={dim(s.label)}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  /**
   * One column per period, cut into its parts.
   *
   * This is what a trend line could not do: the height says how much went out
   * and the segments say what it went out on, so a month that doubled because
   * of one equipment purchase is distinguishable at a glance from one that
   * doubled across the board.
   */
  const StackedBars = () => (
    <ResponsiveContainer width="100%" height={chartHeight + 10}>
      <BarChart
        data={series}
        margin={{ left: 0, right: 8, top: 16, bottom: 0 }}
        onClick={(e) => select(e?.activeLabel)}
        style={{ cursor: canFilter ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval={0} />
        <YAxis {...axisProps} width={money ? 52 : 30} tickFormatter={fmtValue} domain={HEADROOM} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v, n) => (Number(v) > 0
            ? [fmtFull(v), bars?.find((b) => b.key === n)?.label || n]
            : null)}
        />
        {(bars || []).map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            stackId="a"
            barSize={30}
            radius={i === (bars.length - 1) ? [3, 3, 0, 0] : undefined}
          >
            {series.map((s, j) => <Cell key={j} fill={b.color} fillOpacity={dim(s.label)} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  /** A part of a whole. The hole carries the total, so the wedges stay wedges. */
  const Donut = () => {
    const total = series.reduce((s, d) => s + (Number(d.total) || 0), 0);
    const outer = bp === 'mobile' ? 66 : 80;
    return (
      <div className="relative">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart>
            <Pie
              data={series}
              dataKey="total"
              nameKey="label"
              innerRadius={outer * 0.62}
              outerRadius={outer}
              paddingAngle={2}
              stroke="none"
              onClick={(e) => select(e?.label ?? e?.payload?.label)}
              style={{ cursor: canFilter ? 'pointer' : 'default' }}
            >
              {series.map((s, i) => (
                <Cell key={i} fill={s.color || NAVY} fillOpacity={dim(s.label)} />
              ))}
            </Pie>
            <Tooltip
              {...tooltipStyle}
              formatter={(v, n) => [
                `${fmtFull(v)}${total > 0 ? ` · ${Math.round((v / total) * 100)}%` : ''}`, n,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] font-semibold text-gray-400">{data?.donut_label || 'Total'}</span>
          <span className="text-base font-extrabold text-gray-900 tabular-nums">{fmtValue(total)}</span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
          {series.map((s) => (
            <button
              key={s.label}
              onClick={() => select(s.label)}
              className={`flex items-center gap-1.5 text-[10px] transition-opacity ${
                picked && s.label !== picked ? 'opacity-40' : ''
              } ${canFilter ? 'hover:underline' : 'cursor-default'}`}
            >
              <i className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color || NAVY }} />
              <span className="text-gray-600">{s.label}</span>
              <span className="text-gray-400 tabular-nums">
                {total > 0 ? `${Math.round((s.total / total) * 100)}%` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Money in, then every cost knocked off it, then what is left.
   *
   * A waterfall rather than three numbers because the question behind the Net
   * card is not "what is net", it is "where did it go" — and only a chart that
   * shows each cost taking a bite out of the bar answers that in one look.
   *
   * Each row carries `range: [bottom, top]` — a floating bar, not a bar on an
   * invisible pedestal. The pedestal version had to clamp at zero, so once a
   * clinic was past break-even its last costs sat flat on the floor instead of
   * marching down through it, which is the one moment the chart matters.
   */
  const Waterfall = () => (
    <ResponsiveContainer width="100%" height={chartHeight + 34}>
      <BarChart
        data={series}
        margin={{ left: 0, right: 8, top: 18, bottom: 0 }}
        onClick={(e) => select(e?.activeLabel)}
        style={{ cursor: canFilter ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
        <XAxis
          dataKey="short"
          {...axisProps}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={54}
        />
        <YAxis {...axisProps} width={52} tickFormatter={fmtValue} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v, n, item) => {
            const p = item?.payload || {};
            const label = p.kind === 'in' ? 'Collected'
              : p.kind === 'net' ? (p.negative ? 'Short by' : 'Left over') : 'Spent';
            return [`${p.kind === 'out' ? '-' : ''}${fmtFull(p.total)}`, label];
          }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ''}
        />
        <ReferenceLine y={0} stroke="#9ca3af" />
        <Bar dataKey="range" barSize={30} radius={[3, 3, 0, 0]}>
          {series.map((s, i) => (
            <Cell
              key={i}
              fill={s.kind === 'in' ? GREEN : s.kind === 'net' ? (s.negative ? RED : GREEN) : AMBER}
              fillOpacity={dim(s.label)}
            />
          ))}
          <LabelList
            dataKey="total"
            position="top"
            formatter={(v) => (v > 0 ? fmtValue(v) : '')}
            style={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  /** The original: discrete buckets compared side by side. */
  const VerticalBars = () => (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={series}
        margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
        onClick={(e) => select(e?.activeLabel)}
        style={{ cursor: canFilter ? 'pointer' : 'default' }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={money ? 52 : 30} tickFormatter={fmtValue} allowDecimals={false} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name) => [
            fmtFull(value),
            bars?.find((b) => b.key === name)?.label || 'Total',
          ]}
        />
        {stacked ? (
          bars.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              stackId="a"
              barSize={22}
              radius={i === bars.length - 1 ? [3, 3, 0, 0] : undefined}
            >
              {series.map((s, j) => <Cell key={j} fill={b.color} fillOpacity={dim(s.label)} />)}
            </Bar>
          ))
        ) : (
          <Bar dataKey="total" barSize={26} radius={[3, 3, 0, 0]}>
            {series.map((s, i) => (
              <Cell
                key={i}
                // Dim the others rather than recolouring the chosen one, so the
                // selection reads without introducing a colour that means
                // nothing on its own.
                fill={s.color || (data.x_is_ageing ? AGEING_COLORS[i] || NAVY : NAVY)}
                fillOpacity={dim(s.label)}
              />
            ))}
            {/* Ageing is nearly always one tall bar beside three slivers — the
                whole point is the slivers, and at 2px tall they're unreadable
                without their value printed above them. */}
            <LabelList
              dataKey="total"
              position="top"
              formatter={(v) => (v > 0 ? fmtValue(v) : '')}
              style={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }}
            />
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );

  // What the reader is actually tapping, so the hint under an area chart does
  // not tell them to tap a bar.
  const TAPPABLE = {
    donut: 'slice', area: 'point', line: 'point', stacked: 'column', grouped: 'period',
  };

  const CHARTS = {
    hbar: HorizontalBars,
    area: TrendArea,
    line: TrendArea,
    donut: Donut,
    waterfall: Waterfall,
    grouped: GroupedBars,
    stacked: StackedBars,
    bar: VerticalBars,
  };
  const Chart = CHARTS[chart] || VerticalBars;

  const NARRATIVE_TONE = {
    good: 'bg-green-50 text-green-900',
    bad: 'bg-red-50 text-red-900',
    warn: 'bg-amber-50 text-amber-900',
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet on a phone, side drawer from sm up — a full-height side
          panel at 390px covers the screen with only a small ✕ to escape. */}
      <div className="absolute inset-x-0 bottom-0 top-14 rounded-t-2xl sm:rounded-none sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 w-full sm:max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">

        <div className="bg-[#2a276e] text-white px-4 md:px-5 py-3.5 flex-shrink-0">
          <div className="sm:hidden w-9 h-1 rounded-full bg-white/30 mx-auto mb-3" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-tight">{card.title}</h3>
              <p className="text-[11px] text-white/70 mt-0.5 truncate">
                {card.display}
                {card.storyShort ? ` · ${card.storyShort}` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 hover:bg-white/15 rounded transition-colors flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Timeline filter. Squared corners, not pills. Hidden for metrics with
            no time dimension at all — a vendor list has no "last 7 days". */}
        {periods && (
          <div className="flex gap-1.5 px-4 md:px-5 py-2.5 border-b border-gray-200 flex-wrap flex-shrink-0">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded border transition-colors min-h-[1.9rem] ${
                  period === p.value
                    ? 'bg-[#2a276e] border-[#2a276e] text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <GearLoader size="w-10 h-10" />
            </div>
          ) : !data ? (
            <p className="text-sm text-gray-500 text-center py-12">Couldn't load this breakdown.</p>
          ) : (
            <>
              {/* The written read of the chart, next to the figures it names so
                  the prose cannot drift from the numbers. */}
              {data.narrative && (
                <p className={`rounded-lg px-3.5 py-3 text-xs leading-relaxed mb-4 ${
                  NARRATIVE_TONE[data.tone] || 'bg-[#f0f0fd] text-gray-700'
                }`}>
                  {data.narrative}
                </p>
              )}

              {/* A short strip of the figures worth quoting, above the chart
                  rather than buried under it. */}
              {data.insights?.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {data.insights.map((s) => (
                    <div key={s.label} className="border border-gray-200 rounded-lg px-2.5 py-2 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 truncate">{s.label}</p>
                      <p className={`text-sm font-extrabold tabular-nums truncate ${
                        s.tone === 'good' ? 'text-green-700'
                          : s.tone === 'bad' ? 'text-red-600'
                            : s.tone === 'warn' ? 'text-amber-600' : 'text-gray-900'
                      }`}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {series.length > 0 && (
                <div className="mb-5">
                  <Chart />

                  {(data.x_label || stacked || canFilter) && (
                    <div className="flex items-center justify-between mt-1.5 gap-3">
                      <span className="text-[10px] text-gray-400">
                        {data.x_label
                          || (canFilter ? `Tap a ${TAPPABLE[chart] || 'bar'} to filter the list below` : '')}
                      </span>
                      {stacked && (
                        <span className="flex items-center gap-x-3 gap-y-1 flex-wrap justify-end flex-shrink-0">
                          {bars.map((b) => (
                            <span key={b.key} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                              <i className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                              {b.label}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {picked && (
                <div className="flex items-center justify-between gap-2 mb-3 rounded-lg bg-[#f0f0fd] px-3 py-2">
                  <span className="text-xs text-[#2a276e]">
                    Showing <strong>{picked}</strong> only
                    <span className="text-[#2a276e]/60"> · {rows.length} of {allRows.length}</span>
                  </span>
                  <button
                    onClick={() => setPicked(null)}
                    className="text-[11px] font-bold text-[#2a276e] hover:underline flex-shrink-0"
                  >
                    Show all
                  </button>
                </div>
              )}

              {rows.length > 0 ? (
                <div>
                  {(data.row_label || rowLabel) && (
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                      {data.row_label || rowLabel}
                    </h4>
                  )}
                  <div>
                    {rows.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0"
                      >
                        {r.color && (
                          <i
                            className="w-1.5 h-8 rounded-full flex-shrink-0"
                            style={{ background: r.color }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate flex items-center gap-1.5">
                            {r.title}
                            {r.stalled && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 flex-shrink-0">
                                STALLED
                              </span>
                            )}
                            {r.tag && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                                r.tagTone === 'bad' ? 'bg-red-50 text-red-600'
                                  : r.tagTone === 'good' ? 'bg-green-50 text-green-700'
                                    : 'bg-amber-50 text-amber-700'
                              }`}>
                                {r.tag}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">{r.subtitle}</p>
                          {typeof r.progress === 'number' && (
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5 max-w-[10rem]">
                              <div
                                className="h-full bg-[#2a276e] rounded-full"
                                style={{ width: `${Math.min(100, r.progress)}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold text-gray-900 tabular-nums flex-shrink-0">
                          {/* A row can carry a ready-made string (a lab case's
                              "41 days"), otherwise the number is formatted by
                              whether this metric is currency at all. */}
                          {r.display ?? (r.amount != null
                            ? (r.amount_is_money ?? money ? formatMoney(r.amount) : formatCount(r.amount))
                            : '')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">
                  Nothing to list for this selection.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KpiDetailDrawer;
