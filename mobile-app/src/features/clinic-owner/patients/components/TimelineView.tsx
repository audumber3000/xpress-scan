import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { Calendar, CheckCircle2, Clock, Plus, X, ListTodo, IndianRupee, PencilLine } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';

interface TimelineItem {
    id: string;
    procedure: string;
    date: string;
    status: 'completed' | 'planned' | 'scheduled';
    cost?: number;
    notes?: string;
    visit_number?: number;
}

interface TimelineViewProps {
    history: TimelineItem[];
    plan: TimelineItem[];
    onAddStep?: (item: Omit<TimelineItem, 'id'>) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ history, plan, onAddStep }) => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [formData, setFormData] = useState({
        procedure: '',
        cost: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
    });

    const allItems = [
        ...plan.map(item => ({ ...item, isPlan: true })),
        ...history.map(item => ({ ...item, isPlan: false }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleSave = () => {
        if (!formData.procedure) {
            Alert.alert('Error', 'Please enter a procedure name');
            return;
        }

        onAddStep?.({
            procedure: formData.procedure,
            cost: formData.cost ? parseInt(formData.cost) : 0,
            notes: formData.notes,
            date: formData.date,
            status: 'planned',
            visit_number: plan.length + 1
        });

        setIsModalVisible(false);
        setFormData({
            procedure: '',
            cost: '',
            notes: '',
            date: new Date().toISOString().split('T')[0],
        });
    };

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.roadmapTitle}>Clinical Roadmap</Text>
                        <Text style={styles.roadmapSubtitle}>Journey Architect</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => setIsModalVisible(true)}
                    >
                        <Plus size={18} color="#FFFFFF" strokeWidth={3} />
                        <Text style={styles.addBtnText}>Add Step</Text>
                    </TouchableOpacity>
                </View>

                {allItems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Calendar size={48} color={colors.gray300} />
                        <Text style={styles.emptyText}>No clinical roadmap available yet.</Text>
                    </View>
                ) : (
                    <View style={styles.timeline}>
                        <View style={styles.line} />
                        {allItems.map((item, index) => (
                            <View key={item.id || index} style={styles.itemContainer}>
                                <View style={[styles.dot, item.isPlan ? styles.planDot : styles.historyDot]}>
                                    {item.isPlan ? <Clock size={12} color={colors.primary} /> : <CheckCircle2 size={12} color={colors.success} />}
                                </View>
                                <View style={[styles.card, item.isPlan ? styles.planCard : styles.historyCard]}>
                                    <View style={styles.cardHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.procedureText}>{item.procedure}</Text>
                                            <Text style={styles.dateText}>
                                                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </Text>
                                        </View>
                                        {item.cost && <Text style={styles.costText}>₹{item.cost.toLocaleString('en-IN')}</Text>}
                                    </View>
                                    {item.notes && <Text style={styles.notesText}>"{item.notes}"</Text>}
                                    <View style={styles.badgeContainer}>
                                        <View style={[styles.badge, { backgroundColor: item.isPlan ? 'rgba(155, 140, 255, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                                            <Text style={[styles.badgeText, { color: item.isPlan ? colors.primary : colors.success }]}>
                                                {item.isPlan ? 'PLANNED' : 'COMPLETED'}
                                            </Text>
                                        </View>
                                        {item.visit_number && (
                                            <View style={styles.visitBadge}>
                                                <Text style={styles.visitBadgeText}>Visit #{item.visit_number}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Add Step Bottom Tray */}
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
                    <TouchableOpacity activeOpacity={1} style={styles.bottomTray}>
                        <View style={styles.trayHandle} />
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>New Treatment Step</Text>
                                <Text style={styles.modalSubtitle}>Add manual step to journey</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                                <X size={20} color={colors.gray500} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <ListTodo size={14} color={colors.gray400} />
                                    <Text style={styles.inputLabel}>PROCEDURE NAME</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Tooth Extraction"
                                    value={formData.procedure}
                                    onChangeText={(val) => setFormData({ ...formData, procedure: val })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <IndianRupee size={14} color={colors.gray400} />
                                    <Text style={styles.inputLabel}>ESTIMATED COST (₹)</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0.00"
                                    keyboardType="numeric"
                                    value={formData.cost}
                                    onChangeText={(val) => setFormData({ ...formData, cost: val })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Calendar size={14} color={colors.gray400} />
                                    <Text style={styles.inputLabel}>PLANNED DATE</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="YYYY-MM-DD"
                                    value={formData.date}
                                    onChangeText={(val) => setFormData({ ...formData, date: val })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <PencilLine size={14} color={colors.gray400} />
                                    <Text style={styles.inputLabel}>CLINICAL NOTES</Text>
                                </View>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Add any specific clinical instructions..."
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                    value={formData.notes}
                                    onChangeText={(val) => setFormData({ ...formData, notes: val })}
                                />
                            </View>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>Add to Roadmap</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        marginBottom: 8,
    },
    headerInfo: {
        flex: 1,
    },
    roadmapTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    roadmapSubtitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 2,
    },
    addBtn: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 6,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    addBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    emptyContainer: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 15,
        color: colors.gray500,
        textAlign: 'center',
        fontWeight: '500',
    },
    timeline: {
        padding: 20,
        paddingTop: 10,
        position: 'relative',
    },
    line: {
        position: 'absolute',
        left: 29,
        top: 30,
        bottom: 0,
        width: 2,
        backgroundColor: '#E5E7EB',
    },
    itemContainer: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    dot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        marginTop: 12,
    },
    planDot: { borderColor: colors.primary },
    historyDot: { borderColor: colors.success },
    card: {
        flex: 1,
        marginLeft: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    planCard: { borderLeftWidth: 4, borderLeftColor: colors.primary },
    historyCard: { borderLeftWidth: 4, borderLeftColor: colors.success },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    procedureText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111827',
    },
    dateText: {
        fontSize: 12,
        color: colors.gray500,
        marginTop: 2,
    },
    costText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#344054',
    },
    notesText: {
        fontSize: 14,
        color: '#667085',
        fontStyle: 'italic',
        marginBottom: 12,
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: { fontSize: 9, fontWeight: 'bold' },
    visitBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
    },
    visitBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#6B7280' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    bottomTray: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '90%',
        paddingTop: 8,
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
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    modalSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    closeBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
    modalContent: { padding: 24 },
    inputGroup: { marginBottom: 20 },
    labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 0.5 },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: '#111827',
    },
    textArea: { height: 100 },
    saveBtn: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 32,
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
