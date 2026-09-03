import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, X, Phone } from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import { notify } from '../../utils/notify';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import InlineFeedback from '../../components/common/InlineFeedback';

/**
 * Insurers this clinic bills.
 *
 * Kept here rather than typed per patient because the same company appears on
 * hundreds of patients, and one spelling per clinic is what lets "who owes us
 * through Star Health" ever be answerable. A patient's own policy — number,
 * percentages, deductible — is on their file, since that is what differs
 * between two people covered by the same insurer.
 */
const emptyForm = () => ({ name: '', payer_code: '', phone: '', notes: '', is_active: true });

const Insurers = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/insurance/payers');
      setRows(Array.isArray(d) ? d : []);
      setError('');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not load insurers.'));
      setRows([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); setError(''); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ name: r.name || '', payer_code: r.payer_code || '', phone: r.phone || '',
              notes: r.notes || '', is_active: r.is_active !== false });
    setShowForm(true); setError('');
  };

  const save = async () => {
    if (!form.name.trim()) { notify.problem('Give the insurer a name'); return; }
    setSaving(true); setError('');
    try {
      if (editing) await api.put(`/insurance/payers/${editing.id}`, form);
      else await api.post('/insurance/payers', form);
      setShowForm(false);
      await load();
      notify.done(editing ? 'Insurer updated' : 'Insurer added');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not save the insurer.'));
    } finally { setSaving(false); }
  };

  const remove = async (r) => {
    setDeletingId(r.id);
    try {
      const res = await api.delete(`/insurance/payers/${r.id}`);
      await load();
      // Retiring rather than deleting is not a failure, but it is a different
      // outcome and the person who pressed Delete should be told which happened.
      notify.done(res?.deactivated
        ? `${r.name} is used by ${res.patients} patient${res.patients === 1 ? '' : 's'}, so it was retired instead of deleted`
        : 'Insurer deleted');
    } catch (e) {
      notify.problem(getFriendlyErrorMessage(e, 'Could not remove the insurer.'));
    } finally { setDeletingId(null); }
  };

  const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2a276e]';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Insurers</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            The companies this clinic bills. A patient's own policy and percentages go on their file.
          </p>
        </div>
        {!showForm && (
          <button onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1e1c4f]">
            <Plus size={14} /> Add insurer
          </button>
        )}
      </div>

      {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

      {showForm && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">
            {editing ? 'Edit insurer' : 'New insurer'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Name</label>
              <input className={INPUT} value={form.name} autoFocus
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Star Health" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">
                Reference <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input className={INPUT} value={form.payer_code}
                onChange={(e) => setForm({ ...form, payer_code: e.target.value })}
                placeholder="Their code for your practice" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Phone</label>
              <input className={INPUT} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Claims line" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Notes</label>
              <input className={INPUT} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything the front desk needs to remember" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="px-3.5 py-2 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1e1c4f] disabled:opacity-50 inline-flex items-center gap-2">
              {editing ? 'Save changes' : 'Add insurer'} {saving && <Spinner className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => { setShowForm(false); setError(''); }}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-[13px] font-semibold hover:bg-gray-50 inline-flex items-center gap-1.5">
              <X size={13} /> Cancel
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-gray-500">
          <Spinner className="w-4 h-4" /> Loading insurers
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
          <ShieldCheck size={22} className="mx-auto text-gray-300" />
          <p className="mt-2 text-[13px] text-gray-600">No insurers yet.</p>
          <p className="mt-1 text-[12px] text-gray-400">
            Add one here, then record each patient's policy on their file to see what their cover pays.
          </p>
        </div>
      ) : (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex items-center gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                  {!r.is_active && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-500">
                      Retired
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-gray-500 mt-0.5 truncate">
                  {[r.payer_code, r.phone, r.notes].filter(Boolean).join('  ·  ') || 'No details'}
                </p>
              </div>
              {r.phone && (
                <a href={`tel:${r.phone}`} title={`Call ${r.name}`}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 shrink-0">
                  <Phone size={14} />
                </a>
              )}
              <button onClick={() => openEdit(r)} title="Edit"
                className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 shrink-0">
                <Pencil size={14} />
              </button>
              <button onClick={() => remove(r)} disabled={deletingId === r.id} title="Remove"
                className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0">
                {deletingId === r.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Insurers;
