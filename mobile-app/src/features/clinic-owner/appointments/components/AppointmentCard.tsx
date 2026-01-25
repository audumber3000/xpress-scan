import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface AppointmentCardProps {
  appointment: any;
  onPress: () => void;
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'finished':
      return { border: '#10B981', bg: '#D1FAE5', text: '#065F46' };
    case 'encounter':
      return { border: '#F59E0B', bg: '#FEF3C7', text: '#92400E' };
    case 'registered':
      return { border: '#6B7280', bg: '#F3F4F6', text: '#374151' };
    case 'cancelled':
      return { border: '#EF4444', bg: '#FEE2E2', text: '#991B1B' };
    case 'confirmed':
      return { border: '#F59E0B', bg: '#FEF3C7', text: '#92400E' }; // Orange for Pending
    case 'accepted':
      return { border: '#10B981', bg: '#D1FAE5', text: '#065F46' }; // Green for Accepted
    case 'rejected':
      return { border: '#EF4444', bg: '#FEE2E2', text: '#991B1B' }; // Red for Rejected
    default:
      return { border: '#6B7280', bg: '#F3F4F6', text: '#374151' };
  }
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
            {appointment.startTime.substring(0, 5)}
          </Text>
          <Text style={styles.appointmentPeriod}>AM</Text>
        </View>
        <View style={styles.appointmentMiddle}>
          <Text style={styles.appointmentPatient}>{appointment.patientName}</Text>
          <Text style={styles.appointmentTreatment}>{appointment.treatment || 'Treatment'}</Text>
        </View>
        <View style={styles.appointmentRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {appointment.status.toLowerCase() === 'confirmed' ? 'PENDING' : appointment.status.toUpperCase()}
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
