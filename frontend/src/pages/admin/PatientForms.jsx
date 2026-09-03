import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus, Trash2, Check, Stethoscope, HeartPulse } from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import { notify } from '../../utils/notify';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import InlineFeedback from '../../components/common/InlineFeedback';

/**
 * The forms a clinic can send to patients.
 *
 * Adoption first, authoring second. A clinic that opens this to an empty table
 * and a "New form" button will not sit down and write a medical history
 * questionnaire, so the ready-made ones are the thing on screen and editing
 * them is the follow-up.
 *
 * Field editing is deliberately not here yet. The starters cover the questions
 * a practice actually asks, and a schema builder is a screen in its own right —
 * shipping a half one would be worse than sending people to support for a
 * change they make once a year.
 */
const BAND = {
  dental: { label: 'Dental', icon: Stethoscope, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  general: { label: 'General', icon: HeartPulse, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const PatientForms = () => {
  const [mine, setMine] = useState([]);
  const [starters, setStarters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, lib] = await Promise.all([
        api.get('/forms/templates'),
        api.get('/forms/starter-library'),
      ]);
      setMine(Array.isArray(t) ? t : []);
      setStarters(lib?.forms || []);
      setError('');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not load forms.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const adopt = async (name) => {
    setBusy(name); setError('');
    try {
      const res = await api.post('/forms/templates/adopt', [name]);
      await load();
      notify.done(res?.length ? `${name} added` : 'You already have that one');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not add that form.'));
    } finally { setBusy(''); }
  };

  const remove = async (t) => {
    setBusy(`del-${t.id}`);
    try {
      const res = await api.delete(`/forms/templates/${t.id}`);
      await load();
      notify.done(res?.deactivated
        ? `Already sent to ${res.submissions} patient${res.submissions === 1 ? '' : 's'}, so it was retired rather than deleted`
        : 'Form removed');
    } catch (e) {
      notify.problem(getFriendlyErrorMessage(e, 'Could not remove that form.'));
    } finally { setBusy(''); }
  };

  const have = new Set(mine.map((t) => t.name));

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-gray-900">Patient forms</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Questionnaires you can send to a patient to fill in on their phone before a visit.
          Send them from the Forms tab on any patient's file.
        </p>
      </div>

      {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-gray-500">
          <Spinner className="w-4 h-4" /> Loading forms
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Your forms</h2>
            </div>
            {mine.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <ClipboardList size={22} className="mx-auto text-gray-300" />
                <p className="mt-2 text-[13px] text-gray-600">Nothing set up yet.</p>
                <p className="mt-1 text-[12px] text-gray-400">Add one from the ready-made forms below.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {mine.map((t) => {
                  const b = BAND[t.case_paper_type];
                  const Icon = b?.icon;
                  return (
                    <li key={t.id} className="px-4 py-3 flex items-center gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                          {b && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${b.cls}`}>
                              <Icon size={11} /> {b.label}
                            </span>
                          )}
                          {!t.is_active && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-500">
                              Retired
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-gray-500 mt-0.5">
                          {(t.schema || []).length} question{(t.schema || []).length === 1 ? '' : 's'}
                          {(t.schema || []).some((f) => f.maps_to)
                            ? ` · updates ${[...new Set((t.schema || []).filter((f) => f.maps_to).map((f) => f.maps_to))].join(', ')} on the patient's file`
                            : ''}
                        </p>
                      </div>
                      <button onClick={() => remove(t)} disabled={busy === `del-${t.id}`} title="Remove"
                        className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0">
                        {busy === `del-${t.id}` ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 size={14} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Ready-made</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {starters.map((f) => {
                const b = BAND[f.case_paper_type];
                const Icon = b?.icon;
                const already = have.has(f.name);
                return (
                  <li key={f.name} className="px-4 py-3 flex items-center gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{f.name}</p>
                        {b && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${b.cls}`}>
                            <Icon size={11} /> {b.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-gray-500 mt-0.5">
                        {f.field_count} questions · shown only to patients on the {b?.label.toLowerCase()} case paper
                      </p>
                    </div>
                    <button onClick={() => adopt(f.name)} disabled={already || busy === f.name}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold shrink-0 ${
                        already
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default'
                          : 'bg-[#2a276e] text-white hover:bg-[#1e1c4f] disabled:opacity-50'
                      }`}>
                      {already ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
                      {busy === f.name && <Spinner className="w-3.5 h-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

export default PatientForms;
