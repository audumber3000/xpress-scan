import React from 'react';

/**
 * CleanToothSVG - Renders a clean, simple tooth visualization
 * @param {number} toothNum - The tooth number for unique gradient IDs
 * @param {boolean} isUpper - Whether this is an upper tooth (affects orientation)
 */
const CleanToothSVG = ({ toothNum, isUpper }) => {
    // Natural tooth colors from reference
    const crownColor = '#FFFEF0';  // Light cream/ivory
    const rootColor = '#E8DCC0';   // Pale yellow/tan
    const outlineColor = '#D0D0D0'; // Subtle gray

    if (isUpper) {
        // Upper teeth - crown on top, root below
        return (
            <svg viewBox="0 0 40 70" className="w-full h-full">
                <defs>
                    {/* Crown gradient for subtle depth */}
                    <linearGradient id={`crown-grad-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: crownColor, stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#F5F0E8', stopOpacity: 1 }} />
                    </linearGradient>
                    {/* Root gradient */}
                    <linearGradient id={`root-grad-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#F5F0E8', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: rootColor, stopOpacity: 1 }} />
                    </linearGradient>
                </defs>

                {/* Crown - simple rounded rectangle */}
                <path
                    d="M 12 8 L 28 8 L 29 12 L 28 28 L 27 32 L 13 32 L 12 28 L 11 12 Z"
                    fill={`url(#crown-grad-${toothNum})`}
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />

                {/* Root - tapered */}
                <path
                    d="M 13 32 L 27 32 L 25 55 L 22 62 L 18 62 L 15 55 Z"
                    fill={`url(#root-grad-${toothNum})`}
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />

                {/* Occlusal view circle at bottom */}
                <ellipse
                    cx="20"
                    cy="66"
                    rx="8"
                    ry="3"
                    fill="none"
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />
            </svg>
        );
    } else {
        // Lower teeth - root on top, crown below
        return (
            <svg viewBox="0 0 40 70" className="w-full h-full">
                <defs>
                    <linearGradient id={`crown-grad-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#F5F0E8', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: crownColor, stopOpacity: 1 }} />
                    </linearGradient>
                    <linearGradient id={`root-grad-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: rootColor, stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#F5F0E8', stopOpacity: 1 }} />
                    </linearGradient>
                </defs>

                {/* Occlusal view circle at top */}
                <ellipse
                    cx="20"
                    cy="4"
                    rx="8"
                    ry="3"
                    fill="none"
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />

                {/* Root - tapered */}
                <path
                    d="M 15 8 L 18 8 L 22 8 L 25 8 L 27 32 L 13 32 Z"
                    fill={`url(#root-grad-${toothNum})`}
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />

                {/* Crown - simple rounded rectangle */}
                <path
                    d="M 13 32 L 27 32 L 28 36 L 29 52 L 28 56 L 12 56 L 11 52 L 12 36 Z"
                    fill={`url(#crown-grad-${toothNum})`}
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />
            </svg>
        );
    }
};

export default CleanToothSVG;
