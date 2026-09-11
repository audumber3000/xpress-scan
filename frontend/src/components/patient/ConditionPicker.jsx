import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check, Minus } from 'lucide-react';
import { CONDITION_GROUPS, conditionLabel } from './dentalConstants';

/**
 * Conditions: a search box, a list of checkboxes under it, pills for what is
 * ticked. Nothing else.
 *
 * The first version had an "Add condition" button that opened an inline panel
 * with a description under every row and a Done button to close it. Five parts
 * for what is one gesture — find it, tick it — and it read as a form to fill in
 * rather than a list to pick from.
 *
 * `state` maps each value to `'all'` or `'some'`. On one tooth it is only ever
 * `'all'`. On a group of teeth, `'some'` means the condition is on some of them:
 * it shows a dash, and ticking it puts it on the rest.
 */
const ConditionPicker = ({ state = {}, onToggle, multi = false }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef(null);

    useEffect(() => {
        const onDown = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return CONDITION_GROUPS;
        return CONDITION_GROUPS
            .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
            .filter((g) => g.items.length);
    }, [query]);

    const items = CONDITION_GROUPS.flatMap((g) => g.items);
    const chosen = Object.keys(state);

    return (
        <div ref={wrapRef} className="relative">
            <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
                    placeholder="Search conditions…"
                    aria-label="Search conditions"
                    className="w-full h-10 pl-9 pr-3 bg-white border border-gray-200 rounded-lg text-sm outline-none transition-colors focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15 placeholder:text-gray-400"
                />
            </div>

            {open && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto overscroll-contain">
                    {groups.length === 0 && (
                        <p className="px-3 py-3 text-sm text-gray-500">No condition by that name.</p>
                    )}
                    {groups.map((g) => (
                        <div key={g.id}>
                            <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {g.label}
                            </div>
                            {g.items.map((item) => {
                                const s = state[item.value];
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        // Keeps focus in the search box, so ticking
                                        // several in a row does not close the list.
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => onToggle?.(item, s !== 'all')}
                                        title={item.hint}
                                        aria-pressed={s === 'all'}
                                        className="w-full text-left px-3 py-1.5 flex items-center gap-2.5 text-sm text-gray-800 hover:bg-gray-50"
                                    >
                                        <span className={`w-4 h-4 rounded shrink-0 grid place-items-center border ${
                                            s === 'all' ? 'bg-[#2a276e] border-[#2a276e] text-white'
                                                : s === 'some' ? 'bg-white border-[#2a276e] text-[#2a276e]'
                                                    : 'bg-white border-gray-300'
                                        }`}>
                                            {s === 'all' && <Check size={11} strokeWidth={3} />}
                                            {s === 'some' && <Minus size={11} strokeWidth={3} />}
                                        </span>
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {chosen.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {chosen.map((value) => {
                        const some = state[value] === 'some';
                        const item = items.find((i) => i.value === value);
                        return (
                            <span
                                key={value}
                                title={some ? 'On some of the selected teeth' : undefined}
                                className={`inline-flex items-center gap-1 pl-2 pr-0.5 h-6 rounded-md text-xs font-semibold ${
                                    some
                                        ? 'bg-white text-[#2a276e] border border-dashed border-[#2a276e]/40'
                                        : 'bg-[#2a276e]/[0.08] text-[#2a276e]'
                                }`}
                            >
                                {conditionLabel(value)}
                                <button
                                    type="button"
                                    onClick={() => item && onToggle?.(item, false)}
                                    title={`Remove ${conditionLabel(value)}`}
                                    className="w-5 h-5 grid place-items-center rounded text-[#2a276e]/60 hover:text-[#2a276e]"
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}

            {multi && chosen.some((v) => state[v] === 'some') && (
                <p className="mt-1.5 text-[11px] text-gray-400">Dashed = on some of the selected teeth.</p>
            )}
        </div>
    );
};

export default ConditionPicker;
