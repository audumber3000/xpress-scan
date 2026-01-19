import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stethoscope, Clock } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';

interface AppointmentDetailsScreenProps {
  navigation: any;
  route?: any;
}

export const AppointmentDetailsScreen: React.FC<AppointmentDetailsScreenProps> = ({ navigation, route }) => {
  const appointment = route?.params?.appointment || {
    patientName: 'Jerome Bell',
    date: 'Tuesday, Oct 24',
    startTime: '10:30 AM',
    endTime: '11:15 AM',
    duration: '45 min',
    treatment: 'Deep Cleaning & X-Ray',
    treatmentType: 'Treatment Type',
    dentist: 'Dr. Arlene McCoy',
    dentistRole: 'Assigned Dentist',
    status: 'ENCOUNTER',
    clinicalNotes: 'Patient has sensitive teeth and requested a morning slot. History of dental anxiety, prefers topical numbing before starting.',
  };

  const getInitials = (name: string) => {
    const names = name.split(' ');
    return names.length > 1 
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Appointment Details"
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Patient Avatar and Info */}
        <View style={styles.patientSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(appointment.patientName)}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{appointment.status}</Text>
            </View>
          </View>
          <Text style={styles.patientName}>{appointment.patientName}</Text>
          <Text style={styles.appointmentDate}>{appointment.date}</Text>
          <Text style={styles.appointmentTime}>
            {appointment.startTime} - {appointment.endTime} ({appointment.duration})
          </Text>
        </View>

        {/* Services & Staff Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SERVICES & STAFF</Text>
          
          {/* Treatment Card */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconEmoji}>🦷</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>{appointment.treatment}</Text>
              <Text style={styles.infoSubtitle}>{appointment.treatmentType}</Text>
            </View>
          </View>

          {/* Dentist Card */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Stethoscope size={24} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>{appointment.dentist}</Text>
              <Text style={styles.infoSubtitle}>{appointment.dentistRole}</Text>
            </View>
          </View>

          {/* Duration Card */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Clock size={24} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>{appointment.duration.replace(' min', ' Minutes')}</Text>
              <Text style={styles.infoSubtitle}>Scheduled Duration</Text>
            </View>
          </View>
        </View>

        {/* Clinical Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLINICAL NOTES</Text>
          <View style={styles.notesCard}>
            <View style={styles.notesIcon}>
              <Text style={styles.notesIconText}>📝</Text>
            </View>
            <Text style={styles.notesText}>"{appointment.clinicalNotes}"</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.checkInButton} activeOpacity={0.8}>
          <Text style={styles.checkInIcon}>👤</Text>
          <Text style={styles.checkInText}>Check-in Patient</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} activeOpacity={0.8}>
          <Text style={styles.cancelText}>Cancel Appointment</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  editText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  patientSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6B9B9E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: [{ translateX: -45 }],
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  patientName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  appointmentDate: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  appointmentTime: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 24,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  notesCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  notesIcon: {
    marginRight: 12,
  },
  notesIconText: {
    fontSize: 20,
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  checkInIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  checkInText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
