import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import CleanToothSVG from './CleanToothSVG';
import ToothSurfaceMap from './ToothSurfaceMap';
import { getCurrencySymbol } from '../../utils/currency';
import { TOOTH_NAMES } from './dentalConstants';
import AnatomyIcon from './AnatomyIcons';
import ClinicalAutocomplete from './ClinicalAutocomplete';

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
    const [note, setNote] = useState('');
    const [status, setStatus] = useState('present');

    useEffect(() => {
        if (editingTreatment) {
            setDiagnosis(editingTreatment.diagnosis || '');
            setTreatment(editingTreatment.procedure || '');
            setPrice(editingTreatment.cost || 0);
            setNote(editingTreatment.notes || toothNotes[selectedTooth] || '');
            setStatus(teethData[selectedTooth]?.status || 'present');
        } else if (selectedTooth) {
            setDiagnosis('');
            setTreatment('');
            setPrice(0);
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

    // One save: status + note already persist live; this commits the procedure card
    // (if any) and reflects a planned procedure on the chart. Nothing is half-saved.
    const handleSave = () => {
        if (treatment) {
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
                cost: price,
                status: editingTreatment?.status || 'planned'
            });
        }
        onClose();
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
                            {isTooth ? `Tooth ${selectedTooth}` : 'Examination'}
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
                            <span className="text-xl font-black text-[#2a276e] tracking-tight w-28 break-words">{selectedTooth}</span>
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

                    {/* Procedure (drives price) */}
                    <ClinicalAutocomplete
                        category="procedure"
                        label="Procedure"
                        value={treatment}
                        onChange={(val) => setTreatment(val)}
                        onSelectFull={(suggestion) => {
                            if (suggestion.price != null && suggestion.price > 0) {
                                setPrice(suggestion.price);
                            }
                        }}
                        placeholder="Type procedure or select suggestion..."
                    />

                    {/* Price (read-only, from settings) */}
                    {price > 0 && (
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl -mt-2">
                            <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Procedure Fee</span>
                            <span className="ml-auto text-lg font-black text-green-700">{getCurrencySymbol()}{Number(price).toLocaleString('en-US')}</span>
                        </div>
                    )}

                    {/* Jump to pricing settings to edit / compare procedure prices. */}
                    {isTooth && (
                        <Link
                            to="/admin/treatments"
                            className="-mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2a276e] hover:underline"
                        >
                            {price > 0 ? 'Change price' : 'Check procedure prices'} or compare others
                            <ArrowUpRight size={13} />
                        </Link>
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
        </>
    );
};

export default ToothRightDrawer;
