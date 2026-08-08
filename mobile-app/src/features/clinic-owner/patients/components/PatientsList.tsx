import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { PatientCard } from './PatientCard';
import { colors } from '../../../../shared/constants/colors';
import { AppSkeleton } from '../../../../shared/components/Skeleton';
import { EmptyState } from '../../../../shared/components/EmptyState';
import { Users } from 'lucide-react-native';

interface Patient {
  id: string;
  name: string;
  phone: string;
  status: 'Active' | 'Inactive';
  lastVisit: string;
  age: number;
  gender: string;
}

interface PatientsListProps {
  patients: Patient[];
  onPatientPress: (patient: Patient) => void;
  onPhonePress: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  emptyMessage?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
  /** Fetch the next page — fired when the list nears its end. */
  onEndReached?: () => void;
  /** Shows a spinner under the last row while the next page is in flight. */
  loadingMore?: boolean;
}

export const PatientsList: React.FC<PatientsListProps> = ({
  patients,
  onPatientPress,
  onPhonePress,
  onDelete,
  emptyMessage = 'No patients found',
  refreshing = false,
  onRefresh,
  loading = false,
  onEndReached,
  loadingMore = false,
}) => {
  if (!loading && patients.length === 0) {
    return (
      <View style={{ paddingTop: 60 }}>
        <EmptyState 
          icon={Users}
          title={emptyMessage}
          description="Try a different search or filter criteria."
        />
      </View>
    );
  }

  // Use a type-safe approach for the data
  const data = loading ? Array.from({ length: 5 }, (_, i) => ({ id: `skel-${i}` } as Patient)) : patients;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        if (loading) {
          return (
            <View style={styles.skeletonItem}>
              <AppSkeleton width={50} height={50} radius={25} />
              <View style={styles.skeletonTextContainer}>
                <AppSkeleton width={150} height={20} radius={4} />
                <View style={{ height: 8 }} />
                <AppSkeleton width={100} height={14} radius={4} />
              </View>
            </View>
          );
        }

        return (
          <PatientCard
            patient={item}
            onPress={() => onPatientPress(item)}
            onPhonePress={() => onPhonePress(item)}
            onDelete={() => onDelete(item)}
          />
        );
      }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      // Skeleton rows are placeholders, not real data — paging off them would
      // fire a page fetch during the initial load.
      onEndReached={loading ? undefined : onEndReached}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  skeletonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
});
