import React, { useState } from 'react';
import {
    TOOTH_NAMES,
    SURFACE_COLORS,
    CONDITION_LABELS,
    STATUS_COLORS,
    STATUS_LABELS,
    SURFACES
} from './dentalConstants';

/**
 * SurfaceSelectionModal - Modal for editing tooth status and surface conditions
 * @param {boolean} visible - Whether the modal is visible
 * @param {number} toothNum - The tooth number being edited
 * @param {object} currentSurfaces - Current surface conditions
 * @param {string} currentStatus - Current tooth status
 * @param {function} onClose - Callback to close modal
 * @param {function} onSurfaceConditionChange - Callback when surface condition changes
 * @param {function} onToothStatusChange - Callback when tooth status changes
 */
const SurfaceSelectionModal = ({
    visible,
    toothNum,
    currentSurfaces = {},
    currentStatus = 'present',
    onClose,
    onSurfaceConditionChange,
    onToothStatusChange
}) => {
    const [selectedSurface, setSelectedSurface] = useState(null);

    const conditions = Object.entries(SURFACE_COLORS).filter(([key]) => key !== 'none');

    if (!visible) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h3 className="text-xl font-semibold text-gray-900">
                        Tooth #{toothNum} - {TOOTH_NAMES[toothNum]}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {/* Tooth Status */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Tooth Status:</h4>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => onToothStatusChange(toothNum, key)}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${currentStatus === key
                                        ? 'text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    style={currentStatus === key ? { backgroundColor: STATUS_COLORS[key] } : {}}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Surface Selection */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Surface:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {SURFACES.map(({ key, label, desc }) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedSurface(key)}
                                    className={`p-3 rounded-lg border-2 transition-all text-left ${selectedSurface === key
                                        ? 'border-[#2a276e] bg-[#9B8CFF]/10'
                                        : currentSurfaces[key] && currentSurfaces[key] !== 'none'
                                            ? 'border-blue-300 bg-[#9B8CFF]/10'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold text-gray-900">{label} ({key})</div>
                                            <div className="text-xs text-gray-500">{desc}</div>
                                        </div>
                                        {currentSurfaces[key] && currentSurfaces[key] !== 'none' && (
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: SURFACE_COLORS[currentSurfaces[key]] }}
                                            />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Condition Selection */}
                    {selectedSurface && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                Select Condition for {selectedSurface}:
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <button
                                    onClick={() => {
                                        onSurfaceConditionChange(toothNum, selectedSurface, 'none');
                                    }}
                                    className="px-4 py-3 rounded-lg border-2 border-gray-300 bg-white hover:bg-gray-50 font-medium text-sm"
                                >
                                    Clear
                                </button>
                                {conditions.map(([key, color]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            onSurfaceConditionChange(toothNum, selectedSurface, key);
                                        }}
                                        className="px-4 py-3 rounded-lg font-medium text-sm text-white shadow-sm hover:shadow-md transition-all"
                                        style={{ backgroundColor: color }}
                                    >
                                        {CONDITION_LABELS[key]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 bg-[#2a276e] text-white rounded-lg font-semibold hover:bg-[#1a1548] transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SurfaceSelectionModal;
