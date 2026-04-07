import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

/* ──────────────────────────────────────────────
   DESIGN TOKENS  (referenced by all components)
   ────────────────────────────────────────────── */
export const COLORS = {
  brand:   { bg: 'bg-brand-50',  text: 'text-brand-700',  icon: 'text-brand-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',  icon: 'text-amber-600' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',   icon: 'text-rose-600' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',    icon: 'text-sky-600' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700', icon: 'text-violet-600' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-600',  icon: 'text-slate-500' },
};

/* ──────────────────────────────────────────────
   PAGE HEADER
   ────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────
   STAT CARD
   ────────────────────────────────────────────── */
export function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  const c = COLORS[color] || COLORS.brand;
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-card p-4 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
          <Icon size={18} className={c.icon} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-lg font-semibold text-slate-900 leading-tight mt-0.5">{value}</p>
          {sub && <p className="text-2xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   CARD  (generic wrapper)
   ────────────────────────────────────────────── */
export function Card({ children, className = '', padding = true }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/60 shadow-card ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, actions }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────
   BADGE / PILL
   ────────────────────────────────────────────── */
export function Badge({ children, color = 'slate', className = '' }) {
  const c = COLORS[color] || COLORS.slate;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold leading-tight ${c.bg} ${c.text} ${className}`}>
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────
   STATUS MAP  (reusable across pages)
   ────────────────────────────────────────────── */
export const STATUS_MAP = {
  active:          { label: 'Active',       color: 'emerald' },
  suspended:       { label: 'Suspended',    color: 'rose' },
  open:            { label: 'Open',         color: 'amber' },
  in_progress:     { label: 'In Progress',  color: 'sky' },
  resolved:        { label: 'Resolved',     color: 'emerald' },
  closed:          { label: 'Closed',       color: 'slate' },
  paid_verified:   { label: 'Paid',         color: 'emerald' },
  paid_unverified: { label: 'Paid (unv.)',  color: 'sky' },
  partially_paid:  { label: 'Partial',      color: 'amber' },
  finalized:       { label: 'Finalized',    color: 'brand' },
  draft:           { label: 'Draft',        color: 'slate' },
  cancelled:       { label: 'Cancelled',    color: 'rose' },
  paused:          { label: 'Paused',       color: 'amber' },
  expired:         { label: 'Expired',      color: 'slate' },
  sent:            { label: 'Sent',         color: 'emerald' },
  delivered:       { label: 'Delivered',    color: 'emerald' },
  failed:          { label: 'Failed',       color: 'rose' },
  completed:       { label: 'Completed',    color: 'emerald' },
  pending:         { label: 'Pending',      color: 'amber' },
};

export function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: 'slate' };
  return <Badge color={s.color}>{s.label}</Badge>;
}

/* ──────────────────────────────────────────────
   DATA TABLE
   ────────────────────────────────────────────── */
export function DataTable({ columns, data, loading, emptyIcon: EmptyIcon, emptyText = 'No data found', onRowClick }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-brand-400" />
      </div>
    );
  }
  if (!data?.length) {
    return (
      <div className="py-20 text-center">
        {EmptyIcon && <EmptyIcon size={28} className="mx-auto mb-2 text-slate-300" />}
        <p className="text-sm text-slate-400">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map(col => (
              <th key={col.key} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap" style={col.width ? { width: col.width } : {}}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((row, i) => (
            <tr key={row.id ?? i} className={`hover:bg-slate-50/60 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)}>
              {columns.map(col => (
                <td key={col.key} className="py-2.5 px-4 whitespace-nowrap">
                  {col.render ? col.render(row) : <span className="text-sm text-slate-700">{row[col.key] ?? '—'}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────────────────────────
   PAGINATION
   ────────────────────────────────────────────── */
export function Pagination({ page, total, perPage, onPageChange }) {
  const totalPages = Math.ceil(total / perPage) || 1;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <span className="text-xs text-slate-400">
        {total > 0 ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total.toLocaleString()}` : '0 results'}
      </span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-xs font-medium text-slate-600">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   FILTER SELECT
   ────────────────────────────────────────────── */
export function FilterSelect({ value, onChange, options, placeholder = 'All' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-8 px-2.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 transition-colors"
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
          {typeof opt === 'string' ? opt.replace(/_/g, ' ') : opt.label}
        </option>
      ))}
    </select>
  );
}

/* ──────────────────────────────────────────────
   SECTION LABEL  (used in sidebar)
   ────────────────────────────────────────────── */
export function SectionLabel({ children }) {
  return (
    <p className="px-3 pt-5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
      {children}
    </p>
  );
}

/* ──────────────────────────────────────────────
   TAB BAR
   ────────────────────────────────────────────── */
export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0.5 border-b border-slate-200">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
            active === t.id
              ? 'border-brand text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   SPINNER (full-page)
   ────────────────────────────────────────────── */
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={22} className="animate-spin text-brand-400" />
    </div>
  );
}

/* ──────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────── */
export const fmt = {
  inr: (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
  num: (n) => Number(n || 0).toLocaleString(),
  date: (d) => d ? d.slice(0, 10) : '—',
  datetime: (d) => d ? d.slice(0, 16).replace('T', ' ') : '—',
  ago: (d) => {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  },
};
