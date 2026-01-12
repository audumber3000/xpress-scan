import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Phone, Mail, MapPin, Calendar } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { GearLoader } from '../../components/GearLoader';
import { apiService, Patient } from '../../services/api/apiService';

interface PatientDetailsScreenProps {
  navigation: any;
  route: {
    params: {
      patientId: string;
    };
  };
}

export const PatientDetailsScreen: React.FC<PatientDetailsScreenProps> = ({ navigation, route }) => {
  const { patientId } = route.params;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'timeline' | 'billing' | 'profile' | 'prescriptions'>('chart');
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);

  const tabs = [
    { id: 'chart', name: 'Dental Chart' },
    { id: 'timeline', name: 'Timeline' },
    { id: 'billing', name: 'Billing' },
    { id: 'profile', name: 'Patient Info' },
    { id: 'prescriptions', name: 'Prescriptions' }
  ];

  useEffect(() => {
    loadPatientDetails();
  }, [patientId]);

  const loadPatientDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 [PATIENT_DETAILS] Loading patient:', patientId);
      const data = await apiService.getPatientDetails(patientId);
      
      if (!data) {
        setError('Patient not found');
      } else {
        setPatient(data);
        console.log('✅ [PATIENT_DETAILS] Patient loaded:', data.name);
      }
      
      // TODO: Load appointments and payments when backend endpoints are ready
      // const [appointmentsData, paymentsData] = await Promise.all([
      //   apiService.getAppointmentsForPatient(patientId),
      //   apiService.getPaymentsForPatient(patientId)
      // ]);
      // setAppointments(appointmentsData);
      // setPayments(paymentsData);
      
    } catch (err: any) {
      console.error('❌ [PATIENT_DETAILS] Load error:', err);
      setError('Failed to load patient details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Patient Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <GearLoader text="Loading patient data..." />
        </View>
      </SafeAreaView>
    );
  }

  if (!patient || error) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Patient Details</Text>
          <View style={styles.backButton} />
        </View>
        
        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadPatientDetails} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{error || 'Patient not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Patient Info Card */}
        <View style={styles.patientCard}>
          <View style={styles.patientAvatar}>
            <Text style={styles.patientInitials}>
              {patient.name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <Text style={styles.patientName}>{patient.name}</Text>
          <Text style={styles.patientMeta}>{patient.age} yrs • {patient.gender}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: patient.status === 'Active' ? colors.successLight : colors.gray200 }
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: patient.status === 'Active' ? colors.success : colors.gray400 }
            ]} />
            <Text style={[
              styles.statusText,
              { color: patient.status === 'Active' ? colors.success : colors.gray400 }
            ]}>
              {patient.status}
            </Text>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Phone size={20} color={colors.primary} />
              <Text style={styles.infoText}>{patient.phone}</Text>
            </View>
            {patient.email && (
              <View style={styles.infoRow}>
                <Mail size={20} color={colors.primary} />
                <Text style={styles.infoText}>{patient.email}</Text>
              </View>
            )}
            {patient.address && (
              <View style={styles.infoRow}>
                <MapPin size={20} color={colors.primary} />
                <Text style={styles.infoText}>{patient.address}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Visit Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.visitRow}>
              <Text style={styles.visitLabel}>Last Visit</Text>
              <Text style={styles.visitValue}>{patient.lastVisit}</Text>
            </View>
            {patient.nextAppointment && (
              <View style={styles.visitRow}>
                <Text style={styles.visitLabel}>Next Appointment</Text>
                <Text style={styles.visitValue}>{patient.nextAppointment}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tabs - Same as Web Platform */}
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id as any)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content - Web Platform Layout */}
        {activeTab === 'chart' && (
          <View style={styles.tabContent}>
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Dental Chart</Text>
              <Text style={styles.chartSubtitle}>Interactive dental chart coming soon...</Text>
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>🦷 Dental Chart View</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'timeline' && (
          <View style={styles.tabContent}>
            <View style={styles.timelineContainer}>
              <Text style={styles.sectionTitle}>Appointment Timeline</Text>
              {appointments.length > 0 ? (
                appointments.map((apt, index) => (
                  <View key={index} style={styles.timelineItem}>
                    <Text style={styles.timelineDate}>{apt.date}</Text>
                    <Text style={styles.timelineProcedure}>{apt.procedure}</Text>
                    <Text style={styles.timelineStatus}>{apt.status}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyTabText}>No appointments found</Text>
              )}
            </View>
          </View>
        )}

        {activeTab === 'billing' && (
          <View style={styles.tabContent}>
            <View style={styles.billingContainer}>
              <Text style={styles.sectionTitle}>Billing History</Text>
              {payments.length > 0 ? (
                payments.map((payment, index) => (
                  <View key={index} style={styles.billingCard}>
                    <View style={styles.billingHeader}>
                      <Text style={styles.billingDate}>{payment.date}</Text>
                      <Text style={[
                        styles.billingStatus,
                        { color: payment.status === 'paid' ? colors.success : payment.status === 'pending' ? colors.warning : colors.error }
                      ]}>
                        {payment.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.billingService}>{payment.procedure}</Text>
                    <Text style={styles.billingAmount}>${payment.amount}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyTabText}>No billing history available</Text>
              )}
            </View>
          </View>
        )}

        {activeTab === 'profile' && (
          <View style={styles.tabContent}>
            <View style={styles.profileContainer}>
              <Text style={styles.sectionTitle}>Patient Information</Text>
              
              {/* Contact Info */}
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Contact Information</Text>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Phone size={20} color={colors.primary} />
                    <Text style={styles.infoText}>{patient.phone}</Text>
                  </View>
                  {patient.email && (
                    <View style={styles.infoRow}>
                      <Mail size={20} color={colors.primary} />
                      <Text style={styles.infoText}>{patient.email}</Text>
                    </View>
                  )}
                  {patient.address && (
                    <View style={styles.infoRow}>
                      <MapPin size={20} color={colors.primary} />
                      <Text style={styles.infoText}>{patient.address}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Visit Info */}
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Visit Information</Text>
                <View style={styles.infoCard}>
                  <View style={styles.visitRow}>
                    <Text style={styles.visitLabel}>Last Visit</Text>
                    <Text style={styles.visitValue}>{patient.lastVisit}</Text>
                  </View>
                  {patient.nextAppointment && (
                    <View style={styles.visitRow}>
                      <Text style={styles.visitLabel}>Next Appointment</Text>
                      <Text style={styles.visitValue}>{patient.nextAppointment}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'prescriptions' && (
          <View style={styles.tabContent}>
            <View style={styles.prescriptionsContainer}>
              <Text style={styles.sectionTitle}>Prescriptions</Text>
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>💊 Prescriptions coming soon...</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray600,
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
    marginRight: 12,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray500,
  },
  content: {
    flex: 1,
  },
  patientCard: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  patientAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryBgLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  patientInitials: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  patientName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 4,
  },
  patientMeta: {
    fontSize: 14,
    color: colors.gray500,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: colors.gray700,
    marginLeft: 12,
  },
  visitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  visitLabel: {
    fontSize: 14,
    color: colors.gray500,
  },
  visitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray700,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabContent: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  overviewText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  recordCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recordDate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
  },
  recordDoctor: {
    fontSize: 13,
    color: colors.gray500,
  },
  recordDiagnosis: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  recordTreatment: {
    fontSize: 14,
    color: colors.gray700,
    marginBottom: 4,
  },
  recordNotes: {
    fontSize: 13,
    color: colors.gray500,
    fontStyle: 'italic',
  },
  billingCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  billingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billingDate: {
    fontSize: 13,
    color: colors.gray500,
  },
  billingStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  billingService: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  billingAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  emptyTabText: {
    fontSize: 15,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: 40,
  },
  // Web Platform Layout Styles
  chartContainer: {
    padding: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 8,
  },
  chartSubtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginBottom: 20,
  },
  placeholderBox: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: colors.gray500,
  },
  timelineContainer: {
    padding: 20,
  },
  timelineItem: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  timelineDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  timelineProcedure: {
    fontSize: 15,
    color: colors.gray700,
    marginBottom: 4,
  },
  timelineStatus: {
    fontSize: 13,
    color: colors.gray500,
  },
  billingContainer: {
    padding: 20,
  },
  profileContainer: {
    padding: 20,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  prescriptionsContainer: {
    padding: 20,
  },
});
