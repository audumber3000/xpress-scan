import React, { useState } from 'react';
import teethMapping from '../../assets/teeth_mapping.json';

import { CONDITION_LABELS, STATUS_COLORS } from './dentalConstants';

/**
 * RealisticDentalChart - Uses anatomical SVG data to render a professional chart
 */
const RealisticDentalChart = ({
    teethData = {},
    toothNotes = {},
    selectedTooth,
    onToothSelect,
    onSurfaceConditionChange,
    onToothStatusChange,
    onNotesChange,
    editable = true
}) => {
    const handleToothClick = (toothNum, event) => {
        if (editable) {
            onToothSelect(toothNum);
        }
    };

    // Single source of truth — colours come from STATUS_COLORS in dentalConstants.
    const getToothStatusColor = (toothNum) => {
        const data = teethData[toothNum];
        if (!data || !data.status) return null;
        return STATUS_COLORS[data.status] || null;
    };

    // Helper to calculate center of a tooth for label placement
    const getToothCenter = (paths) => {
        const xs = paths.map(p => p.x);
        const ys = paths.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return {
            x: minX + (maxX - minX) / 2, // No arbitrary offset, use true center
            y: minY + (maxY - minY) / 2
        };
    };

    return (
        <div className="w-full dental-chart-container relative bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            {/* Top Quadrant Labels */}
            <div className="flex justify-between mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                <span>Upper Right (1-8)</span>
                <span>Upper Left (9-16)</span>
            </div>

            <div className="relative group/chart">
                {/* Fixed SVG Root - Using medical standard orientations with high-clearance gap */}
                <svg viewBox="0 -40 1169 500" className="w-full h-auto drop-shadow-sm select-none">
                    <defs>
                        <pattern id="hatchPattern" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="4" stroke="#94a3b8" strokeWidth="1" />
                        </pattern>
                        <filter id="toothGlow" x="-40%" y="-40%" width="180%" height="180%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
                            <feFlood floodColor="#2a276e" floodOpacity="0.65" result="color" />
                            <feComposite in="color" in2="blur" operator="in" result="glow" />
                            <feMerge>
                                <feMergeNode in="glow" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    {Object.entries(teethMapping).map(([toothNum, paths]) => {
                        const toothInt = parseInt(toothNum);
                        const data = teethData[toothInt] || {};
                        const status = data.status || 'present';
                        const surfaces = data.surfaces || {};

                        const statusColor = getToothStatusColor(toothInt);
                        const isSelected = selectedTooth === toothInt;
                        const isUpper = toothInt <= 16;

                        // Substantially increase space between arches
                        const archGap = 40;
                        const yOffset = isUpper ? 0 : archGap;

                        const center = getToothCenter(paths);
                        // Adjust center for interactive components
                        const adjustedCenter = {
                            x: center.x,
                            y: center.y + yOffset
                        };

                        return (
                            <g
                                key={toothNum}
                                onClick={(e) => handleToothClick(toothInt, e)}
                                className="cursor-pointer group/tooth"
                                filter={isSelected ? "url(#toothGlow)" : "none"}
                            >
                                {/* Tooth Anatomy */}
                                <g className="transition-all duration-300">
                                    {paths.map((path, idx) => (
                                        <path
                                            key={idx}
                                            d={path.d}
                                            fill={status === 'crown_gold' ? '#D4AF37' : (status === 'crown_porcelain' ? '#f8fafc' : (statusColor || path.fill))}
                                            transform={`translate(${path.x},${path.y + yOffset})`}
                                            className="transition-all duration-200"
                                            style={{
                                                opacity: status === 'missing' ? 0.15 : 1,
                                                stroke: (status === 'crown_gold' || status === 'crown_porcelain') ? '#000' : 'none',
                                                strokeWidth: (status === 'crown_gold' || status === 'crown_porcelain') ? '0.2' : '0'
                                            }}
                                        />
                                    ))}
                                </g>

                                {/* IMPACTED: Hatching overlay */}
                                {status === 'impacted' && (
                                    <mask id={`mask-${toothNum}`}>
                                        {paths.map((path, i) => (
                                            <path key={i} d={path.d} transform={`translate(${path.x},${path.y + yOffset})`} fill="white" />
                                        ))}
                                    </mask>
                                )}
                                {status === 'impacted' && (
                                    <rect width="1169" height="680" fill="url(#hatchPattern)" mask={`url(#mask-${toothNum})`} pointerEvents="none" />
                                )}

                                {/* IMPLANT: Screw Symbol */}
                                {status === 'implant' && (
                                    <g transform={`translate(${adjustedCenter.x - 5}, ${adjustedCenter.y + (isUpper ? 20 : -20)})`}>
                                        <rect width="10" height="20" rx="2" fill="#64748b" />
                                        <path d="M 0 5 H 10 M 0 10 H 10 M 0 15 H 10" stroke="white" strokeWidth="1" />
                                    </g>
                                )}

                                {/* ROOT CANAL: Canal lines */}
                                {status === 'rootCanal' && (
                                    <g transform={`translate(${adjustedCenter.x}, ${adjustedCenter.y})`}>
                                        <line x1="-2" y1="-10" x2="-2" y2="20" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                                        <line x1="2" y1="-10" x2="2" y2="20" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                                    </g>
                                )}

                                {/* MISSING: Red Cross */}
                                {status === 'missing' && (
                                    <g transform={`translate(${adjustedCenter.x}, ${adjustedCenter.y}) rotate(45)`}>
                                        <line x1="-15" y1="0" x2="15" y2="0" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                                        <line x1="0" y1="-15" x2="0" y2="15" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                                    </g>
                                )}

                                {/* PLANNED: Amber dashed ring (matches the amber fill) */}
                                {status === 'planned' && (
                                    <circle cx={adjustedCenter.x} cy={adjustedCenter.y} r="35" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
                                )}

                                {/* FRACTURE: Zig zag crack */}
                                {status === 'fractured' && (
                                    <path
                                        d="M -5 -10 L 5 -5 L -5 0 L 5 5 L -5 10"
                                        fill="none"
                                        stroke="#ef4444"
                                        strokeWidth="1.5"
                                        transform={`translate(${adjustedCenter.x}, ${adjustedCenter.y - 10})`}
                                    />
                                )}




                                {/* Medical Tooth Number */}
                                {isSelected || statusColor ? (
                                    <circle cx={adjustedCenter.x} cy={isUpper ? -19 : 436} r="10" fill={isSelected ? '#2a276e' : statusColor} />
                                ) : null}
                                <text
                                    x={adjustedCenter.x}
                                    y={isUpper ? -15 : 440}
                                    textAnchor="middle"
                                    className={`text-[13px] font-black tracking-tighter transition-colors duration-300 ${isSelected || statusColor ? 'fill-white' : 'fill-gray-400'
                                        }`}
                                >
                                    {toothNum}
                                </text>
                            </g>
                        );
                    })}

                    {/* Midline Divider - Extended for the new height */}
                    <line x1="584" y1="-20" x2="584" y2="480" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
            </div>

            {/* Bottom Quadrant Labels */}
            <div className="flex justify-between mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                <span>Lower Right (32-25)</span>
                <span>Lower Left (24-17)</span>
            </div>


            {/* Status Legend — matches exactly what the chart can draw */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-gray-50 pt-8">
                <div className="flex items-center gap-2.5 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100/50">
                    <div className="w-4 h-4 rounded-lg bg-white ring-2 ring-[#2a276e] shadow-[0_0_6px_#2a276e] flex-shrink-0"></div>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-none">Selected</span>
                </div>
                <div className="flex items-center gap-2.5 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50">
                    <div className="w-4 h-4 rounded-lg bg-[#f59e0b] shadow-sm flex-shrink-0"></div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-none">Planned</span>
                </div>
                <div className="flex items-center gap-2.5 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50">
                    <div className="w-4 h-4 rounded-lg bg-[#3b82f6] shadow-sm flex-shrink-0"></div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest leading-none">Existing Work</span>
                </div>
                <div className="flex items-center gap-2.5 bg-red-50/50 p-2.5 rounded-xl border border-red-100/50">
                    <div className="w-4 h-4 rounded-lg bg-[#ef4444] shadow-sm flex-shrink-0"></div>
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-widest leading-none">Extracted</span>
                </div>
                <div className="flex items-center gap-2.5 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100/50">
                    <div className="w-4 h-4 rounded-lg shadow-sm flex-shrink-0" style={{ backgroundColor: '#3f2b1d' }}></div>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-none">Caries</span>
                </div>
            </div>
        </div>
    );
};

export default RealisticDentalChart;
