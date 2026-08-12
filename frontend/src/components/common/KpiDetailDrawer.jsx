import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { api } from '../../utils/api';
import GearLoader from '../GearLoader';
import { formatMoney, formatCompactMoney, formatCount } from '../../utils/currency';
import { useBreakpoint } from '../../utils/useBreakpoint';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 days' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

const NAVY = '#2a276e';
const LAV = '#9B8CFF';
const AMBER = '#f59e0b';
const RED = '#ef4444';

// Ageing buckets get progressively hotter, because "how old" is the whole point
// of that chart. Every other chart is single-hue.
const AGEING_COLORS = [NAVY, AMBER, AMBER, RED];

/**
 * The right drawer behind a KPI card, on any screen.
 *
 * Payments, Lab and Inventory all use this one component; `endpoint` is what
 * differs. Each backend returns the same envelope — `series`, `keys`,
 * `narrative`, `rows` — so the drawer never needs to know which domain it is
 * showing.
 *
 * Its `period` is deliberately independent of the page's own date filters: the
 * page filter narrows *which records* you're looking at, while this one only
 * controls the chart's x-axis. Inheriting a one-day page filter would leave
 * every chart with a single bar. The record filters (search, status, …) *are*
 * inherited, so the drawer always describes the same population as the card
 * that opened it.
 *
 * `rowLabel` names the list under the chart; without it the list is unlabelled
 * rather than mislabelled with a Payments-specific heading.
 */
const KpiDetailDrawer = ({ card, filters, endpoint = '/invoices/kpi-detail', rowLabel, onClose }) => {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  // Which bar was clicked. The rows already carry the bucket they belong to,
  // so narrowing the list is local: clicking a bar should feel instant, and a
  // round trip to re-filter data already on screen would not.
  const [pickedBar, setPickedBar] = useState(null);
  const [loading, setLoading] = useState(false);
  const bp = useBreakpoint();

  const metric = card?.key;

  const load = useCallback(async () => {
    if (!metric) return;
    setLoading(true);
    try {
      const params = { metric, period, ...(filters || {}) };
      setData(await api.get(endpoint, { params }));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [metric, period, filters, endpoint]);

  useEffect(() => { load(); }, [load]);

  // Reset to All time whenever a different card opens, so the drawer never
  // inherits the last card's window.
  useEffect(() => { setPeriod('all'); }, [metric]);

  // A bar selected in one window means nothing in another.
  useEffect(() => { setPickedBar(null); }, [metric, period]);

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
  // backend has not filled `bucket` in, so an older endpoint degrades to the
  // previous behaviour rather than an empty list.
  const canFilter = allRows.some((r) => r.bucket);
  const rows = pickedBar && canFilter
    ? allRows.filter((r) => r.bucket === pickedBar)
    : allRows;
  const stacked = (data?.keys || []).length > 1;
  // Whether the y-axis is currency. Declared by the card, because only the
  // card knows — 'count of open lab cases' and 'rupees owed' are both plain
  // numbers to this component. Backend may override per response.
  const money = data?.is_money ?? card.isMoney ?? false;
  const chartHeight = bp === 'mobile' ? 160 : bp === 'tablet' ? 190 : 220;

  const axisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 10, fontWeight: 600, fill: '#9ca3af' },
  };

  const fmtValue = (v) => (money ? formatCompactMoney(v) : formatCount(v));

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

        {/* Timeline filter. Squared corners, not pills. */}
        <div className="flex gap-1.5 px-4 md:px-5 py-2.5 border-b border-gray-200 flex-wrap flex-shrink-0">
          {PERIODS.map((p) => (
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

        <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <GearLoader size="w-10 h-10" />
            </div>
          ) : !data ? (
            <p className="text-sm text-gray-500 text-center py-12">Couldn't load this breakdown.</p>
          ) : (
            <>
              {/* The written read of the chart. Composed server-side, where the
                  figures are, so the prose can't drift from the numbers. */}
              {data.narrative && (
                <p className="bg-[#f0f0fd] rounded-lg px-3.5 py-3 text-xs leading-relaxed text-gray-700 mb-4">
                  {data.narrative}
                </p>
              )}

              {series.length > 0 && (
                <div className="mb-5">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart
                      data={series}
                      margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
                      onClick={(e) => {
                        if (!canFilter) return;
                        const label = e?.activeLabel;
                        if (!label) return;
                        setPickedBar((prev) => (prev === label ? null : label));
                      }}
                      style={{ cursor: canFilter ? 'pointer' : 'default' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
                      <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                      <YAxis {...axisProps} width={money ? 52 : 30} tickFormatter={fmtValue} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8, border: 'none', background: '#111',
                          color: '#fff', fontSize: 11,
                        }}
                        cursor={{ fill: '#eef0f4' }}
                        formatter={(value, name) => [
                          money ? formatMoney(value) : formatCount(value),
                          name === 'cash' ? 'Cash' : name === 'digital' ? 'Digital' : 'Total',
                        ]}
                      />
                      {stacked ? (
                        <>
                          <Bar dataKey="cash" stackId="a" barSize={22}>
                            {series.map((s, i) => (
                              <Cell key={i} fill={NAVY}
                                    fillOpacity={pickedBar && s.label !== pickedBar ? 0.28 : 1} />
                            ))}
                          </Bar>
                          <Bar dataKey="digital" stackId="a" barSize={22} radius={[3, 3, 0, 0]}>
                            {series.map((s, i) => (
                              <Cell key={i} fill={LAV}
                                    fillOpacity={pickedBar && s.label !== pickedBar ? 0.28 : 1} />
                            ))}
                          </Bar>
                        </>
                      ) : (
                        <Bar dataKey="total" barSize={26} radius={[3, 3, 0, 0]}>
                          {series.map((s, i) => {
                            const base = data.x_is_ageing ? AGEING_COLORS[i] || NAVY : NAVY;
                            // Dim the others rather than recolouring the chosen
                            // one, so the selection reads without introducing a
                            // colour that means nothing on its own.
                            return (
                              <Cell
                                key={i}
                                fill={base}
                                fillOpacity={pickedBar && s.label !== pickedBar ? 0.28 : 1}
                              />
                            );
                          })}
                          {/* Ageing is nearly always one tall bar beside three
                              slivers — the whole point is the slivers, and at
                              2px tall they're unreadable without their value
                              printed above them. */}
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

                  {(data.x_label || stacked || canFilter) && (
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-400">
                        {data.x_label || (canFilter ? 'Tap a bar to filter the list below' : '')}
                      </span>
                      {stacked && (
                        <span className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <i className="w-2 h-2 rounded-full" style={{ background: NAVY }} /> Cash
                          </span>
                          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <i className="w-2 h-2 rounded-full" style={{ background: LAV }} /> Digital
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {pickedBar && (
                <div className="flex items-center justify-between gap-2 mb-3 rounded-lg bg-[#f0f0fd] px-3 py-2">
                  <span className="text-xs text-[#2a276e]">
                    Showing <strong>{pickedBar}</strong> only
                    <span className="text-[#2a276e]/60"> · {rows.length} of {allRows.length}</span>
                  </span>
                  <button
                    onClick={() => setPickedBar(null)}
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
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate flex items-center gap-1.5">
                            {r.title}
                            {r.stalled && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 flex-shrink-0">
                                STALLED
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
