import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { FeatureLock } from '../../../../shared/components/FeatureLock';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Menu, Plus, UserCircle2, Mail, Shield, UserCheck, Users } from 'lucide-react-native';
import { StaffMemberCard } from '../components/StaffMemberCard';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService, StaffMember } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { EmptyState } from '../../../../shared/components/EmptyState';

interface StaffManagementScreenProps {
  navigation: any;
}

export const StaffManagementScreen: React.FC<StaffManagementScreenProps> = ({ navigation }) => {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const filters = ['All', 'Dentists', 'Receptionist', 'Inactive'];

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await adminApiService.getStaff();
      setStaffMembers(data);
    } catch (err) {
      console.error('❌ [STAFF] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const filteredStaff = staffMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedFilter === 'All') return matchesSearch;
    if (selectedFilter === 'Dentists') return matchesSearch && (member.role === 'dentist' || member.role === 'doctor');
    if (selectedFilter === 'Receptionist') return matchesSearch && member.role === 'receptionist';
    if (selectedFilter === 'Inactive') return matchesSearch && !member.is_active;
    return matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={24} color={adminColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Management</Text>
        <TouchableOpacity style={styles.menuButton}>
          <UserCheck size={24} color={adminColors.primary} />
        </TouchableOpacity>
      </View>

      <FeatureLock
        featureName="Staff Management"
        description="Managing staff members is a Professional plan feature. Upgrade to add doctors, receptionists, and track their roles."
      >
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.center}>
              <GearLoader text="Loading staff records..." />
            </View>
          ) : (
            <FlatList
              style={styles.content}
              showsVerticalScrollIndicator={false}
              data={filteredStaff}
              keyExtractor={(item) => item.id.toString()}
              ListHeaderComponent={
                <>
                  {/* Search Bar */}
                  <View style={styles.searchContainer}>
                    <Search size={20} color="#9CA3AF" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search staff by name..."
                      placeholderTextColor="#9CA3AF"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  {/* Filters */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filtersContainer}
                  >
                    {filters.map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.filterButton,
                          selectedFilter === filter && styles.filterButtonActive,
                        ]}
                        onPress={() => setSelectedFilter(filter)}
                      >
                        <Text style={[
                          styles.filterText,
                          selectedFilter === filter && styles.filterTextActive,
                        ]}>
                          {filter}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              }
              contentContainerStyle={{ paddingBottom: 100 }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item: staff }) => (
                <View style={styles.staffListItemWrapper}>
                  <StaffMemberCard
                    staff={{
                      ...staff,
                      isOnline: staff.is_active,
                      role: staff.role.toUpperCase().replace('_', ' ')
                    }}
                    onPress={() => { }}
                  />
                </View>
              )}
              ListEmptyComponent={
                <EmptyState 
                  icon={Users}
                  title="No staff members found"
                  description="Try adjusting your search or filters."
                />
              }
            />
          )}

          {/* FAB */}
          <TouchableOpacity
            style={[styles.fab, { bottom: Math.max(insets.bottom + 20, 20) }]}
            onPress={() => showAlert('Coming Soon', 'Staff onboarding via mobile is coming in the next update.')}
          >
            <Plus size={28} color="#FFFFFF" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </FeatureLock>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: adminColors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  staffListItemWrapper: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 100,
    marginRight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: adminColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: adminColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
