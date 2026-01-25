import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Line, Defs, Pattern } from 'react-native-svg';
import { CleanToothSVG } from './CleanToothSVG';
import { SURFACE_COLORS, STATUS_COLORS } from './dentalConstants';

interface ToothUnitProps {
    toothNum: number;
    isUpper: boolean;
    status: string;
    surfaces: Record<string, string>;
    isSelected: boolean;
    onToothPress: (toothNum: number) => void;
}

export const ToothUnit: React.FC<ToothUnitProps> = ({
    toothNum,
    isUpper,
    status,
    surfaces,
    isSelected,
    onToothPress,
}) => {
    const getSurfaceColor = (surface: string) => {
        return SURFACE_COLORS[surfaces?.[surface]] || SURFACE_COLORS.none;
    };

    const isAffected = status !== 'present' || Object.keys(surfaces || {}).some(s => surfaces[s] !== 'none');

    const hasStripePattern = (condition: string) => {
        return ['cavity', 'fracture', 'abscess', 'class_i', 'class_ii', 'class_iii', 'class_v', 'caries'].includes(condition);
    };

    return (
        <View style={styles.container}>
            {isUpper && <Text style={styles.toothNumTop}>{toothNum}</Text>}
            <TouchableOpacity
                onPress={() => onToothPress(toothNum)}
                activeOpacity={0.7}
                style={[
                    styles.toothButton,
                    isSelected && styles.selectedTooth
                ]}
            >
                <View style={styles.svgContainer}>
                    {status === 'missing' ? (
                        <Svg viewBox="0 0 40 70" width="100%" height="100%">
                            <Line x1="8" y1="10" x2="32" y2="60" stroke="#ef4444" strokeWidth="3" />
                            <Line x1="32" y1="10" x2="8" y2="60" stroke="#ef4444" strokeWidth="3" />
                        </Svg>
                    ) : status === 'implant' ? (
                        <Svg viewBox="0 0 40 70" width="100%" height="100%">
                            <Rect x="16" y={isUpper ? 36 : 8} width="8" height="25" fill="#3b82f6" rx="1" />
                            <Path
                                d={isUpper
                                    ? "M 12 12 L 28 12 L 29 16 L 28 32 L 27 36 L 13 36 L 12 32 L 11 16 Z"
                                    : "M 12 33 L 28 33 L 29 37 L 28 53 L 27 57 L 13 57 L 12 53 L 11 37 Z"
                                }
                                fill="#E8E8E8"
                                stroke="#3b82f6"
                                strokeWidth="1.5"
                            />
                        </Svg>
                    ) : (
                        <View style={styles.relative}>
                            <CleanToothSVG toothNum={toothNum} isUpper={isUpper} />

                            <Svg viewBox="0 0 40 70" style={StyleSheet.absoluteFill}>
                                {Object.entries(surfaces || {}).map(([surface, condition]) => {
                                    if (condition === 'none') return null;

                                    const useStripes = hasStripePattern(condition);
                                    const fillColor = useStripes ? "#DC2626" : getSurfaceColor(surface);

                                    // Corrected Y-coordinates for the new flipped orientation
                                    if (surface === 'O') {
                                        return <Rect key={surface} x="14" y={isUpper ? 34 : 10} width="12" height="6" fill={fillColor} opacity={useStripes ? 0.8 : 0.6} rx={1} />;
                                    } else if (surface === 'M') {
                                        return <Rect key={surface} x="12" y={isUpper ? 38 : 16} width="4" height="12" fill={fillColor} opacity={useStripes ? 0.8 : 0.6} rx={1} />;
                                    } else if (surface === 'D') {
                                        return <Rect key={surface} x="24" y={isUpper ? 38 : 16} width="4" height="12" fill={fillColor} opacity={useStripes ? 0.8 : 0.6} rx={1} />;
                                    } else if (surface === 'B') {
                                        return <Rect key={surface} x="16" y={isUpper ? 40 : 18} width="8" height="10" fill={fillColor} opacity={useStripes ? 0.8 : 0.6} rx={1} />;
                                    } else if (surface === 'L') {
                                        return <Rect key={surface} x="14" y={isUpper ? 46 : 24} width="12" height="6" fill={fillColor} opacity={useStripes ? 0.8 : 0.6} rx={1} />;
                                    }
                                    return null;
                                })}
                            </Svg>

                            {isAffected && status !== 'present' && (
                                <View
                                    style={[
                                        styles.statusRing,
                                        {
                                            borderColor: STATUS_COLORS[status] || '#ef4444',
                                            borderStyle: status === 'rootCanal' ? 'dashed' : 'solid'
                                        }
                                    ]}
                                />
                            )}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
            {!isUpper && <Text style={styles.toothNum}>{toothNum}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginHorizontal: 2,
    },
    toothButton: {
        width: 36,
        height: 54,
        borderRadius: 6,
        overflow: 'hidden',
    },
    selectedTooth: {
        borderWidth: 2,
        borderColor: '#2a276e',
        backgroundColor: 'rgba(42, 39, 110, 0.1)',
    },
    svgContainer: {
        width: '100%',
        height: '100%',
    },
    relative: {
        position: 'relative',
        width: '100%',
        height: '100%',
    },
    statusRing: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 2,
        borderRadius: 6,
    },
    toothNum: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 2,
    },
    toothNumTop: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 2,
    },
});
