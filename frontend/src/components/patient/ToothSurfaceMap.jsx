import React from 'react';
import { SURFACE_COLORS } from './dentalConstants';

/**
 * ToothSurfaceMap - Returns a group of SVG paths for the 5-surface diagram.
 * Renders at a crisp vector level directly in the main SVG.
 */
const ToothSurfaceMap = ({
    toothNum,
    surfaces = {},
    onSurfaceSelect,
    transform = "",
    className = ""
}) => {

    const getFill = (surface) => {
        const condition = surfaces[surface];
        return condition && condition !== 'none' ? SURFACE_COLORS[condition] : 'rgba(255,255,255,0.9)';
    };

    const getStroke = (surface) => {
        const condition = surfaces[surface];
        return condition && condition !== 'none' ? 'rgba(0,0,0,0.4)' : '#cbd5e1';
    };

    return (
        <g transform={transform} className={`select-none ${className}`}>
            {/* High-contrast background disc */}
            <ellipse cx="30" cy="20" rx="32" ry="22" fill="white" fillOpacity="0.8" stroke="#e2e8f0" strokeWidth="0.5" />

            {/* Buccal (Top) */}
            <path
                d="M 10 7 L 50 7 L 42 17 L 18 17 Z"
                fill={getFill('B')}
                stroke={getStroke('B')}
                strokeWidth="1.5"
                className="cursor-pointer hover:fill-blue-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); onSurfaceSelect('B'); }}
            />
            {/* Lingual (Bottom) */}
            <path
                d="M 18 23 L 42 23 L 50 33 L 10 33 Z"
                fill={getFill('L')}
                stroke={getStroke('L')}
                strokeWidth="1.5"
                className="cursor-pointer hover:fill-blue-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); onSurfaceSelect('L'); }}
            />
            {/* Mesial (Left/Front) */}
            <path
                d="M 7 10 L 15 17 L 15 23 L 7 30 Z"
                fill={getFill('M')}
                stroke={getStroke('M')}
                strokeWidth="1.5"
                className="cursor-pointer hover:fill-blue-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); onSurfaceSelect('M'); }}
            />
            {/* Distal (Right/Back) */}
            <path
                d="M 53 10 L 45 17 L 45 23 L 53 30 Z"
                fill={getFill('D')}
                stroke={getStroke('D')}
                strokeWidth="1.5"
                className="cursor-pointer hover:fill-blue-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); onSurfaceSelect('D'); }}
            />
            {/* Occlusal (Center) - Larger and clearer */}
            <path
                d="M 18 17 L 42 17 L 42 23 L 18 23 Z"
                fill={getFill('O')}
                stroke={getStroke('O')}
                strokeWidth="1.5"
                className="cursor-pointer hover:fill-blue-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); onSurfaceSelect('O'); }}
            />

            {/* High-visibility Labels */}
            <g className="pointer-events-none fill-gray-600 font-black" style={{ fontSize: '6px', fontFamily: 'Inter, system-ui' }}>
                <text x="30" y="5.5" textAnchor="middle">B</text>
                <text x="30" y="38" textAnchor="middle">L</text>
                <text x="4" y="21.5" textAnchor="middle">M</text>
                <text x="56" y="21.5" textAnchor="middle">D</text>
            </g>
        </g>
    );
};

export default ToothSurfaceMap;
