import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
          {formatDate(selectedDate).toUpperCase()}
        </Text>
        <Text style={styles.appointmentsCount}>
          {appointments.length} Appointments
        </Text>
      </View>

      {appointments.length > 0 ? (
        appointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            onPress={() => onAppointmentPress(appointment)}
          />
        ))
      ) : (
        <Text style={styles.noAppointments}>No more appointments today</Text>
      )}
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
