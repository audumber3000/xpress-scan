import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Ellipse } from 'react-native-svg';

interface CleanToothSVGProps {
    toothNum: number;
    isUpper: boolean;
}

export const CleanToothSVG: React.FC<CleanToothSVGProps> = ({ toothNum, isUpper }) => {
    const crownColor = '#FFFEF0';
    const rootColor = '#E8DCC0';
    const outlineColor = '#D0D0D0';

    if (isUpper) {
        // Upper teeth - Root on top, Crown below (facing mid-line)
        return (
            <Svg viewBox="0 0 40 70" width="100%" height="100%">
                <Defs>
                    <LinearGradient id={`crown-grad-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#F5F0E8" stopOpacity={1} />
                        <Stop offset="100%" stopColor={crownColor} stopOpacity={1} />
                    </LinearGradient>
                    <LinearGradient id={`root-grad-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={rootColor} stopOpacity={1} />
                        <Stop offset="100%" stopColor="#F5F0E8" stopOpacity={1} />
                    </LinearGradient>
                </Defs>

                {/* Occlusal view circle at top */}
                <Ellipse
                    cx="20"
                    cy="4"
                    rx="8"
                    ry="3"
                    fill="none"
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />

                {/* Root - tapered */}
                <Path
                    d="M 15 8 L 18 8 L 22 8 L 25 8 L 27 32 L 13 32 Z"
                    fill={`url(#root-grad-${toothNum})`}
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />

                {/* Crown - simple rounded rectangle */}
                <Path
                    d="M 13 32 L 27 32 L 28 36 L 29 52 L 28 56 L 12 56 L 11 52 L 12 36 Z"
                    fill={`url(#crown-grad-${toothNum})`}
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />
            </Svg>
        );
    } else {
        // Lower teeth - Root on bottom, Crown on top (facing mid-line)
        return (
            <Svg viewBox="0 0 40 70" width="100%" height="100%">
                <Defs>
                    <LinearGradient id={`crown-grad-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={crownColor} stopOpacity={1} />
                        <Stop offset="100%" stopColor="#F5F0E8" stopOpacity={1} />
                    </LinearGradient>
                    <LinearGradient id={`root-grad-${toothNum}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#F5F0E8" stopOpacity={1} />
                        <Stop offset="100%" stopColor={rootColor} stopOpacity={1} />
                    </LinearGradient>
                </Defs>

                {/* Crown - simple rounded rectangle */}
                <Path
                    d="M 12 8 L 28 8 L 29 12 L 28 28 L 27 32 L 13 32 L 12 28 L 11 12 Z"
                    fill={`url(#crown-grad-${toothNum})`}
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />

                {/* Root - tapered */}
                <Path
                    d="M 13 32 L 27 32 L 25 55 L 22 62 L 18 62 L 15 55 Z"
                    fill={`url(#root-grad-${toothNum})`}
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />

                {/* Occlusal view circle at bottom */}
                <Ellipse
                    cx="20"
                    cy="66"
                    rx="8"
                    ry="3"
                    fill="none"
                    stroke={outlineColor}
                    strokeWidth="0.8"
                />
            </Svg>
        );
    }
};
