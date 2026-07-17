import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { universalToFDI } from '../../utils/toothNumbering';
import CleanToothSVG from './CleanToothSVG';
import ToothSurfaceMap from './ToothSurfaceMap';
import { getCurrencySymbol } from '../../utils/currency';
import { TOOTH_NAMES } from './dentalConstants';
import AnatomyIcon from './AnatomyIcons';
import ClinicalAutocomplete from './ClinicalAutocomplete';
import { api } from '../../utils/api';
import { toast } from 'react-toastify';

// Honest status options — the label, the stored value, and the chart symbol all agree.
const TOOTH_STATUSES = [
    { value: 'present', label: 'Healthy', color: '#10b981' },
    { value: 'planned', label: 'Planned', color: '#f59e0b' },
    { value: 'implant', label: 'Existing Work', color: '#3b82f6' },
    { value: 'rootCanal', label: 'Root Canal', color: '#3b82f6' },
    { value: 'missing', label: 'Extracted', color: '#ef4444' },
    { value: 'impacted', label: 'Impacted', color: '#94a3b8' },
];

const ANATOMY_STATUSES = [
    { value: 'present', label: 'Normal', color: '#10b981' },
    { value: 'inflamed', label: 'Inflamed', color: '#ef4444' },
    { value: 'under_observation', label: 'Observation', color: '#f59e0b' },
];

