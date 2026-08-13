import React, { useState, useEffect, useCallback } from 'react';
import { FlaskConical, Stethoscope, Check, Undo2, Wallet, RefreshCw } from 'lucide-react';
import { notify } from '../../utils/notify';
import { api } from '../../utils/api';
import { formatMoney, formatCount } from '../../utils/currency';
import { formatDate } from '../../utils/datetime';
import EmptyState from '../common/EmptyState';
import { receipt } from '../../assets/illustrations';
import { useBreakpoint } from '../../utils/useBreakpoint';

/**
 * What the clinic owes for work already done: lab bills and consultant fees.
 *
 * These used to be invisible. `LabOrder.cost` recorded what a lab charged and
 * then went nowhere, so the Activity tab's money-out counted manual expenses
 * only. Settling a row here writes an Expense, which is what puts it into the
 * ledger, the CSV export and the dashboard's Net card.
 */

const KIND_ICON = { lab: FlaskConical, consultant: Stethoscope };

const PayablesTable = ({ onSettled }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showPaid, setShowPaid] = useState(false);
  const bp = useBreakpoint();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/clinical/case-costs', {
        params: showPaid ? {} : { status: 'unpaid' },
      });
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [showPaid]);

  useEffect(() => { load(); }, [load]);

  const settle = async (row) => {
    setBusyId(row.id);
    try {
      await api.post(`/clinical/case-costs/${row.id}/settle`, { payment_method: 'Cash' });
      notify.done(`Paid ${formatMoney(row.amount)} to ${row.vendor_name || 'vendor'}`);
      await load();
      onSettled?.();
    } catch (e) {
      notify.problem(e, 'Could not record that payment');
    } finally {
      setBusyId(null);
    }
  };

  const unsettle = async (row) => {
    setBusyId(row.id);
    try {
      await api.post(`/clinical/case-costs/${row.id}/unsettle`);
      notify.done('Payment undone, and its expense removed from Activity');
      await load();
      onSettled?.();
    } catch (e) {
      notify.problem(e, 'Could not undo that');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2a276e]" />
      </div>
    );
  }

  const rows = data?.items || [];

  if (!rows.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <EmptyState
          image={receipt}
          title={showPaid ? 'Nothing recorded yet' : 'Nothing owed right now'}
          subtitle="Lab bills appear here as soon as a lab order has a cost on it. Consultant fees are added from the case paper."
        />
        <div className="flex justify-center mt-4">
          <button onClick={() => setShowPaid((v) => !v)} className="text-xs font-bold text-[#29828a] hover:underline">
            {showPaid ? 'Show only unpaid' : 'Include already paid'}
          </button>
        </div>
      </div>
    );
  }

  const Row = ({ r }) => {
    const Icon = KIND_ICON[r.kind] || Wallet;
    const paid = r.status === 'paid';
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
        <span className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${
          paid ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
        }`}>
          <Icon size={15} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {r.vendor_name || 'Unassigned'}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              r.kind === 'lab' ? 'bg-[#29828a]/10 text-[#29828a]' : 'bg-purple-50 text-purple-700'
            }`}>
              {r.kind === 'lab' ? 'Lab' : r.kind === 'consultant' ? 'Consultant' : 'Other'}
            </span>
            {paid && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-700">
                PAID {r.paid_on ? formatDate(r.paid_on) : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 truncate">
            {r.description || 'Work'}
            {r.patient_name ? ` · ${r.patient_name}` : ''}
            {r.basis === 'percentage' ? ` · ${r.percentage}% of collection` : ''}
          </p>
        </div>

        <span className="text-sm font-bold text-gray-900 tabular-nums flex-shrink-0">
          {formatMoney(r.amount)}
        </span>

        <button
          onClick={() => (paid ? unsettle(r) : settle(r))}
          disabled={busyId === r.id}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 min-h-[2.25rem] rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
            paid
              ? 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              : 'bg-[#29828a] hover:bg-[#1f6b72] text-white'
          }`}
        >
          {busyId === r.id
            ? <RefreshCw size={13} className="animate-spin" />
            : paid ? <><Undo2 size={13} />{bp !== 'mobile' && ' Undo'}</>
              : <><Check size={13} />{bp !== 'mobile' && ' Mark paid'}</>}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-bold text-amber-700">
            {formatMoney(data.unpaid)} owed
          </span>
          <span className="text-gray-400">
            {formatCount(rows.filter((r) => r.status === 'unpaid').length)} unpaid
            {showPaid && ` · ${formatMoney(data.paid)} already paid`}
          </span>
        </div>
        <button onClick={() => setShowPaid((v) => !v)} className="text-xs font-bold text-[#29828a] hover:underline">
          {showPaid ? 'Show only unpaid' : 'Include already paid'}
        </button>
      </div>

      <p className="text-[11px] text-gray-400">
        Marking one paid records it as an expense, so it shows up in Activity and counts
        against your net.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {rows.map((r) => <Row key={r.id} r={r} />)}
      </div>
    </div>
  );
};

export default PayablesTable;
