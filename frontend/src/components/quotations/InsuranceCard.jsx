import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldOff, Pencil, X } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { getCurrencySymbol } from '../../utils/currency';
import { formatDate } from '../../utils/datetime';
import Spinner from '../common/Spinner';
import InlineFeedback from '../common/InlineFeedback';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BANDS = [
  ['preventive', 'Preventive', 'Check-ups, scaling, x-rays'],
  ['basic', 'Basic', 'Fillings, extractions'],
  ['major', 'Major', 'Crowns, bridges, dentures'],
  ['ortho', 'Orthodontic', 'Braces and aligners'],
];

/**
 * The patient's cover, and the editor for it.
 *
 * `compact` renders it as a single line inside the quotations card instead of a
 * card of its own. Cover is context for a quotation, not a subject in its own
 * right, and as a separate box it sat between the invoices and the quotations
 * belonging to neither.
 *
 * The remaining figures are shown rather than the raw ones, because "600 left
 * of a 1,000 maximum" is what decides a treatment plan and "annual_used: 400"
 * is not. The percentages are per benefit band because that is how a plan is
 * written — a policy says 80% of basic, never 80% of a composite filling.
 */
const InsuranceCard = ({ patientId, onChanged, compact = false }) => {
  const [cover, setCover] = useState([]);
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        api.get(`/insurance/patient/${patientId}`),
        api.get('/insurance/payers'),
      ]);
      setCover(Array.isArray(c) ? c : []);
      setPayers(Array.isArray(p) ? p : []);
      setError('');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not load insurance.'));
    } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const active = cover.find((c) => c.is_active && !c.expired) || null;

  const startNew = () => setEditing({
    payer_id: payers[0]?.id || '', policy_number: '', subscriber_relation: 'self',
    valid_to: '', deductible: '', deductible_met: '', annual_max: '', annual_used: '',
    coverage: { preventive: 100, basic: 80, major: 50, ortho: 50 }, is_active: true,
  });

  const save = async () => {
    if (!editing.payer_id) { setError('Choose an insurer first.'); return; }
    setSaving(true); setError('');
    const body = {
      payer_id: Number(editing.payer_id),
      policy_number: editing.policy_number || null,
      subscriber_relation: editing.subscriber_relation || null,
      valid_to: editing.valid_to || null,
      coverage: editing.coverage,
      deductible: editing.deductible === '' ? null : Number(editing.deductible),
      deductible_met: editing.deductible_met === '' ? null : Number(editing.deductible_met),
      annual_max: editing.annual_max === '' ? null : Number(editing.annual_max),
      annual_used: editing.annual_used === '' ? null : Number(editing.annual_used),
      is_active: true,
    };
    try {
      if (editing.id) await api.put(`/insurance/patient-cover/${editing.id}`, body);
      else await api.post(`/insurance/patient/${patientId}`, body);
      setEditing(null);
      await load();
      onChanged?.();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not save the policy.'));
    } finally { setSaving(false); }
  };

  const F = ({ label, children }) => (
    <div className="min-w-0">
      <label className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
  const INPUT = 'w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] outline-none focus:border-[#2a276e]';

  if (loading) {
    return compact
      ? <div className="px-4 py-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center gap-2 text-[12px] text-gray-500">
          <Spinner className="w-3.5 h-3.5" /> Loading cover
        </div>
      : <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-2 text-[13px] text-gray-500">
          <Spinner className="w-4 h-4" /> Loading insurance
        </div>;
  }

  if (compact && !editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-gray-50/70 border-b border-gray-100 text-[12px]">
        {active ? (
          <>
            <ShieldCheck size={13} className="text-emerald-600 flex-shrink-0" />
            <span className="font-semibold text-gray-900 truncate max-w-[14rem]">{active.payer_name}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">
              {BANDS.filter(([k]) => Number(active.coverage?.[k])).map(([k, l]) => `${l} ${Number(active.coverage[k])}%`).join(' · ') || 'no percentages set'}
            </span>
            {active.remaining_annual != null && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{money(active.remaining_annual)} cover left</span>
              </>
            )}
          </>
        ) : (
          <>
            <ShieldOff size={13} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-500">No cover on file, so a quotation shows the whole amount as the patient's.</span>
          </>
        )}
        <button
          onClick={active ? () => setEditing({ ...active, valid_to: active.valid_to || '' }) : startNew}
          className="ml-auto font-semibold text-[#2a276e] hover:underline shrink-0"
        >
          {active ? 'Edit cover' : 'Add cover'}
        </button>
      </div>
    );
  }

  return (
    <section className={compact ? 'border-b border-gray-100' : 'rounded-xl border border-gray-200 bg-white'}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 tracking-tight">Insurance</h3>
        {!editing && (
          <button onClick={active ? () => setEditing({ ...active, valid_to: active.valid_to || '' }) : startNew}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2a276e] hover:underline">
            {active ? <><Pencil size={12} /> Edit</> : 'Add cover'}
          </button>
        )}
      </div>

      <div className="p-4">
        {error && <InlineFeedback tone="error" className="mb-3">{error}</InlineFeedback>}

        {!editing && !active && (
          <div className="flex items-center gap-2.5 text-[13px] text-gray-500">
            <ShieldOff size={16} className="text-gray-400" />
            No cover on file. Quotations will show the full amount as the patient's.
          </div>
        )}

        {!editing && active && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{active.payer_name}</p>
                <p className="text-[11px] text-gray-500">
                  {active.policy_number ? `Policy ${active.policy_number}` : 'No policy number'}
                  {active.valid_to ? ` · to ${formatDate(active.valid_to)}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {BANDS.map(([k, label]) => (
                <span key={k} className="px-2 py-0.5 rounded text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-700">
                  {label} {Number(active.coverage?.[k] || 0)}%
                </span>
              ))}
            </div>

            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <dt className="text-gray-500">Deductible left</dt>
                <dd className="font-bold text-gray-900 tabular-nums">{money(active.remaining_deductible)}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <dt className="text-gray-500">Annual cover left</dt>
                <dd className="font-bold text-gray-900 tabular-nums">
                  {active.remaining_annual == null ? 'No limit' : money(active.remaining_annual)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <F label="Insurer">
                <select className={INPUT} value={editing.payer_id}
                  onChange={(e) => setEditing({ ...editing, payer_id: e.target.value })}>
                  <option value="">Choose…</option>
                  {payers.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {payers.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">Add an insurer in Control Center first.</p>
                )}
              </F>
              <F label="Policy number">
                <input className={INPUT} value={editing.policy_number || ''}
                  onChange={(e) => setEditing({ ...editing, policy_number: e.target.value })} />
              </F>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Cover by band</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BANDS.map(([k, label, hint]) => (
                  <div key={k} title={hint}>
                    <label className="block text-[11px] text-gray-600 truncate">{label}</label>
                    <div className="relative">
                      <input type="number" min="0" max="100" className={`${INPUT} pr-6`}
                        value={editing.coverage?.[k] ?? ''}
                        onChange={(e) => setEditing({ ...editing,
                          coverage: { ...editing.coverage, [k]: e.target.value === '' ? '' : Number(e.target.value) } })} />
                      <span className="absolute right-2 top-1.5 text-[12px] text-gray-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <F label="Deductible"><input type="number" className={INPUT} value={editing.deductible ?? ''}
                onChange={(e) => setEditing({ ...editing, deductible: e.target.value })} /></F>
              <F label="Already met"><input type="number" className={INPUT} value={editing.deductible_met ?? ''}
                onChange={(e) => setEditing({ ...editing, deductible_met: e.target.value })} /></F>
              <F label="Annual maximum"><input type="number" className={INPUT} value={editing.annual_max ?? ''}
                onChange={(e) => setEditing({ ...editing, annual_max: e.target.value })} /></F>
              <F label="Used this year"><input type="number" className={INPUT} value={editing.annual_used ?? ''}
                onChange={(e) => setEditing({ ...editing, annual_used: e.target.value })} /></F>
            </div>

            <F label="Cover ends">
              <input type="date" className={`${INPUT} sm:w-48`} value={editing.valid_to || ''}
                onChange={(e) => setEditing({ ...editing, valid_to: e.target.value })} />
            </F>

            {/* Said out loud because staff reasonably assume the app knows. It
                cannot: the patient's other dentist draws on the same maximum. */}
            <p className="text-[11px] text-gray-500">
              Used-this-year is typed by you. Other clinics draw on the same annual maximum,
              so this app can only ever know part of it.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="px-3.5 py-2 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1e1c4f] disabled:opacity-50 inline-flex items-center gap-2">
                Save policy {saving && <Spinner className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setEditing(null); setError(''); }}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-[13px] font-semibold hover:bg-gray-50 inline-flex items-center gap-1.5">
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default InsuranceCard;
