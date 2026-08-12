import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Loader2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api } from '../../utils/api';
import { formatMoney } from '../../utils/currency';
import { formatDateTime } from '../../utils/datetime';
import Pagination from '../Pagination';
import ExpenseModal from '../payments/ExpenseModal';

/**
 * The money ledger: everything in and everything out, in date order.
 *
 * Written as its own component rather than lifted out of Payments, where it
 * shared that page's table, filters and pagination state with the invoice list.
 * Untangling it would have meant rewriting how invoices render, for no gain
 * beyond reuse of a table that shows different columns anyway.
 *
 * It keeps the inflow figure even though it lives under Expenses: what went out
 * only means something beside what came in, and hiding the other half would
 * turn a net position into a list of outgoings.
 */

const PER_PAGE = 25;

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'expense', label: 'Money out' },
  { value: 'invoice', label: 'Money in' },
];

const MoneyLedger = ({ refreshKey = 0 }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ inflow: 0, outflow: 0 });
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [expenseId, setExpenseId] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dates = {};
      if (from) dates.date_from = from;
      if (to) dates.date_to = to;
      const paged = { ...dates, ...(type ? { type_filter: type } : {}) };

      const [list, count, all] = await Promise.all([
        api.get('/ledger/', { params: { skip: (page - 1) * PER_PAGE, limit: PER_PAGE, ...paged } }),
        api.get('/ledger/count', { params: paged }),
        // Totals cover the whole date window regardless of the type toggle, so
        // switching to "Money out" narrows the list without making the net
        // position look like it changed.
        api.get('/ledger/', { params: { skip: 0, limit: 10000, ...dates } }),
      ]);
      setRows(list || []);
      setTotal(Number(count?.total) || 0);

      let inflow = 0, outflow = 0;
      (all || []).forEach((r) => {
        const amt = Number(r.amount) || 0;
        if (r.type === 'expense') outflow += amt; else inflow += amt;
      });
      setStats({ inflow, outflow });
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, type, from, to]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(1); }, [type, from, to]);

  const net = useMemo(() => stats.inflow - stats.outflow, [stats]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Three figures, not a wall of them. Out is what this section is for, so
          it leads; in is there because a net position needs both. */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
        <div className="border border-gray-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Money out</p>
          <p className="text-lg md:text-xl font-bold text-red-600 tabular-nums mt-0.5">
            {formatMoney(stats.outflow)}
          </p>
        </div>
        <div className="border border-gray-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Money in</p>
          <p className="text-lg md:text-xl font-bold text-green-700 tabular-nums mt-0.5">
            {formatMoney(stats.inflow)}
          </p>
        </div>
        <div className="border border-gray-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Net</p>
          <p className={`text-lg md:text-xl font-bold tabular-nums mt-0.5 ${
            net < 0 ? 'text-red-600' : 'text-gray-900'
          }`}>
            {formatMoney(net)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select value={type} onChange={(e) => setType(e.target.value)}
                className="h-9 px-2.5 border border-gray-200 rounded-lg text-sm bg-white">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
               className="h-9 px-2.5 border border-gray-200 rounded-lg text-sm" />
        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
               className="h-9 px-2.5 border border-gray-200 rounded-lg text-sm" />
        <button
          onClick={() => setAdding(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-bold"
        >
          <Plus size={15} /> Record an expense
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-xl">
        {loading ? (
          <div className="py-16 grid place-items-center text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-sm font-semibold text-gray-700">Nothing in this window</p>
            <p className="text-xs text-gray-500 mt-1">
              Settling a payable records itself here automatically.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => {
              const out = r.type === 'expense';
              return (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    onClick={() => out && setExpenseId(r.id)}
                    className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-3 ${
                      out ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full grid place-items-center flex-shrink-0 ${
                      out ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                    }`}>
                      {out ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 truncate">
                        {r.entity_name || r.category || (out ? 'Expense' : 'Payment')}
                      </span>
                      <span className="block text-[11px] text-gray-400 truncate">
                        {[r.category, r.payment_method, r.description].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="text-right flex-shrink-0">
                      <span className={`block text-sm font-bold tabular-nums ${
                        out ? 'text-red-600' : 'text-green-700'
                      }`}>
                        {out ? '-' : '+'}{formatMoney(Math.abs(Number(r.amount) || 0))}
                      </span>
                      <span className="block text-[11px] text-gray-400">
                        {r.date ? formatDateTime(r.date) : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Pagination page={page} pageSize={PER_PAGE} totalItems={total}
                  onPageChange={setPage} className="flex-shrink-0" />

      {expenseId && (
        <ExpenseModal expenseId={expenseId} onClose={() => { setExpenseId(null); load(); }} />
      )}
      {adding && (
        <ExpenseModal expenseId={null} onClose={() => { setAdding(false); load(); }} />
      )}
    </div>
  );
};

export default MoneyLedger;
