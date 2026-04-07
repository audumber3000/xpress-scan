import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    ScrollView, 
    TouchableOpacity, 
    Modal, 
    TextInput,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Pill, FileText, Plus, X } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { format } from 'date-fns';

export interface PrescriptionItem {
    id: string;
    date: string;
    medicine: string;
    dosage: string;
    duration: string;
    notes?: string;
}

interface PrescriptionsViewProps {
    prescriptions: PrescriptionItem[];
    onAddPrescription?: (prescription: PrescriptionItem) => void;
}

export const PrescriptionsView: React.FC<PrescriptionsViewProps> = ({ prescriptions, onAddPrescription }) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMed, setNewMed] = useState('');
    const [newDosage, setNewDosage] = useState('');
    const [newDuration, setNewDuration] = useState('');
    const [newNotes, setNewNotes] = useState('');

    const handleSave = () => {
        if (!newMed || !newDosage) return;
        
        const prescription: PrescriptionItem = {
            id: Date.now().toString(),
            date: format(new Date(), 'MMM d, yyyy'),
            medicine: newMed,
            dosage: newDosage,
            duration: newDuration,
            notes: newNotes,
        };

        onAddPrescription?.(prescription);
        setShowAddModal(false);
        resetForm();
    };

    const resetForm = () => {
        setNewMed('');
        setNewDosage('');
        setNewDuration('');
        setNewNotes('');
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Prescriptions</Text>
                <TouchableOpacity 
                    style={styles.addButton}
                    onPress={() => setShowAddModal(true)}
                >
                    <Plus size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>New</Text>
                </TouchableOpacity>
            </View>

            {prescriptions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Pill size={48} color={colors.gray300} />
                    <Text style={styles.emptyText}>No prescriptions found.</Text>
                </View>
            ) : (
                <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                    {prescriptions.map((item, index) => (
                        <View key={item.id || index} style={styles.card}>
                            <View style={styles.header}>
                                <View style={styles.medicineIcon}>
                                    <Pill size={20} color={colors.primary} />
                                </View>
                                <View style={styles.headerInfo}>
                                    <Text style={styles.medicineName}>{item.medicine}</Text>
                                    <Text style={styles.dateText}>{item.date}</Text>
                                </View>
                            </View>

                            <View style={styles.detailsGrid}>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Dosage</Text>
                                    <Text style={styles.detailValue}>{item.dosage}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Duration</Text>
                                    <Text style={styles.detailValue}>{item.duration}</Text>
                                </View>
                            </View>

                            {item.notes && (
                                <View style={styles.notesContainer}>
                                    <FileText size={14} color={colors.gray400} />
                                    <Text style={styles.notesText}>{item.notes}</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </ScrollView>
            )}

            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Prescription</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <X size={24} color={colors.gray500} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.form}>
                            <Text style={styles.label}>Medicine Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Paracetamol"
                                value={newMed}
                                onChangeText={setNewMed}
                            />

                            <Text style={styles.label}>Dosage</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 1-0-1"
                                value={newDosage}
                                onChangeText={setNewDosage}
                            />

                            <Text style={styles.label}>Duration</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 5 days"
                                value={newDuration}
                                onChangeText={setNewDuration}
                            />

                            <Text style={styles.label}>Notes</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Additional instructions..."
                                value={newNotes}
                                onChangeText={setNewNotes}
                                multiline
                                numberOfLines={3}
                            />

                            <TouchableOpacity 
                                style={[styles.saveButton, !newMed && styles.disabledButton]}
                                onPress={handleSave}
                                disabled={!newMed}
                            >
                                <Text style={styles.saveButtonText}>Add Prescription</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.gray500,
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    medicineIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(155, 140, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
    },
    medicineName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    dateText: {
        fontSize: 12,
        color: colors.gray500,
        marginTop: 2,
    },
    detailsGrid: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    detailItem: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#344054',
    },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    notesText: {
        flex: 1,
        fontSize: 13,
        color: '#667085',
        lineHeight: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    form: {
        padding: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#111827',
        marginBottom: 20,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.5,
    },
});
