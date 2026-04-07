import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { AppointmentCard } from './AppointmentCard';
import { colors } from '../../../../shared/constants/colors';

interface AppointmentsListProps {
  appointments: any[];
  selectedDate: Date;
  onAppointmentPress: (appointment: any) => void;
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

export const AppointmentsList: React.FC<AppointmentsListProps> = ({ 
  appointments, 
  selectedDate,
  onAppointmentPress 
}) => {
  return (
    <View style={styles.appointmentsSection}>
      <View style={styles.appointmentsHeader}>
        <Text style={styles.appointmentsDate}>
          {(formatDate(selectedDate) || '').toUpperCase()}
        </Text>
        <Text style={styles.appointmentsCount}>
          {appointments.length} Appointments
        </Text>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <AppointmentCard
            appointment={item}
            onPress={() => onAppointmentPress(item)}
          />
        )}
        scrollEnabled={false} // Nested inside ScrollView in parent
        ListEmptyComponent={
          <Text style={styles.noAppointments}>No more appointments today</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  appointmentsSection: {
    paddingHorizontal: 20,
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
