import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { FIELD_TYPES, TYPE_MAP, CANNOT_MAP, isLayout, needsOptions, keyFor } from './fieldTypes';

/**
 * Edit one question.
 *
 * A modal rather than a drawer, per the house rule: editing something that
 * already exists pops up centred, and drawers are for creating a whole new
 * thing. Which this is either way — a question is a field inside a form the
 * clinic is already building, never a flow of its own.
 *
 * The type picker changes the rest of the dialog, because the questions a type
 * needs are different: a tick list needs its options, a declaration needs its
 * wording, and a section heading needs neither and cannot be required.
 */
const LBL = 'block text-[12px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5';
const IN = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15 transition';

const QuestionModal = ({ field, takenKeys, mappableFields, onSave, onClose }) => {
  const [draft, setDraft] = useState(() => ({
    key: '', label: '', type: 'text', required: false,
    options: [], maps_to: null, help: '', ...(field || {}),
  }));
  const [optionText, setOptionText] = useState((field?.options || []).join('\n'));
  const [error, setError] = useState('');

  const isNew = !field;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // Escape closes, the way every other modal in the app does.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const type = draft.type;
  const layout = isLayout(type);
  const wantsOptions = needsOptions(type);
  const canMap = !CANNOT_MAP.has(type);

  const save = () => {
    const label = (draft.label || '').trim();
    if (!label) { setError('Give the question a label. It is what the patient reads.'); return; }

    const options = wantsOptions
      ? optionText.split('\n').map((o) => o.trim()).filter(Boolean)
      : [];
    if (wantsOptions && !options.length) {
      setError('This kind of question needs at least one option to choose from.');
      return;
    }
    if (type === 'declaration' && !(draft.help || '').trim()) {
      setError('A declaration needs the wording the patient is agreeing to.');
      return;
    }

    onSave({
      ...draft,
      label,
      // The key is how answers already collected line up against the question,
      // so it is generated once and never changes when the label is reworded.
      key: draft.key || keyFor(label, takenKeys),
      options,
      required: layout ? false : !!draft.required,
      maps_to: canMap ? (draft.maps_to || null) : null,
      help: (draft.help || '').trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="text-[15px] font-bold text-gray-900">
            {isNew ? 'Add a question' : 'Edit question'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className={LBL}>Question type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set({ type: t.id })}
                  className={`text-left px-3 py-2 rounded-lg border text-[13px] transition ${
                    type === t.id
                      ? 'border-[#2a276e] bg-[#2a276e]/5 text-[#2a276e] font-semibold'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-gray-500">{TYPE_MAP[type]?.hint}</p>
          </div>

          <div>
            <label className={LBL}>{layout ? 'Heading' : 'What the patient is asked'}</label>
            <input
              className={IN}
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder={layout ? 'Health information' : 'Are you taking any blood thinners?'}
              autoFocus
            />
          </div>

          <div>
            <label className={LBL}>
              {type === 'declaration' ? 'The wording being agreed to' : 'Helper text (optional)'}
            </label>
            <textarea
              className={IN}
              rows={type === 'declaration' ? 6 : 2}
              value={draft.help || ''}
              onChange={(e) => set({ help: e.target.value })}
              placeholder={type === 'declaration'
                ? 'To the best of my knowledge, all of the preceding answers are true and correct...'
                : 'Anything that helps them answer it accurately.'}
            />
          </div>

          {wantsOptions && (
            <div>
              <label className={LBL}>Options, one per line</label>
              <textarea
                className={`${IN} font-mono text-[13px]`}
                rows={type === 'checkbox_grid' ? 8 : 4}
                value={optionText}
                onChange={(e) => setOptionText(e.target.value)}
                placeholder={'Yes\nNo\nNot sure'}
              />
              <p className="mt-1 text-[12px] text-gray-500">
                {optionText.split('\n').filter((o) => o.trim()).length} options
              </p>
            </div>
          )}

          {!layout && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-[#2a276e]"
                checked={!!draft.required}
                onChange={(e) => set({ required: e.target.checked })}
              />
              <span className="text-[13px] text-gray-700">
                <span className="font-semibold">The patient must answer this</span>
                <span className="block text-gray-500">
                  They cannot get past the step it is on until they have.
                </span>
              </span>
            </label>
          )}

          {canMap && (
            <div>
              <label className={LBL}>Update the patient's file with this answer</label>
              <select
                className={IN}
                value={draft.maps_to || ''}
                onChange={(e) => set({ maps_to: e.target.value || null })}
              >
                <option value="">Just record it on the form</option>
                {Object.entries(mappableFields || {}).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-gray-500">
                Nothing is written automatically. Staff review the answer first and choose whether to accept it.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2.5 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={save}
            className="flex-[2] py-2.5 rounded-lg bg-[#2a276e] text-white font-semibold text-sm hover:bg-[#1a1548]">
            {isNew ? 'Add question' : 'Save question'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionModal;
