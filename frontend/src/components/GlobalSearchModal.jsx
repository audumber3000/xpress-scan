import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, X } from 'lucide-react';
import { api } from '../utils/api';

/**
 * GlobalSearchModal — command-palette search across every clinic record.
 *
 * Opens from the header search icon (or ⌘/Ctrl+K). One /search call returns
 * results grouped by type, plus the types this user may view — so the tabs
 * render straight from the response and never duplicate permission rules.
 *
 * Rows are already normalised server-side to {title, subtitle, meta, status,
 * extra, link}, which is why one row renderer covers all five types.
 *
 * Keyboard: ↑/↓ move, ←/→ switch tab, ↵ open, esc close.
 */

const TAB_LABELS = {
  patients: 'Patients',
  appointments: 'Appointments',
  billing: 'Billing',
  stock: 'Stock',
  lab: 'Lab Orders',
};

const COLUMN_HEADS = {
  patients: ['Name', 'Treatment', '', 'Village'],
  appointments: ['Patient', 'When', 'Status', ''],
  billing: ['Invoice / Payment', 'Amount', 'Status', ''],
  stock: ['Item', 'Quantity', 'Status', 'Category'],
  lab: ['Work', 'Vendor', 'Status', 'Due'],
};

/** Status → badge classes, following the style guide's status palette. */
const statusClasses = (status = '') => {
  const s = status.toLowerCase();
  if (/(paid_verified|paid|completed|received|success|in stock|confirmed|accepted)/.test(s))
    return 'bg-green-100 text-green-800 border-green-200';
  if (/(pending|draft|checking|partially_paid|paid_unverified|sent)/.test(s))
    return 'bg-amber-100 text-amber-800 border-amber-200';
  if (/(cancelled|failed|no-show|low stock|overdue)/.test(s))
    return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

/** "paid_unverified" → "Paid unverified" */
const prettyStatus = (status = '') => {
  const s = status.replace(/[_-]/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};

const GlobalSearchModal = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ results: {}, counts: {}, types: [] });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  // Guards against a slow early request overwriting a newer one's results.
  const requestId = useRef(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setData({ results: {}, counts: {}, types: [] });
      setTab(null);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Debounced search. The endpoint needs 2+ chars, so don't fire on 1.
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setData({ results: {}, counts: {}, types: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(term)}&limit=10`);
        if (id !== requestId.current) return;
        setData({ results: res?.results || {}, counts: res?.counts || {}, types: res?.types || [] });
        setActive(0);
      } catch {
        if (id !== requestId.current) return;
        setData({ results: {}, counts: {}, types: [] });
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  // Tabs that actually have hits, so we never show an empty tab.
  const tabs = useMemo(
    () => (data.types || []).filter((t) => (data.counts?.[t] || 0) > 0),
    [data]
  );

  // Land on the first tab with results; keep the user's choice while it stays valid.
  useEffect(() => {
    if (!tabs.length) { setTab(null); return; }
    if (!tab || !tabs.includes(tab)) { setTab(tabs[0]); setActive(0); }
  }, [tabs, tab]);

  const rows = (tab && data.results?.[tab]) || [];

  const openRow = useCallback((row) => {
    if (!row?.link) return;
    navigate(row.link);
    onClose();
  }, [navigate, onClose]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowLeft' && tabs.length > 1) {
      e.preventDefault();
      const i = tabs.indexOf(tab);
      setTab(tabs[(i - 1 + tabs.length) % tabs.length]); setActive(0);
      return;
    }
    if (e.key === 'ArrowRight' && tabs.length > 1) {
      e.preventDefault();
      const i = tabs.indexOf(tab);
      setTab(tabs[(i + 1) % tabs.length]); setActive(0);
      return;
    }
    if (!rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % rows.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + rows.length) % rows.length); }
    else if (e.key === 'Enter') { e.preventDefault(); openRow(rows[active]); }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const term = query.trim();
  const heads = (tab && COLUMN_HEADS[tab]) || [];
  const totalHits = Object.values(data.counts || {}).reduce((a, b) => a + b, 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[8vh] bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Title */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Search anything</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Patients, appointments, billing, stock and lab orders
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-3 px-4 h-12 rounded-lg bg-gray-50 border border-gray-200 focus-within:border-[#2a276e] focus-within:ring-2 focus-within:ring-[#2a276e]/20 transition-all">
            <Search size={18} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing to search…"
              className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400 bg-transparent"
            />
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex items-center gap-1 px-5 border-b border-gray-200 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setActive(0); }}
                className={`px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  t === tab
                    ? 'border-[#2a276e] text-[#2a276e]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {TAB_LABELS[t] || t}
                <span className="ml-1.5 text-xs font-medium text-gray-400">{data.counts[t]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {term.length < 2 && (
            <div className="px-5 py-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#2a276e]/5 flex items-center justify-center mb-3">
                <Search size={22} className="text-[#2a276e]/40" />
              </div>
              <p className="text-sm text-gray-500">Type at least 2 characters to search</p>
            </div>
          )}

          {term.length >= 2 && loading && (
            <div className="px-5 py-12 flex items-center justify-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#2a276e] rounded-full animate-spin" />
              <span className="text-sm">Searching…</span>
            </div>
          )}

          {term.length >= 2 && !loading && totalHits === 0 && (
            <div className="px-8 py-12 text-center bg-gray-50">
              <p className="text-sm font-medium text-gray-500">No matches found</p>
              <p className="text-xs text-gray-400 mt-1">
                Try a name, phone number, invoice number or item
              </p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <table className="min-w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {heads.map((h, i) => (
                    <th
                      key={i}
                      className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr
                    key={`${row.kind || tab}-${row.id ?? i}`}
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => openRow(row)}
                    className={`cursor-pointer transition-colors ${
                      i === active ? 'bg-[#2a276e]/[0.06]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{row.title}</p>
                      {row.subtitle && (
                        <p className="text-sm text-gray-500 truncate">{row.subtitle}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">{row.meta}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {row.status && (
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${statusClasses(row.status)}`}
                        >
                          {prettyStatus(row.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">{row.extra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer hint bar */}
        <div className="flex items-center gap-5 px-5 h-12 border-t border-gray-200 bg-gray-50 text-xs font-medium text-gray-400">
          <span className="hidden sm:flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-200 bg-white"><ArrowUp size={11} /></kbd>
            <kbd className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-200 bg-white"><ArrowDown size={11} /></kbd>
            Navigate
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center px-1.5 h-5 rounded border border-gray-200 bg-white">←</kbd>
            <kbd className="inline-flex items-center justify-center px-1.5 h-5 rounded border border-gray-200 bg-white">→</kbd>
            Switch tab
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-200 bg-white"><CornerDownLeft size={11} /></kbd>
            Open
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center px-1.5 h-5 rounded border border-gray-200 bg-white">esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
