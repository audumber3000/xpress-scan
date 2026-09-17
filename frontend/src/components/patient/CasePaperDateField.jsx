import React, { useEffect, useRef, useState } from 'react';
import { Clock, Check, Pencil } from 'lucide-react';
import { clinicInputParts, clinicPartsToServer, formatDate, formatTime } from '../../utils/datetime';

/**
 * When the visit happened, and a way to correct it.
 *
 * The case paper always stamped itself with the moment it was saved, which is
 * only ever right for a patient sitting in the chair. It is wrong for the two
 * things clinics do most with this screen: writing up a visit the next morning,
 * and entering a paper file that is months old. Both were being recorded as
 * happening today, which puts them in today's register, today's collection and
 * the wrong place in the patient's own history.
 *
 * Reads and writes in the CLINIC's timezone, never the browser's — see
 * utils/datetime. The value handed back is a UTC ISO string, which is what
 * every other timestamp in this app is.
 */
const CasePaperDateField = ({ value, onChange, disabled = false }) => {
  const [editing, setEditing] = useState(false);
  const boxRef = useRef(null);
  const parts = clinicInputParts(value);

  // Click away to finish. There is nothing to confirm — each keystroke has
  // already landed in the form — so an outside click closes rather than asking.
  useEffect(() => {
    if (!editing) return undefined;
    const away = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setEditing(false);
    };
    const key = (e) => { if (e.key === 'Escape') setEditing(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [editing]);

  const set = (date, time) => {
    // A cleared date would stamp the paper with nothing, so the last good value
    // stands until a real one replaces it.
    const next = clinicPartsToServer(date || parts.date, time || parts.time || '00:00');
    if (next) onChange(next);
  };

  if (!editing) {
    // The pencil is always there, the same one every other editable value in
    // the app carries. A control that only appears on hover does not exist on
    // a tablet — there is no hover — and this screen is used on tablets more
    // than anywhere else.
    return (
      <div className="mt-0.5 flex items-center gap-1.5">
        <Clock size={12} className="text-gray-400" />
        <span className="text-xs font-bold text-gray-500">
          {formatDate(value)}{parts.time ? ` at ${formatTime(value)}` : ''}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Change the visit date and time"
            aria-label="Change the visit date and time"
            className="p-1 rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#2a276e]"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="mt-1 flex flex-wrap items-center gap-1.5">
      <input
        type="date"
        value={parts.date}
        onChange={(e) => set(e.target.value, parts.time)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 outline-none focus:border-[#2a276e] focus:ring-1 focus:ring-[#2a276e]/20"
      />
      <input
        type="time"
        value={parts.time}
        onChange={(e) => set(parts.date, e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 outline-none focus:border-[#2a276e] focus:ring-1 focus:ring-[#2a276e]/20"
      />
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Done editing the visit date"
        className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[#2a276e] text-white transition-[background-color,transform] hover:bg-[#1a1548] active:scale-95"
      >
        <Check size={13} strokeWidth={3} />
      </button>
    </div>
  );
};

export default CasePaperDateField;
