import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, FlaskConical, Stethoscope, Wallet, RefreshCw } from 'lucide-react';
import { notify } from '../../utils/notify';
import { api } from '../../utils/api';
import { formatMoney, getCurrencySymbol } from '../../utils/currency';

/**
 * What this case cost the clinic, and what it therefore earned.
 *
 * Lab lines arrive on their own from the case's lab orders. Consultant fees are
 * added here. The margin line is the point of the whole panel: collection minus
 * costs, which nothing in the app could answer before.
 *
 * Nothing here changes what the patient owes. A cost is money going out; the
 * invoice is money coming in. They only meet in the margin.
 */
const CaseCostsPanel = ({ open, onClose, casePaperId, patientId, patientName }) => {
  const [costs, setCosts] = useState([]);
  const [collected, setCollected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(null); // null = closed

  const load = useCallback(async () => {
    if (!casePaperId) return;
    setLoading(true);
    try {
      const [res, invs] = await Promise.all([
        api.get('/clinical/case-costs', { params: { case_paper_id: casePaperId } }),
        api.get('/invoices', { params: { case_paper_id: casePaperId, limit: 50 } }),
      ]);
      setCosts(res?.items || []);
      // Collection, not billing: a margin against money you have not received
      // would flatter every part-paid case.
      setCollected((invs || []).reduce((s, i) => s + Number(i.paid_amount || 0), 0));
    } catch {
      setCosts([]);
    } finally {
      setLoading(false);
    }
  }, [casePaperId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!open) return;
    api.get('/vendors').then((v) => setVendors(v || [])).catch(() => setVendors([]));
  }, [open]);

  const addFee = async () => {
    if (!form?.amount && !form?.percentage) {
      notify.problem('Enter an amount or a percentage');
      return;
    }
    setSaving(true);
    try {
      await api.post('/clinical/case-costs', {
        patient_id: patientId,
        case_paper_id: casePaperId,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        kind: 'consultant',
        description: form.description || 'Consultant fee',
        basis: form.basis,
        percentage: form.basis === 'percentage' ? Number(form.percentage) : null,
        amount: form.basis === 'fixed' ? Number(form.amount) : 0,
      });
      notify.done('Consultant fee recorded');
      setForm(null);
      load();
    } catch (e) {
      notify.problem(e, 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/clinical/case-costs/${id}`);
      load();
    } catch (e) {
      notify.problem(e, 'Could not remove that');
    }
  };

  if (!open) return null;

  const totalCost = costs.reduce((s, c) => s + Number(c.amount || 0), 0);
  const margin = collected - totalCost;
  const consultants = vendors.filter((v) => (v.category || '').toLowerCase() === 'consultant');

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-14 rounded-t-2xl sm:rounded-none sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 w-full sm:max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">

        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">What this case cost</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{patientName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw size={20} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* The number this panel exists for. */}
              <div className="rounded-xl border border-gray-200 p-4 mb-4">
                <div className="flex items-baseline justify-between text-sm py-1">
                  <span className="text-gray-500">Collected from patient</span>
                  <span className="font-bold text-gray-900 tabular-nums">{formatMoney(collected)}</span>
                </div>
                <div className="flex items-baseline justify-between text-sm py-1">
                  <span className="text-gray-500">Costs</span>
                  <span className="font-bold text-gray-900 tabular-nums">-{formatMoney(totalCost)}</span>
                </div>
                <div className="flex items-baseline justify-between pt-2.5 mt-2 border-t border-gray-200">
                  <span className="text-sm font-bold text-gray-900">This case earned</span>
                  <span className={`text-xl font-extrabold tabular-nums ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatMoney(margin)}
                  </span>
                </div>
                {collected === 0 && totalCost > 0 && (
                  <p className="text-[11px] text-amber-700 mt-2">
                    Nothing collected yet, so this reads as a loss until the patient pays.
                  </p>
                )}
              </div>

              {costs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  No costs on this case yet. Lab bills appear here on their own once a lab
                  order has a cost.
                </p>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                  {costs.map((c) => {
                    const Icon = c.kind === 'lab' ? FlaskConical : c.kind === 'consultant' ? Stethoscope : Wallet;
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-gray-100 last:border-0">
                        <Icon size={14} className="text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {c.description || (c.kind === 'lab' ? 'Lab work' : 'Consultant fee')}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {c.vendor_name || 'Unassigned'}
                            {c.basis === 'percentage' ? ` · ${c.percentage}% of collection` : ''}
                            {c.status === 'paid' ? ' · paid' : ' · unpaid'}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-gray-900 tabular-nums flex-shrink-0">
                          {formatMoney(c.amount)}
                        </span>
                        {/* Lab lines are owned by the lab order; edit the order. */}
                        {c.kind !== 'lab' && c.status !== 'paid' && (
                          <button
                            onClick={() => remove(c.id)}
                            aria-label="Remove"
                            className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {form ? (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-gray-900">Add a consultant fee</p>

                  <select
                    value={form.vendor_id || ''}
                    onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#2a276e]"
                  >
                    <option value="">Who is being paid</option>
                    {consultants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  {consultants.length === 0 && (
                    <p className="text-[11px] text-amber-700">
                      No consultants yet. Add one under Inventory, Vendors, with the category
                      set to Consultant.
                    </p>
                  )}

                  <input
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What for, e.g. RCT"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#2a276e]"
                  />

                  <div className="flex gap-1.5">
                    {[['fixed', 'Fixed amount'], ['percentage', 'Share of collection']].map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setForm({ ...form, basis: id })}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                          form.basis === id
                            ? 'bg-[#2a276e] border-[#2a276e] text-white'
                            : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {form.basis === 'fixed' ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        {getCurrencySymbol()}
                      </span>
                      <input
                        type="number"
                        value={form.amount || ''}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="0"
                        className="w-full h-10 pl-8 pr-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#2a276e]"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <input
                          type="number"
                          value={form.percentage || ''}
                          onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                          placeholder="40"
                          className="w-full h-10 pl-3 pr-8 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#2a276e]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Worked out on what the patient has actually paid
                        ({formatMoney(collected)}), not what was billed. Recorded as a fixed
                        amount once saved.
                      </p>
                    </>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setForm(null)}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addFee}
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-lg bg-[#2a276e] text-white text-sm font-bold disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Add fee'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setForm({ basis: 'fixed' })}
                  className="w-full flex items-center justify-center gap-2 py-3 min-h-[2.75rem] border border-dashed border-gray-300 rounded-xl text-sm font-semibold text-[#2a276e] hover:border-[#2a276e]/50 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={15} /> Add a consultant fee
                </button>
              )}

              <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
                Costs are settled from Inventory, Payables. Nothing here changes what the
                patient owes.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseCostsPanel;
