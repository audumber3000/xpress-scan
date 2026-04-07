import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Check, X, UserPlus, FileText as FileIcon, Search, UserRound, Stethoscope } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import {
  appointmentsApiService,
  Appointment,
  AppointmentUpdatePayload,
  DuplicatePatient,
} from '../../../../services/api/appointments.api';
import { AddPatientScreen } from '../../patients/screens/AddPatientScreen';

interface AppointmentDetailsScreenProps {
  navigation: any;
  route?: any;
}

export const AppointmentDetailsScreen: React.FC<AppointmentDetailsScreenProps> = ({ navigation, route }) => {
  const routeAppointment = route?.params?.appointment;
  const [appointment, setAppointment] = useState<Appointment>(
    routeAppointment || {
      id: '1',
      patientId: null,
      patientName: 'Unknown Patient',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '10:30',
      duration: 30,
      treatment: 'Consultation',
      status: 'confirmed',
      notes: '',
    },
  );

  const [loading, setLoading] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<DuplicatePatient[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<DuplicatePatient | null>(null);

  const [checkInData, setCheckInData] = useState({
    doctor_id: '',
    chair_number: '',
    notes: '',
    patient_age: '',
    patient_gender: 'Male',
    patient_village: '',
    patient_referred_by: 'Direct',
  });

  useEffect(() => {
    if (!routeAppointment?.id) return;
    (async () => {
      try {
        const latest = await appointmentsApiService.getAppointment(routeAppointment.id);
        setAppointment(latest);
      } catch (error) {
        console.error('Error loading latest appointment details:', error);
      }
    })();
  }, [routeAppointment?.id]);

  const getInitials = (name: string) => {
    const names = name.split(' ');
    return names.length > 1
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      const updated = await appointmentsApiService.updateAppointment(appointment.id, { status: 'accepted' });
      setAppointment(updated);
      showAlert('Success', 'Appointment accepted successfully!');
    } catch (error) {
      console.error('Error accepting appointment:', error);
      showAlert('Error', 'Failed to accept appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    showAlert('Confirm Reject', 'Are you sure you want to reject this appointment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const updated = await appointmentsApiService.updateAppointment(appointment.id, { status: 'rejected' });
            setAppointment(updated);
            showAlert('Success', 'Appointment rejected');
          } catch (error) {
            console.error('Error rejecting appointment:', error);
            showAlert('Error', 'Failed to reject appointment');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const openCheckIn = () => {
    setCheckInData({
      doctor_id: '',
      chair_number: '',
      notes: appointment.notes || '',
      patient_age: '',
      patient_gender: 'Male',
      patient_village: '',
      patient_referred_by: 'Direct',
    });
    setPatientQuery(appointment.patientName || '');
    setPatientResults([]);
    setSelectedMatch(null);
    setShowCheckInModal(true);
  };

  const searchPatients = async () => {
    if (!patientQuery.trim() || patientQuery.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    setSearchingPatient(true);
    try {
      const results = await appointmentsApiService.searchPatients(patientQuery.trim());
      setPatientResults(results);
    } catch (error) {
      console.error('Error searching patients:', error);
      setPatientResults([]);
    } finally {
      setSearchingPatient(false);
    }
  };

  const finalizeCheckIn = async (existingPatientId: number | null = null) => {
    setLoading(true);
    try {
      const payload: AppointmentUpdatePayload = {
        status: 'checking',
        patient_id: existingPatientId || (appointment.patientId ? parseInt(appointment.patientId, 10) : null),
        doctor_id: checkInData.doctor_id ? parseInt(checkInData.doctor_id, 10) : null,
        chair_number: checkInData.chair_number || undefined,
        notes: checkInData.notes || undefined,
        patient_age: checkInData.patient_age ? parseInt(checkInData.patient_age, 10) : null,
        patient_gender: checkInData.patient_gender || undefined,
        patient_village: checkInData.patient_village || undefined,
        patient_referred_by: checkInData.patient_referred_by || undefined,
        patient_name: appointment.patientName,
        patient_phone: appointment.patientPhone,
        patient_email: appointment.patientEmail,
      };

      const updated = await appointmentsApiService.updateAppointment(appointment.id, payload);
      setAppointment(updated);
      setShowCheckInModal(false);

      if (existingPatientId || updated.patientId) {
        showAlert('Success', 'Patient checked-in and linked successfully.');
      } else {
        showAlert('Checked In', 'Check-in completed. Now create patient file to continue.');
      }
    } catch (error: any) {
      console.error('Error during check-in:', error);
      showAlert('Error', error?.message || 'Failed to check in patient');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    setLoading(true);
    try {
      const duplicates = await appointmentsApiService.checkPatientDuplicates({
        name: appointment.patientName,
        phone: appointment.patientPhone,
        email: appointment.patientEmail,
      });

      if (selectedMatch) {
        setLoading(false);
        await finalizeCheckIn(selectedMatch.id);
        return;
      }

      if (duplicates.length > 0) {
        setLoading(false);
        showAlert(
          'Similar Patient Found',
          `Found ${duplicates.length} matching patient file(s). Link first match or create new?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Link First Match',
              onPress: () => finalizeCheckIn(duplicates[0].id),
            },
            {
              text: 'Create New File',
              onPress: () => finalizeCheckIn(null),
            },
          ],
        );
        return;
      }

      setLoading(false);
      await finalizeCheckIn(null);
    } catch (error) {
      setLoading(false);
      console.error('Error checking duplicates:', error);
      showAlert('Error', 'Failed to verify duplicates. Please try again.');
    }
  };

  const handlePatientAdded = (patient: any) => {
    setAppointment(prev => ({
      ...prev,
      patientId: patient.id.toString(),
      status: 'Registered',
    }));
  };

  const renderActionButtons = () => {
    if (loading) {
      return (
        <View style={styles.actionButtons}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    if (appointment.status === 'confirmed') {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            activeOpacity={0.8}
            onPress={handleAccept}
          >
            <Check size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Accept Appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            activeOpacity={0.8}
            onPress={handleReject}
          >
            <X size={20} color="#EF4444" />
            <Text style={[styles.buttonText, { color: '#EF4444' }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (appointment.status === 'accepted') {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.button, styles.checkInButton]} activeOpacity={0.8} onPress={openCheckIn}>
            <UserPlus size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Check-in Patient</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (appointment.status === 'checking') {
      if (appointment.patientId) {
        return (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.checkInButton]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('PatientDetails', { patientId: appointment.patientId })}
            >
              <FileIcon size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Open Patient File</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.button, styles.checkInButton]} activeOpacity={0.8} onPress={() => setShowAddPatientModal(true)}>
            <UserPlus size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Create Patient File</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (appointment.status === 'Registered' && appointment.patientId) {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.checkInButton]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PatientDetails', { patientId: appointment.patientId })}
          >
            <FileIcon size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>View Patient File</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.actionButtons}>
        <View style={styles.readOnlyState}>
          <Text style={styles.readOnlyText}>No actions available for this status.</Text>
        </View>
      </View>
    );
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'confirmed': return { label: 'PENDING', color: '#F59E0B' };
      case 'accepted': return { label: 'ACCEPTED', color: '#10B981' };
      case 'checking': return { label: 'CHECKING IN', color: '#2D9596' };
      case 'rejected': return { label: 'REJECTED', color: '#EF4444' };
      case 'Registered': return { label: 'REGISTERED', color: '#6B7280' };
      default: return { label: status.toUpperCase(), color: '#6B7280' };
    }
  };

  const statusInfo = getStatusDisplay(appointment.status);

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
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
              <Text style={styles.statusBadgeText}>{statusInfo.label}</Text>
            </View>
          </View>
          <Text style={styles.patientName}>{appointment.patientName}</Text>
          <Text style={styles.appointmentDate}>{appointment.date}</Text>
          <Text style={styles.appointmentTime}>
            {appointment.startTime} - {appointment.endTime} ({appointment.duration}{typeof appointment.duration === 'number' ? ' min' : ''})
          </Text>
        </View>

        {/* Services & Staff Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SERVICES & STAFF</Text>

          {appointment.notes ? (
            <View style={styles.infoCard}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconEmoji}>📝</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>{appointment.notes}</Text>
                <Text style={styles.infoSubtitle}>Notes</Text>
              </View>
            </View>
          ) : null}

          {/* Duration Card */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <Clock size={24} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                {typeof appointment.duration === 'string'
                  ? appointment.duration.replace(' min', ' Minutes')
                  : `${appointment.duration} Minutes`}
              </Text>
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
            <Text style={styles.notesText}>"{appointment.notes || 'No notes available'}"</Text>
          </View>
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Action Buttons */}
      {renderActionButtons()}

      <AddPatientScreen
        visible={showAddPatientModal}
        onClose={() => setShowAddPatientModal(false)}
        onPatientAdded={handlePatientAdded}
        initialData={{
          name: appointment.patientName,
          phone: appointment.patientPhone,
          treatmentType: appointment.treatment || 'General Consultation',
          appointmentId: appointment.id,
        }}
      />

      <Modal
        visible={showCheckInModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCheckInModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Patient Check-in</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Find Existing Patient</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={patientQuery}
                  onChangeText={setPatientQuery}
                  placeholder="Search by name"
                />
                <TouchableOpacity style={styles.searchBtn} onPress={searchPatients}>
                  {searchingPatient ? <ActivityIndicator size="small" color="#fff" /> : <Search size={16} color="#fff" />}
                </TouchableOpacity>
              </View>

              {patientResults.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.resultCard, selectedMatch?.id === p.id && styles.resultCardActive]}
                  onPress={() => setSelectedMatch(p)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <UserRound size={14} color={selectedMatch?.id === p.id ? colors.primary : '#6B7280'} />
                    <Text style={styles.resultName}>{p.name}</Text>
                  </View>
                  <Text style={styles.resultMeta}>{p.phone || 'No phone'} • ID {p.id}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.modalLabel}>Check-in Details</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={checkInData.patient_age}
                  onChangeText={(v) => setCheckInData((prev) => ({ ...prev, patient_age: v }))}
                  placeholder="Age"
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={checkInData.patient_gender}
                  onChangeText={(v) => setCheckInData((prev) => ({ ...prev, patient_gender: v }))}
                  placeholder="Gender"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={checkInData.doctor_id}
                  onChangeText={(v) => setCheckInData((prev) => ({ ...prev, doctor_id: v }))}
                  placeholder="Doctor ID"
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={checkInData.chair_number}
                  onChangeText={(v) => setCheckInData((prev) => ({ ...prev, chair_number: v }))}
                  placeholder="Chair"
                />
              </View>
              <TextInput
                style={styles.input}
                value={checkInData.patient_village}
                onChangeText={(v) => setCheckInData((prev) => ({ ...prev, patient_village: v }))}
                placeholder="Village"
              />
              <TextInput
                style={styles.input}
                value={checkInData.patient_referred_by}
                onChangeText={(v) => setCheckInData((prev) => ({ ...prev, patient_referred_by: v }))}
                placeholder="Referred by"
              />
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={checkInData.notes}
                onChangeText={(v) => setCheckInData((prev) => ({ ...prev, notes: v }))}
                placeholder="Clinical notes"
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowCheckInModal(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmCheckIn}>
                <Text style={styles.primaryBtnText}>Finish Check-in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'column',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
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
  readOnlyState: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  readOnlyText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  searchBtn: {
    height: 42,
    width: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  resultCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDFA',
  },
  resultName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  resultMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
