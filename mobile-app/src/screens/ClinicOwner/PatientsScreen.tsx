import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, RefreshControl, Animated, Alert, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, Plus, ChevronRight, Trash2 } from 'lucide-react-native';
import { Platform } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GearLoader } from '../../components/GearLoader';
import { AddPatientScreen } from './AddPatientScreen';
import { colors } from '../../constants/colors';
import { apiService, Patient } from '../../services/api/apiService';

interface PatientsScreenProps {
  navigation: any;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

  // Swipeable Patient Card Component
  const SwipeablePatientCard: React.FC<{ patient: Patient }> = ({ patient }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const lastOffset = useRef(0);
    const swipeThreshold = 60; // Slightly lower threshold for smaller button

    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
        },
        onPanResponderGrant: () => {
          if (openSwipeId !== null && openSwipeId !== patient.id) {
            // Close other open card
            setOpenSwipeId(null);
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
          lastOffset.current = (translateX as any)._value || 0;
        },
        onPanResponderMove: (_, gestureState) => {
          const newOffset = lastOffset.current + gestureState.dx;
          // Only allow left swipe (negative values), limit to 120px for smaller button
          if (newOffset <= 0 && newOffset >= -120) {
            translateX.setValue(newOffset);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldOpen = gestureState.dx < -swipeThreshold;
          const targetValue = shouldOpen ? -80 : 0; // Match new button width
          
          if (shouldOpen) {
            setOpenSwipeId(patient.id);
            // Optional haptic feedback
            if (Platform.OS === 'ios') {
              // Haptic feedback would require expo-haptics
            }
          } else {
            setOpenSwipeId(null);
          }

          Animated.spring(translateX, {
            toValue: targetValue,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        },
      })
    ).current;

    const handleClose = () => {
      setOpenSwipeId(null);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    };

    const handleDelete = () => {
      Alert.alert(
        'Delete Patient',
        `Are you sure you want to delete ${patient.name}? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: handleClose,
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('🗑️ [PATIENTS] Deleting patient:', patient.id);
                await apiService.deletePatient(patient.id);
                console.log('✅ [PATIENTS] Patient deleted successfully');
                handleClose();
                // Refresh the patient list
                loadPatients();
              } catch (error: any) {
                console.error('❌ [PATIENTS] Delete error:', error);
                Alert.alert(
                  'Error',
                  'Failed to delete patient. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            },
          },
        ]
      );
    };

    return (
      <View style={styles.swipeableContainer}>
        {/* Delete Button - Hidden by default, revealed on swipe */}
        <Animated.View 
          style={[
            styles.deleteButton,
            {
              transform: [{
                translateX: translateX.interpolate({
                  inputRange: [-80, 0],
                  outputRange: [0, 80], // Delete button moves from right (80px) to visible (0px) as row swipes left
                  extrapolate: 'clamp',
                }),
              }],
            },
          ]}
        >
          <TouchableOpacity 
            style={styles.deleteButtonInner}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Trash2 size={20} color={colors.white} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Patient Row - Moves left on swipe to reveal delete button */}
        <Animated.View
          style={[
            styles.patientRow,
            {
              transform: [{ translateX }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity 
            style={styles.patientRowContent}
            onPress={() => {
              handleClose();
              navigation.navigate('PatientDetails', { patientId: patient.id });
            }}
            activeOpacity={0.7}
          >
            <View style={styles.patientAvatar}>
              <Text style={styles.patientInitials}>
                {patient.name.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            
            <View style={styles.patientInfo}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: patient.status === 'Active' ? '#D1FAE5' : '#F3F4F6' }
                ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: patient.status === 'Active' ? '#10B981' : '#9CA3AF' }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: patient.status === 'Active' ? '#10B981' : '#9CA3AF' }
                  ]}>
                    {patient.status}
                  </Text>
                </View>
              </View>
              
              <View style={styles.patientDetails}>
                <Text style={styles.patientDetailText}>
                  {patient.age} yrs • {patient.gender}
                </Text>
                <Text style={styles.patientDetailText}>•</Text>
                <Text style={styles.patientDetailText}>{patient.phone}</Text>
              </View>
            </View>
            
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 [PATIENTS] Loading patients...');
      const data = await apiService.getPatients();
      setPatients(data);
      console.log('✅ [PATIENTS] Loaded', data.length, 'patients');
    } catch (err: any) {
      console.error('❌ [PATIENTS] Load error:', err);
      setError('Failed to load patients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      console.log('🔄 [PATIENTS] Refreshing patients...');
      const data = await apiService.getPatients();
      setPatients(data);
      console.log('✅ [PATIENTS] Refreshed', data.length, 'patients');
    } catch (err: any) {
      console.error('❌ [PATIENTS] Refresh error:', err);
      setError('Failed to refresh patients. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterActive === 'All' || patient.status === filterActive;
    return matchesSearch && matchesFilter;
  });

  const handlePatientAdded = () => {
    loadPatients(); // Refresh the patients list
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader 
        title="Patients" 
      />
      
      {/* Add Button - Outside Header for Testing */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddPatient(true)}
        >
          <Plus size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Search and Filter */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patients..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Filter size={20} color="#9333EA" />
          </TouchableOpacity>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadPatients} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, filterActive === 'All' && styles.filterTabActive]}
            onPress={() => setFilterActive('All')}
          >
            <Text style={[styles.filterTabText, filterActive === 'All' && styles.filterTabTextActive]}>
              All ({patients.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filterActive === 'Active' && styles.filterTabActive]}
            onPress={() => setFilterActive('Active')}
          >
            <Text style={[styles.filterTabText, filterActive === 'Active' && styles.filterTabTextActive]}>
              Active ({patients.filter(p => p.status === 'Active').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filterActive === 'Inactive' && styles.filterTabActive]}
            onPress={() => setFilterActive('Inactive')}
          >
            <Text style={[styles.filterTabText, filterActive === 'Inactive' && styles.filterTabTextActive]}>
              Inactive ({patients.filter(p => p.status === 'Inactive').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Patients List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <GearLoader text="Loading patients..." />
          </View>
        ) : (
          <ScrollView 
            style={styles.patientsList} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.gray100}
              />
            }
          >
            {filteredPatients.map((patient) => (
              <SwipeablePatientCard key={patient.id} patient={patient} />
            ))}
            
            {filteredPatients.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No patients found</Text>
              </View>
            )}
            
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>

      {/* Add Patient Screen */}
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
    backgroundColor: colors.gray50,
  },
  addButtonContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.gray800,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  filterTabActive: {
    backgroundColor: '#9333EA',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  patientsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#9333EA',
  },
  patientInfo: {
    flex: 1,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  patientDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  patientDetailText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  patientFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  visitDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  nextAppointment: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nextAppointmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray500,
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
  // Native-style list rows
  swipeableContainer: {
    position: 'relative',
    overflow: 'hidden', // Critical for hiding delete action
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  deleteButton: {
    position: 'absolute',
    right: 0, // Start at right edge, will be hidden by container overflow
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deleteButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  patientRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
});
