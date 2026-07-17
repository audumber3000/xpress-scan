import React from 'react';
import teethMapping from '../../assets/teeth_mapping.json';
import { universalToFDI } from '../../utils/toothNumbering';

import { CONDITION_LABELS, STATUS_COLORS } from './dentalConstants';

// Primary (deciduous) teeth reuse the anatomical shape + arch position of a
// suitable permanent tooth — the app has no separate primary-tooth artwork.
// Map: primary FDI number -> permanent Universal tooth whose shape to borrow.
const PRIMARY_SOURCE = {
    55: 4, 54: 5, 53: 6, 52: 7, 51: 8,        // upper right (51–55)
    61: 9, 62: 10, 63: 11, 64: 12, 65: 13,    // upper left  (61–65)
    75: 20, 74: 21, 73: 22, 72: 23, 71: 24,   // lower left  (71–75)
    81: 25, 82: 26, 83: 27, 84: 28, 85: 29,   // lower right (81–85)
};
const PRIMARY_UPPER = new Set([51, 52, 53, 54, 55, 61, 62, 63, 64, 65]);

// Primary teeth in the Universal system are letters A–T. Keyed by primary FDI.
const PRIMARY_UNIVERSAL = {
    55: 'A', 54: 'B', 53: 'C', 52: 'D', 51: 'E',
    61: 'F', 62: 'G', 63: 'H', 64: 'I', 65: 'J',
    75: 'K', 74: 'L', 73: 'M', 72: 'N', 71: 'O',
    81: 'P', 82: 'Q', 83: 'R', 84: 'S', 85: 'T',
};

// Quadrant range labels shown above/below the arches, per dentition + system.
// Order: [upper-right, upper-left, lower-right, lower-left].
const QUADRANT_RANGES = {
    adult: {
        fdi: ['11-18', '21-28', '41-48', '31-38'],
        universal: ['1-8', '9-16', '32-25', '24-17'],
    },
    primary: {
        fdi: ['51-55', '61-65', '81-85', '71-75'],
        universal: ['A-E', 'F-J', 'P-T', 'K-O'],
    },
};

/**
 * RealisticDentalChart - anatomical SVG chart.
 * `dentition` = 'adult' (32 permanent) or 'primary' (20 baby teeth).
 * `numberingSystem` = 'fdi' (default) or 'universal'.
 * Storage never changes — adult teeth store Universal (1–32), primary store FDI
 * (51–85); the label is just formatted to the chosen system for display.
 */
const RealisticDentalChart = ({
    teethData = {},
    selectedTooth,
    onToothSelect,
    editable = true,
    dentition = 'adult',
    numberingSystem = 'fdi'
}) => {
    const isPrimary = dentition === 'primary';
    const isUniversal = numberingSystem === 'universal';
    const quadrantRanges = QUADRANT_RANGES[isPrimary ? 'primary' : 'adult'][isUniversal ? 'universal' : 'fdi'];

    // One flat list the SVG maps over, so the render body doesn't branch per mode.
    const renderList = isPrimary
        ? Object.entries(PRIMARY_SOURCE)
            .map(([fdi, src]) => ({
                storageKey: Number(fdi),
                label: isUniversal ? PRIMARY_UNIVERSAL[fdi] : fdi,
                paths: teethMapping[src],
                isUpper: PRIMARY_UPPER.has(Number(fdi)),
            }))
            .filter((t) => t.paths)
        : Object.entries(teethMapping).map(([toothNum, paths]) => {
            const universal = parseInt(toothNum);
            return {
                storageKey: universal,
                label: String(isUniversal ? universal : universalToFDI(universal)),
                paths,
                isUpper: universal <= 16,
            };
        });
    const handleToothClick = (toothNum) => {
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
        <div className="w-full dental-chart-container relative bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            {/* Top Quadrant Labels */}
            <div className="flex justify-between mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                <span>Upper Right ({quadrantRanges[0]})</span>
                <span>Upper Left ({quadrantRanges[1]})</span>
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
                    {renderList.map(({ storageKey, label, paths, isUpper }) => {
                        const data = teethData[storageKey] || {};
                        const status = data.status || 'present';

                        const statusColor = getToothStatusColor(storageKey);
                        const isSelected = selectedTooth === storageKey;

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
                                key={storageKey}
                                onClick={() => handleToothClick(storageKey)}
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
                                    <mask id={`mask-${storageKey}`}>
                                        {paths.map((path, i) => (
                                            <path key={i} d={path.d} transform={`translate(${path.x},${path.y + yOffset})`} fill="white" />
                                        ))}
                                    </mask>
                                )}
                                {status === 'impacted' && (
                                    <rect width="1169" height="680" fill="url(#hatchPattern)" mask={`url(#mask-${storageKey})`} pointerEvents="none" />
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
                                    {label}
                                </text>
                            </g>
                        );
                    })}

                    {/* Midline Divider - Extended for the new height */}
                    <line x1="584" y1="-20" x2="584" y2="480" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
            </div>

            {/* Bottom Quadrant Labels — FDI quadrant ranges */}
            <div className="flex justify-between mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                <span>Lower Right ({quadrantRanges[2]})</span>
                <span>Lower Left ({quadrantRanges[3]})</span>
            </div>

            {/* Standard note so the numbering is unambiguous to any clinician. */}
            <p className="mt-2 text-center text-[10px] font-medium text-gray-400">
                {isPrimary ? 'Primary teeth' : 'Permanent teeth'} · {isUniversal ? 'Universal Numbering System' : 'FDI World Dental Federation standard'}
            </p>


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
