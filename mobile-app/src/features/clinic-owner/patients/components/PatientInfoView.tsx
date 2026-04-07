import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Phone, Mail, MapPin, User, Info, Clock, Calendar } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { Patient, patientsApiService } from '../../../../services/api/patients.api';

interface PatientInfoViewProps {
    patient: Patient;
}

const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
};

export const PatientInfoView: React.FC<PatientInfoViewProps> = ({ patient }) => {
    const [visits, setVisits] = useState<any[]>([]);
    const [loadingVisits, setLoadingVisits] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const data = await patientsApiService.getCasePapers(patient.id);
                setVisits(Array.isArray(data) ? data : []);
            } catch { setVisits([]); }
            finally { setLoadingVisits(false); }
        })();
    }, [patient.id]);

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Avatar Header */}
            <View style={styles.avatarSection}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(patient.name)}</Text>
                </View>
                <Text style={styles.avatarName}>{patient.name}</Text>
                <Text style={styles.avatarSub}>{patient.gender}, {patient.age} years</Text>
                <View style={[
                    styles.statusBadge,
                    { backgroundColor: patient.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)', marginTop: 8 }
                ]}>
                    <Text style={[styles.statusText, { color: patient.status === 'Active' ? colors.success : colors.gray500 }]}>
                        {patient.status?.toUpperCase() || 'ACTIVE'}
                    </Text>
                </View>
            </View>

            {/* Basic Profile */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <User size={18} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Personal Information</Text>
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

            {/* Clinic Info */}
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
                                {patient.status?.toUpperCase() || 'ACTIVE'}
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

            {/* Visit History */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Calendar size={18} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Visit History</Text>
                </View>
                {loadingVisits ? (
                    <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
                ) : visits.length === 0 ? (
                    <View style={styles.card}>
                        <Text style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 }}>
                            No visit history found.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.card}>
                        {visits.map((visit: any, i: number) => (
                            <React.Fragment key={visit.id || i}>
                                {i > 0 && <View style={styles.divider} />}
                                <View style={styles.visitRow}>
                                    <View style={styles.visitDot} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.visitComplaint} numberOfLines={1}>
                                            {Array.isArray(visit.chief_complaint) ? visit.chief_complaint.join(', ') : visit.chief_complaint || 'General Checkup'}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <Clock size={10} color="#9CA3AF" />
                                            <Text style={styles.visitDate}>{fmtDate(visit.date)}</Text>
                                        </View>
                                    </View>
                                    <View style={[
                                        styles.visitStatusBadge,
                                        { backgroundColor: visit.status === 'Completed' ? '#F0FDF4' : '#FFFBEB' }
                                    ]}>
                                        <Text style={[
                                            styles.visitStatusText,
                                            { color: visit.status === 'Completed' ? '#15803D' : '#B45309' }
                                        ]}>
                                            {visit.status || 'In Progress'}
                                        </Text>
                                    </View>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                )}
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
    // Avatar header
    avatarSection: {
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 8,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    avatarName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    avatarSub: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    // Visit history
    visitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
    },
    visitDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    visitComplaint: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    visitDate: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    visitStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    visitStatusText: {
        fontSize: 10,
        fontWeight: '700',
    },
});
