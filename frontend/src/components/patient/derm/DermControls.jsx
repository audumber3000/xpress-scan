import React, { useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';

/**
 * The controls the dermatology case paper is built from.
 *
 * Two families, and which one to reach for is decided by list length:
 *
 *   Under about eight options   PickOne / PickMany. Every choice on screen,
 *                               one tap, nothing hidden. A grade, a depth, a
 *                               Fitzpatrick type.
 *   Longer than that            SearchPicker. Selected items stay visible, the
 *                               six commonest sit below them, and the rest is
 *                               a search box away.
 *
 * That line exists because the first version of this screen ignored it and
 * rendered every vocabulary as chips: about two hundred of them for a consult
 * that needs fifteen. Long lists are not made usable by being complete, they
 * are made usable by being ranked and searchable.
 *
 * Collapsible carries the same idea up a level, with one rule — a collapsed
 * section must say what is inside it. Compressed, never hidden.
 *
 * Accent is #2a276e to match the rest of the case paper screen, not the teal
 * used in Control Center. Borders, never shadows.
 */

const ACCENT = '#2a276e';

export const SectionHeading = ({ Icon, title, hint, right }) => (
  <div className="flex items-start justify-between gap-4 mb-5">
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-8 h-8 rounded-xl bg-[#2a276e]/5 flex items-center justify-center text-[#2a276e] shrink-0">
          <Icon size={18} />
        </div>
      )}
      <div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
    </div>
    {right}
  </div>
);

export const Label = ({ children, hint }) => (
  <div className="mb-2">
    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{children}</span>
    {hint && <span className="block text-[11px] text-gray-400 font-normal normal-case mt-0.5">{hint}</span>}
  </div>
);

const chipClass = (selected) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors text-left ${
    selected
      ? 'bg-[#2a276e] border-[#2a276e] text-white'
      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
  }`;

/**
 * Pick exactly one, or none. Tapping the selected chip clears it, because a
 * mis-tap on a single-select is otherwise unrecoverable without a Clear button
 * nobody would find.
 */
export const PickOne = ({ label, hint, options, value, onChange, columns }) => (
  <div>
    {label && <Label hint={hint}>{label}</Label>}
    <div className={columns ? `grid gap-2 ${columns}` : 'flex flex-wrap gap-2'}>
      {options.map((opt) => {
        const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(selected ? '' : o.value)}
            className={chipClass(selected)}
          >
            {o.label}
            {o.hint && (
              <span className={`block text-[10px] font-normal mt-0.5 ${selected ? 'text-white/70' : 'text-gray-400'}`}>
                {o.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

/** Pick any number. Same chips, toggling independently. */
export const PickMany = ({ label, hint, options, values = [], onChange, columns }) => {
  const toggle = (v) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div>
      {label && <Label hint={hint}>{label}</Label>}
      <div className={columns ? `grid gap-2 ${columns}` : 'flex flex-wrap gap-2'}>
        {options.map((opt) => {
          const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
          const selected = values.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={chipClass(selected)}
            >
              {o.label}
              {o.hint && (
                <span className={`block text-[10px] font-normal mt-0.5 ${selected ? 'text-white/70' : 'text-gray-400'}`}>
                  {o.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const inputClass =
  'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium ' +
  'focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none transition-all';

export const TextField = ({ label, hint, value, onChange, placeholder, rows }) => (
  <div>
    {label && <Label hint={hint}>{label}</Label>}
    {rows ? (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${inputClass} resize-none`}
      />
    ) : (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    )}
  </div>
);

