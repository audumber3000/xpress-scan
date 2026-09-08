import React, { useMemo, useRef, useEffect } from 'react';
import teethMapping from '../../assets/teeth_mapping.json';
import { universalToFDI } from '../../utils/toothNumbering';

import { CONDITION_LABELS, STATUS_COLORS, marksOf } from './dentalConstants';

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

/* How each status paints the tooth itself. Anything absent falls through to
   the status colour, then to the tooth's own anatomy. */
const FILLS = {
    crown_gold: 'url(#castHatch)',
    bridge: 'url(#castHatch)',
    crown_porcelain: '#f8fafc',
    crown_ss: '#e2e8f0',
    veneer: '#f8fafc',
};

/* Statuses drawn with the red outline a paper chart uses for a restoration. */
const OUTLINED = new Set(['crown_gold', 'crown_porcelain', 'crown_ss', 'veneer', 'bridge']);

/**
 * A quadrant heading that is also the control for selecting that quadrant.
 * Inert (and styled as plain text) on the read-only chart, so the Overview
 * card does not grow four buttons that do nothing.
 */
const QuadrantLabel = ({ q, text, editable, onSelect }) => {
    const base = 'text-[10px] font-black uppercase tracking-[0.2em]';
    if (!editable || !onSelect) {
        return <span className={`${base} text-gray-300`}>{text}</span>;
    }
    return (
        <button
            type="button"
            onClick={(e) => onSelect(q, e.ctrlKey || e.metaKey || e.shiftKey)}
            title={`Select the whole ${text.split(' (')[0].toLowerCase()} quadrant`}
            className={`${base} text-gray-300 px-1.5 py-1 -mx-1.5 rounded cursor-pointer transition-colors duration-150 ease-out hover:text-[#2a276e] hover:bg-[#2a276e]/5`}
        >
            {text}
        </button>
    );
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
    // `selectedTooth` is the legacy single value and still works on its own —
    // the read-only Overview card passes neither and needs no change. When a
    // group is selected, `selectedTeeth` carries it and `selectedTooth` is the
    // anchor within it.
    selectedTooth,
    selectedTeeth,
    onToothSelect,
    onToothDragEnter,
    onSelectionDragEnd,
    onQuadrantSelect,
    // Sticky additive selection. Every tooth's number badge becomes a checkbox:
    // an empty ring is unpicked, a filled one is picked.
    multiMode = false,
    editable = true,
    dentition = 'adult',
    numberingSystem = 'fdi',
    // Off in the compact Overview card, where the chart is a signal that
    // something is marked rather than something to read a key against.
    showLegend = true
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
    /* One Set for the whole render pass instead of an array scan per tooth. */
    const selectedSet = useMemo(() => {
        const list = Array.isArray(selectedTeeth) && selectedTeeth.length
            ? selectedTeeth
            : (selectedTooth === null || selectedTooth === undefined ? [] : [selectedTooth]);
        return new Set(list.map((t) => String(t)));
    }, [selectedTeeth, selectedTooth]);

    /* Live for the length of one drag. A ref, not state: it changes on every
       pointermove and nothing renders differently because of it. */
    const dragging = useRef(false);

    useEffect(() => {
        if (!editable) return undefined;
        const stop = () => {
            if (!dragging.current) return;
            dragging.current = false;
            onSelectionDragEnd?.();
        };
        // Released anywhere, including outside the chart or outside the window.
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
        return () => {
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
    }, [editable, onSelectionDragEnd]);

    const modifiersOf = (e) => ({ additive: e.ctrlKey || e.metaKey, range: e.shiftKey });

    const handleToothPointerDown = (e, toothNum) => {
        if (!editable) return;
        // Ignore a second finger arriving mid-drag: without this the selection
        // jumps to wherever the new touch landed.
        if (dragging.current) return;
        // Mouse only. On touch, dragging across the chart is how you scroll the
        // page, and stealing that to paint a selection would trap the doctor.
        if (e.pointerType === 'mouse') dragging.current = true;
        onToothSelect(toothNum, modifiersOf(e));
    };

    const handleToothPointerEnter = (toothNum) => {
        if (!editable || !dragging.current) return;
        onToothDragEnter?.(toothNum);
    };

    // Single source of truth — colours come from STATUS_COLORS in dentalConstants.
    const getToothStatusColor = (toothNum) => {
        const data = teethData[toothNum];
        if (!data || !data.status) return null;
        return STATUS_COLORS[data.status] || null;
    };

    /* Upper teeth are drawn with their roots toward the top of the chart and
       their biting surface toward the middle; lower teeth are the mirror. Every
       symbol below is placed off this box rather than off the centre, so an
       abscess sits at the apex and a sealant sits on the occlusal. */
    const getToothBox = (paths, yOffset) => {
        const xs = paths.map((p) => p.x);
        const ys = paths.map((p) => p.y + yOffset);
        return {
            minX: Math.min(...xs), maxX: Math.max(...xs),
            minY: Math.min(...ys), maxY: Math.max(...ys),
        };
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
            {/* Quadrant labels double as quadrant selectors. They already sat
                exactly where a dentist points when they say "upper right", and
                a quadrant scaling or a full-arch case is genuinely quadrant-
                level work rather than eight separate clicks. */}
            <div className="flex justify-between mb-4">
                <QuadrantLabel q="UR" text={`Upper Right (${quadrantRanges[0]})`} editable={editable} onSelect={onQuadrantSelect} />
                <QuadrantLabel q="UL" text={`Upper Left (${quadrantRanges[1]})`} editable={editable} onSelect={onQuadrantSelect} />
            </div>

            <div className="relative group/chart">
                {/* Fixed SVG Root - Using medical standard orientations with high-clearance gap */}
                <svg viewBox="0 -64 1169 546" className="w-full h-auto drop-shadow-sm select-none">
                    <defs>
                        <pattern id="hatchPattern" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="4" stroke="#94a3b8" strokeWidth="1" />
                        </pattern>
                        {/* The diagonal red hatch every paper chart uses for a
                            cast restoration. Gold and bridge share it. */}
                        <pattern id="castHatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                            <rect width="5" height="5" fill="#fff" />
                            <line x1="0" y1="0" x2="0" y2="5" stroke="#b91c1c" strokeWidth="1.4" />
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
                        const isSelected = selectedSet.has(String(storageKey));
                        // The anchor of a multi-selection: the tooth a shift-click
                        // measures its range from, and the one whose surfaces the
                        // drawer is showing. Worth marking apart from the rest.
                        const isAnchor = isSelected && String(selectedTooth) === String(storageKey);

                        // Substantially increase space between arches
                        const archGap = 40;
                        const yOffset = isUpper ? 0 : archGap;

                        const box = getToothBox(paths, yOffset);
                        const marks = marksOf(data);
                        // Root apex vs biting surface, per arch.
                        const apexY = isUpper ? box.minY - 4 : box.maxY + 4;
                        const biteY = isUpper ? box.maxY - 14 : box.minY + 14;
                        const center = getToothCenter(paths);
                        // Adjust center for interactive components
                        const adjustedCenter = {
                            x: center.x,
                            y: center.y + yOffset
                        };

                        return (
                            <g
                                key={storageKey}
                                onPointerDown={(e) => handleToothPointerDown(e, storageKey)}
                                onPointerEnter={() => handleToothPointerEnter(storageKey)}
                                className={editable ? 'cursor-pointer group/tooth' : 'group/tooth'}
                                filter={isAnchor ? "url(#toothGlow)" : "none"}
                            >
                                {/* Tooth Anatomy */}
                                <g className="transition-all duration-300">
                                    {paths.map((path, idx) => (
                                        <path
                                            key={idx}
                                            d={path.d}
                                            fill={FILLS[status] || statusColor || path.fill}
                                            transform={`translate(${path.x},${path.y + yOffset})`}
                                            className="transition-all duration-200"
                                            style={{
                                                opacity: status === 'missing' ? 0.15 : 1,
                                                stroke: OUTLINED.has(status) ? '#b91c1c' : 'none',
                                                strokeWidth: OUTLINED.has(status) ? '0.6' : '0'
                                            }}
                                        />
                                    ))}
                                </g>

                                {/* Selected: a navy outline traced on the tooth's own
                                    shape. Cheap enough to put on all 32 at once, which
                                    the glow filter is not. */}
                                {isSelected && paths.map((path, idx) => (
                                    <path
                                        key={`sel-${idx}`}
                                        d={path.d}
                                        transform={`translate(${path.x},${path.y + yOffset})`}
                                        fill="none"
                                        stroke="#2a276e"
                                        strokeWidth="2.5"
                                        strokeLinejoin="round"
                                        pointerEvents="none"
                                    />
                                ))}

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

                                {/* MISSING: the black X of the standard chart. Black,
                                    not red, so it cannot be confused with the red
                                    diagonal that means "to be extracted" — one has
                                    happened, the other has not. */}
                                {status === 'missing' && (
                                    <g transform={`translate(${adjustedCenter.x}, ${adjustedCenter.y}) rotate(45)`}>
                                        <line x1="-16" y1="0" x2="16" y2="0" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
                                        <line x1="0" y1="-16" x2="0" y2="16" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
                                    </g>
                                )}

                                {/* TO BE EXTRACTED: one red diagonal through the tooth. */}
                                {status === 'to_extract' && (
                                    <line
                                        x1={box.minX - 2} y1={box.maxY + 6}
                                        x2={box.maxX + 14} y2={box.minY - 6}
                                        stroke="#b91c1c" strokeWidth="3.5" strokeLinecap="round"
                                        pointerEvents="none"
                                    />
                                )}

                                {/* STAINLESS STEEL CROWN: lettered, as on paper. */}
                                {status === 'crown_ss' && (
                                    <text x={adjustedCenter.x} y={biteY} textAnchor="middle" dominantBaseline="middle"
                                        className="text-[13px] font-black" fill="#334155" pointerEvents="none">SS</text>
                                )}

                                {/* POST AND CORE: a post down the canal into the crown. */}
                                {status === 'post_core' && (
                                    <g pointerEvents="none">
                                        <line x1={adjustedCenter.x} y1={apexY + (isUpper ? 10 : -10)}
                                            x2={adjustedCenter.x} y2={adjustedCenter.y}
                                            stroke="#b91c1c" strokeWidth="3" strokeLinecap="round" />
                                        <circle cx={adjustedCenter.x} cy={adjustedCenter.y} r="5" fill="#b91c1c" />
                                    </g>
                                )}

                                {/* VENEER: a facing over the front of the crown. */}
                                {status === 'veneer' && (
                                    <line
                                        x1={box.minX + 4} y1={biteY} x2={box.maxX + 8} y2={biteY}
                                        stroke="#b91c1c" strokeWidth="3" strokeLinecap="round" pointerEvents="none"
                                    />
                                )}

                                {/* SEALANT: S on the biting surface. */}
                                {marks.includes('sealant') && (
                                    <text x={adjustedCenter.x} y={biteY} textAnchor="middle" dominantBaseline="middle"
                                        className="text-[13px] font-black" fill="#1f2937" pointerEvents="none">S</text>
                                )}

                                {/* PERIAPICAL ABSCESS: a ring at the root apex. */}
                                {marks.includes('abscess') && (
                                    <circle cx={adjustedCenter.x} cy={apexY} r="6"
                                        fill="none" stroke="#b91c1c" strokeWidth="2.5" pointerEvents="none" />
                                )}

                                {/* DRIFTING: an arrow showing which way it has moved. */}
                                {marks.includes('drifting') && (
                                    <g transform={`translate(${adjustedCenter.x}, ${adjustedCenter.y})`} pointerEvents="none">
                                        <line x1="14" y1="0" x2="-12" y2="0" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" />
                                        <path d="M -12 0 L -6 -4 L -6 4 Z" fill="#b91c1c" />
                                    </g>
                                )}

                                {/* DIASTEMA: two red uprights in the gap. */}
                                {marks.includes('diastema_mesial') && (
                                    <g pointerEvents="none">
                                        <line x1={box.minX - 3} y1={box.minY} x2={box.minX - 3} y2={box.maxY} stroke="#b91c1c" strokeWidth="2" />
                                        <line x1={box.minX - 8} y1={box.minY} x2={box.minX - 8} y2={box.maxY} stroke="#b91c1c" strokeWidth="2" />
                                    </g>
                                )}
                                {marks.includes('diastema_distal') && (
                                    <g pointerEvents="none">
                                        <line x1={box.maxX + 14} y1={box.minY} x2={box.maxX + 14} y2={box.maxY} stroke="#b91c1c" strokeWidth="2" />
                                        <line x1={box.maxX + 19} y1={box.minY} x2={box.maxX + 19} y2={box.maxY} stroke="#b91c1c" strokeWidth="2" />
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




                                {/* A real checkbox per tooth while picking a
                                    group: tick the ones you want, then press
                                    Done. It sits in its own lane beyond the
                                    number badge, so it never covers the tooth. */}
                                {multiMode && editable && (() => {
                                    const boxY = isUpper ? -46 : 460;
                                    const x = adjustedCenter.x - 7;
                                    return (
                                        <g>
                                            <rect
                                                x={x} y={boxY - 7} width="14" height="14" rx="3.5"
                                                fill={isSelected ? '#2a276e' : '#ffffff'}
                                                stroke={isSelected ? '#2a276e' : '#cbd5e1'}
                                                strokeWidth="1.5"
                                            />
                                            {isSelected && (
                                                <path
                                                    d={`M ${adjustedCenter.x - 3.2} ${boxY} L ${adjustedCenter.x - 1} ${boxY + 2.6} L ${adjustedCenter.x + 3.4} ${boxY - 2.8}`}
                                                    fill="none" stroke="#ffffff" strokeWidth="2"
                                                    strokeLinecap="round" strokeLinejoin="round"
                                                />
                                            )}
                                        </g>
                                    );
                                })()}

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

                    {/* FIXED BRIDGE: the bar joining a span.

                        Derived rather than stored. A bridge is not a property of
                        one tooth, and giving the snapshot a separate "spans"
                        structure would mean a second place for the truth to live
                        and drift. Instead: any two ADJACENT teeth both carrying
                        bridge work are joined here. Mark the abutments and the
                        pontic as bridge and the span draws itself. */}
                    {renderList.map(({ storageKey, paths, isUpper }, i) => {
                        const next = renderList[i + 1];
                        if (!next || next.isUpper !== isUpper) return null;
                        const a = teethData[storageKey];
                        const b = teethData[next.storageKey];
                        const isBridge = (d) =>
                            d?.status === 'bridge' || (d?.work === 'existing' && d?.workType === 'bridge');
                        if (!isBridge(a) || !isBridge(b)) return null;

                        const yOff = isUpper ? 0 : 40;
                        const c1 = getToothCenter(paths);
                        const c2 = getToothCenter(next.paths);
                        const box = getToothBox(paths, yOff);
                        const y = isUpper ? box.maxY - 22 : box.minY + 22;
                        return (
                            <line
                                key={`bridge-${storageKey}`}
                                x1={c1.x} y1={y} x2={c2.x} y2={y}
                                stroke="#b91c1c" strokeWidth="3" strokeLinecap="round"
                                pointerEvents="none"
                            />
                        );
                    })}

                    {/* Midline Divider - Extended for the new height */}
                    <line x1="584" y1="-20" x2="584" y2="470" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
            </div>

            <div className="flex justify-between mt-4">
                <QuadrantLabel q="LR" text={`Lower Right (${quadrantRanges[2]})`} editable={editable} onSelect={onQuadrantSelect} />
                <QuadrantLabel q="LL" text={`Lower Left (${quadrantRanges[3]})`} editable={editable} onSelect={onQuadrantSelect} />
            </div>

            {/* Standard note so the numbering is unambiguous to any clinician. */}
            <p className="mt-2 text-center text-[10px] font-medium text-gray-400">
                {isPrimary ? 'Primary teeth' : 'Permanent teeth'} · {isUniversal ? 'Universal Numbering System' : 'FDI World Dental Federation standard'}
            </p>


            {/* Status legend — matches exactly what the chart can draw.
                flex-wrap, not `sm:grid-cols-5`: a grid column count answers the
                viewport, so in any container narrower than about 700px each
                cell got ~70px and every label overran the swatch beside it. The
                labels also lost `tracking-widest`, which was adding a character
                of width per letter to text that had none to give. */}
            {showLegend && (
            <div className="mt-8 flex flex-wrap gap-2 border-t border-gray-50 pt-6">
                <div className="inline-flex items-center gap-2 bg-gray-50/50 px-2.5 py-1.5 rounded-lg border border-gray-100/50">
                    <div className="w-4 h-4 rounded-lg bg-white ring-2 ring-[#2a276e] shadow-[0_0_6px_#2a276e] flex-shrink-0"></div>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide leading-none whitespace-nowrap">Selected</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-amber-50/50 px-2.5 py-1.5 rounded-lg border border-amber-100/50">
                    <div className="w-4 h-4 rounded-lg bg-[#f59e0b] shadow-sm flex-shrink-0"></div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide leading-none whitespace-nowrap">Planned</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-blue-50/50 px-2.5 py-1.5 rounded-lg border border-blue-100/50">
                    <div className="w-4 h-4 rounded-lg bg-[#3b82f6] shadow-sm flex-shrink-0"></div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide leading-none whitespace-nowrap">Existing Work</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-red-50/50 px-2.5 py-1.5 rounded-lg border border-red-100/50">
                    <div className="w-4 h-4 rounded-lg bg-[#ef4444] shadow-sm flex-shrink-0"></div>
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-wide leading-none whitespace-nowrap">Extracted</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-gray-50/50 px-2.5 py-1.5 rounded-lg border border-gray-100/50">
                    <div className="w-4 h-4 rounded-lg shadow-sm flex-shrink-0" style={{ backgroundColor: '#3f2b1d' }}></div>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide leading-none whitespace-nowrap">Caries</span>
                </div>
            </div>
            )}
        </div>
    );
};

export default RealisticDentalChart;
