import React, { useState, useEffect } from 'react';
import {
    TOOTH_NAMES,
    SURFACE_COLORS,
    CONDITION_LABELS,
    STATUS_COLORS,
    STATUS_LABELS,
    SURFACES
} from './dentalConstants';

const ALL_STATUSES = [
    { id: 'present', label: 'Present', color: 'bg-emerald-500' },
    { id: 'missing', label: 'Missing / Extracted', color: 'bg-red-500', icon: '❌' },
    { id: 'planned', label: 'Planned Treatment', color: 'bg-red-500', icon: '⭕' },
    { id: 'implant', label: 'Dental Implant', color: 'bg-slate-500', icon: '⚙️' },
    { id: 'impacted', label: 'Impacted', color: 'bg-slate-400', icon: '🧊' },
    { id: 'rootCanal', label: 'Root Canal', color: 'bg-red-500', icon: '💉' },
];

const SURFACE_CONDITIONS = [
    { id: 'none', label: 'Healthy', color: 'bg-gray-100' },
    { id: 'caries', label: 'Caries (Decay)', color: 'bg-[#3f2b1d]', icon: '🕳️' },
    { id: 'filling_existing', label: 'Existing Filling', color: 'bg-blue-500', icon: '🟦' },
    { id: 'filling_temp', label: 'Temporary Filling', color: 'bg-orange-500', icon: '🟧' },
    { id: 'crown_porcelain', label: 'Porcelain Crown', color: 'bg-slate-100', icon: '🦷' },
    { id: 'crown_gold', label: 'Gold Crown', color: 'bg-yellow-500', icon: '👑' },
    { id: 'fracture', label: 'Fracture / Crack', color: 'bg-red-800', icon: '⚡' },
];

/**
 * ToothEditPopover - An inline editing box that appears near the selected tooth
 */
