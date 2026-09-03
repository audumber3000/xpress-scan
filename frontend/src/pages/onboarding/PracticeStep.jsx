import React from 'react';
import { Minus, Plus, Check, Sparkles } from 'lucide-react';

/**
 * Screen two: the two settings that shape the calendar, and nothing else.
 *
 * Kept deliberately thin. Both fields have a sane default and neither blocks
 * anything, so this screen is answerable in two taps without reading. That is
 * the point — it sits between the real work of screen one and the wall of
 * verification, and a second slab of form in that position is where people
 * decide the setup is longer than they were promised.
 *
 * The panel at the bottom is doing quiet work: a new owner does not know that
 * treatments, prices and opening hours already exist, so they brace for them.
 * Saying what is already done is the cheapest reassurance in the whole wizard.
 */

const SPECIALIZATIONS = [
  'General Dentistry',
  'Orthodontics',
  'Pediatric',
  'Implantology',
  'Cosmetic',
  'Periodontics',
];

const PracticeStep = ({ data, onChange }) => {
  const chairs = data.number_of_chairs || 1;
  const adjust = (delta) => onChange('number_of_chairs', Math.max(1, Math.min(50, chairs + delta)));

  return (
    <div className="space-y-6">
      <header className="animate-ob-rise" style={{ '--ob-i': 0 }}>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">How do you practise?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Two quick ones. Both are easy to change once you are in.
        </p>
      </header>

      <div className="animate-ob-rise" style={{ '--ob-i': 1 }}>
        <span className="mb-2 block text-sm font-medium text-gray-700">Main focus</span>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {SPECIALIZATIONS.map((cat) => {
            const selected = data.category === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange('category', cat)}
                className={`relative rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                  selected
                    ? 'border-[#2a276e] bg-[#9B8CFF]/12 text-[#2a276e]'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat}
                {selected && (
                  <Check
                    size={13}
                    strokeWidth={3}
                    className="absolute right-2 top-2 animate-ob-done text-[#2a276e]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="animate-ob-rise" style={{ '--ob-i': 2 }}>
        <label htmlFor="ob-chairs" className="mb-2 block text-sm font-medium text-gray-700">
          Treatment chairs
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={chairs <= 1}
            aria-label="One fewer chair"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            id="ob-chairs"
            type="number"
            min="1"
            max="50"
            value={chairs}
            onChange={(e) =>
              onChange(
                'number_of_chairs',
                Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)),
              )
            }
            className="w-20 rounded-xl border border-gray-300 px-4 py-3 text-center text-sm font-semibold focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
          />
          <button
            type="button"
            onClick={() => adjust(1)}
            disabled={chairs >= 50}
            aria-label="One more chair"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* The number turned into the thing it actually controls. */}
          <div className="ml-1 flex items-end gap-1" aria-hidden="true">
            {Array.from({ length: Math.min(chairs, 8) }).map((_, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-[#2a276e]/25 transition-all duration-300"
                style={{ height: `${14 + (i % 3) * 5}px` }}
              />
            ))}
            {chairs > 8 && <span className="ml-1 text-xs text-gray-400">+{chairs - 8}</span>}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          Your calendar shows one column per chair, so two appointments can run side by side.
        </p>
      </div>

      <div
        className="animate-ob-rise rounded-xl border border-gray-200 bg-gray-50/70 p-4"
        style={{ '--ob-i': 3 }}
      >
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <Sparkles size={14} className="text-[#29828a]" /> Already done for you
        </p>
        <ul className="mt-2 space-y-1 text-xs text-gray-500">
          <li className="flex items-start gap-1.5">
            <Check size={12} className="mt-0.5 shrink-0 text-[#29828a]" />
            12 common treatments, priced and ready to edit
          </li>
          <li className="flex items-start gap-1.5">
            <Check size={12} className="mt-0.5 shrink-0 text-[#29828a]" />
            Opening hours set to 8am to 8pm, Monday to Saturday
          </li>
          <li className="flex items-start gap-1.5">
            <Check size={12} className="mt-0.5 shrink-0 text-[#29828a]" />
            Your plan, with everything unlocked while you try it
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PracticeStep;
