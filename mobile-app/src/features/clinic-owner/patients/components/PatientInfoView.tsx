import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Phone, Mail, MapPin, User, Info } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { Patient } from '../../../../services/api/patients.api';

interface PatientInfoViewProps {
    patient: Patient;
}

export const PatientInfoView: React.FC<PatientInfoViewProps> = ({ patient }) => {
    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Basic Profile */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <User size={18} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Basic Profile</Text>
                </View>
                <View style={styles.card}>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Full Name</Text>
                        <Text style={styles.value}>{patient.name}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Age</Text>
                        <Text style={styles.value}>{patient.age} years</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Gender</Text>
                        <Text style={styles.value}>{patient.gender}</Text>
                    </View>
                </View>
            </View>

            {/* Contact Details */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Phone size={18} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Contact Details</Text>
                </View>
                <View style={styles.card}>
                    <View style={styles.infoRow}>
                        <View style={styles.iconLabel}>
                            <Phone size={16} color={colors.gray400} />
                            <Text style={styles.label}>Phone Number</Text>
                        </View>
                        <Text style={styles.value}>{patient.phone}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <View style={styles.iconLabel}>
                            <Mail size={16} color={colors.gray400} />
                            <Text style={styles.label}>Email Address</Text>
                        </View>
                        <Text style={styles.value}>{patient.email || 'Not provided'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <View style={styles.iconLabel}>
                            <MapPin size={16} color={colors.gray400} />
                            <Text style={styles.label}>Location / Village</Text>
                        </View>
                        <Text style={styles.value}>{patient.address || 'Not provided'}</Text>
                    </View>
                </View>
            </View>

            {/* Additional Info */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Info size={18} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Clinic Info</Text>
                </View>
                <View style={styles.card}>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Status</Text>
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: patient.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)' }
                        ]}>
                            <Text style={[
                                styles.statusText,
                                { color: patient.status === 'Active' ? colors.success : colors.gray500 }
                            ]}>
                                {patient.status.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Patient Since</Text>
                        <Text style={styles.value}>{patient.lastVisit || 'N/A'}</Text>
                    </View>
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.gray400,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    label: {
        fontSize: 14,
        color: colors.gray500,
    },
    iconLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
});
