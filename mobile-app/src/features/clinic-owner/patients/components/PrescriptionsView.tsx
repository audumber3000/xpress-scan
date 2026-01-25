import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Pill, FileText } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';

interface PrescriptionItem {
    id: string;
    date: string;
    medicine: string;
    dosage: string;
    duration: string;
    notes?: string;
}

interface PrescriptionsViewProps {
    prescriptions: PrescriptionItem[];
}

export const PrescriptionsView: React.FC<PrescriptionsViewProps> = ({ prescriptions }) => {
    if (prescriptions.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Pill size={48} color={colors.gray300} />
                <Text style={styles.emptyText}>No prescriptions found.</Text>
            </View>
        );
    }

    return (
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
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
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
});