const ToothRightDrawer = ({
    isOpen,
    onClose,
    selectedTooth,
    teethData,
    toothNotes,
    onSurfaceConditionChange,
    onToothStatusChange,
    onNotesChange,
    onAddTreatment,
    editingTreatment
}) => {
    // Local state for the drawer form
    const [diagnosis, setDiagnosis] = useState('');
    const [treatment, setTreatment] = useState('');
    const [price, setPrice] = useState(0);
    const [priceFromCatalog, setPriceFromCatalog] = useState(false); // picked from the price list
    const [savePrice, setSavePrice] = useState(false);               // "also save to my price list"
    const [feePrompt, setFeePrompt] = useState(false);               // "free or paid?" confirm
    const priceInputRef = useRef(null);
    const [note, setNote] = useState('');
    const [status, setStatus] = useState('present');

    useEffect(() => {
        if (editingTreatment) {
            setDiagnosis(editingTreatment.diagnosis || '');
            setTreatment(editingTreatment.procedure || '');
            setPrice(editingTreatment.cost || 0);
            setPriceFromCatalog(!!editingTreatment.cost);
            setSavePrice(false);
            setNote(editingTreatment.notes || toothNotes[selectedTooth] || '');
            setStatus(teethData[selectedTooth]?.status || 'present');
        } else if (selectedTooth) {
            setDiagnosis('');
            setTreatment('');
            setPrice(0);
            setPriceFromCatalog(false);
            setSavePrice(false);
            setNote(toothNotes[selectedTooth] || '');
            setStatus(teethData[selectedTooth]?.status || 'present');
        }
    }, [selectedTooth, toothNotes, teethData, editingTreatment]);

    if (!isOpen || !selectedTooth) return null;

    const isTooth = !isNaN(parseInt(selectedTooth)) && Number.isInteger(Number(selectedTooth));
    const statusOptions = isTooth ? TOOTH_STATUSES : ANATOMY_STATUSES;

    const handleSurfaceClick = (surface) => {
        if (!isTooth) return;
        const currentSurfaces = teethData[selectedTooth]?.surfaces || {};
        const currentCond = currentSurfaces[surface];
        const nextCond = currentCond === 'caries' ? 'none' : 'caries';
        onSurfaceConditionChange(selectedTooth, surface, nextCond);
    };

    const pickStatus = (value) => {
        setStatus(value);
        onToothStatusChange(selectedTooth, value);
    };

    // Commit the procedure card with a confirmed fee (status + note already persist live).
    const commitTreatment = async (fee) => {
        // Optionally remember a new procedure + its fee, so it's recognised next time.
        if (savePrice && !priceFromCatalog && treatment.trim() && fee > 0) {
            try {
                await api.post('/treatment-types', { name: treatment.trim(), price: fee });
                toast.success(`Saved "${treatment.trim()}" to your price list`);
            } catch {
                // non-fatal — still add the procedure to this case
            }
        }
        // Colour the tooth on the chart as "planned" unless it already carries an
        // explicit status (extracted / existing work / etc.).
        if ((teethData[selectedTooth]?.status || 'present') === 'present') {
            onToothStatusChange(selectedTooth, 'planned');
        }
        onAddTreatment({
            tooth: selectedTooth,
            diagnosis,
            procedure: treatment,
            notes: note,
            cost: fee,
            status: editingTreatment?.status || 'planned'
        });
        onClose();
    };

    const handleSave = () => {
        if (!treatment.trim()) { onClose(); return; }
        const fee = Number(price) || 0;
        // No fee entered — confirm it's genuinely free before adding a ₹0 procedure.
        if (fee <= 0) { setFeePrompt(true); return; }
        commitTreatment(fee);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            ></div>

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col translate-x-0">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 leading-tight">
                            {isTooth ? `Tooth ${universalToFDI(selectedTooth)}` : 'Examination'}
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {isTooth ? (TOOTH_NAMES[selectedTooth] || 'Procedure & status') : selectedTooth}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {/* Compact visual */}
                    {isTooth ? (
                        <div className="flex items-center justify-around px-4 py-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                            <div className="w-16 h-20 flex items-end justify-center">
                                <CleanToothSVG toothNum={selectedTooth} className="w-full h-full drop-shadow-sm" />
                            </div>
                            <div className="w-px h-20 bg-gray-200 mx-1"></div>
                            <div className="w-28 h-28 relative">
                                <ToothSurfaceMap
                                    surfaces={teethData[selectedTooth]?.surfaces || {}}
                                    onSurfaceSelect={handleSurfaceClick}
                                    readOnly={false}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center items-center py-5 px-4 bg-gray-50/70 rounded-2xl border border-gray-100 gap-6">
                            <div className="w-24 h-24 drop-shadow-sm">
                                <AnatomyIcon type={selectedTooth} />
                            </div>
                            <span className="text-xl font-black text-[#2a276e] tracking-tight w-28 break-words">{universalToFDI(selectedTooth)}</span>
                        </div>
                    )}

                    {/* Clinical Status — honest segmented pills */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Status</label>
                        <div className="flex flex-wrap gap-2">
                            {statusOptions.map(opt => {
                                const active = status === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => pickStatus(opt.value)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            active
                                                ? 'text-white border-transparent shadow-sm'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                        }`}
                                        style={active ? { backgroundColor: opt.color } : undefined}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Diagnosis */}
                    <ClinicalAutocomplete
                        category="diagnosis"
                        label="Diagnosis"
                        value={diagnosis}
                        onChange={(val) => setDiagnosis(val)}
                        placeholder="Type diagnosis or select suggestion..."
                    />

                    {/* Procedure — a list pick fills the fee; a typed-in one is flagged
                        as new and asks for a fee (no silent default). */}
                    <ClinicalAutocomplete
                        category="procedure"
                        label="Procedure"
                        value={treatment}
                        onChange={(val) => { setTreatment(val); setPriceFromCatalog(false); setSavePrice(false); }}
                        onSelectFull={(suggestion) => {
                            setPrice(suggestion.price != null ? suggestion.price : 0);
                            setPriceFromCatalog(true);
                            setSavePrice(false);
                        }}
                        placeholder="Type procedure or select suggestion..."
                    />

                    {/* Editable fee — green when it's from the price list, amber when it's
                        a new procedure that needs a fee set for this case. */}
                    {treatment.trim() && (
                        <div className="-mt-1 space-y-2">
                            <div className={`rounded-xl border px-4 py-3 ${priceFromCatalog ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold uppercase tracking-widest ${priceFromCatalog ? 'text-green-600' : 'text-amber-700'}`}>Procedure fee</span>
                                    <div className="ml-auto flex items-center gap-0.5">
                                        <span className={`text-base font-black ${priceFromCatalog ? 'text-green-700' : 'text-amber-700'}`}>{getCurrencySymbol()}</span>
                                        <input
                                            ref={priceInputRef}
                                            type="number" min="0" inputMode="numeric"
                                            value={price || ''}
                                            onChange={(e) => setPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                                            placeholder="0"
                                            className={`w-24 text-right text-lg font-black bg-transparent outline-none placeholder:text-current/40 ${priceFromCatalog ? 'text-green-700' : 'text-amber-700'}`}
                                        />
                                    </div>
                                </div>
                                <p className={`text-[11px] mt-1 ${priceFromCatalog ? 'text-green-600/70' : 'text-amber-700'}`}>
                                    {priceFromCatalog
                                        ? 'From your price list — edit if this case is different.'
                                        : `"${treatment.trim()}" isn't in your price list yet — set a fee for this case.`}
                                </p>
                            </div>

                            {/* Remember a new procedure's fee for next time */}
                            {!priceFromCatalog && Number(price) > 0 && (
                                <label className="flex items-center gap-2 px-1 cursor-pointer">
                                    <input type="checkbox" checked={savePrice} onChange={(e) => setSavePrice(e.target.checked)}
                                        className="rounded border-gray-300 text-[#2a276e] focus:ring-[#2a276e]/20" />
                                    <span className="text-xs text-gray-600">Save <span className="font-semibold">{treatment.trim()}</span> at {getCurrencySymbol()}{Number(price).toLocaleString('en-US')} to my price list</span>
                                </label>
                            )}

                            {isTooth && (
                                <Link to="/admin/treatments" className="inline-flex items-center gap-1 text-xs font-semibold text-[#2a276e] hover:underline px-1">
                                    Manage price list <ArrowUpRight size={13} />
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Note (optional — merges the old "On Examination") */}
                    <div>
                        <label className="block text-sm font-bold text-gray-900 mb-1.5">Note <span className="text-xs font-normal text-gray-400">(optional)</span></label>
                        <textarea
                            value={note}
                            onChange={(e) => {
                                setNote(e.target.value);
                                onNotesChange(selectedTooth, e.target.value);
                            }}
                            rows={2}
                            placeholder="Findings, observations…"
                            className="w-full bg-gray-50 border border-transparent hover:border-gray-200 focus:border-[#2a276e] focus:bg-white focus:ring-4 focus:ring-[#2a276e]/10 rounded-xl px-4 py-3 text-sm transition-all text-gray-900 resize-none"
                        />
                    </div>
                </div>

                {/* Footer sticky action */}
                <div className="p-5 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={handleSave}
                        className="w-full py-3.5 rounded-xl font-bold transition-all shadow-md bg-[#2a276e] hover:bg-[#1a1548] text-white hover:shadow-lg"
                    >
                        {editingTreatment ? 'Update Procedure' : (treatment ? 'Add Procedure' : 'Save')}
                    </button>
                    {!treatment && !editingTreatment && (
                        <p className="text-[11px] text-center text-gray-400 mt-2">Status &amp; note save automatically. Add a procedure to plan treatment.</p>
                    )}
                </div>

            </div>

            {/* Confirm free-or-paid when a procedure is added with no fee. */}
            {feePrompt && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setFeePrompt(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2" /></svg>
                        </div>
                        <h3 className="text-base font-bold text-gray-900">No fee set</h3>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                            Is <span className="font-semibold text-gray-700">"{treatment.trim()}"</span> free, or would you like to add a price?
                        </p>
                        <div className="flex flex-col gap-2.5 mt-5">
                            <button
                                onClick={() => { setFeePrompt(false); setTimeout(() => priceInputRef.current?.focus(), 50); }}
                                className="w-full px-4 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
                            >
                                Add a price
                            </button>
                            <button
                                onClick={() => { setFeePrompt(false); commitTreatment(0); }}
                                className="w-full px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                            >
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
