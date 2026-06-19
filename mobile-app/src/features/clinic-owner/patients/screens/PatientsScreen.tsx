import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, StatusBar } from 'react-native';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Users, UploadCloud, Gift } from 'lucide-react-native';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { useAuth } from '../../../../app/AuthContext';
import { SearchBar } from '../components/SearchBar';
import { FilterTabs } from '../components/FilterTabs';
import { PatientsList } from '../components/PatientsList';
import { AddPatientScreen } from './AddPatientScreen';
import { ImportPatientsModal } from '../components/ImportPatientsModal';
import { BirthdaysView } from '../components/BirthdaysView';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { AppSkeleton } from '../../../../shared/components/Skeleton';
import { ContactActionSheet } from '../../../../shared/components/ContactActionSheet';

interface PatientsScreenProps {
  navigation: any;
  route?: any;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({ navigation, route }) => {
  const [searchQuery, setSearchQuery] = useState(route?.params?.initialSearchQuery || '');
  const [selectedTab, setSelectedTab] = useState('all');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [contactPatient, setContactPatient] = useState<Patient | null>(null);

  const { backendUser } = useAuth();

  useEffect(() => {
    loadPatients();
  }, [backendUser?.clinic?.id]);

  // If initialSearchQuery changes (e.g. navigating again with different query), update state
  useEffect(() => {
    if (route?.params?.initialSearchQuery) {
      setSearchQuery(route.params.initialSearchQuery);
    }
  }, [route?.params?.initialSearchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPatients();
    setRefreshing(false);
  };

  const loadPatients = async () => {
    setLoading(true);
    try {
      const data = await patientsApiService.getPatients();
      setPatients(data);
    } catch (err: any) {
      console.error('Error loading patients:', err);
      showAlert('Error', `Failed to load patients: ${err.message}`);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    let filtered = patients;

    if (selectedTab === 'active') {
      filtered = filtered.filter(p => p.status === 'Active');
    } else if (selectedTab === 'inactive') {
      filtered = filtered.filter(p => p.status === 'Inactive');
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.phone && p.phone.includes(query)) ||
        (p.id && p.id.toString().includes(query))
      );
    }

    return filtered;
  };

  const handlePatientPress = (patient: Patient) => {
    navigation.navigate('PatientDetails', { patientId: patient.id });
  };

  const handleContactPatient = (patient: Patient) => {
    if (!patient.phone) {
      showAlert('Error', 'Patient has no phone number');
      return;
    }
    setContactPatient(patient);
  };

  const handleCall = () => {
    if (contactPatient?.phone) {
      Linking.openURL(`tel:${contactPatient.phone.replace(/[^0-9+]/g, '')}`);
    }
  };

  const handleWhatsApp = () => {
    if (contactPatient?.phone) {
      const num = contactPatient.phone.replace(/[^0-9]/g, '');
      Linking.openURL(`https://wa.me/${num}`);
    }
  };

  const handleDeletePatient = (patient: Patient) => {
    showAlert('Delete Patient', `Are you sure you want to delete ${patient.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {} } // Delete logic not implemented yet
    ]);
  };

  // Prepare tabs with counts
  const tabs = [
    { key: 'all', label: 'All Patients', value: 'all', count: patients.length },
    {
      key: 'birthdays',
      label: 'Birthdays',
      value: 'birthdays',
      icon: <Gift size={15} color={selectedTab === 'birthdays' ? colors.primary : '#6B7280'} />,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        title="Patients"
        titleIcon={<Users size={22} />}
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        rightComponent={
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowImport(true)} style={styles.headerAddBtn}>
              <UploadCloud color={colors.white} size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddPatient(true)} style={styles.headerAddBtn}>
              <Plus color={colors.white} size={22} />
            </TouchableOpacity>
          </View>
        }
      />

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by name, ID or phone"
        autoFocus={route?.params?.fromHomeSearch || !!route?.params?.initialSearchQuery}
      />

      <FilterTabs
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
      />

      {selectedTab === 'birthdays' ? (
        <BirthdaysView onPatientPress={(id) => navigation.navigate('PatientDetails', { patientId: String(id) })} />
      ) : loading && !refreshing ? (
        <View style={{ padding: 20 }}>
          <AppSkeleton show={true} width="100%" height={80} radius={12} />
          <View style={{ height: 12 }} />
          <AppSkeleton show={true} width="100%" height={80} radius={12} />
          <View style={{ height: 12 }} />
          <AppSkeleton show={true} width="100%" height={80} radius={12} />
        </View>
      ) : (
        <PatientsList
          patients={filterPatients()}
          onPatientPress={handlePatientPress}
          onPhonePress={handleContactPatient}
          onDelete={handleDeletePatient}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      <ImportPatientsModal
        visible={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          setShowImport(false);
          loadPatients();
        }}
      />

      <AddPatientScreen
        visible={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        onPatientAdded={() => {
          setShowAddPatient(false);
          loadPatients();
        }}
      />

      <ContactActionSheet
        isVisible={!!contactPatient}
        onClose={() => setContactPatient(null)}
        name={contactPatient?.name}
        phone={contactPatient?.phone}
        onCall={handleCall}
        onWhatsApp={handleWhatsApp}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
