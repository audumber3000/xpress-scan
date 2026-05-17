import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { AppointmentCard } from './AppointmentCard';
import { colors } from '../../../../shared/constants/colors';
import { EmptyState } from '../../../../shared/components/EmptyState';
import { Calendar } from 'lucide-react-native';

interface AppointmentsListProps {
  appointments: any[];
  selectedDate: Date;
  onAppointmentPress: (appointment: any) => void;
  ListHeaderComponent?: React.ReactElement;
  refreshControl?: React.ReactElement;
  loading?: boolean;
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

export const AppointmentsList: React.FC<AppointmentsListProps> = ({ 
  appointments, 
  selectedDate,
  onAppointmentPress,
  ListHeaderComponent,
  refreshControl,
  loading = false,
}) => {
  return (
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <>
            {ListHeaderComponent}
            <View style={styles.appointmentsHeader}>
              <Text style={styles.appointmentsDate}>
                {(formatDate(selectedDate) || '').toUpperCase()}
              </Text>
              <Text style={styles.appointmentsCount}>
                {appointments.length} Appointments
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <AppointmentCard
            appointment={item}
            onPress={() => onAppointmentPress(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={refreshControl}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState 
              icon={Calendar}
              title="No Appointments"
              description="You have no appointments scheduled for this day."
            />
          )
        }
      />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  appointmentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appointmentsDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  appointmentsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  noAppointments: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 40,
  },
});