export const NumberField = ({ label, hint, value, onChange, placeholder, max, suffix }) => (
  <div>
    {label && <Label hint={hint}>{label}</Label>}
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        max={max}
        min={0}
        className={`${inputClass} ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

/**
 * A 0–10 severity slider for itch.
 *
 * Itch is the symptom that decides whether somebody sleeps, and it is the one
 * thing patients can rate consistently between visits. A number here is worth
 * more than a paragraph of "moderate itching" in the notes.
 */
export const SeveritySlider = ({ label, value = 0, onChange }) => (
  <div>
    <Label>{label}</Label>
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={10}
        value={value || 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#2a276e]"
      />
      <span className="w-12 text-center text-sm font-bold text-gray-900 tabular-nums">
        {value || 0}<span className="text-gray-400 font-normal">/10</span>
      </span>
    </div>
  </div>
);

export const Section = ({ children, first = false }) => (
  <section className={first ? '' : 'pt-8 border-t border-gray-100'}>{children}</section>
);

export { ACCENT };

/* ── Controls that keep long vocabularies off the screen ──────────────────── */

/**
 * A section that stays shut until it is needed, and says what is inside while
 * it is shut.
 *
 * The summary line is the whole point. A collapsed section that reads
 * "Fitzpatrick IV · Combination · 8 months, progressive" is not hidden
 * information, it is compressed information — you can read the whole consult
 * down the left edge without opening anything. A collapsed section that just
 * says "History" is hidden information, and people stop trusting it.
 */
export const Collapsible = ({ Icon, title, hint, summary, count, open, onToggle, children, right }) => (
  <section className="border border-gray-200 rounded-2xl overflow-hidden">
    <div className="flex items-center gap-3 w-full px-5 py-4 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <ChevronRight
          size={16}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {Icon && (
          <span className="w-7 h-7 rounded-lg bg-[#2a276e]/5 flex items-center justify-center text-[#2a276e] shrink-0">
            <Icon size={15} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{title}</span>
            {count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#2a276e] text-white text-[10px] font-bold tabular-nums">
                {count}
              </span>
            )}
          </span>
          {!open && summary && (
            <span className="block text-xs text-gray-500 truncate mt-0.5">{summary}</span>
          )}
          {!open && !summary && hint && (
            <span className="block text-xs text-gray-400 truncate mt-0.5">{hint}</span>
          )}
        </span>
      </button>
      {right}
    </div>
    {open && <div className="px-5 pb-5 pt-1 border-t border-gray-100">{children}</div>}
  </section>
);

/**
 * Pick many from a long vocabulary, without printing the vocabulary.
 *
 * Selected items are always visible, because what she chose is the record.
 * Below them sits a short row of the options this list is actually used for
 * most of the time, and a search box for the rest. Typing "lich" reaches
 * lichenification in three keystrokes, which is faster than reading fifteen
 * chips and is how somebody who knows the words already works.
 *
 * `common` is the shortlist shown without searching. Everything else exists but
 * has to be asked for.
 */
export const SearchPicker = ({
  label, hint, options, values = [], onChange, common = 6, placeholder = 'Search…',
}) => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const norm = (o) => (typeof o === 'string' ? { value: o, label: o } : o);
  const all = options.map(norm);
  const selected = all.filter((o) => values.includes(o.value));
  const unselected = all.filter((o) => !values.includes(o.value));

  const q = query.trim().toLowerCase();
  const matches = q
    ? unselected.filter((o) => o.label.toLowerCase().includes(q))
    : unselected.slice(0, expanded ? undefined : common);

  const hiddenCount = unselected.length - matches.length;

  const toggle = (v) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div>
      {label && <Label hint={hint}>{label}</Label>}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2a276e] text-white text-xs font-semibold"
            >
              {o.label}
              <X size={11} className="opacity-70" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        {matches.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => { toggle(o.value); setQuery(''); }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 bg-white hover:border-gray-400 transition-colors"
          >
            {o.label}
          </button>
        ))}

        {!q && hiddenCount > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#2a276e] hover:bg-[#2a276e]/5 transition-colors"
          >
            +{hiddenCount} more
          </button>
        )}
        {!q && expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:bg-gray-50 transition-colors"
          >
            Show fewer
          </button>
        )}

        {all.length > common && (
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-36 pl-7 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15 outline-none"
            />
          </div>
        )}
      </div>

      {q && matches.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">Nothing matches “{query}”.</p>
      )}
    </div>
  );
};

/** Single-choice version of the same idea, for vocabularies over about eight. */
export const SearchPickOne = ({ label, hint, options, value, onChange, common = 6 }) => (
  <SearchPicker
    label={label}
    hint={hint}
    options={options}
    values={value ? [value] : []}
    onChange={(vals) => onChange(vals.filter((v) => v !== value)[0] || '')}
    common={common}
  />
);
