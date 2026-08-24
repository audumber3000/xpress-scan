import React, { useState, useEffect, useMemo } from 'react';
import { X, CalendarClock, CalendarDays, Siren, CheckCircle2, HelpCircle } from 'lucide-react';
import { clinicToday, formatDate } from '../../utils/datetime';
import {
  NOT_SPECIFIED,
  CUSTOM_DATE_LABEL,
  NEXT_VISIT_INTERVALS,
  NEXT_VISIT_OPEN_ENDED,
  daysBetween,
  weekday,
} from '../../utils/nextVisit';

/**
 * Next Visit — one decision, made properly.
 *
 * The old control was a bare <select> wedged into the action bar, and it stored
 * a phrase: "Review After 1 Month". Nobody at the front desk can act on a
 * phrase. So every option here resolves to a real calendar day, and the doctor
 * can also just pick one outright.
 *
 * Three ways to answer, in the order a dentist actually thinks:
 *   1. Come back in <interval>  the common case, one tap, date computed
 *   2. Come back on <date>      when the plan already has a fixed day
 *   3. No fixed date            SOS, discharged, or not decided yet
 */

const ICONS = { siren: Siren, check: CheckCircle2, help: HelpCircle };

const NextVisitModal = ({ open, onClose, value, onSave }) => {
  const today = useMemo(() => clinicToday(), []);
  const [label, setLabel] = useState(NOT_SPECIFIED);
  const [date, setDate] = useState('');

  const incomingLabel = value?.label;
  const incomingDate = value?.date;

  useEffect(() => {
    if (!open) return;
    setLabel(incomingLabel || NOT_SPECIFIED);
    setDate(incomingDate || '');
    // Re-seeding on every prop change would fight the user mid-edit, so this
    // deliberately syncs only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const pickInterval = (interval) => {
    setLabel(interval.label);
    setDate(interval.add(today));
  };

  const pickDate = (iso) => {
    if (!iso) { setLabel(NOT_SPECIFIED); setDate(''); return; }
    setLabel(CUSTOM_DATE_LABEL);
    setDate(iso);
  };

  const pickOpenEnded = (opt) => {
    setLabel(opt.label);
    setDate('');
  };

  const isCustom = label === CUSTOM_DATE_LABEL;
  const chosenDate = date || null;
  const inDays = chosenDate ? daysBetween(today, chosenDate) : null;

  const summary = (() => {
    if (chosenDate) {
      const when =
        inDays === 0 ? 'today'
        : inDays === 1 ? 'tomorrow'
        : inDays > 0 ? `in ${inDays} days`
        : `${Math.abs(inDays)} days ago`;
      return `Back on ${weekday(chosenDate)}, ${formatDate(chosenDate)} (${when})`;
    }
    const opt = NEXT_VISIT_OPEN_ENDED.find((o) => o.label === label);
    if (opt && opt.label !== NOT_SPECIFIED) return opt.title;
    return 'No next visit set';
  })();

  const handleSave = () => {
    onSave({ label, date: chosenDate });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2a276e]/10 flex items-center justify-center">
              <CalendarClock size={18} className="text-[#2a276e]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Next visit</h3>
              <p className="text-xs text-gray-500">When should this patient come back?</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 overflow-y-auto">
          {/* 1. The common case: an interval, resolved to a real day. */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
              Come back in
            </p>
            <div className="grid grid-cols-3 gap-2">
              {NEXT_VISIT_INTERVALS.map((interval) => {
                const on = interval.add(today);
                const active = label === interval.label;
                return (
                  <button
                    key={interval.label}
                    type="button"
                    onClick={() => pickInterval(interval)}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-[#2a276e] bg-[#2a276e]/[0.04]'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <p className={`text-sm font-bold ${active ? 'text-[#2a276e]' : 'text-gray-900'}`}>
                      {interval.short}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {weekday(on)}, {formatDate(on, { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. A fixed day, when the plan already has one. */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
              Or pick an exact day
            </p>
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                isCustom ? 'border-[#2a276e] bg-[#2a276e]/[0.04]' : 'border-gray-200'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-[#2a276e]/10 flex items-center justify-center shrink-0">
                <CalendarDays size={18} className="text-[#2a276e]" />
              </div>
              <div className="min-w-0 flex-1">
                <input
                  type="date"
                  value={isCustom ? date : ''}
                  // A reopened paper can carry a day that has already passed;
                  // clamping to today would make its own stored value invalid.
                  min={date && date < today ? date : today}
                  onChange={(e) => pickDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
                />
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Use this for a scheduled procedure, a suture removal, or a lab fitting.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Everything that has no date by nature. */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
              No fixed date
            </p>
            <div className="space-y-2">
              {NEXT_VISIT_OPEN_ENDED.map((opt) => {
                const active = label === opt.label;
                const Icon = ICONS[opt.icon];
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => pickOpenEnded(opt)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-[#2a276e] bg-[#2a276e]/[0.04]'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${opt.tone}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
                      <p className="text-xs text-gray-500">{opt.hint}</p>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                        active ? 'border-[#2a276e] bg-[#2a276e]' : 'border-gray-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-[#2a276e] truncate" title={summary}>
            {summary}
          </p>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors"
            >
              Set next visit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NextVisitModal;
