import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import {
    UNIVERSAL_UPPER,
    UNIVERSAL_LOWER,
    SURFACE_COLORS,
    CONDITION_LABELS,
    SURFACES,
    STATUS_LABELS,
    STATUS_COLORS,
    TOOTH_NAMES
} from './dentalConstants';
import { ToothUnit } from './ToothUnit';
import { colors } from '../../../../../shared/constants/colors';
import { Check, X } from 'lucide-react-native';

interface DentalChartProps {
    teethData?: any;
    toothNotes?: any;
    onToothUpdate?: (toothNum: number, data: any) => void;
    editable?: boolean;
}

export const DentalChart: React.FC<DentalChartProps> = ({
    teethData = {},
    toothNotes = {},
    onToothUpdate,
    editable = true,
}) => {
    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const getToothData = (toothNum: number) => {
        return teethData[toothNum] || { status: 'present', surfaces: {} };
    };

    const handleToothPress = (toothNum: number) => {
        setSelectedTooth(toothNum);
        if (editable) {
            setIsModalVisible(true);
        }
    };

    const updateSurface = (toothNum: number, surface: string, condition: string) => {
        const currentData = getToothData(toothNum);
        const newSurfaces = { ...currentData.surfaces };

        if (newSurfaces[surface] === condition) {
            delete newSurfaces[surface];
        } else {
            newSurfaces[surface] = condition;
        }

        onToothUpdate?.(toothNum, { ...currentData, surfaces: newSurfaces });
    };

    const updateStatus = (toothNum: number, status: string) => {
        const currentData = getToothData(toothNum);
        onToothUpdate?.(toothNum, { ...currentData, status });
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Legend */}
            <View style={styles.legendContainer}>
                <Text style={styles.legendTitle}>Conditions:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
                    {Object.entries(SURFACE_COLORS).filter(([k]) => k !== 'none').map(([key, color]) => (
                        <View key={key} style={styles.legendItem}>
                            <View style={[styles.legendColor, { backgroundColor: color }]} />
                            <Text style={styles.legendText}>{CONDITION_LABELS[key]}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>

            {/* Chart View */}
            <ScrollView horizontal directionalLockEnabled={false} showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                <View style={styles.chartContainer}>
                    {/* Upper Arch */}
                    <View style={styles.archLabelRow}>
                        <Text style={styles.archLabel}>Upper Right</Text>
                        <Text style={styles.archLabel}>Upper Left</Text>
                    </View>

                    <View style={styles.teethRow}>
                        {UNIVERSAL_UPPER.map(num => (
                            <ToothUnit
                                key={num}
                                toothNum={num}
                                isUpper={true}
                                status={getToothData(num).status}
                                surfaces={getToothData(num).surfaces}
                                isSelected={selectedTooth === num}
                                onToothPress={handleToothPress}
                            />
                        ))}
                    </View>

                    {/* Divider */}
                    <View style={styles.midlineRow}>
                        <View style={styles.midline} />
                        <Text style={styles.midlineText}>R | L</Text>
                        <View style={styles.midline} />
                    </View>

                    {/* Lower Arch */}
                    <View style={styles.teethRow}>
                        {UNIVERSAL_LOWER.map(num => (
                            <ToothUnit
                                key={num}
                                toothNum={num}
                                isUpper={false}
                                status={getToothData(num).status}
                                surfaces={getToothData(num).surfaces}
                                isSelected={selectedTooth === num}
                                onToothPress={handleToothPress}
                            />
                        ))}
                    </View>

                    <View style={styles.archLabelRow}>
                        <Text style={styles.archLabel}>Lower Right</Text>
                        <Text style={styles.archLabel}>Lower Left</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Active Conditions Table - Web Layout ported to Mobile */}
            <View style={styles.conditionsTable}>
                <View style={styles.tableHeaderSection}>
                    <View style={styles.tableDecoration} />
                    <Text style={styles.tableTitle}>Active Conditions</Text>
                </View>

                <View style={styles.tableHeader}>
                    <Text style={[styles.columnHeader, { flex: 0.15 }]}>#</Text>
                    <Text style={[styles.columnHeader, { flex: 0.45 }]}>NAME</Text>
                    <Text style={[styles.columnHeader, { flex: 0.4 }]}>STATUS/SURFACES</Text>
                </View>

                {Object.entries(teethData)
                    .filter(([_, data]: [string, any]) =>
                        data && (data.status !== 'present' || Object.keys(data.surfaces || {}).length > 0)
                    )
                    .map(([tooth, data]: [string, any]) => (
                        <TouchableOpacity
                            key={tooth}
                            style={[
                                styles.tableRow,
                                selectedTooth === parseInt(tooth) && styles.selectedRow
                            ]}
                            onPress={() => handleToothPress(parseInt(tooth))}
                        >
                            <View style={[styles.cell, { flex: 0.15 }]}>
                                <View style={[
                                    styles.toothBadge,
                                    selectedTooth === parseInt(tooth) && styles.toothBadgeActive
                                ]}>
                                    <Text style={selectedTooth === parseInt(tooth) ? styles.toothBadgeTextActive : styles.toothBadgeText}>
                                        {tooth}
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.cell, { flex: 0.45 }]}>
                                <Text style={styles.toothNameText} numberOfLines={1}>{TOOTH_NAMES[parseInt(tooth)]}</Text>
                            </View>
                            <View style={[styles.cell, { flex: 0.4 }]}>
                                <View style={styles.statusDisplay}>
                                    {data.status !== 'present' && (
                                        <View style={styles.statusChip}>
                                            <Text style={styles.statusChipText}>{data.status?.toUpperCase()}</Text>
                                        </View>
                                    )}
                                    {Object.entries(data.surfaces || {}).map(([surface, cond]) => (
                                        <View key={surface} style={styles.surfaceChip}>
                                            <Text style={styles.surfaceChipText}>{surface}: {CONDITION_LABELS[cond as string]}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}

                {Object.entries(teethData).filter(([_, data]: [string, any]) => data && (data.status !== 'present' || Object.keys(data.surfaces || {}).length > 0)).length === 0 && (
                    <View style={styles.emptyTable}>
                        <Text style={styles.emptyTableText}>Healthy Smile - No active conditions recorded.</Text>
                    </View>
                )}
            </View>

            {/* Tooth Edit Bottom Tray */}
            {selectedTooth && (
                <Modal
                    visible={isModalVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setIsModalVisible(false)}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={styles.bottomTray}
                        >
                            <View style={styles.trayHandle} />

                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Tooth #{selectedTooth}</Text>
                                    <Text style={styles.modalSubtitle}>{TOOTH_NAMES[selectedTooth]}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setIsModalVisible(false)}
                                    style={styles.closeBtn}
                                >
                                    <X size={20} color={colors.gray500} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.modalContent}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 40 }}
                            >
                                {/* Status Selection */}
                                <Text style={styles.sectionHeader}>Condition Overview</Text>
                                <View style={styles.optionGrid}>
                                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                        <TouchableOpacity
                                            key={key}
                                            style={[
                                                styles.optionButton,
                                                getToothData(selectedTooth).status === key && styles.optionButtonActive
                                            ]}
                                            onPress={() => updateStatus(selectedTooth, key)}
                                        >
                                            <Text style={[
                                                styles.optionText,
                                                getToothData(selectedTooth).status === key && styles.optionTextActive
                                            ]}>
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Surface Selection */}
                                <Text style={styles.sectionHeader}>Surface Details</Text>
                                {SURFACES.map(surface => (
                                    <View key={surface.key} style={styles.surfaceRow}>
                                        <View style={styles.surfaceInfo}>
                                            <Text style={styles.surfaceLabel}>{surface.label} ({surface.key})</Text>
                                        </View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.conditionScroll}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.conditionButton,
                                                    !getToothData(selectedTooth).surfaces[surface.key] && styles.conditionButtonActive
                                                ]}
                                                onPress={() => updateSurface(selectedTooth, surface.key, 'none')}
                                            >
                                                <Text style={styles.conditionText}>Healthy</Text>
                                            </TouchableOpacity>
                                            {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                                                <TouchableOpacity
                                                    key={key}
                                                    style={[
                                                        styles.conditionButton,
                                                        getToothData(selectedTooth).surfaces[surface.key] === key && styles.conditionButtonActive,
                                                        { borderColor: SURFACE_COLORS[key] }
                                                    ]}
                                                    onPress={() => updateSurface(selectedTooth, surface.key, key)}
                                                >
                                                    <View style={[styles.colorDot, { backgroundColor: SURFACE_COLORS[key] }]} />
                                                    <Text style={styles.conditionText}>{label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                ))}

                                {/* Clinical Notes Section */}
                                <Text style={styles.sectionHeader}>Clinical Notes</Text>
                                <View style={styles.notesBox}>
                                    <Text style={styles.notesTextPlaceholder}>
                                        {toothNotes[selectedTooth] || "No clinical notes recorded for this tooth yet. Add details in the web platform to see them here."}
                                    </Text>
                                </View>
                            </ScrollView>

                            <TouchableOpacity
                                style={styles.doneButton}
                                onPress={() => setIsModalVisible(false)}
                            >
                                <Text style={styles.doneButtonText}>Save Details</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    legendContainer: {
        marginBottom: 20,
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
    },
    legendTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    legendScroll: {
        flexDirection: 'row',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    legendColor: {
        width: 10,
        height: 10,
        borderRadius: 2,
        marginRight: 6,
    },
    legendText: {
        fontSize: 11,
        color: '#4B5563',
        fontWeight: '500',
    },
    chartScroll: {
        marginHorizontal: -16,
    },
    chartContainer: {
        paddingHorizontal: 24,
        minWidth: 600,
    },
    archLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        marginVertical: 4,
    },
    archLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#D1D5DB',
        textTransform: 'uppercase',
    },
    teethRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 12,
    },
    midlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    midline: {
        flex: 1,
        height: 2,
        backgroundColor: '#F3F4F6',
        borderRadius: 1,
    },
    midlineText: {
        paddingHorizontal: 12,
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9CA3AF',
        letterSpacing: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    bottomTray: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '85%',
        paddingTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
    },
    trayHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
    },
    modalContent: {
        padding: 24,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 8,
        marginBottom: 16,
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 24,
    },
    optionButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        backgroundColor: '#F9FAFB',
    },
    optionButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
    },
    optionTextActive: {
        color: '#FFFFFF',
    },
    surfaceRow: {
        marginBottom: 24,
    },
    surfaceInfo: {
        marginBottom: 10,
    },
    surfaceLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    conditionScroll: {
        flexDirection: 'row',
        marginHorizontal: -24,
        paddingHorizontal: 24,
    },
    conditionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    conditionButtonActive: {
        backgroundColor: '#F9FAFB',
        borderColor: '#9CA3AF',
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    conditionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#344054',
    },
    doneButton: {
        marginHorizontal: 24,
        marginBottom: 32,
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    doneButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    // Active Conditions Table Styles
    conditionsTable: {
        marginTop: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    tableHeaderSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    tableDecoration: {
        width: 4,
        height: 18,
        backgroundColor: colors.primary,
        borderRadius: 2,
    },
    tableTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111827',
        letterSpacing: 0.5,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        marginBottom: 8,
    },
    columnHeader: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9CA3AF',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    selectedRow: {
        backgroundColor: 'rgba(155, 140, 255, 0.05)',
    },
    cell: {
        justifyContent: 'center',
    },
    toothBadge: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    toothBadgeActive: {
        backgroundColor: colors.primary,
    },
    toothBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: colors.primary,
    },
    toothBadgeTextActive: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    toothNameText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#344054',
    },
    statusDisplay: {
        flexDirection: 'column',
        gap: 4,
    },
    statusChip: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusChipText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#EF4444',
    },
    surfaceChip: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(155, 140, 255, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    surfaceChipText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: colors.primary,
    },
    emptyTable: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    emptyTableText: {
        fontSize: 13,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    notesBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginTop: 4,
    },
    notesTextPlaceholder: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        fontStyle: 'italic',
    },
});
