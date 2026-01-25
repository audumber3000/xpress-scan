import React, { useState } from 'react';
import ToothUnit from './ToothUnit';
import ToothEditPopover from './ToothEditPopover';
import {
    UNIVERSAL_UPPER,
    UNIVERSAL_LOWER,
    SURFACE_COLORS,
    CONDITION_LABELS
} from './dentalConstants';

/**
 * ImprovedDentalChart - Main dental chart component
 * @param {object} teethData - Data for all teeth (status and surfaces)
 * @param {number} selectedTooth - Currently selected tooth number
 * @param {function} onToothSelect - Callback when a tooth is selected
 * @param {function} onSurfaceConditionChange - Callback when surface condition changes
 * @param {function} onToothStatusChange - Callback when tooth status changes
 * @param {boolean} editable - Whether the chart is editable
 */
const ImprovedDentalChart = ({
    teethData = {},
    toothNotes = {},
    selectedTooth,
    onToothSelect,
    onSurfaceConditionChange,
    onToothStatusChange,
    onNotesChange,
    editable = true,
}) => {
    const [popoverState, setPopoverState] = useState({ visible: false, toothNum: null, x: 0, y: 0 });

    const handleToothPress = (toothNum, event) => {
        onToothSelect(toothNum);
        if (editable && event) {
            const rect = event.currentTarget.getBoundingClientRect();
            // Get position relative to the nearest positioned ancestor (the chart container)
            const parentRect = event.currentTarget.closest('.dental-chart-container').getBoundingClientRect();

            setPopoverState({
                visible: true,
                toothNum: toothNum,
                x: rect.left + rect.width / 2 - parentRect.left,
                y: rect.top - parentRect.top
            });
        }
    };

    const getToothData = (toothNum) => {
        return teethData[toothNum] || { status: 'present', surfaces: {} };
    };

    return (
        <div className="w-full dental-chart-container relative">
            {/* Legend */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Conditions:</h4>
                <div className="flex flex-wrap gap-3">
                    {Object.entries(SURFACE_COLORS).filter(([k]) => k !== 'none').map(([key, color]) => (
                        <div key={key} className="flex items-center space-x-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                            <span className="text-sm text-gray-700">{CONDITION_LABELS[key]}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chart Container - Single View */}
            <div className="overflow-x-auto pb-10">
                <div className="inline-block min-w-full">
                    {/* Upper Arch Label */}
                    <div className="flex justify-between mb-2 px-4">
                        <span className="text-sm font-semibold text-gray-600">Upper Right</span>
                        <span className="text-sm font-semibold text-gray-600">Upper Left</span>
                    </div>

                    {/* Upper Teeth Row */}
                    <div className="flex justify-center gap-1 mb-4">
                        {UNIVERSAL_UPPER.map((toothNum) => {
                            const data = getToothData(toothNum);
                            return (
                                <ToothUnit
                                    key={toothNum}
                                    toothNum={toothNum}
                                    isUpper={true}
                                    status={data.status}
                                    surfaces={data.surfaces}
                                    isSelected={selectedTooth === toothNum}
                                    onToothPress={(num, e) => handleToothPress(num, e)}
                                />
                            );
                        })}
                    </div>

                    {/* Midline Divider */}
                    <div className="flex items-center justify-center my-4">
                        <div className="flex-1 border-t-2 border-gray-300" />
                        <span className="px-4 text-sm font-semibold text-gray-600">R | L</span>
                        <div className="flex-1 border-t-2 border-gray-300" />
                    </div>

                    {/* Lower Teeth Row */}
                    <div className="flex justify-center gap-1 mb-2">
                        {UNIVERSAL_LOWER.map((toothNum) => {
                            const data = getToothData(toothNum);
                            return (
                                <ToothUnit
                                    key={toothNum}
                                    toothNum={toothNum}
                                    isUpper={false}
                                    status={data.status}
                                    surfaces={data.surfaces}
                                    isSelected={selectedTooth === toothNum}
                                    onToothPress={(num, e) => handleToothPress(num, e)}
                                />
                            );
                        })}
                    </div>

                    {/* Lower Arch Label */}
                    <div className="flex justify-between mt-2 px-4">
                        <span className="text-sm font-semibold text-gray-600">Lower Right</span>
                        <span className="text-sm font-semibold text-gray-600">Lower Left</span>
                    </div>
                </div>
            </div>

            {/* Tooth Edit Popover */}
            {popoverState.visible && (
                <ToothEditPopover
                    toothNum={popoverState.toothNum}
                    currentSurfaces={popoverState.toothNum ? getToothData(popoverState.toothNum).surfaces : {}}
                    currentStatus={popoverState.toothNum ? getToothData(popoverState.toothNum).status : 'present'}
                    currentNotes={popoverState.toothNum ? (toothNotes[popoverState.toothNum] || '') : ''}
                    position={{ top: popoverState.y, left: popoverState.x }}
                    side={popoverState.toothNum <= 16 ? 'bottom' : 'top'}
                    onClose={() => setPopoverState({ ...popoverState, visible: false })}
                    onSurfaceConditionChange={onSurfaceConditionChange}
                    onToothStatusChange={onToothStatusChange}
                    onNotesChange={onNotesChange}
                />
            )}
        </div>
    );
};

export default ImprovedDentalChart;
