import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { statusMeta } from '../../../../shared/constants/appointmentStatus';

interface AppointmentCardProps {
  appointment: any;
  onPress: () => void;
}

// Colours and words from the one status vocabulary. The card used to read the
// old words ("finished", "accepted", "checking"), so a completed or checked-in
// visit showed grey and a patient-confirmed one said PENDING.
const getStatusColor = (status: string) => {
  const m = statusMeta(status);
  return { border: m.border, bg: m.bg, text: m.color };
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
              {statusMeta(appointment.status).label.toUpperCase()}
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
    borderRadius: 12,
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
    borderRadius: 20,
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
