import React from 'react';
import { Check, Smile, Stethoscope } from 'lucide-react';

/**
 * Which case paper this clinic writes.
 *
 * Two options rather than a bare on/off switch, because "Dental case paper:
 * off" does not tell a dermatologist what she gets instead. Each option says
 * what it puts on the screen and what it takes away, so the choice can be made
 * without trying it first.
 *
 * This is deliberately NOT the `specialization` field. That one is free text
 * shown on the public booking page and has drifted to whatever the signup form
 * was given. This is a closed set of two that the clinical screen branches on.
 */

const OPTIONS = [
  {
    value: 'dental',
    label: 'Dental case paper',
    Icon: Smile,
    summary: 'Tooth chart, dental history, per-tooth treatment planning.',
    detail: 'The full dental record. Choose this for a dental or orthodontic practice.',
  },
  {
    value: 'general',
    label: 'General case paper',
    Icon: Stethoscope,
    summary: 'Complaint, history, examination, diagnosis and plan. No tooth chart.',
    detail: 'For skin, hair and other non-dental practices, where teeth are not the subject.',
  },
];

const CasePaperTypeField = ({ value, onChange }) => {
  const active = value === 'general' ? 'general' : 'dental';

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <label className="block text-sm font-semibold text-gray-700 mb-1">Case paper</label>
      <p className="text-xs text-gray-500 mb-4">
        Changes what the clinical screen asks for. Nothing already written is altered or
        deleted, so you can switch back at any time and old case papers read as they did.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {OPTIONS.map(({ value: v, label, Icon, summary, detail }) => {
          const selected = active === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-pressed={selected}
              className={`text-left p-4 rounded-xl border-2 transition-colors ${
                selected
                  ? 'border-[#29828a] bg-[#29828a]/5'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    selected ? 'bg-[#29828a] text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${selected ? 'text-[#29828a]' : 'text-gray-900'}`}>
                      {label}
                    </span>
                    {selected && <Check size={15} className="text-[#29828a] shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{summary}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{detail}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CasePaperTypeField;
