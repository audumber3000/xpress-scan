import React, { useState, useEffect, useRef } from 'react';
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
  // Total across the whole clinic, from GET /patients/count. Kept apart from
  // patients.length, which is only what has been paged in so far — using the
  // array length showed "100" for every clinic bigger than one page.
  const [totalPatients, setTotalPatients] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [contactPatient, setContactPatient] = useState<Patient | null>(null);

  const { backendUser } = useAuth();

  // Monotonic id for the newest list request. Debouncing alone does not stop a
  // slow earlier response landing after a newer one — type "sha" then "sharm",
  // and if "sha" is slower it overwrites the correct results with no error
  // shown. Every response checks it is still the latest before it writes state.
  const requestIdRef = useRef(0);

  // Reload on clinic switch, and whenever the search term settles. Search runs
  // server-side across the whole clinic — filtering the loaded page in JS meant
  // a patient beyond the first 100 could not be found at all.
  useEffect(() => {
    const handle = setTimeout(() => { loadPatients(); }, searchQuery ? 350 : 0);
    return () => clearTimeout(handle);
  }, [backendUser?.clinic?.id, searchQuery]);

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

  const PAGE_SIZE = 100;

  const loadPatients = async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const [data, total] = await Promise.all([
        patientsApiService.getPatients({ skip: 0, limit: PAGE_SIZE, search: searchQuery }),
        patientsApiService.getPatientsCount({ search: searchQuery }),
      ]);
      if (reqId !== requestIdRef.current) return;  // a newer search superseded this
      setPatients(data);
      setTotalPatients(total);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      console.error('Error loading patients:', err);
      showAlert('Error', `Failed to load patients: ${err.message}`);
      setPatients([]);
      setTotalPatients(null);
      setHasMore(false);
    } finally {
      // Only the newest request owns the spinner, or a stale one turns it off
      // while the current search is still running.
      if (reqId === requestIdRef.current) setLoading(false);
    }
  };

  // Next page, appended. Guarded so overlapping onEndReached fires (FlatList
  // can emit several in a row) don't queue duplicate requests.
  const loadMorePatients = async () => {
    if (loadingMore || loading || !hasMore) return;
    // Belongs to the search that is current right now. If a new search starts
    // mid-flight, this page is for the old query and must not be appended.
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const next = await patientsApiService.getPatients({
        skip: patients.length,
        limit: PAGE_SIZE,
        search: searchQuery,
      });
      if (reqId !== requestIdRef.current) return;
      if (next.length === 0) {
        setHasMore(false);
        return;
      }
      // De-dupe on id: a patient added between pages shifts the offset and
      // would otherwise reappear, and duplicate keys break FlatList.
      setPatients((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
      setHasMore(next.length === PAGE_SIZE);
    } catch (err: any) {
      console.error('Error loading more patients:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // No client-side filtering: the server already returned exactly this page,
  // searched across the whole clinic. Filtering the loaded pages in JS is what
  // made a patient past the first 100 unfindable, and it does not scale.
  // Matches the web list (frontend/src/pages/Patients.jsx).
  //
  // Under 2 characters the backend rejects `search` (min_length=2), so the list
  // stays unfiltered until the second character — same as web.

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
    // The clinic-wide total, not how many have been paged in.
    { key: 'all', label: 'All Patients', value: 'all', count: totalPatients ?? patients.length },
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

      {/* On Today's Patients the tabs move below the metric card (rendered inside
          TodayPatientsView); every other tab keeps them up here under the search. */}
      {selectedTab !== 'today' && (
        <FilterTabs
          tabs={tabs}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
        />
      )}

      {selectedTab === 'today' ? (
        <TodayPatientsView
          navigation={navigation}
          onRegisterNew={handleRegisterNew}
          refreshKey={registerRefreshKey}
          registerSignal={registerSignal}
          tabsSlot={
            <FilterTabs
              tabs={tabs}
              selectedTab={selectedTab}
              onTabChange={setSelectedTab}
            />
          }
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
          patients={patients}
          onPatientPress={handlePatientPress}
          onPhonePress={handleContactPatient}
          onDelete={handleDeletePatient}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={loadMorePatients}
          loadingMore={loadingMore}
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
