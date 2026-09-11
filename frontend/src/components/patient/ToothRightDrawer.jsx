import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { universalToFDI } from '../../utils/toothNumbering';
import CleanToothSVG from './CleanToothSVG';
import ToothSurfaceMap from './ToothSurfaceMap';
import { getCurrencySymbol } from '../../utils/currency';
import {
    surfacesFor, surfacesForMany, surfaceLabel, formatSurfaces, toothFullName,
    normaliseSurfaces, readToothState, deriveStatus,
    WORK_TYPES_BY_STAGE, TOOTH_MARKS, marksOf, stepTooth,
    conditionsOf, allConditionsOf,
} from './dentalConstants';
import ConditionPicker from './ConditionPicker';
import AnatomyIcon from './AnatomyIcons';
import ClinicalMultiSelect from './ClinicalMultiSelect';
import ClinicalAutocomplete from './ClinicalAutocomplete';
import { api } from '../../utils/api';
import { notify } from '../../utils/notify';

// Soft tissue and TMJ are not teeth: no surfaces, no conditions, no arch to walk.
const ANATOMY_STATUSES = [
    { value: 'present', label: 'Normal', color: '#10b981' },
    { value: 'inflamed', label: 'Inflamed', color: '#ef4444' },
    { value: 'under_observation', label: 'Observation', color: '#f59e0b' },
];

/** Marks a field the drawer will refuse to commit without. Used sparingly:
 *  a star on something optional is a star nobody reads. */
const Req = () => <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>;

/** Section heading: a label, and an optional note or action on the right. */
const Section = ({ n, title, right, children }) => (
    <section>
        <div className="flex items-baseline justify-between gap-3 mb-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                {n != null && <span className="text-gray-300 mr-1.5">{n}.</span>}
                {title}
            </h3>
            {right}
        </div>
        {children}
    </section>
);

/** A row of exclusive choices. */
const PillRow = ({ options, value, onPick, colored = false }) => (
    <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
            const on = value === opt.value;
            return (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onPick(on && opt.clearable ? null : opt.value)}
                    aria-pressed={on}
                    title={opt.hint}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                        on
                            ? colored
                                ? 'text-white border-transparent'
                                : 'bg-[#2a276e] text-white border-[#2a276e]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                    style={on && colored && opt.color ? { backgroundColor: opt.color } : undefined}
                >
                    {opt.label}
                </button>
            );
        })}
    </div>
);

const SELECT =
    'w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-900 ' +
    'cursor-pointer outline-none transition-[border-color,box-shadow] duration-150 ease-out ' +
    'focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15';

