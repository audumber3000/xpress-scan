import React from 'react';
import { surfacesFor } from './dentalConstants';

/**
 * The five surfaces of one tooth: four around a centre.
 *
 * There used to be a sixth region — a detached arch above the donut emitting
 * 'F' for facial. Facial and buccal are the same surface, and the constants
 * only ever defined five with no 'F' in them, so anything marked on that arch
 * was written to a key nothing else read and disappeared on the next open. The
 * arch is gone; the donut's four-around-a-centre is the standard chart form and
 * the one the surface letters actually correspond to.
 *
 * The letters come from `surfacesFor(toothNum)`, so an incisor shows I rather
 * than O, and an upper tooth shows P rather than L. The stored key behind each
 * region never changes.
 */
const ToothSurfaceMap = ({
    toothNum,
    surfaces = {},
    onSurfaceSelect,
    readOnly = false,
    transform = "",
    className = ""
}) => {
    const marked = (key) => {
        const cond = surfaces[key];
        return !!cond && cond !== 'none';
    };

    const shortOf = (key) =>
        surfacesFor(toothNum).find((s) => s.key === key)?.short || key;

    // Centre of each region, for its letter.
    const CENTRES = {
        M: [29, 90], B: [71, 90], D: [71, 122], L: [29, 122], O: [50, 106],
    };

    const REGIONS = [
        { key: 'M', d: 'M 50 65 A 40 40 0 0 0 10 105 L 30 105 A 20 20 0 0 1 50 85 Z' },
        { key: 'B', d: 'M 50 65 A 40 40 0 0 1 90 105 L 70 105 A 20 20 0 0 0 50 85 Z' },
        { key: 'D', d: 'M 90 105 A 40 40 0 0 1 50 145 L 50 125 A 20 20 0 0 0 70 105 Z' },
        { key: 'L', d: 'M 10 105 A 40 40 0 0 0 50 145 L 50 125 A 20 20 0 0 1 30 105 Z' },
    ];

    const pick = (e, key) => {
        if (readOnly || !onSurfaceSelect) return;
        e.stopPropagation();
        onSurfaceSelect(key);
    };

    const cursor = readOnly ? '' : 'cursor-pointer';

    return (
        <g transform={transform} className={`select-none ${className}`}>
            <svg viewBox="0 58 100 94" className="w-full h-full overflow-visible">
                {REGIONS.map(({ key, d }) => (
                    <path
                        key={key}
                        d={d}
                        fill={marked(key) ? '#2a276e' : 'white'}
                        stroke="#8a8a8a"
                        strokeWidth="2"
                        onClick={(e) => pick(e, key)}
                        className={`${cursor} transition-[fill] duration-150 ease-out ${readOnly ? '' : 'hover:brightness-95'}`}
                    />
                ))}

                <circle
                    cx="50" cy="105" r="15"
                    fill={marked('O') ? '#2a276e' : 'white'}
                    stroke="#8a8a8a"
                    strokeWidth="2"
                    onClick={(e) => pick(e, 'O')}
                    className={`${cursor} transition-[fill] duration-150 ease-out ${readOnly ? '' : 'hover:brightness-95'}`}
                />

                {/* Letters last so they sit over every fill. Not clickable: the
                    region beneath already is, and a letter that swallowed the
                    click would make the middle of each surface dead. */}
                {Object.entries(CENTRES).map(([key, [x, y]]) => (
                    <text
                        key={`t-${key}`}
                        x={x} y={y}
                        textAnchor="middle" dominantBaseline="middle"
                        pointerEvents="none"
                        className="text-[13px] font-bold"
                        fill={marked(key) ? '#ffffff' : '#94a3b8'}
                    >
                        {shortOf(key)}
                    </text>
                ))}
            </svg>
        </g>
    );
};

export default ToothSurfaceMap;
