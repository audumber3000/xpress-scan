import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Users } from 'lucide-react-native';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { SearchBar } from '../components/SearchBar';
import { FilterTabs } from '../components/FilterTabs';
import { PatientsList } from '../components/PatientsList';
import { AddPatientScreen } from './AddPatientScreen';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { AppSkeleton } from '../../../../shared/components/Skeleton';

interface PatientsScreenProps {
  navigation: any;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

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
      // Real API call
      const data = await patientsApiService.getPatients();

      // Augment data with UI components (initials, colors)
      const augmentedData = data.map(p => ({
        ...p,
        initials: getInitials(p.name),
        avatarColor: getAvatarColor()
      }));

      setPatients(augmentedData);
    } catch (err: any) {
      console.error('Error loading patients:', err);
      Alert.alert('Error', `Failed to load patients: ${err.message}`);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    let filtered = patients;

    // Filter by tab
    if (selectedTab === 'active') {
      filtered = filtered.filter(p => p.status === 'Active');
    } else if (selectedTab === 'inactive') {
      filtered = filtered.filter(p => p.status === 'Inactive');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.phone.includes(query) ||
        p.id.includes(query)
      );
    }

    return filtered;
  };

  const handlePatientPress = (patient: any) => {
    navigation.navigate('PatientDetails', { patientId: patient.id });
  };

  const handlePhonePress = (patient: any) => {
    const phoneNumber = patient.phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleDeletePatient = async (patient: any) => {
    setPatients(prevPatients => prevPatients.filter(p => p.id !== patient.id));
    // Real API call
    try {
      await patientsApiService.deletePatient(patient.id);
      loadPatients();
    } catch (error) {
      console.error('Error deleting patient:', error);
      Alert.alert('Error', 'Failed to delete patient');
    }
  };

  const handleAddPatient = () => {
    setShowAddPatient(true);
  };

  const handlePatientAdded = () => {
    loadPatients();
  };

  const filteredPatients = filterPatients();
  const allCount = patients.length;
  const activeCount = patients.filter(p => p.status === 'Active').length;
  const inactiveCount = patients.filter(p => p.status === 'Inactive').length;

  const tabs = [
    { label: 'All', count: allCount, value: 'all' },
    { label: 'Active', count: activeCount, value: 'active' },
    { label: 'Inactive', count: inactiveCount, value: 'inactive' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Patients"
        titleIcon={<Users size={22} color="#111827" />}
      />

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filter Tabs */}
      <FilterTabs
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
      />

      {/* Patients List */}
      <PatientsList
        patients={filteredPatients}
        onPatientPress={handlePatientPress}
        onPhonePress={handlePhonePress}
        onDelete={handleDeletePatient}
        refreshing={refreshing}
        onRefresh={onRefresh}
        loading={loading}
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddPatient}
        activeOpacity={0.8}
      >
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Patient Bottom Sheet */}
      <AddPatientScreen
        visible={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        onPatientAdded={handlePatientAdded}
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
    bottom: 80,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
