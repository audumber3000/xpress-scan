import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, StatusBar } from 'react-native';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Users } from 'lucide-react-native';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { useAuth } from '../../../../app/AuthContext';
import { SearchBar } from '../components/SearchBar';
import { FilterTabs } from '../components/FilterTabs';
import { PatientsList } from '../components/PatientsList';
import { AddPatientScreen } from './AddPatientScreen';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { AppSkeleton } from '../../../../shared/components/Skeleton';

interface PatientsScreenProps {
  navigation: any;
  route?: any;
}

interface UIPatient extends Patient {
  initials: string;
  avatarColor: string;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({ navigation, route }) => {
  const [searchQuery, setSearchQuery] = useState(route?.params?.initialSearchQuery || '');
  const [selectedTab, setSelectedTab] = useState('all');
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);

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

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = () => {
    return colors.primary;
  };

  const loadPatients = async () => {
    setLoading(true);
    try {
      const data = await patientsApiService.getPatients();
      const augmentedData = data.map(p => ({
        ...p,
        initials: getInitials(p.name),
        avatarColor: getAvatarColor()
      }));
      setPatients(augmentedData);
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

  const handlePatientPress = (patient: UIPatient) => {
    navigation.navigate('PatientDetails', { patientId: patient.id });
  };

  const handleCallPatient = (patient: UIPatient) => {
    if (patient.phone) {
      Linking.openURL(`tel:${patient.phone}`);
    } else {
      showAlert('Error', 'Patient has no phone number');
    }
  };

  const handleDeletePatient = (patient: UIPatient) => {
    showAlert('Delete Patient', `Are you sure you want to delete ${patient.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {} } // Delete logic not implemented yet
    ]);
  };

  // Prepare tabs with counts
  const tabs = [
    { key: 'all', label: 'All Patients', value: 'all', count: patients.length },
    { key: 'active', label: 'Active', value: 'active', count: patients.filter(p => p.status === 'Active').length },
    { key: 'inactive', label: 'Inactive', value: 'inactive', count: patients.filter(p => p.status === 'Inactive').length },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        title="Patients"
        titleIcon={<Users size={22} />}
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
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

      {loading && !refreshing ? (
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
          onPhonePress={handleCallPatient}
          onDelete={handleDeletePatient}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddPatient(true)}
      >
        <Plus color="#FFFFFF" size={24} />
      </TouchableOpacity>

      <AddPatientScreen
        visible={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        onPatientAdded={() => {
          setShowAddPatient(false);
          loadPatients();
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
