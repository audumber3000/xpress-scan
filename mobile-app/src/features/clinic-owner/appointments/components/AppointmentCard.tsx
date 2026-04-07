import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface AppointmentCardProps {
  appointment: any;
  onPress: () => void;
}

const getStatusColor = (status: string) => {
  const s = (status || 'booked').toLowerCase();
  if (s === 'finished') {
    return { border: '#0694a2', bg: '#e1effe', text: '#1e429f' }; // Teal/Greenish
  }
  if (s === 'accepted') {
    return { border: '#E29312', bg: '#FFF4E5', text: '#B45309' }; // Light Orange
  }
  if (s === 'checked in' || s === 'checking' || s === 'encounter') {
    return { border: '#10B981', bg: '#D1FAE5', text: '#065F46' }; // Green
  }
  if (s === 'cancelled' || s === 'rejected') {
    return { border: '#EF4444', bg: '#FEE2E2', text: '#991B1B' }; // Red
  }
  // Default/Booked/Confirmed
  return { border: '#6B7280', bg: '#F3F4F6', text: '#374151' }; // Grey
};

export const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointment, onPress }) => {
  const statusColors = getStatusColor(appointment.status);

  return (
    <TouchableOpacity
      style={styles.appointmentCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.appointmentBorder, { backgroundColor: statusColors.border }]} />
      <View style={styles.appointmentContent}>
        <View style={styles.appointmentLeft}>
          <Text style={styles.appointmentTime}>
            {(appointment.startTime || '10:00').substring(0, 5)}
          </Text>
          <Text style={styles.appointmentPeriod}>AM</Text>
        </View>
        <View style={styles.appointmentMiddle}>
          <Text style={styles.appointmentPatient}>{appointment.patientName || 'Anonymous'}</Text>
          <Text style={styles.appointmentTreatment}>{appointment.doctor || appointment.notes || 'General Visit'}</Text>
        </View>
        <View style={styles.appointmentRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {(appointment.status || 'booked').toLowerCase() === 'confirmed' ? 'PENDING' : (appointment.status || 'booked').toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColors.border }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  appointmentCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  appointmentBorder: {
    width: 4,
  },
  appointmentContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  appointmentLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  appointmentTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  appointmentPeriod: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  appointmentMiddle: {
    flex: 1,
  },
  appointmentPatient: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  appointmentTreatment: {
    fontSize: 14,
    color: '#6B7280',
  },
  appointmentRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
