import React from 'react';

const ToothSurfaceMap = ({
    toothNum,
    surfaces = {},
    onSurfaceSelect,
    transform = "",
    className = ""
}) => {
    // Determine the color of each surface based on selection/condition.
    // The user requested dark purple for selected state.
    const getFill = (surface) => {
        const cond = surfaces[surface];
        if (cond && cond !== 'none') {
            return '#2a276e'; // App's dark purple
        }
        return 'white';
    };

    const getStroke = (surface) => {
        return '#8a8a8a'; // Neutral gray outline from the screenshot
    };

    return (
        <g transform={transform} className={`select-none ${className}`}>
            <svg viewBox="0 0 100 160" className="w-full h-full overflow-visible">
                {/* 
                    The new UI layout requires:
                    - 1 detached arch on top
                    - 1 donut divided into 4 quadrants
                */}

                {/* Detached Arch (F - Facial/Labial) */}
                <path
                    d="M 15 45 A 35 35 0 0 1 85 45 L 65 45 A 15 15 0 0 0 35 45 Z"
                    fill={getFill('F')}
                    stroke={getStroke('F')}
                    strokeWidth="2"
                    className="cursor-pointer hover:brightness-95 transition-all"
                    onClick={(e) => { e.stopPropagation(); onSurfaceSelect('F'); }}
                />

                {/* Donut - Top Left (M) */}
                <path
                    d="M 50 65 A 40 40 0 0 0 10 105 L 30 105 A 20 20 0 0 1 50 85 Z"
                    fill={getFill('M')}
                    stroke={getStroke('M')}
                    strokeWidth="2"
                    className="cursor-pointer hover:brightness-95 transition-all"
                    onClick={(e) => { e.stopPropagation(); onSurfaceSelect('M'); }}
                />

                {/* Donut - Top Right (B) */}
                <path
                    d="M 50 65 A 40 40 0 0 1 90 105 L 70 105 A 20 20 0 0 0 50 85 Z"
                    fill={getFill('B')}
                    stroke={getStroke('B')}
                    strokeWidth="2"
                    className="cursor-pointer hover:brightness-95 transition-all"
                    onClick={(e) => { e.stopPropagation(); onSurfaceSelect('B'); }}
                />

                {/* Donut - Bottom Right (D) */}
                <path
                    d="M 90 105 A 40 40 0 0 1 50 145 L 50 125 A 20 20 0 0 0 70 105 Z"
                    fill={getFill('D')}
                    stroke={getStroke('D')}
                    strokeWidth="2"
                    className="cursor-pointer hover:brightness-95 transition-all"
                    onClick={(e) => { e.stopPropagation(); onSurfaceSelect('D'); }}
                />

                {/* Donut - Bottom Left (L) */}
                <path
                    d="M 10 105 A 40 40 0 0 0 50 145 L 50 125 A 20 20 0 0 1 30 105 Z"
                    fill={getFill('L')}
                    stroke={getStroke('L')}
                    strokeWidth="2"
                    className="cursor-pointer hover:brightness-95 transition-all"
                    onClick={(e) => { e.stopPropagation(); onSurfaceSelect('L'); }}
                />

                {/* Center Circle (O - Occlusal) */}
                <circle
                    cx="50"
                    cy="105"
                    r="15"
                    fill={getFill('O')}
                    stroke={getStroke('O')}
                    strokeWidth="2"
                    className="cursor-pointer hover:brightness-95 transition-all"
                    onClick={(e) => { e.stopPropagation(); onSurfaceSelect('O'); }}
                />
            </svg>
        </g>
    );
};

export default ToothSurfaceMap;