const ToothEditPopover = ({
    toothNum,
    currentSurfaces = {},
    currentStatus = 'present',
    currentNotes = '',
    onClose,
    onSurfaceConditionChange,
    onToothStatusChange,
    onNotesChange,
    position = { top: 0, left: 0 },
    side = 'top'
}) => {
    const [selectedSurface, setSelectedSurface] = useState('O');
    const [localNotes, setLocalNotes] = useState(currentNotes);
    const [clampedPos, setClampedPos] = useState({ left: position.left, arrowLeft: '50%' });
    const popoverRef = React.useRef(null);

    // Sync local notes when tooth changes
    useEffect(() => {
        setLocalNotes(currentNotes);
        setSelectedSurface('O');
    }, [toothNum, currentNotes]);

    // Robust positioning logic
    React.useLayoutEffect(() => {
        const calculatePosition = () => {
            const container = popoverRef.current?.closest('.dental-chart-container');
            if (container && popoverRef.current) {
                const containerWidth = container.offsetWidth;
                const popoverWidth = 640;
                const padding = 15;

                // The 'natural' left position for a centered popover
                let newLeft = position.left - (popoverWidth / 2);

                // Clamp within container
                const minLeft = padding;
                const maxLeft = containerWidth - popoverWidth - padding;
                const finalLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));

                // Calculate arrow position relative to popover
                const arrowPos = position.left - finalLeft;

                setClampedPos({
                    left: finalLeft,
                    arrowLeft: `${arrowPos}px`
                });
            }
        };

        calculatePosition();
        window.addEventListener('resize', calculatePosition);
        return () => window.removeEventListener('resize', calculatePosition);
    }, [position.left, toothNum]);

    const handleSave = () => {
        // Save notes
        if (onNotesChange) {
            onNotesChange(toothNum, localNotes);
        }
        // Close the popover - changes to surfaces and status are already saved in real-time
        onClose();
    };

    if (!toothNum) return null;

    const isTop = side === 'top';

    return (
        <div
            ref={popoverRef}
            className="absolute z-[100] bg-white rounded-2xl shadow-2xl border border-gray-200 w-[640px] animate-in fade-in zoom-in duration-200"
            style={{
                top: isTop ? `${position.top - 20}px` : `${position.top + 60}px`,
                left: `${clampedPos.left}px`,
                transform: isTop ? 'translateY(-100%)' : 'translateY(0)'
            }}
        >
            {/* Connector Triangle Pointer */}
            <div
                className={`absolute ${isTop ? '-bottom-2 border-r border-b' : '-top-2 border-l border-t'} w-4 h-4 bg-white border-gray-200 rotate-45 transition-all duration-300`}
                style={{
                    left: clampedPos.arrowLeft,
                    transform: 'translateX(-50%) rotate(45deg)'
                }}
            ></div>

            <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#2a276e] text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md">
                        {toothNum}
                    </div>
                    <div className="flex flex-col text-left">
                        <h3 className="text-[11px] font-bold text-[#2a276e] uppercase tracking-wide">
                            {TOOTH_NAMES[toothNum]}
                        </h3>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-xl transition-colors text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="p-5 flex gap-6">
                {/* Column 1: Surface & Status */}
                <div className="w-40 space-y-4">
                    <div className="space-y-2">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">1. Surfaces</p>
                        <div className="grid grid-cols-2 gap-1.5 bg-gray-50 p-2 rounded-xl">
                            {SURFACES.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedSurface(key)}
                                    className={`h-9 rounded-lg flex flex-col items-center justify-center transition-all border ${selectedSurface === key
                                        ? 'bg-[#2a276e] text-white border-[#2a276e] shadow-sm'
                                        : currentSurfaces[key] && currentSurfaces[key] !== 'none'
                                            ? 'bg-[#9B8CFF]/10 text-[#2a276e] border-[#9B8CFF]'
                                            : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-xs font-bold">{key}</span>
                                    <span className="text-[7px] uppercase tracking-tighter font-bold opacity-60">{label.slice(0, 3)}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">2. Status</p>
                        <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1 custom-scrollbar">
                            {ALL_STATUSES.map(status => (
                                <button
                                    key={status.id}
                                    onClick={() => onToothStatusChange(toothNum, status.id)}
                                    className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-[10px] transition-all border ${currentStatus === status.id
                                        ? 'bg-[#2a276e] border-[#2a276e] text-white font-bold'
                                        : 'bg-white border-gray-100 hover:border-gray-300 text-gray-600'
                                        }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${status.color} ${currentStatus === status.id ? 'bg-white' : ''}`}></span>
                                    <span className="truncate">{status.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Column 2: Surface Condition */}
                <div className="flex-1 space-y-3 border-l border-gray-100 pl-6">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">3. Conditions ({selectedSurface})</p>
                    <div className="grid grid-cols-1 gap-1 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                        {SURFACE_CONDITIONS.map(cond => (
                            <button
                                key={cond.id}
                                onClick={() => onSurfaceConditionChange(toothNum, selectedSurface, cond.id)}
                                className={`flex items-center gap-2.5 p-2 rounded-xl text-[11px] transition-all border ${currentSurfaces[selectedSurface] === cond.id
                                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold shadow-sm'
                                    : 'bg-white border-gray-100 hover:border-gray-300 text-gray-600'
                                    }`}
                            >
                                <span className={`w-3.5 h-3.5 rounded-md ${cond.color} shadow-sm border border-black/5 flex-shrink-0`}></span>
                                <span className="flex-1 font-medium">{cond.label}</span>
                                <span className="text-[10px]">{cond.icon}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Column 3: Clinical Notes */}
                <div className="w-48 space-y-3 border-l border-gray-100 pl-6">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">4. Notes</p>
                    <textarea
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        placeholder="Clinical observations..."
                        className="w-full h-[180px] p-3 text-[11px] bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-[#2a276e] focus:border-[#2a276e] transition-all outline-none resize-none font-medium text-gray-700"
                    />
                </div>
            </div>

            <div className="p-3 bg-gray-50/80 rounded-b-2xl border-t border-gray-100">
                <button
                    onClick={handleSave}
                    className="w-full py-2 bg-[#2a276e] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#1a1548] active:scale-[0.98] transition-all shadow-lg"
                >
                    Update Clinical Record
                </button>
            </div>
        </div>
    );
};

export default ToothEditPopover;
