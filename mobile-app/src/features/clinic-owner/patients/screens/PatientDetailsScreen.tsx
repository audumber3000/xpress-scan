import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../../shared/constants/colors';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { DentalChart } from '../components/DentalChart';
import { TimelineView } from '../components/TimelineView';
import { BillingView } from '../components/BillingView';
import { PatientInfoView } from '../components/PatientInfoView';
import { PrescriptionsView } from '../components/PrescriptionsView';

import { appointmentsApiService } from '../../../../services/api/appointments.api';
import { transactionsApiService } from '../../../../services/api/transactions.api';

interface PatientDetailsScreenProps {
  navigation: any;
  route: {
    params: {
      patientId: string;
      initialTab?: string;
    };
  };
}

type TabType = 'chart' | 'timeline' | 'billing' | 'profile' | 'prescriptions';

import { Phone, MessageCircle } from 'lucide-react-native';

export const PatientDetailsScreen: React.FC<PatientDetailsScreenProps> = ({ navigation, route }) => {
  const { patientId, initialTab } = route.params;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || 'chart');

  const tabs: { id: TabType; name: string; icon: string }[] = [
    { id: 'chart', name: 'Chart', icon: '🦷' },
    { id: 'timeline', name: 'Timeline', icon: '📅' },
    { id: 'billing', name: 'Billing', icon: '💰' },
    { id: 'profile', name: 'Info', icon: '👤' },
    { id: 'prescriptions', name: 'Scripts', icon: '💊' }
  ];

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  const loadPatientData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [details, apts, trans] = await Promise.all([
        patientsApiService.getPatientDetails(patientId),
        appointmentsApiService.getAppointments(), // Ideally getByPatientId
        transactionsApiService.getPatientTransactions(patientId)
      ]);

      if (!details) {
        setError('Patient not found');
      } else {
        setPatient(details);
        // Filter appointments for this patient
        const patientApts = apts.filter((a: any) => a.patientId === patientId);
        setAppointments(patientApts);
        setPayments(trans);
      }
    } catch (err: any) {
      console.error('❌ [PATIENT_DETAILS] Load error:', err);
      setError('Failed to load patient details');
    } finally {
      setLoading(false);
    }
  };

  const handleToothUpdate = async (toothNum: number, toothData: any) => {
    if (!patient) return;

    // Optimistic update
    const newDentalChart = { ...patient.dentalChart, [toothNum]: toothData };
    setPatient({ ...patient, dentalChart: newDentalChart });

    try {
      await patientsApiService.updatePatient(patientId, { dental_chart: newDentalChart });
    } catch (err) {
      console.error('❌ [PATIENT_DETAILS] Update error:', err);
      Alert.alert('Error', 'Failed to save tooth update');
      // Rollback if needed
      loadPatientData();
    }
  };

  const handleCall = () => {
    if (patient?.phone) {
      // Logic to open dialer
    }
  };

  const handleWhatsApp = () => {
    if (patient?.phone) {
      // Logic for WhatsApp
    }
  };

  const handleAddTimelineStep = async (step: any) => {
    if (!patient) return;

    const newPlan = [...(patient.treatmentPlan || []), { ...step, id: Date.now().toString() }];
    setPatient({ ...patient, treatmentPlan: newPlan });

    try {
      await patientsApiService.updatePatient(patientId, { treatment_plan: newPlan });
    } catch (err) {
      console.error('❌ [PATIENT_DETAILS] Timeline error:', err);
      Alert.alert('Error', 'Failed to save treatment step');
      loadPatientData();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Patient File" onBackPress={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <GearLoader text="Opening patient file..." />
        </View>
      </SafeAreaView>
    );
  }

  if (!patient || error) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Error" onBackPress={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error || 'Patient not found'}</Text>
          <TouchableOpacity onPress={loadPatientData} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={patient.name}
        subtitle={`${patient.age} yrs • ${patient.gender}`}
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleCall} style={styles.headerActionBtn}>
              <Phone size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleWhatsApp} style={styles.headerActionBtn}>
              <MessageCircle size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Tabs - Mobile Optimized Scrollable */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.name}
              </Text>
              {activeTab === tab.id && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {activeTab === 'chart' && (
          <DentalChart
            teethData={patient.dentalChart}
            onToothUpdate={handleToothUpdate}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineView
            history={appointments.filter(a => a.status === 'completed' || a.status === 'Finished').map(a => ({
              id: a.id,
              procedure: a.treatment || 'Treatment',
              date: a.date,
              status: 'completed'
            }))}
            plan={patient.treatmentPlan || []}
            onAddStep={handleAddTimelineStep}
          />
        )}

        {activeTab === 'billing' && (
          <BillingView
            payments={payments.map(p => ({
              id: p.id,
              date: p.date,
              procedure: p.treatment || 'Treatment',
              amount: p.amount,
              status: p.status === 'success' ? 'paid' : 'pending'
            }))}
          />
        )}

        {activeTab === 'profile' && (
          <PatientInfoView patient={patient} />
        )}

        {activeTab === 'prescriptions' && (
          <PrescriptionsView prescriptions={patient.prescriptions || []} />
        )}
      </View>
    </SafeAreaView>
  );
};

const tabIconStyles = {
  chart: { fontSize: 16 },
  timeline: { fontSize: 16 },
  billing: { fontSize: 16 },
  profile: { fontSize: 16 },
  prescriptions: { fontSize: 16 },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(155, 140, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    position: 'relative',
    minWidth: 100,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(155, 140, 255, 0.1)',
    borderColor: 'rgba(155, 140, 255, 0.2)',
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667085',
  },
  tabTextActive: {
    color: colors.primary,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -12,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
