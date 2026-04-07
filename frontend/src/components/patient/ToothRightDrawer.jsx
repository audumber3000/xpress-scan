import React, { useState, useEffect } from 'react';
import CleanToothSVG from './CleanToothSVG';
import ToothSurfaceMap from './ToothSurfaceMap';
import { TOOTH_NAMES, CONDITION_LABELS } from './dentalConstants';
import AnatomyIcon from './AnatomyIcons';
import ClinicalAutocomplete from './ClinicalAutocomplete';

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
    const [examination, setExamination] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [treatment, setTreatment] = useState('');
    const [price, setPrice] = useState(0);
    const [status, setStatus] = useState('rootCanal');

    useEffect(() => {
        if (editingTreatment) {
            setExamination(editingTreatment.notes || '');
            setDiagnosis(editingTreatment.diagnosis || '');
            setTreatment(editingTreatment.procedure || '');
            setPrice(editingTreatment.cost || 0);
            setStatus(teethData[selectedTooth]?.status || 'rootCanal');
        } else if (selectedTooth) {
            setExamination(toothNotes[selectedTooth] || '');
            setDiagnosis('');
            setTreatment('');
            setPrice(0);
            setStatus(teethData[selectedTooth]?.status || 'rootCanal');
        }
    }, [selectedTooth, toothNotes, teethData, editingTreatment]);

    if (!isOpen || !selectedTooth) return null;

    const isTooth = !isNaN(parseInt(selectedTooth)) && Number.isInteger(Number(selectedTooth));

    const handleSurfaceClick = (surface) => {
        if (!isTooth) return;
        const currentSurfaces = teethData[selectedTooth]?.surfaces || {};
        const currentCond = currentSurfaces[surface];
        const nextCond = currentCond === 'caries' ? 'none' : 'caries';
        onSurfaceConditionChange(selectedTooth, surface, nextCond);
    };

    const handleAddTreatment = () => {
        if (treatment) {
            onAddTreatment({
                tooth: selectedTooth, // Maps nicely as either '12' or 'Left TMJ'
                diagnosis: diagnosis,
                procedure: treatment,
                notes: examination,
                cost: price,
                status: editingTreatment?.status || 'planned'
            });
            onClose();
        }
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
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isTooth ? 'Tooth Procedure' : 'Examination & Planning'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                    
                    {/* Visuals Block conditional on type */}
                    {isTooth ? (
                        <div className="flex justify-around items-center px-4 py-8 bg-gray-50/50 rounded-2xl mb-6 border border-gray-100">
                            
                            {/* Actual Tooth Representation & Number */}
                            <div className="flex flex-col items-center justify-end h-40 w-1/2">
                                <div className="w-20 h-28 mb-5 flex items-end justify-center">
                                    <CleanToothSVG toothNum={selectedTooth} className="w-full h-full drop-shadow-md" />
                                </div>
                                <span className="text-4xl font-black text-[#2a276e] leading-none tracking-tighter shadow-sm">{selectedTooth}</span>
                            </div>

                            {/* Divider Line */}
                            <div className="w-px h-32 bg-gray-200 shadow-sm mx-2"></div>

                            {/* Interactive MBDL Surface Selector */}
                            <div className="flex flex-col items-center justify-center h-40 w-1/2">
                                <div className="w-40 h-40 relative">
                                    <ToothSurfaceMap 
                                        surfaces={teethData[selectedTooth]?.surfaces || {}}
                                        onSurfaceSelect={handleSurfaceClick}
                                        readOnly={false}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center items-center py-6 px-4 bg-gray-50/50 rounded-2xl mb-6 border border-gray-100 shadow-inner gap-8">
                            <div className="w-28 h-28 drop-shadow-md">
                                <AnatomyIcon type={selectedTooth} />
                            </div>
                            <span className="text-2xl font-black text-[#2a276e] tracking-tight w-32 break-words">{selectedTooth}</span>
                        </div>
                    )}

                    {/* Forms */}
                    <div className="space-y-6">
                        {/* On Examination */}
                        <ClinicalAutocomplete
                            category="finding"
                            label="On Examination"
                            value={examination}
                            onChange={(val) => {
                                setExamination(val);
                                onNotesChange(selectedTooth, val);
                            }}
                            placeholder="Type findings or select suggestion..."
                        />

                        {/* Diagnosis */}
                        <ClinicalAutocomplete
                            category="diagnosis"
                            label="Diagnosis"
                            value={diagnosis}
                            onChange={(val) => setDiagnosis(val)}
                            placeholder="Type diagnosis or select suggestion..."
                        />

                        {/* Procedure */}
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

                        {/* Price Display (read-only, from settings) */}
                        {price > 0 && (
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl">
                                <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Procedure Fee</span>
                                <span className="ml-auto text-lg font-black text-green-700">₹{Number(price).toLocaleString('en-IN')}</span>
                            </div>
                        )}

                        {/* Status Selection */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-1">Clinical Status</label>
                            <p className="text-xs text-gray-400 italic mb-2">Set the primary clinical status</p>
                            <select
                                value={status}
                                onChange={(e) => {
                                    setStatus(e.target.value);
                                    onToothStatusChange(selectedTooth, e.target.value);
                                }}
                                className="w-full bg-gray-50 border border-transparent hover:border-gray-200 focus:border-[#2a276e] focus:bg-white focus:ring-4 focus:ring-[#2a276e]/10 rounded-xl px-4 py-3 text-sm transition-all text-gray-900 appearance-none"
                            >
                                <option value="present">Present (Healthy)</option>
                                {isTooth && (
                                    <>
                                        <option value="missing">Teeth Removed</option>
                                        <option value="implant">Treatment Taken Before</option>
                                        <option value="rootCanal">Recommended To Take Treatment</option>
                                    </>
                                )}
                                {!isTooth && (
                                    <>
                                        <option value="inflamed">Inflamed / Abnormal</option>
                                        <option value="under_observation">Under Observation</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                </div>

                {/* Footer sticky action */}
                <div className="p-6 border-t border-gray-100 bg-gray-50">
                    <button 
                        onClick={handleAddTreatment}
                        disabled={!treatment}
                        className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-md ${
                            treatment 
                            ? 'bg-[#2a276e] hover:bg-[#1a1548] text-white hover:shadow-lg' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        {editingTreatment ? 'Update Procedure Card' : 'Add to Procedures'}
                    </button>
                </div>

            </div>
        </>
    );
};

export default ToothRightDrawer;
