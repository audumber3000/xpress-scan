import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
    TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
    UNIVERSAL_UPPER,
    UNIVERSAL_LOWER,
    TOOTH_NAMES,
} from './dentalConstants';
import { ToothUnit } from './ToothUnit';
import { colors } from '../../../../../shared/constants/colors';
import { X, Search, ChevronDown } from 'lucide-react-native';
import { patientsApiService } from '../../../../../services/api/patients.api';

interface DentalChartProps {
    teethData?: any;
    toothNotes?: any;
    onToothUpdate?: (toothNum: number, data: any) => void;
    onNotesChange?: (toothNum: number, notes: string) => void;
    onAddTreatment?: (item: { tooth: number; diagnosis: string; procedure: string; notes: string; cost: number; status: string }) => void;
    editable?: boolean;
}

// ─── Autocomplete Input (inline chips — no z-index issues) ───────
interface SuggestOption { id: number; name: string; price?: number }

const AutoSuggestInput: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    onSelect?: (s: SuggestOption) => void;
    suggestions: SuggestOption[];
    placeholder?: string;
}> = ({ label, value, onChange, onSelect, suggestions, placeholder }) => {
    // Show filtered matches when typing; show top-5 defaults when empty
    const chips = value.trim().length > 0
        ? suggestions.filter(s => s.name.toLowerCase().includes(value.toLowerCase()) && s.name.toLowerCase() !== value.toLowerCase())
        : suggestions.slice(0, 5);

    return (
        <View style={{ marginBottom: 14 }}>
            <Text style={ss.fieldLabel}>{label}</Text>
            <View style={ss.inputWrap}>
                <Search size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                    style={ss.suggestInput}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder || `Type ${label.toLowerCase()}...`}
                    placeholderTextColor="#9CA3AF"
                />
            </View>
            {/* Inline chips — rendered below, push content down, no clipping */}
            {chips.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 6 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {chips.map(s => (
                        <TouchableOpacity
                            key={s.id}
                            style={ss.chip}
                            onPress={() => { onChange(s.name); onSelect?.(s); }}
                        >
                            <Text style={ss.chipText}>{s.name}</Text>
                            {s.price ? <Text style={ss.chipPrice}> · ₹{s.price.toLocaleString('en-IN')}</Text> : null}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

// ─── Main DentalChart ─────────────────────────────────────────────
export const DentalChart: React.FC<DentalChartProps> = ({
    teethData = {},
    toothNotes = {},
    onToothUpdate,
    onNotesChange,
    onAddTreatment,
    editable = true,
}) => {
    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Drawer form state
    const [examination, setExamination] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [procedure, setProcedure] = useState('');
    const [price, setPrice] = useState('');
    const [clinicalStatus, setClinicalStatus] = useState('present');
    const [statusOpen, setStatusOpen] = useState(false);

    // Suggestions
    const [findingSuggestions, setFindingSuggestions] = useState<SuggestOption[]>([]);
    const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<SuggestOption[]>([]);
    const [procedureSuggestions, setProcedureSuggestions] = useState<SuggestOption[]>([]);
    const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

    const loadSuggestions = async () => {
        if (suggestionsLoaded) return;
        const [f, d, p] = await Promise.all([
            patientsApiService.getClinicalSuggestions('finding'),
            patientsApiService.getClinicalSuggestions('diagnosis'),
            patientsApiService.getClinicalSuggestions('procedure'),
        ]);
        setFindingSuggestions(f);
        setDiagnosisSuggestions(d);
        setProcedureSuggestions(p);
        setSuggestionsLoaded(true);
    };

    const getToothData = (toothNum: number) => teethData[toothNum] || { status: 'present', surfaces: {} };

    const handleToothPress = (toothNum: number) => {
        setSelectedTooth(toothNum);
        if (editable) {
            const td = getToothData(toothNum);
            setExamination(toothNotes[toothNum] || '');
            setDiagnosis('');
            setProcedure('');
            setPrice('');
            setClinicalStatus(td.status || 'present');
            setStatusOpen(false);
            loadSuggestions();
            setIsModalVisible(true);
        }
    };

    const handleAddProcedure = () => {
        if (!procedure.trim() || !selectedTooth) return;
        onAddTreatment?.({
            tooth: selectedTooth,
            diagnosis,
            procedure,
            notes: examination,
            cost: parseFloat(price) || 0,
            status: 'planned',
        });
        // Save notes + status to tooth data
        if (examination) onNotesChange?.(selectedTooth, examination);
        const currentData = getToothData(selectedTooth);
        onToothUpdate?.(selectedTooth, { ...currentData, status: clinicalStatus });
        setIsModalVisible(false);
    };

    const handleStatusSelect = (status: string) => {
        setClinicalStatus(status);
        setStatusOpen(false);
        if (selectedTooth) {
            const currentData = getToothData(selectedTooth);
            onToothUpdate?.(selectedTooth, { ...currentData, status });
        }
    };

    const CLINICAL_STATUS_OPTIONS = [
        { value: 'present',    label: 'Present (Healthy)' },
        { value: 'missing',    label: 'Teeth Removed' },
        { value: 'implant',    label: 'Treatment Taken Before' },
        { value: 'rootCanal',  label: 'Recommended Treatment' },
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
        >
            {/* Chart View */}
            <ScrollView
                horizontal
                directionalLockEnabled={false}
                showsHorizontalScrollIndicator={false}
                style={styles.chartScroll}
            >
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
                    <View style={styles.midlineRow}>
                        <View style={styles.midline} />
                        <Text style={styles.midlineText}>R | L</Text>
                        <View style={styles.midline} />
                    </View>
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

            <Text style={styles.tapHint}>Tap a tooth to add findings, diagnosis, or procedure</Text>

            {/* ─── Tooth Procedure Drawer ─── */}
            {selectedTooth && (
                <Modal
                    visible={isModalVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setIsModalVisible(false)}
                    >
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ width: '100%' }}
                        >
                            <TouchableOpacity activeOpacity={1} style={styles.bottomTray}>
                                <View style={styles.trayHandle} />

                                {/* Header */}
                                <View style={styles.drawerHeader}>
                                    <View>
                                        <Text style={styles.drawerTitle}>Tooth #{selectedTooth}</Text>
                                        <Text style={styles.drawerSub}>{TOOTH_NAMES[selectedTooth] || 'Tooth'}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                                        <X size={20} color={colors.gray500 || '#6B7280'} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView
                                    style={styles.drawerBody}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    <AutoSuggestInput
                                        label="On Examination"
                                        value={examination}
                                        onChange={v => { setExamination(v); onNotesChange?.(selectedTooth!, v); }}
                                        suggestions={findingSuggestions}
                                        placeholder="Type findings or select suggestion..."
                                    />

                                    <AutoSuggestInput
                                        label="Diagnosis"
                                        value={diagnosis}
                                        onChange={setDiagnosis}
                                        suggestions={diagnosisSuggestions}
                                        placeholder="Type diagnosis or select suggestion..."
                                    />

                                    <AutoSuggestInput
                                        label="Procedure"
                                        value={procedure}
                                        onChange={setProcedure}
                                        onSelect={s => { if (s.price) setPrice(String(s.price)); }}
                                        suggestions={procedureSuggestions}
                                        placeholder="Type procedure or select suggestion..."
                                    />

                                    {/* Price */}
                                    <View style={{ marginBottom: 14 }}>
                                        <Text style={ss.fieldLabel}>Procedure Fee (₹)</Text>
                                        <TextInput
                                            style={ss.plainInput}
                                            value={price}
                                            onChangeText={setPrice}
                                            placeholder="0"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="numeric"
                                        />
                                        {parseFloat(price) > 0 && (
                                            <View style={ss.priceHint}>
                                                <Text style={ss.priceHintText}>
                                                    ₹{parseFloat(price).toLocaleString('en-IN')} procedure fee
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Clinical Status */}
                                    <View style={{ marginBottom: 14 }}>
                                        <Text style={ss.fieldLabel}>Clinical Status</Text>
                                        <TouchableOpacity
                                            style={ss.statusPicker}
                                            onPress={() => setStatusOpen(o => !o)}
                                        >
                                            <Text style={ss.statusPickerText}>
                                                {CLINICAL_STATUS_OPTIONS.find(o => o.value === clinicalStatus)?.label || 'Present (Healthy)'}
                                            </Text>
                                            <ChevronDown size={16} color="#6B7280" />
                                        </TouchableOpacity>
                                        {statusOpen && (
                                            <View style={ss.statusDropdown}>
                                                {CLINICAL_STATUS_OPTIONS.map(opt => (
                                                    <TouchableOpacity
                                                        key={opt.value}
                                                        style={[ss.statusOption, clinicalStatus === opt.value && ss.statusOptionActive]}
                                                        onPress={() => handleStatusSelect(opt.value)}
                                                    >
                                                        <Text style={[ss.statusOptionText, clinicalStatus === opt.value && ss.statusOptionTextActive]}>
                                                            {opt.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>

                                {/* CTA */}
                                <TouchableOpacity
                                    style={[styles.doneButton, !procedure.trim() && { opacity: 0.4 }]}
                                    onPress={handleAddProcedure}
                                    disabled={!procedure.trim()}
                                >
                                    <Text style={styles.doneButtonText}>Add to Procedures</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        </KeyboardAvoidingView>
                    </TouchableOpacity>
                </Modal>
            )}
        </ScrollView>
    );
};

// ─── Shared sub-styles ───────────────────────────────────────────
const ss = StyleSheet.create({
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    suggestInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    plainInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 14,
        color: '#111827',
    },
    priceHint: {
        marginTop: 6,
        backgroundColor: '#ECFDF5',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignSelf: 'flex-start',
    },
    priceHintText: { fontSize: 12, color: '#065F46', fontWeight: '700' },
    statusPicker: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    statusPickerText: { fontSize: 14, color: '#111827' },
    statusDropdown: {
        marginTop: 4,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    statusOption: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    statusOptionActive: { backgroundColor: colors.primary + '15' },
    statusOptionText: { fontSize: 14, color: '#374151' },
    statusOptionTextActive: { color: colors.primary, fontWeight: '700' as const },

    // Inline suggestion chips
    chip: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginRight: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipText: { fontSize: 12, color: '#374151', fontWeight: '500' as const },
    chipPrice: { fontSize: 11, color: '#10B981', fontWeight: '700' as const },
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 20,
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
    tapHint: {
        textAlign: 'center',
        fontSize: 11,
        color: '#9CA3AF',
        fontStyle: 'italic',
        marginTop: 10,
        marginBottom: 4,
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
        maxHeight: '88%',
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
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    drawerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    drawerSub: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
    },
    drawerBody: {
        padding: 24,
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
});