const ToothRightDrawer = ({
    isOpen,
    onClose,
    selectedTooth,
    selectedTeeth = [],
    teethData = {},
    toothNotes = {},
    onSurfaceConditionChange,
    onToothStatusChange,
    onToothStateChange,
    onFindingsChange,
    onMarksChange,
    onConditionsChange,
    onAddTreatment,
    onNavigate,
    editingTreatment,
}) => {
    const [treatment, setTreatment] = useState('');
    const [price, setPrice] = useState(0);
    const [priceFromCatalog, setPriceFromCatalog] = useState(false);
    const [savePrice, setSavePrice] = useState(false);
    const [feePrompt, setFeePrompt] = useState(false);
    const priceInputRef = useRef(null);
    const [note, setNote] = useState('');
    const [status, setStatus] = useState('present');       // anatomy only
    const [condition, setCondition] = useState('sound');
    const [work, setWork] = useState(null);
    const [workType, setWorkType] = useState(null);
    const [findings, setFindings] = useState([]);
    const [marks, setMarks] = useState([]);
    const [procSurfaces, setProcSurfaces] = useState([]);
    const [lastSurface, setLastSurface] = useState(null);  // for "Distal selected"
    const [combined, setCombined] = useState(false);
    /* Most teeth are sound with nothing on them, so the default is a single
       line of prose rather than eleven unlit pills. Opens on its own when
       there is something to see. */
    /**
     * What this drawer is for right now.
     *
     * It is a mode, not a field. Existing work is already in the mouth: there
     * is nothing to plan, nothing to price and nothing to bill, so the whole
     * procedure block is meaningless and is not shown. Planned work IS the
     * procedure — which is also why planned has no "type" dropdown: choosing
     * type "Crown" and then procedure "Crown, ₹8,000" was the same fact twice.
     *
     * Defaults to planned, because planning is why a tooth gets opened.
     * Nothing is stored until something is actually filled in.
     */
    const [mode, setMode] = useState('planned');

    const key = `${selectedTooth}|${selectedTeeth.length}`;

    useEffect(() => {
        if (!selectedTooth) return;
        const data = teethData[selectedTooth] || {};
        const state = readToothState(data);
        setCondition(state.condition);
        setWork(state.work);
        setWorkType(state.workType);
        // A group's box is a batch to apply, not one tooth's record, so it
        // starts empty. Showing #12's findings while writing to #12-15 would
        // read as "these four have caries" when only one of them does.
        setFindings(selectedTeeth.length > 1 ? [] : (Array.isArray(data.findings) ? data.findings : []));
        setStatus(data.status || 'present');
        setMarks(marksOf(data));
        setLastSurface(null);
        setCombined(false);
        setMode(state.work === 'existing' ? 'existing' : 'planned');

        if (editingTreatment) {
            setTreatment(editingTreatment.procedure || '');
            setPrice(editingTreatment.cost || 0);
            setPriceFromCatalog(!!editingTreatment.cost);
            setProcSurfaces(editingTreatment.surfaces || []);
            setNote(editingTreatment.notes || toothNotes[selectedTooth] || '');
        } else {
            setTreatment('');
            setPrice(0);
            setPriceFromCatalog(false);
            setProcSurfaces([]);
            setNote(toothNotes[selectedTooth] || '');
        }
        setSavePrice(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, editingTreatment]);

    if (!isOpen || !selectedTooth) return null;

    const isTooth = !isNaN(parseInt(selectedTooth)) && Number.isInteger(Number(selectedTooth));

    /* Every tooth being charted right now. A single click gives a list of one,
       so the body below rarely has to branch on the count. */
    const targets = selectedTeeth.length
        ? selectedTeeth
        : [isTooth ? Number(selectedTooth) : selectedTooth];
    const isMulti = targets.length > 1;

    /* Judged per axis: a quadrant is all upper (so palatal is certain) even
       when it mixes front and back teeth (so the biting surface is not). */
    const surfaceSet = !isTooth
        ? surfacesForMany([])
        : isMulti ? surfacesForMany(targets) : surfacesFor(selectedTooth);

    /* Whether the group already disagrees about its state. Editing here writes
       to every selected tooth, so silently showing the first one's value and
       stamping it over the rest would lose what was already recorded. */
    const groupStates = isMulti ? targets.map((t) => readToothState(teethData[t] || {})) : [];
    const mixedCondition = isMulti && new Set(groupStates.map((g) => g.condition)).size > 1;
    const mixedWork = isMulti && new Set(groupStates.map((g) => `${g.work}:${g.workType}`)).size > 1;

    const prev = isTooth && !isMulti ? stepTooth(selectedTooth, -1) : null;
    const next = isTooth && !isMulti ? stepTooth(selectedTooth, 1) : null;
    const canNavigate = !!onNavigate && (prev !== null || next !== null);

    const chartSurfaces = normaliseSurfaces(teethData[selectedTooth]?.surfaces);

    /* ── writes ─────────────────────────────────────────────────────────── */

    const pushState = (nextState) => {
        const full = { condition, work, workType, ...nextState };
        setCondition(full.condition);
        setWork(full.work);
        setWorkType(full.workType);
        targets.forEach((t) => onToothStateChange?.(t, full));
    };

    // Nothing selected IS the healthy state, so clearing returns to 'sound'.
    // The value is still stored; it just is not a button anyone has to press.
    const pickCondition = (value) => pushState({ condition: value || 'sound' });

    /**
     * Overlays, saved the moment they are toggled.
     *
     * Separate from status because they coexist with it and with each other: a
     * tooth can carry a crown, a root canal and an abscess at once, and a single
     * status can only ever say one of those.
     */
    const toggleMark = (value, turnOn = !marks.includes(value)) => {
        setMarks(turnOn ? [...marks.filter((m) => m !== value), value] : marks.filter((m) => m !== value));
        // Each tooth's OWN list, changed by one item. This used to write the
        // first tooth's whole list over every selected tooth, so turning on a
        // sealant across four teeth erased a drifting mark on the third. It
        // also matters now that the abscess can be switched from the condition
        // list: a stale copy here would put back what was just taken off.
        targets.forEach((t) => {
            const cur = marksOf(teethData[t] || {});
            const next = turnOn
                ? (cur.includes(value) ? cur : [...cur, value])
                : cur.filter((m) => m !== value);
            onMarksChange?.(t, next);
        });
    };

    /**
     * The condition list, read from every selected tooth.
     *
     * Straight from `teethData` rather than a local copy: a condition can live
     * in three places (the structural state, the abscess mark, the tooth's own
     * list), and one reader for all three is what keeps the chips, the chart and
     * the summary PDF from ever disagreeing about the same tooth.
     */
    const conditionState = (() => {
        const counts = {};
        targets.forEach((t) => {
            allConditionsOf(teethData[t] || {}).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
        });
        return Object.fromEntries(
            Object.entries(counts).map(([v, n]) => [v, n === targets.length ? 'all' : 'some'])
        );
    })();

    /** Write one condition to wherever that kind of condition is kept. */
    const toggleCondition = (item, turnOn) => {
        if (item.structural) {
            // One of impacted / missing / fractured: they change the drawing and
            // exclude each other, so choosing one replaces the others, and
            // removing it returns the tooth to normal.
            pickCondition(turnOn ? item.structural : null);
            return;
        }
        if (item.mark) {
            toggleMark(item.mark, turnOn);
            return;
        }
        targets.forEach((t) => {
            const cur = conditionsOf(teethData[t] || {});
            const next = turnOn
                ? (cur.includes(item.value) ? cur : [...cur, item.value])
                : cur.filter((v) => v !== item.value);
            onConditionsChange?.(t, next);
        });
    };

    /** Existing work is a record, not a plan, so it saves as soon as it is picked. */
    const pickExistingType = (type) =>
        pushState({ work: type ? 'existing' : null, workType: type || null });

    const switchMode = (next) => {
        setMode(next);
        // Leaving "existing" clears what was recorded there; the two modes
        // describe different things and a tooth should not quietly claim both.
        if (next === 'planned' && work === 'existing') pushState({ work: null, workType: null });
    };

    const pickAnatomyStatus = (value) => {
        setStatus(value);
        targets.forEach((t) => onToothStatusChange?.(t, value));
    };

    const handleSurfaceClick = (surface) => {
        if (!isTooth) return;
        const current = chartSurfaces[surface];
        const nextCond = current === 'caries' ? 'none' : 'caries';
        targets.forEach((t) => onSurfaceConditionChange(t, surface, nextCond));
        setLastSurface(nextCond === 'none' ? null : surface);
    };

    /**
     * On one tooth this is simply its findings.
     *
     * On a group it is a batch: what you type is ADDED to each tooth, and
     * removing a pill takes it off each tooth again. It used to write the
     * primary tooth's whole list over every other one, so selecting four teeth
     * and adding "caries" erased a fracture already recorded on the third.
     */
    const setFindingsEverywhere = (vals) => {
        const added = vals.filter((v) => !findings.includes(v));
        const removed = findings.filter((v) => !vals.includes(v));
        setFindings(vals);

        if (!isMulti) {
            targets.forEach((t) => onFindingsChange?.(t, vals));
            return;
        }
        targets.forEach((t) => {
            const own = Array.isArray(teethData[t]?.findings) ? teethData[t].findings : [];
            const next = [...new Set([...own, ...added])].filter((v) => !removed.includes(v));
            onFindingsChange?.(t, next);
        });
    };

    const toggleProcSurface = (k) =>
        setProcSurfaces((prev) => (prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]));

    /* ── commit ─────────────────────────────────────────────────────────── */

    const commitTreatment = async (fee) => {
        if (savePrice && !priceFromCatalog && treatment.trim() && fee > 0) {
            try {
                await api.post('/treatment-types', { name: treatment.trim(), price: fee });
                notify.done(`Saved "${treatment.trim()}" to your price list`);
            } catch {
                /* non-fatal — still add the procedure to this case */
            }
        }
        // Adding a procedure is planning work, so say so on the chart — unless
        // the tooth already carries work of its own that we would be overwriting.
        targets.forEach((t) => {
            const s = readToothState(teethData[t] || {});
            if (!s.work) onToothStateChange?.(t, { ...s, work: 'planned' });
        });

        onAddTreatment({
            tooth: isMulti ? null : selectedTooth,
            teeth: isMulti ? targets : undefined,
            combined: isMulti ? combined : undefined,
            surfaces: procSurfaces.length ? procSurfaces : undefined,
            diagnosis: findings.join(', '),
            procedure: treatment,
            notes: note,
            cost: fee,
            status: editingTreatment?.status || 'planned',
        });
        onClose();
    };

    const handleSave = () => {
        if (!treatment.trim()) { onClose(); return; }
        const fee = Number(price) || 0;
        if (fee <= 0) { setFeePrompt(true); return; }
        commitTreatment(fee);
    };

    const NAV_BTN =
        'w-8 h-8 grid place-items-center rounded-lg border border-gray-200 text-gray-500 cursor-pointer ' +
        'transition-[background-color,color,transform] duration-150 ease-out hover:bg-gray-50 hover:text-[#2a276e] ' +
        'active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100';

    return (
        <>
            <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-40" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">

                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">
                                {isMulti
                                    ? `${targets.length} teeth selected`
                                    : isTooth ? `Tooth #${universalToFDI(selectedTooth)}` : 'Examination'}
                            </h2>
                            {!isMulti && isTooth && (
                                <span className="px-2 py-0.5 rounded-md bg-[#2a276e]/5 text-[#2a276e] text-[11px] font-bold">
                                    FDI {universalToFDI(selectedTooth)} · {selectedTooth <= 16 ? 'Maxillary' : 'Mandibular'}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {isMulti
                                ? targets.map(universalToFDI).join(', ')
                                : isTooth ? toothFullName(selectedTooth) : selectedTooth}
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {canNavigate && (
                            <>
                                <button type="button" className={NAV_BTN} disabled={prev === null}
                                    onClick={() => onNavigate(prev)}
                                    title={prev ? `Tooth ${universalToFDI(prev)}` : 'Start of the arch'}
                                    aria-label="Previous tooth">
                                    <ChevronLeft size={16} />
                                </button>
                                <button type="button" className={NAV_BTN} disabled={next === null}
                                    onClick={() => onNavigate(next)}
                                    title={next ? `Tooth ${universalToFDI(next)}` : 'End of the arch'}
                                    aria-label="Next tooth">
                                    <ChevronRight size={16} />
                                </button>
                            </>
                        )}
                        <button type="button" onClick={onClose} aria-label="Close"
                            className="w-8 h-8 grid place-items-center rounded-lg text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-700 active:scale-[0.97]">
                            <X size={17} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">

                    {/* Profile + surfaces */}
                    {isMulti ? (
                        <div className="px-4 py-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2.5">
                                Mark a surface on all {targets.length}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {surfaceSet.map((s) => (
                                    <button key={s.key} type="button" onClick={() => handleSurfaceClick(s.key)}
                                        title={`${s.label} — ${s.desc}`}
                                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-[#2a276e] hover:text-[#2a276e] active:scale-[0.97]">
                                        {s.short}
                                        <span className="ml-1.5 font-medium text-gray-400">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : isTooth ? (
                        <div className="px-4 py-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                            <div className="flex items-center justify-around">
                                <div className="text-center">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Profile</p>
                                    <div className="w-16 h-20 flex items-end justify-center">
                                        <CleanToothSVG toothNum={selectedTooth} className="w-full h-full" />
                                    </div>
                                </div>
                                <div className="w-px h-24 bg-gray-200" />
                                <div className="text-center">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Surfaces</p>
                                    <div className="w-28 h-28">
                                        <ToothSurfaceMap
                                            toothNum={selectedTooth}
                                            surfaces={chartSurfaces}
                                            onSurfaceSelect={handleSurfaceClick}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Said in words. A coloured wedge is ambiguous; "Distal" is not. */}
                            <p className="mt-2 text-center text-[11px] font-semibold text-[#2a276e] min-h-[16px]">
                                {lastSurface ? `${surfaceLabel(selectedTooth, lastSurface)} marked` : ''}
                            </p>
                        </div>
                    ) : (
                        <div className="flex justify-center items-center gap-6 py-5 px-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                            <div className="w-24 h-24"><AnatomyIcon type={selectedTooth} /></div>
                            <span className="w-28 text-xl font-black text-[#2a276e] break-words">{selectedTooth}</span>
                        </div>
                    )}

                    {isTooth ? (
                        <>
                            {/* Nothing at all for a healthy tooth.
                                Not a card, not a dot, not the word "Healthy" —
                                a box whose only message is that nothing has
                                happened is a box worth deleting. What is left
                                is one quiet line offering the exceptions, and
                                it only becomes a summary once there is
                                something true to summarise. */}
                            {/* Condition is orthogonal to everything below: a
                                tooth can be impacted AND have an extraction
                                planned, so it stays its own control. No collapse
                                — one dropdown is not worth hiding behind a link. */}
                            <Section
                                title="Conditions"
                                right={<span className="text-[11px] text-gray-400">Saved as you tap</span>}
                            >
                                <ConditionPicker
                                    state={conditionState}
                                    onToggle={toggleCondition}
                                    multi={isMulti}
                                />
                            </Section>

                            {/* The mode switch. Everything below it changes. */}
                            <div className="flex p-1 bg-gray-100 rounded-xl" role="group" aria-label="What are you recording">
                                {[
                                    { id: 'planned', label: 'Planned Treatment' },
                                    { id: 'existing', label: 'Existing Past Work' },
                                ].map((m) => {
                                    const on = mode === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => switchMode(m.id)}
                                            aria-pressed={on}
                                            className={`flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-semibold cursor-pointer transition-[background-color,color] duration-150 ease-out ${
                                                on ? 'bg-[#2a276e] text-white' : 'text-gray-500 hover:text-gray-900'
                                            }`}
                                        >
                                            <span className={`w-2.5 h-2.5 rounded-full border-2 ${
                                                on ? 'bg-white border-white' : 'border-gray-400'
                                            }`} />
                                            {m.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {mode === 'existing' && (
                                <Section
                                    title={<>What is already there<Req /></>}
                                    right={<span className="text-[11px] text-gray-400">Saved as you pick</span>}
                                >
                                    <select
                                        value={work === 'existing' ? (workType || '') : ''}
                                        onChange={(e) => pickExistingType(e.target.value || null)}
                                        className={SELECT}
                                    >
                                        <option value="">Choose…</option>
                                        {WORK_TYPES_BY_STAGE.existing.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                                        A record of what the mouth already has. It shows blue on
                                        the chart, and nothing is planned, priced or billed —
                                        which is why there is no procedure to fill in below.
                                    </p>
                                </Section>
                            )}

                            <Section title="Also on this tooth" right={<span className="text-[11px] text-gray-400">Saved as you tap</span>}>
                                {/* What a chart draws on TOP of the tooth rather
                                    than instead of it — these stack with each
                                    other and with whatever work is recorded. */}
                                <div className="flex flex-wrap gap-2">
                                    {TOOTH_MARKS.filter((m) => m.value !== 'abscess').map((m) => {
                                        const on = marks.includes(m.value);
                                        return (
                                            <button
                                                key={m.value} type="button" title={m.hint}
                                                onClick={() => toggleMark(m.value)} aria-pressed={on}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                                                    on ? 'bg-[#2a276e] text-white border-[#2a276e]'
                                                       : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {m.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Section>

                            <Section
                                title={isMulti ? `Add findings to all ${targets.length}` : 'Findings'}
                                right={mixedCondition || mixedWork
                                    ? <span className="text-[11px] font-semibold text-amber-600">These teeth differ</span>
                                    : null}
                            >
                                <ClinicalMultiSelect
                                    category="diagnosis"
                                    placeholder="Caries, demineralisation, fracture…"
                                    selectedValues={findings}
                                    onChange={setFindingsEverywhere}
                                />
                            </Section>
                        </>
                    ) : (
                        <Section title="Status">
                            <PillRow options={ANATOMY_STATUSES} value={status} onPick={pickAnatomyStatus} colored />
                        </Section>
                    )}

                    {(mode === 'planned' || !isTooth) && (
                    <Section
                        title={<>Procedure<Req /></>}
                        right={<span className="text-[11px] text-gray-400">Adds to the treatment plan</span>}
                    >
                        <ClinicalAutocomplete
                            category="procedure"
                            value={treatment}
                            onChange={(val) => { setTreatment(val); setPriceFromCatalog(false); setSavePrice(false); }}
                            onSelectFull={(s) => {
                                setPrice(s.price != null ? s.price : 0);
                                setPriceFromCatalog(true);
                                setSavePrice(false);
                            }}
                            placeholder="Type a procedure or pick one…"
                        />

                        {treatment.trim() && (
                            <div className="mt-3 space-y-2.5">
                                {/* Which surfaces the work is on. An MOD composite is not the
                                    same job, or the same fee, as a single-surface one, and
                                    until now the plan and the invoice could not tell them apart. */}
                                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Surfaces</span>
                                    <div className="flex gap-1">
                                        {surfaceSet.map((s) => {
                                            const on = procSurfaces.includes(s.key);
                                            return (
                                                <button key={s.key} type="button" onClick={() => toggleProcSurface(s.key)}
                                                    aria-pressed={on} title={s.label}
                                                    className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
                                                        on ? 'bg-[#2a276e] border-[#2a276e] text-white'
                                                           : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                                    }`}>
                                                    {s.short}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={`rounded-xl border px-4 py-3 ${priceFromCatalog ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold uppercase tracking-widest ${priceFromCatalog ? 'text-green-600' : 'text-amber-700'}`}>Fee<Req /></span>
                                        <div className="ml-auto flex items-center gap-0.5">
                                            <span className={`text-base font-black ${priceFromCatalog ? 'text-green-700' : 'text-amber-700'}`}>{getCurrencySymbol()}</span>
                                            <input ref={priceInputRef} type="number" min="0" inputMode="numeric"
                                                value={price || ''}
                                                onChange={(e) => setPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                                                placeholder="0"
                                                className={`w-24 text-right text-lg font-black bg-transparent outline-none ${priceFromCatalog ? 'text-green-700' : 'text-amber-700'}`} />
                                        </div>
                                    </div>
                                    <p className={`text-[11px] mt-1 ${priceFromCatalog ? 'text-green-600/70' : 'text-amber-700'}`}>
                                        {priceFromCatalog
                                            ? 'From your price list — edit if this case is different.'
                                            : `"${treatment.trim()}" isn't in your price list yet — set a fee for this case.`}
                                    </p>

                                    {isMulti && (
                                        <p className="text-[12px] font-semibold mt-2 pt-2 border-t border-current/10 text-gray-700">
                                            {combined
                                                ? `One procedure across ${targets.length} teeth · ${getCurrencySymbol()}${(Number(price) || 0).toLocaleString('en-IN')} in total`
                                                : `${getCurrencySymbol()}${(Number(price) || 0).toLocaleString('en-IN')} per tooth · ${targets.length} teeth = ${getCurrencySymbol()}${((Number(price) || 0) * targets.length).toLocaleString('en-IN')}`}
                                        </p>
                                    )}
                                </div>

                                {!priceFromCatalog && Number(price) > 0 && (
                                    <label className="flex items-center gap-2 px-1 cursor-pointer">
                                        <input type="checkbox" checked={savePrice} onChange={(e) => setSavePrice(e.target.checked)}
                                            className="rounded border-gray-300 text-[#2a276e] focus:ring-[#2a276e]/20" />
                                        <span className="text-xs text-gray-600">
                                            Save <span className="font-semibold">{treatment.trim()}</span> at {getCurrencySymbol()}{Number(price).toLocaleString('en-IN')} to my price list
                                        </span>
                                    </label>
                                )}

                                {isMulti && (
                                    <label className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer">
                                        <input type="checkbox" checked={combined} onChange={(e) => setCombined(e.target.checked)}
                                            className="mt-0.5 rounded border-gray-300 text-[#2a276e] focus:ring-[#2a276e]/20" />
                                        <span className="min-w-0">
                                            <span className="block text-xs font-semibold text-gray-800">Bill as one combined procedure</span>
                                            <span className="block text-[11px] leading-snug text-gray-500 mt-0.5">
                                                {combined
                                                    ? `One line on the plan and the bill, covering teeth ${targets.map(universalToFDI).join(', ')}.`
                                                    : 'Leave this off for separate work on each tooth. Turn it on for one job across several, like a quadrant scaling.'}
                                            </span>
                                        </span>
                                    </label>
                                )}

                                {isTooth && !isMulti && (
                                    <Link to="/admin/treatments" className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-[#2a276e] hover:underline">
                                        Manage price list <ArrowUpRight size={13} />
                                    </Link>
                                )}
                            </div>
                        )}
                    </Section>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="w-full py-3.5 rounded-xl font-bold text-white bg-[#2a276e] cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:bg-[#1a1548] active:scale-[0.99]"
                    >
                        {mode === 'existing' && isTooth
                            ? 'Done'
                            : editingTreatment
                                ? 'Update procedure'
                                : treatment
                                    ? (isMulti && !combined ? `Add to ${targets.length} teeth` : 'Add procedure')
                                    : 'Done'}
                    </button>

                    {!treatment && !editingTreatment && (
                        <p className="text-[11px] text-center text-gray-400">
                            {mode === 'existing' && isTooth
                                ? 'Saved already. Nothing here goes on the plan or the bill.'
                                : 'Condition and findings save on their own. Add a procedure to plan treatment.'}
                        </p>
                    )}
                </div>
            </div>

            {feePrompt && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setFeePrompt(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-base font-bold text-gray-900">No fee set</h3>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                            Is <span className="font-semibold text-gray-700">"{treatment.trim()}"</span> free, or would you like to add a price?
                        </p>
                        <div className="flex flex-col gap-2.5 mt-5">
                            <button type="button"
                                onClick={() => { setFeePrompt(false); setTimeout(() => priceInputRef.current?.focus(), 50); }}
                                className="w-full px-4 py-2.5 rounded-lg bg-[#2a276e] text-white text-sm font-semibold cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:bg-[#1a1548] active:scale-[0.97]">
                                Add a price
                            </button>
                            <button type="button"
                                onClick={() => { setFeePrompt(false); commitTreatment(0); }}
                                className="w-full px-4 py-2.5 rounded-lg bg-gray-50 text-gray-600 text-sm font-semibold cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:bg-gray-100 active:scale-[0.97]">
                                It's free — add at {getCurrencySymbol()}0
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ToothRightDrawer;
