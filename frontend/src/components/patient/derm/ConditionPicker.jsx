import React, { useState } from 'react';
import { Search, Check } from 'lucide-react';
import { CONDITIONS } from './dermProtocols';

/**
 * What are we treating today?
 *
 * The hinge the whole case paper turns on. Everything below reshapes around
 * what is picked here: the assessment shows the four questions acne actually
 * needs instead of the full morphology vocabulary, and the plan shortlists the
 * dozen treatments that apply instead of the clinic's entire menu.
 *
 * Multi-select, because presentations are mixed — acne and melasma in the same
 * face is an ordinary Tuesday — and forcing one primary diagnosis would push
 * the second one into the notes where nothing can act on it.
 *
 * Nothing here is a diagnosis. It is the working problem list that organises
 * the screen; the diagnosis proper is written further down and can disagree.
 */

const ConditionPicker = ({ selected = [], onChange }) => {
  const [query, setQuery] = useState('');

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? CONDITIONS.filter(
        (c) => c.label.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q)
      )
    : CONDITIONS;

  return (
    <section className="border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Treating today</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Pick one or more. The assessment and the plan below follow from this.
          </p>
        </div>
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-32 pl-7 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {shown.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`text-left px-3 py-2.5 rounded-xl border-2 transition-colors ${
                on
                  ? 'border-[#2a276e] bg-[#2a276e]/5'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`text-sm font-bold ${on ? 'text-[#2a276e]' : 'text-gray-800'}`}>
                  {c.label}
                </span>
                {on && <Check size={13} className="text-[#2a276e] shrink-0" />}
              </span>
              <span className="block text-[11px] text-gray-400 mt-0.5 truncate">{c.blurb}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 && (
        <p className="text-xs text-gray-400">
          Nothing matches “{query}”. Record it in Other findings below instead.
        </p>
      )}

      {selected.length === 0 && !q && (
        <p className="text-[11px] text-gray-400 mt-3">
          Not sure yet? Skip this and describe what you see in Other findings.
        </p>
      )}
    </section>
  );
};

export default ConditionPicker;
