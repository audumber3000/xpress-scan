import React, { useState } from 'react';
import { PenLine, Sparkles, Undo2 } from 'lucide-react';
import Spinner from '../../common/Spinner';
import { api } from '../../../utils/api';
import { notify } from '../../../utils/notify';

/**
 * The visit's free-text note, beside the tabbed record rather than stranded in
 * a full-width block underneath it. Notes get written while reading what is in
 * those tabs, so the two belong on screen together.
 *
 * The draft button asks Claude to write the note from what is already on the
 * paper. Three rules make that safe rather than reckless:
 *
 *   1. It never saves. The draft lands in the box and the dentist edits it.
 *   2. It never replaces silently — an existing note is kept and can be
 *      restored with one click, because losing a note you typed yourself is
 *      unforgivable.
 *   3. It reports what the record was missing, so the gap is visible rather
 *      than smoothed over by fluent prose.
 */
const ClinicalNotesCard = ({ value, onChange, casePaper }) => {
  const [drafting, setDrafting] = useState(false);
  const [previous, setPrevious] = useState(null);
  const [omitted, setOmitted] = useState([]);

  const canDraft = !!casePaper?.id && !casePaper?.isNew;

  const draft = async () => {
    setDrafting(true);
    setOmitted([]);
    try {
      const res = await api.post(`/clinical/case-papers/${casePaper.id}/draft-notes`, {});
      if (!res?.note) {
        notify.problem('Nothing came back to draft from');
        return;
      }
      setPrevious(value || '');
      onChange(res.note);
      setOmitted(Array.isArray(res.omitted) ? res.omitted : []);
      notify.done('Draft written — read it before saving');
    } catch (err) {
      console.error('Could not draft the note:', err);
      notify.problem(err?.message || 'Could not draft a note just now');
    } finally {
      setDrafting(false);
    }
  };

  const undo = () => {
    onChange(previous || '');
    setPrevious(null);
    setOmitted([]);
    notify.reverted('Your note is back');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-full min-h-[320px]">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-200">
        <span className="w-7 h-7 rounded-lg bg-[#2a276e]/5 text-[#2a276e] flex items-center justify-center">
          <PenLine size={15} />
        </span>
        <h3 className="text-sm font-bold text-gray-900">Clinical Notes</h3>

        <div className="ml-auto flex items-center gap-1.5">
          {previous !== null && (
            <button
              type="button" onClick={undo} title="Put my own note back"
              className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold text-gray-500 cursor-pointer transition-[background-color,color] duration-150 ease-out hover:bg-gray-100 hover:text-gray-900"
            >
              <Undo2 size={12} /> Undo
            </button>
          )}
          <button
            type="button"
            onClick={draft}
            disabled={drafting || !canDraft}
            title={canDraft
              ? 'Draft this note from what is already on the case paper'
              : 'Save the case paper first'}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-600 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-[#2a276e] hover:text-[#2a276e] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {drafting ? <Spinner className="w-3 h-3" /> : <Sparkles size={12} />}
            {drafting ? 'Drafting' : 'Draft'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-2">
        <label htmlFor="case-clinical-notes" className="sr-only">Clinical notes for this visit</label>
        <textarea
          id="case-clinical-notes"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What you observed, what you told the patient, anything the next visit should know."
          className="w-full flex-1 min-h-[200px] px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out focus:bg-white focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15"
        />

        {previous !== null && (
          <p className="text-[11px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            This is a draft written from the record. Read it, correct anything that
            is not right, and it saves with the case paper like any other note.
          </p>
        )}

        {omitted.length > 0 && (
          /* Named gaps, not a silent smoothing-over. The draft can only use what
             is on the paper, and saying what was missing is the difference
             between a helpful note and a confident wrong one. */
          <p className="text-[11px] leading-relaxed text-gray-500">
            <span className="font-semibold text-gray-700">Not on the record:</span>{' '}
            {omitted.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
};

export default ClinicalNotesCard;
