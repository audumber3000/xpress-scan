import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, StatusBar } from 'react-native';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Users, UploadCloud, Gift, CalendarClock } from 'lucide-react-native';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { dailyRegisterApiService } from '../../../../services/api/dailyRegister.api';
import { TodayPatientsView } from '../components/TodayPatientsView';
import { toast } from '../../../../shared/components/toastService';
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
  const [selectedTab, setSelectedTab] = useState('today');
  // When true, a patient created via Add Patient came from the register flow and
  // should be dropped into today's register once saved. Holds the prefill too.
  const [registerAfterAdd, setRegisterAfterAdd] = useState<{ name: string; phone: string } | null>(null);
  const [registerRefreshKey, setRegisterRefreshKey] = useState(0);
  // Bumped by the header "+" while on Today's Patients, to open the register flow.
  const [registerSignal, setRegisterSignal] = useState(0);
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
        // Guard name too: legacy/imported patients can have a null name, and an
        // unguarded .toLowerCase() throws mid-render → app error screen on search.
        (p.name?.toLowerCase().includes(query)) ||
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

  // The register flow found no existing match: open Add Patient prefilled, and
  // remember to drop the new patient into today's register once saved.
  const handleRegisterNew = (name: string, phone: string) => {
    setRegisterAfterAdd({ name, phone });
    setShowAddPatient(true);
  };

  // Prepare tabs. Today's Patients leads, matching the web layout.
  const tabs = [
    {
      key: 'today',
      label: "Today's Patients",
      value: 'today',
      icon: <CalendarClock size={15} color={selectedTab === 'today' ? colors.primary : '#6B7280'} />,
    },
    { key: 'all', label: 'All Patients', value: 'all', count: patients.length },
    {
      key: 'birthdays',
      label: 'Birthdays',
      value: 'birthdays',
      icon: <Gift size={15} color={selectedTab === 'birthdays' ? colors.primary : '#6B7280'} />,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        topInset
        title="Patients"
        titleIcon={<Users size={22} />}
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        rightComponent={
          <View style={styles.headerActions}>
            {/* Import is bulk-CSV, not relevant to the daily register. */}
            {selectedTab !== 'today' && (
              <TouchableOpacity onPress={() => setShowImport(true)} style={styles.headerAddBtn}>
                <UploadCloud color={colors.white} size={20} />
              </TouchableOpacity>
            )}
            {/* On Today's Patients the "+" opens the register flow; elsewhere it creates a patient. */}
            <TouchableOpacity
              onPress={() => selectedTab === 'today' ? setRegisterSignal((n) => n + 1) : setShowAddPatient(true)}
              style={styles.headerAddBtn}
            >
              <Plus color={colors.white} size={22} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* The register carries its own search + day picker, so the global search
          bar only shows for the patient list tabs. */}
      {selectedTab !== 'today' && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, ID or phone"
          autoFocus={route?.params?.fromHomeSearch || !!route?.params?.initialSearchQuery}
        />
      )}

      <FilterTabs
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
      />

      {selectedTab === 'today' ? (
        <TodayPatientsView
          navigation={navigation}
          onRegisterNew={handleRegisterNew}
          refreshKey={registerRefreshKey}
          registerSignal={registerSignal}
        />
      ) : selectedTab === 'birthdays' ? (
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
        onClose={() => { setShowAddPatient(false); setRegisterAfterAdd(null); }}
        initialData={registerAfterAdd ? { name: registerAfterAdd.name, phone: registerAfterAdd.phone } : undefined}
        onPatientAdded={async (created: any) => {
          setShowAddPatient(false);
          // Came from the register flow: drop the new patient into today's list.
          if (registerAfterAdd && created?.id) {
            try {
              await dailyRegisterApiService.addEntry({ patient_id: Number(created.id) });
              setRegisterRefreshKey((k) => k + 1);
              toast.success(`${created.name || registerAfterAdd.name} added to today's register`);
            } catch (e: any) {
              toast.error("Patient saved, but couldn't add to today's register");
            }
          }
          setRegisterAfterAdd(null);
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
