import React from 'react';
import CleanToothSVG from './CleanToothSVG';
import { SURFACE_COLORS, STATUS_COLORS } from './dentalConstants';

/**
 * ToothUnit - Renders a single tooth with its status and surface conditions
 * @param {number} toothNum - The tooth number
 * @param {boolean} isUpper - Whether this is an upper tooth
 * @param {string} status - Tooth status (present, missing, implant, rootCanal)
 * @param {object} surfaces - Surface conditions (M, O, D, B, L)
 * @param {boolean} isSelected - Whether this tooth is currently selected
 * @param {function} onToothPress - Callback when tooth is clicked
 */
const ToothUnit = ({ toothNum, isUpper, status, surfaces, isSelected, onToothPress }) => {
    const getSurfaceColor = (surface) => {
        return SURFACE_COLORS[surfaces?.[surface]] || SURFACE_COLORS.none;
    };

    const isAffected = status !== 'present' || Object.keys(surfaces || {}).some(s => surfaces[s] !== 'none');

    // Check if condition should have stripe pattern
    const hasStripePattern = (condition) => {
        return ['cavity', 'fracture', 'abscess', 'class_i', 'class_ii', 'class_iii', 'class_v'].includes(condition);
    };

    return (
        <div className="flex flex-col items-center">
            <button
                onClick={(e) => onToothPress(toothNum, e)}
                className={`relative transition-all hover:scale-105 ${isSelected ? 'ring-2 ring-[#2a276e] ring-offset-2 rounded-lg' : ''}`}
            >
                <div className="w-14 h-20 relative">
                    {status === 'missing' ? (
                        <svg viewBox="0 0 40 70" className="w-full h-full">
                            <line x1="8" y1="10" x2="32" y2="60" stroke="#ef4444" strokeWidth="3" />
                            <line x1="32" y1="10" x2="8" y2="60" stroke="#ef4444" strokeWidth="3" />
                        </svg>
                    ) : status === 'implant' ? (
                        <svg viewBox="0 0 40 70" className="w-full h-full">
                            {/* Implant screw */}
                            <rect x="16" y="8" width="8" height="25" fill="#3b82f6" rx="1" />
                            {/* Crown */}
                            <path
                                d="M 12 33 L 28 33 L 29 37 L 28 53 L 27 57 L 13 57 L 12 53 L 11 37 Z"
                                fill="#E8E8E8"
                                stroke="#3b82f6"
                                strokeWidth="1.5"
                            />
                        </svg>
                    ) : (
                        <div className="relative">
                            <CleanToothSVG toothNum={toothNum} isUpper={isUpper} />

                            {/* Surface condition overlays with patterns */}
                            <svg viewBox="0 0 40 70" className="absolute inset-0 w-full h-full pointer-events-none">
                                <defs>
                                    {/* Diagonal stripe pattern for cavities/issues */}
                                    <pattern id={`stripes-${toothNum}`} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                                        <rect width="2" height="4" fill="#DC2626" />
                                    </pattern>
                                </defs>

                                {Object.entries(surfaces || {}).map(([surface, condition]) => {
                                    if (condition === 'none') return null;

                                    const useStripes = hasStripePattern(condition);
                                    const fillColor = useStripes ? `url(#stripes-${toothNum})` : getSurfaceColor(surface);

                                    // Position overlays based on surface
                                    if (surface === 'O') {
                                        // Occlusal - top of crown
                                        return (
                                            <rect
                                                key={surface}
                                                x="14"
                                                y={isUpper ? "10" : "34"}
                                                width="12"
                                                height="6"
                                                fill={fillColor}
                                                opacity={useStripes ? "0.8" : "0.6"}
                                                rx="1"
                                            />
                                        );
                                    } else if (surface === 'M') {
                                        // Mesial - left side
                                        return (
                                            <rect
                                                key={surface}
                                                x="12"
                                                y={isUpper ? "16" : "38"}
                                                width="4"
                                                height="12"
                                                fill={fillColor}
                                                opacity={useStripes ? "0.8" : "0.6"}
                                                rx="1"
                                            />
                                        );
                                    } else if (surface === 'D') {
                                        // Distal - right side
                                        return (
                                            <rect
                                                key={surface}
                                                x="24"
                                                y={isUpper ? "16" : "38"}
                                                width="4"
                                                height="12"
                                                fill={fillColor}
                                                opacity={useStripes ? "0.8" : "0.6"}
                                                rx="1"
                                            />
                                        );
                                    } else if (surface === 'B') {
                                        // Buccal - front
                                        return (
                                            <rect
                                                key={surface}
                                                x="16"
                                                y={isUpper ? "18" : "40"}
                                                width="8"
                                                height="10"
                                                fill={fillColor}
                                                opacity={useStripes ? "0.8" : "0.6"}
                                                rx="1"
                                            />
                                        );
                                    } else if (surface === 'L') {
                                        // Lingual - back (shown as bottom overlay)
                                        return (
                                            <rect
                                                key={surface}
                                                x="14"
                                                y={isUpper ? "24" : "46"}
                                                width="12"
                                                height="6"
                                                fill={fillColor}
                                                opacity={useStripes ? "0.8" : "0.6"}
                                                rx="1"
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </svg>

                            {/* Status indicator ring */}
                            {isAffected && status !== 'present' && (
                                <div
                                    className="absolute inset-0 border-2 rounded-lg pointer-events-none"
                                    style={{
                                        borderColor: STATUS_COLORS[status],
                                        borderStyle: status === 'rootCanal' ? 'dashed' : 'solid'
                                    }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </button>
            <span className="text-xs font-medium text-gray-700 mt-1">{toothNum}</span>
        </div>
    );
};

export default ToothUnit;
