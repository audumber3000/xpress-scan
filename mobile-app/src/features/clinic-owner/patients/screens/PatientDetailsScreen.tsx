import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../../shared/constants/colors';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { CasePapersTab } from '../components/CasePapersTab';
import { BillingTab } from '../components/BillingTab';
import { PatientInfoView } from '../components/PatientInfoView';
import { FilesView } from '../components/FilesView';
import { EditPatientModal } from '../components/EditPatientModal';
import { toast } from '../../../../shared/components/toastService';

import { Phone, Pencil, Trash2 } from 'lucide-react-native';
import { WhatsAppIcon } from '../../../../shared/components/icons/WhatsAppIcon';

interface PatientDetailsScreenProps {
  navigation: any;
  route: {
    params: {
      patientId: string;
      initialTab?: string;
    };
  };
}

type TabType = 'case-papers' | 'billing' | 'info' | 'files';

const TABS: { id: TabType; name: string }[] = [
  { id: 'case-papers', name: 'Case Papers' },
  { id: 'billing', name: 'Billing' },
  { id: 'info', name: 'Info' },
  { id: 'files', name: 'Files' },
];

export const PatientDetailsScreen: React.FC<PatientDetailsScreenProps> = ({ navigation, route }) => {
  const { patientId, initialTab } = route.params;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || 'case-papers');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  const loadPatientData = async () => {
    setLoading(true);
    setError(null);
    try {
      const details = await patientsApiService.getPatientDetails(patientId);
      if (!details) {
        setError('Patient not found');
      } else {
        setPatient(details);
      }
    } catch (err: any) {
      console.error('❌ [PATIENT_DETAILS] Load error:', err);
      setError('Failed to load patient details');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (patient?.phone) {
      Linking.openURL(`tel:${patient.phone.replace(/[^0-9+]/g, '')}`);
    }
  };

  const handleWhatsApp = () => {
    if (patient?.phone) {
      const num = patient.phone.replace(/[^0-9]/g, '');
      Linking.openURL(`https://wa.me/${num}`);
    }
  };

  const handleDelete = () => {
    if (!patient) return;
    showAlert(
      'Delete patient?',
      `This permanently removes ${patient.name} and their records. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await patientsApiService.deletePatient(patientId);
              toast.success('Patient deleted');
              navigation.goBack();
            } catch (err: any) {
              setDeleting(false);
              toast.error(err?.message?.includes('body:') ? 'Could not delete this patient.' : (err?.message || 'Delete failed'));
            }
          },
        },
      ],
    );
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
              <Phone size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleWhatsApp} style={styles.headerActionBtn}>
              <WhatsAppIcon size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.headerActionBtn}>
              <Pencil size={17} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={[styles.headerActionBtn, styles.headerDeleteBtn]} disabled={deleting}>
              <Trash2 size={17} color={colors.error} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Tab bar — simple underline style */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === 'case-papers' && (
          <CasePapersTab patient={patient} patientId={patientId} />
        )}

        {activeTab === 'billing' && (
          <BillingTab patientId={patientId} patientPhone={patient.phone} />
        )}

        {activeTab === 'info' && (
          <PatientInfoView patient={patient} />
        )}

        {activeTab === 'files' && (
          <FilesView patientId={patientId} />
        )}
      </View>

      <EditPatientModal
        visible={editing}
        patient={patient}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          // Merge the returned fields, then refresh from the server for the full record.
          setPatient((prev) => (prev ? { ...prev, ...updated } : prev));
          loadPatientData();
        }}
      />
    </SafeAreaView>
  );
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
    gap: 6,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(155, 140, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  // Tab bar — simple underline style matching admin screens
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center' as const,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700' as const,
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
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
