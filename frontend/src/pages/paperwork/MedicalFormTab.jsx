import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Pencil,
  ArrowLeft, Save, Send, FileCheck, Loader2, Heading, Asterisk,
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../../utils/api';
import { notify } from '../../utils/notify';
import Spinner from '../../components/common/Spinner';
import InlineFeedback from '../../components/common/InlineFeedback';
import QuestionModal from './QuestionModal';
import SignedMedicalForms from './SignedMedicalForms';
import { TYPE_MAP, isLayout, keyFor } from './fieldTypes';
import EmptyState from '../../components/common/EmptyState';
import { noData } from '../../assets/illustrations';

/**
 * The medical history a clinic sends its patients, and the editor for it.
 *
 * Lives in Paperwork beside consents rather than in the Control Center,
 * because it is the same job: a document the clinic sends a patient, signs and
 * files. It was in settings, which is where you go to configure something, not
 * where you go to send it.
 *
 * Two screens, not two tabs. The list is almost always one row — a practice has
 * one medical history — so the tab opens on the list and editing takes over the
 * pane rather than opening yet another surface on top of it.
 */
const MedicalFormTab = () => {
  const [forms, setForms] = useState([]);
  const [starter, setStarter] = useState(null);
  const [mappable, setMappable] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);   // the form being built

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, lib] = await Promise.all([
        api.get('/forms/templates'),
        api.get('/forms/starter-library'),
      ]);
      const medical = (Array.isArray(mine) ? mine : []).filter((t) => t.kind === 'medical_history');
      setForms(medical);
      setStarter((lib?.forms || []).find((f) => f.kind === 'medical_history') || null);
      setMappable(lib?.mappable_fields || {});
      setError('');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not load the medical form.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const adopt = async () => {
    if (!starter) return;
    setBusy('adopt');
    try {
      await api.post('/forms/templates/adopt', [starter.name]);
      await load();
      notify.done('Medical form added. Edit the questions to suit your practice.');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'Could not add the medical form.'));
    } finally { setBusy(''); }
  };

  const blank = () => setEditing({
    id: null, name: 'Medical history', kind: 'medical_history',
    category: 'medical_history', case_paper_type: null, is_active: true,
    schema: [
      { key: 'sec_health', type: 'section', label: 'Health information', required: false, options: [], maps_to: null, help: null },
    ],
  });

  const remove = async (t) => {
    setBusy(`del-${t.id}`);
    try {
      const res = await api.delete(`/forms/templates/${t.id}`);
      await load();
      notify.done(res?.deactivated
        ? `Already sent to ${res.submissions} patient${res.submissions === 1 ? '' : 's'}, so it was retired rather than deleted`
        : 'Medical form removed');
    } catch (e) {
      notify.problem(getFriendlyErrorMessage(e, 'Could not remove that form.'));
    } finally { setBusy(''); }
  };

  if (editing) {
    return (
      <FormEditor
        form={editing}
        mappableFields={mappable}
        onCancel={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await load(); }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-[13px] text-gray-500">
        <Spinner className="w-4 h-4" /> Loading the medical form
      </div>
    );
  }

  return (
    <div className="space-y-5 flex-1 min-h-0 overflow-y-auto pb-6">
      {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Your medical form</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Sent to a patient to fill in and sign on their phone. What comes back
              is a signed PDF on their file, and answers staff can accept onto the chart.
            </p>
          </div>
          <button onClick={blank}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-[13px] font-semibold hover:border-[#2a276e] hover:text-[#2a276e] transition-colors">
            <Plus size={14} /> Build one
          </button>
        </div>

        {forms.length === 0 ? (
          <div className="px-5 py-4 text-center">
            <EmptyState
              image={noData}
              title="No medical form yet"
              subtitle="Start from the ready-made one. It asks what a practice actually asks: who the patient is, who pays, the condition list, and a declaration they sign. Every question is yours to change."
            />
            {starter && (
              <button onClick={adopt} disabled={busy === 'adopt'}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1a1548] disabled:opacity-50">
                {busy === 'adopt' ? <Spinner className="w-3.5 h-3.5" /> : <Plus size={14} />}
                Use the ready-made form ({starter.field_count} questions)
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {forms.map((t) => {
              const questions = (t.schema || []).filter((f) => !isLayout(f.type));
              const sections = (t.schema || []).filter((f) => isLayout(f.type));
              return (
                <li key={t.id} className="px-5 py-3.5 flex items-center gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                      {!t.is_active && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-500">
                          Retired
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      {questions.length} question{questions.length === 1 ? '' : 's'}
                      {sections.length ? ` across ${sections.length} section${sections.length === 1 ? '' : 's'}` : ''}
                      {questions.some((f) => f.maps_to)
                        ? ` · updates ${[...new Set(questions.filter((f) => f.maps_to).map((f) => mappable[f.maps_to] || f.maps_to))].join(', ')}`
                        : ''}
                    </p>
                  </div>
                  <button onClick={() => setEditing(t)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-[12px] font-semibold hover:border-[#2a276e] hover:text-[#2a276e]">
                    <Pencil size={12} /> Edit questions
                  </button>
                  <button onClick={() => remove(t)} disabled={busy === `del-${t.id}`} title="Remove"
                    className="shrink-0 p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                    {busy === `del-${t.id}` ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 size={14} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FileCheck size={15} className="text-[#29828a]" /> Signed and on file
          </h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Every history a patient has completed and signed. Opens their file.
          </p>
        </div>
        <div className="p-4">
          <SignedMedicalForms />
        </div>
      </section>
    </div>
  );
};

/**
 * The builder.
 *
 * Reordering is two arrows rather than drag and drop. Dragging a row in a long
 * list is fiddly with a mouse and close to unusable on the touchscreen at a
 * front desk, and the operation being performed here is "move this one question
 * up", which is exactly one arrow press.
 */
const FormEditor = ({ form, mappableFields, onCancel, onSaved }) => {
  const [name, setName] = useState(form.name || '');
  const [schema, setSchema] = useState(() => (form.schema || []).map((f) => ({ ...f })));
  const [modal, setModal] = useState(null);   // { index } or { index: null } for new
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const takenKeys = useMemo(() => new Set(schema.map((f) => f.key)), [schema]);

  const move = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= schema.length) return;
    const next = [...schema];
    [next[i], next[j]] = [next[j], next[i]];
    setSchema(next);
  };

  const removeAt = (i) => setSchema((s) => s.filter((_, x) => x !== i));

  const applyQuestion = (field) => {
    setSchema((s) => {
      if (modal?.index === null || modal?.index === undefined) return [...s, field];
      const next = [...s];
      next[modal.index] = field;
      return next;
    });
    setModal(null);
  };

  const save = async () => {
    if (!name.trim()) { setError('Give the form a name. The patient sees it at the top.'); return; }
    if (!schema.some((f) => !isLayout(f.type))) {
      setError('A form with only headings has nothing to answer. Add at least one question.');
      return;
    }
    setSaving(true); setError('');
    const payload = {
      name: name.trim(),
      category: form.category || 'medical_history',
      case_paper_type: form.case_paper_type || null,
      kind: 'medical_history',
      is_active: form.is_active !== false,
      schema,
    };
    try {
      if (form.id) await api.put(`/forms/templates/${form.id}`, payload);
      else await api.post('/forms/templates', payload);
      notify.done('Medical form saved');
      onSaved();
    } catch (e) {
      // The server rejects a schema it cannot render — a choice question with
      // no choices, a signature aimed at a clinical column. Its message names
      // the offending question, so it is shown as-is rather than replaced.
      setError(getFriendlyErrorMessage(e, 'Could not save the form.'));
    } finally { setSaving(false); }
  };

  const questionCount = schema.filter((f) => !isLayout(f.type)).length;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-[13px] font-semibold hover:bg-gray-50">
          <ArrowLeft size={14} /> Back
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Form name"
          className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15"
        />
        <button onClick={() => setModal({ index: null })}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-[13px] font-semibold hover:border-[#2a276e] hover:text-[#2a276e]">
          <Plus size={14} /> Add question
        </button>
        <button onClick={save} disabled={saving}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold hover:bg-[#1a1548] disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      {error && <div className="mb-3 shrink-0"><InlineFeedback tone="error">{error}</InlineFeedback></div>}

      <p className="text-[12px] text-gray-500 mb-2.5 shrink-0">
        {questionCount} question{questionCount === 1 ? '' : 's'}. Each section heading starts a new
        step on the patient's phone, so keep related questions under one.
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {schema.map((f, i) => {
          const layout = isLayout(f.type);
          return (
            <div key={f.key || i}
              className={`flex items-center gap-3 px-4 py-2.5 min-w-0 ${layout ? 'bg-gray-50/70' : ''}`}>
              <div className="flex flex-col shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up"
                  className="p-0.5 text-gray-400 hover:text-[#2a276e] disabled:opacity-25">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === schema.length - 1} title="Move down"
                  className="p-0.5 text-gray-400 hover:text-[#2a276e] disabled:opacity-25">
                  <ChevronDown size={14} />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  {layout && <Heading size={12} className="text-gray-400 shrink-0" />}
                  <p className={`truncate ${layout
                    ? 'text-[13px] font-bold uppercase tracking-wide text-gray-600'
                    : 'text-[13.5px] font-medium text-gray-900'}`}>
                    {f.label}
                  </p>
                  {f.required && <Asterisk size={11} className="text-red-500 shrink-0" title="Must be answered" />}
                </div>
                {!layout && (
                  <p className="text-[11.5px] text-gray-500 mt-0.5 truncate">
                    {TYPE_MAP[f.type]?.label || f.type}
                    {(f.options || []).length ? ` · ${f.options.length} options` : ''}
                    {f.maps_to ? ` · updates ${mappableFields[f.maps_to] || f.maps_to}` : ''}
                  </p>
                )}
              </div>

              <button onClick={() => setModal({ index: i })} title="Edit"
                className="shrink-0 p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#2a276e] hover:text-[#2a276e]">
                <Pencil size={13} />
              </button>
              <button onClick={() => removeAt(i)} title="Remove"
                className="shrink-0 p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}

        {!schema.length && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-gray-700">Nothing on the form yet</p>
            <p className="mt-1 text-[13px] text-gray-500">Add a section heading first, then the questions under it.</p>
          </div>
        )}
      </div>

      {modal && (
        <QuestionModal
          field={modal.index === null ? null : schema[modal.index]}
          takenKeys={takenKeys}
          mappableFields={mappableFields}
          onSave={applyQuestion}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default MedicalFormTab;
