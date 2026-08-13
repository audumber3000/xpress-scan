import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, Layers, Sparkles, GripVertical, X } from 'lucide-react';
import { notify } from '../../utils/notify';
import { api } from '../../utils/api';
import { DOSAGE_OPTIONS, DURATION_OPTIONS, INSTRUCTION_SUGGESTIONS, withCurrent } from '../../constants/prescription';

/**
 * Prescription sets.
 *
 * Configured once here, applied on a case paper. A set holds LINES, not drug
 * names: the dosage, duration and quantity are most of what gets retyped, so
 * storing only names would leave the work where it was.
 */

const EMPTY_LINE = { medicine_name: '', dosage: '1-0-1', duration: '5 days', quantity: '', notes: '' };

const inputCls =
  'w-full h-9 px-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a] focus:border-transparent outline-none';

const MedicationGroupsTab = () => {
  const [groups, setGroups] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);   // the set open in the editor

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, t] = await Promise.all([
        api.get('/medication-groups'),
        api.get('/treatment-types').catch(() => []),
      ]);
      setGroups(g || []);
      setTreatments(Array.isArray(t) ? t : (t?.treatment_types || []));
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const installStarters = async () => {
    setSaving(true);
    try {
      const res = await api.post('/medication-groups/install-starters');
      notify.done(res.created?.length
        ? `Added ${res.created.length} sets to start from`
        : 'You already have all of them');
      load();
    } catch (e) {
      notify.problem(e, 'Could not add those');
    } finally {
      setSaving(false);
    }
  };

  const blank = () => ({
    name: '', description: '', treatment_type_id: '', audience: 'adult',
    is_active: true, items: [{ ...EMPTY_LINE }],
  });

  const save = async () => {
    if (!editing.name.trim()) { notify.problem('Give the set a name'); return; }
    const items = editing.items.filter((i) => (i.medicine_name || '').trim());
    if (!items.length) { notify.problem('A set needs at least one medicine'); return; }

    setSaving(true);
    try {
      const body = {
        name: editing.name.trim(),
        description: editing.description || null,
        treatment_type_id: editing.treatment_type_id ? Number(editing.treatment_type_id) : null,
        audience: editing.audience || null,
        is_active: editing.is_active !== false,
        items,
      };
      if (editing.id) await api.put(`/medication-groups/${editing.id}`, body);
      else await api.post('/medication-groups', body);
      setEditing(null);
      load();
    } catch (e) {
      notify.problem(e, 'Could not save that set');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g) => {
    if (!window.confirm(`Remove "${g.name}"? Prescriptions already written keep their own copy.`)) return;
    try {
      await api.delete(`/medication-groups/${g.id}`);
      load();
    } catch (e) {
      notify.problem(e, 'Could not remove that');
    }
  };

  const setLine = (idx, patch) =>
    setEditing((e) => ({ ...e, items: e.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  if (loading) {
    return <div className="py-16 grid place-items-center text-gray-400"><Loader2 size={20} className="animate-spin" /></div>;
  }

  // ── Editor ───────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">
            {editing.id ? 'Edit set' : 'New set'}
          </h3>
          <button onClick={() => setEditing(null)} className="p-1.5 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                   placeholder="Root canal, between visits" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              For which treatment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select value={editing.treatment_type_id || ''}
                    onChange={(e) => setEditing({ ...editing, treatment_type_id: e.target.value })}
                    className={inputCls}>
              <option value="">Any</option>
              {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Sets matching the treatment appear first in the picker. Nothing is hidden.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Doses for</label>
            <select value={editing.audience || ''}
                    onChange={(e) => setEditing({ ...editing, audience: e.target.value })}
                    className={inputCls}>
              <option value="adult">Adults</option>
              <option value="child">Children</option>
              <option value="">Not specified</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input value={editing.description || ''}
                   onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                   placeholder="When to use this" className={inputCls} />
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Medicines</span>
            <span className="text-[11px] text-gray-400">Order here is the order on the prescription</span>
          </div>
          <div className="divide-y divide-gray-100">
            {editing.items.map((line, i) => (
              <div key={i} className="p-3">
                <div className="flex items-start gap-2">
                  <GripVertical size={14} className="text-gray-300 mt-2.5 flex-shrink-0" />
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input value={line.medicine_name} placeholder="Medicine"
                           onChange={(e) => setLine(i, { medicine_name: e.target.value })}
                           className={`${inputCls} col-span-2`} />
                    {/* The same lists the prescription drawer uses. Authoring a
                        value it cannot display is how a set silently applies a
                        blank dose. */}
                    <select value={line.dosage || ''} onChange={(e) => setLine(i, { dosage: e.target.value })}
                            className={inputCls}>
                      {withCurrent(DOSAGE_OPTIONS, line.dosage).map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={line.duration || ''} onChange={(e) => setLine(i, { duration: e.target.value })}
                            className={inputCls}>
                      {withCurrent(DURATION_OPTIONS, line.duration).map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input value={line.quantity || ''} placeholder="Qty"
                           onChange={(e) => setLine(i, { quantity: e.target.value })} className={inputCls} />
                    <input value={line.notes || ''} placeholder="After meals"
                           list="rx-set-instruction-suggestions"
                           onChange={(e) => setLine(i, { notes: e.target.value })}
                           className={`${inputCls} col-span-2 sm:col-span-3`} />
                    <datalist id="rx-set-instruction-suggestions">
                      {INSTRUCTION_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                  <button
                    onClick={() => setEditing((e) => ({ ...e, items: e.items.filter((_, x) => x !== i) }))}
                    disabled={editing.items.length === 1}
                    aria-label="Remove this medicine"
                    className="p-1.5 mt-1 text-gray-400 hover:text-red-600 disabled:opacity-30 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setEditing((e) => ({ ...e, items: [...e.items, { ...EMPTY_LINE }] }))}
            className="w-full py-2.5 text-xs font-bold text-[#29828a] hover:bg-[#29828a]/5 border-t border-gray-200"
          >
            <Plus size={13} className="inline mr-1" /> Add a medicine
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(null)}
                  className="px-4 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
                  className="px-5 h-10 rounded-lg bg-[#29828a] hover:bg-[#216b71] text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Save set
          </button>
        </div>
      </div>
    );
  }

  // ── List ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-gray-900">Prescription sets</h3>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Group the medicines you prescribe together, then apply the whole set on a case
            paper instead of typing each one. Every line stays editable when it is applied.
          </p>
        </div>
        <button onClick={() => setEditing(blank())}
                className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-[#29828a] hover:bg-[#216b71] text-white text-sm font-bold flex-shrink-0">
          <Plus size={15} /> New set
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl py-12 px-6 text-center">
          <Layers size={26} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-semibold text-gray-700">No sets yet</p>
          <p className="text-xs text-gray-500 mt-1 mb-4 max-w-md mx-auto">
            Start from the common ones and edit them to match your practice, or build
            your own from scratch.
          </p>
          <button onClick={installStarters} disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg border border-[#29828a] text-[#29828a] text-sm font-bold hover:bg-[#29828a]/5 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Add the common sets
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((g) => (
            <div key={g.id} className="border border-gray-200 rounded-xl p-4 hover:border-[#29828a]/40 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-bold text-gray-900">{g.name}</h4>
                    {g.treatment_name && (
                      <span className="text-[10px] font-bold text-[#29828a] bg-[#29828a]/10 px-1.5 py-0.5 rounded">
                        {g.treatment_name}
                      </span>
                    )}
                    {g.audience === 'child' && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        Children
                      </span>
                    )}
                  </div>
                  {g.description && <p className="text-[11px] text-gray-400 mt-0.5">{g.description}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEditing({ ...g, treatment_type_id: g.treatment_type_id || '' })}
                          className="text-xs font-bold text-[#29828a] hover:underline px-1">
                    Edit
                  </button>
                  <button onClick={() => remove(g)} aria-label={`Remove ${g.name}`}
                          className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <ul className="space-y-1">
                {g.items.map((i) => (
                  <li key={i.id} className="text-xs text-gray-600 flex items-baseline gap-2">
                    <span className="font-medium text-gray-800 truncate">{i.medicine_name}</span>
                    <span className="text-gray-400 text-[11px] whitespace-nowrap ml-auto">
                      {[i.dosage, i.duration].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicationGroupsTab;
