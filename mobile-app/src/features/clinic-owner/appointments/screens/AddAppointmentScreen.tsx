import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { toast } from '../../../../shared/components/toastService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, User, FileText, ChevronRight } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { appointmentsApiService, Appointment } from '../../../../services/api/appointments.api';
import { adminApiService } from '../../../../services/api/admin.api';
import { useAuth } from '../../../../app/AuthContext';
import { format } from 'date-fns';

interface AddAppointmentScreenProps {
  navigation: any;
}

export const AddAppointmentScreen: React.FC<AddAppointmentScreenProps> = ({ navigation }) => {
  const { backendUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [showChairDropdown, setShowChairDropdown] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
  const [nextAvailableSlot, setNextAvailableSlot] = useState<string | null>(null);
  const [doctorOptions, setDoctorOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [clinicChairs, setClinicChairs] = useState(1);
  const [clinicTimings, setClinicTimings] = useState<Record<string, { open: string; close: string; closed: boolean }>>({
    monday: { open: '08:00', close: '20:00', closed: false },
    tuesday: { open: '08:00', close: '20:00', closed: false },
    wednesday: { open: '08:00', close: '20:00', closed: false },
    thursday: { open: '08:00', close: '20:00', closed: false },
    friday: { open: '08:00', close: '20:00', closed: false },
    saturday: { open: '09:00', close: '17:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true },
  });
  
  const [form, setForm] = useState({
    patientName: '',
    patientPhone: '',
    appointmentDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: '',
    duration: '60',
    doctorId: '',
    chairNumber: '',
    notes: '',
  });

  const normalizeTimeInput = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };

  const isValidHHMM = (time: string) => {
    if (!/^\d{2}:\d{2}$/.test(time)) return false;
    const [h, m] = time.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  };

  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const toHHMM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const parseClinicTimings = (raw: any) => {
    if (!raw || typeof raw !== 'object') return;
    const normalized: Record<string, { open: string; close: string; closed: boolean }> = { ...clinicTimings };
    Object.keys(normalized).forEach((day) => {
      const d = raw[day] || raw[day.substring(0, 3)] || raw[day.toUpperCase()];
      if (d && typeof d === 'object') {
        normalized[day] = {
          open: d.open || d.start || normalized[day].open,
          close: d.close || d.end || normalized[day].close,
          closed: Boolean(d.closed),
        };
      }
    });
    setClinicTimings(normalized);
  };

  const loadClinicAndDayAppointments = async () => {
    setLoadingSlots(true);
    try {
      const [clinicInfo, dayAppointments] = await Promise.all([
        adminApiService.getClinicInfo(),
        appointmentsApiService.getAppointments(form.appointmentDate, form.appointmentDate),
      ]);

      if (clinicInfo?.timings) {
        parseClinicTimings(clinicInfo.timings);
      }
      const chairCount = Number((clinicInfo as any)?.number_of_chairs || 1);
      setClinicChairs(Number.isFinite(chairCount) && chairCount > 0 ? chairCount : 1);

      const sameDay = dayAppointments.filter((a) => a.date === form.appointmentDate);
      setExistingAppointments(sameDay);
    } catch (error) {
      console.error('Error loading slot data:', error);
      setExistingAppointments([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    loadClinicAndDayAppointments();
  }, [form.appointmentDate]);

  useEffect(() => {
    (async () => {
      setLoadingDoctors(true);
      try {
        const staff = await adminApiService.getStaff();
        const doctors = (staff || [])
          .filter((s: any) => s.role === 'doctor' || s.role === 'clinic_owner')
          .map((d: any) => ({ id: d.id.toString(), name: d.name }));
        setDoctorOptions(doctors);
      } catch (error) {
        console.error('Error loading doctors:', error);
        setDoctorOptions([]);
      } finally {
        setLoadingDoctors(false);
      }
    })();
  }, []);

  const computedEndTime = useMemo(() => {
    const duration = parseInt(form.duration, 10) || 60;
    if (!form.startTime || !/^\d{2}:\d{2}$/.test(form.startTime)) return '';
    return toHHMM(toMinutes(form.startTime) + duration);
  }, [form.startTime, form.duration]);

  const chairOptions = useMemo(() => {
    const count = Math.max(1, clinicChairs);
    return Array.from({ length: count }, (_, i) => String(i + 1));
  }, [clinicChairs]);

  const findNextAvailableSlot = (durationMinutes: number) => {
    const dayName = new Date(form.appointmentDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const timing = clinicTimings[dayName];
    if (!timing || timing.closed) return null;

    const openM = toMinutes(timing.open);
    const closeM = toMinutes(timing.close);
    const sorted = [...existingAppointments]
      .filter((a) => a.startTime && a.endTime)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    let cursor = openM;
    for (const apt of sorted) {
      const aStart = toMinutes(apt.startTime);
      const aEnd = toMinutes(apt.endTime);
      if (cursor + durationMinutes <= aStart) {
        return toHHMM(cursor);
      }
      if (cursor < aEnd) {
        cursor = aEnd;
      }
    }

    if (cursor + durationMinutes <= closeM) return toHHMM(cursor);
    return null;
  };

  useEffect(() => {
    const duration = parseInt(form.duration, 10) || 60;
    setNextAvailableSlot(findNextAvailableSlot(duration));
  }, [existingAppointments, clinicTimings, form.appointmentDate, form.duration]);

  const checkConflict = (start: string, end: string) => {
    const s = toMinutes(start);
    const e = toMinutes(end);
    return existingAppointments.find((apt) => {
      const aS = toMinutes(apt.startTime);
      const aE = toMinutes(apt.endTime);
      return s < aE && e > aS;
    });
  };

  const validateWithinClinicHours = (start: string, end: string) => {
    const dayName = new Date(form.appointmentDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const timing = clinicTimings[dayName];
    if (!timing || timing.closed) {
      return { valid: false, message: `Clinic is closed on ${dayName}.` };
    }

    const s = toMinutes(start);
    const e = toMinutes(end);
    const open = toMinutes(timing.open);
    const close = toMinutes(timing.close);

    if (s < open) return { valid: false, message: `Clinic opens at ${timing.open}.` };
    if (e > close) return { valid: false, message: `Clinic closes at ${timing.close}.` };
    return { valid: true, message: '' };
  };

  const handleSave = async () => {
    if (!form.patientName || !form.appointmentDate) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    if (!backendUser?.clinic?.id) {
      Alert.alert('Error', 'Clinic information not found');
      return;
    }

    const durationMinutes = parseInt(form.duration, 10);
    if (!durationMinutes || durationMinutes <= 0) {
      Alert.alert('Error', 'Enter a valid duration in minutes.');
      return;
    }

    let start = form.startTime.trim();
    if (!start) {
      if (!nextAvailableSlot) {
        Alert.alert('No Slots', 'No available time slots for selected date.');
        return;
      }
      start = nextAvailableSlot;
      setForm((prev) => ({ ...prev, startTime: start }));
    }

    if (!isValidHHMM(start)) {
      Alert.alert('Error', 'Start time must be in HH:MM format.');
      return;
    }

    const end = toHHMM(toMinutes(start) + durationMinutes);

    const hoursCheck = validateWithinClinicHours(start, end);
    if (!hoursCheck.valid) {
      Alert.alert('Invalid Time', hoursCheck.message);
      return;
    }

    const conflict = checkConflict(start, end);
    if (conflict) {
      Alert.alert(
        'Time Conflict',
        `Overlaps with ${conflict.patientName} (${conflict.startTime}-${conflict.endTime}). Choose another slot.`,
      );
      return;
    }

    setLoading(true);
    try {
      await appointmentsApiService.createAppointment({
        patient_name: form.patientName,
        patient_phone: form.patientPhone,
        appointment_date: form.appointmentDate,
        start_time: start,
        end_time: end,
        duration: durationMinutes,
        clinic_id: Number(backendUser.clinic.id),
        doctor_id: form.doctorId ? Number(form.doctorId) : null,
        chair_number: form.chairNumber || undefined,
        notes: form.notes,
        status: 'confirmed'
      });
      
      Alert.alert('Success', 'Appointment scheduled successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error creating appointment:', error);
      Alert.alert('Error', 'Failed to schedule appointment');
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="New Appointment"
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* Patient Info Section */}
          <Text style={styles.sectionTitle}>PATIENT INFORMATION</Text>
          <View style={styles.inputCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <User size={18} color={colors.primary} />
                <Text style={styles.label}>Patient Name *</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter patient full name"
                value={form.patientName}
                onChangeText={(val) => updateForm('patientName', val)}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <ChevronRight size={18} color={colors.primary} />
                <Text style={styles.label}>Phone Number</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit number"
                keyboardType="phone-pad"
                value={form.patientPhone}
                onChangeText={(val) => updateForm('patientPhone', val)}
              />
            </View>
          </View>

          {/* Schedule Section */}
          <Text style={styles.sectionTitle}>SCHEDULE</Text>
          <View style={styles.inputCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Calendar size={18} color={colors.primary} />
                <Text style={styles.label}>Appointment Date *</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={form.appointmentDate}
                onChangeText={(val) => updateForm('appointmentDate', val)}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <View style={styles.labelContainer}>
                  <Clock size={18} color={colors.primary} />
                  <Text style={styles.label}>Start Time</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (optional)"
                  value={form.startTime}
                  onChangeText={(val) => updateForm('startTime', normalizeTimeInput(val))}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <View style={styles.labelContainer}>
                  <Clock size={18} color={colors.primary} />
                  <Text style={styles.label}>Duration (min)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="60"
                  value={form.duration}
                  onChangeText={(val) => updateForm('duration', val)}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.slotInfoBox}>
              <Text style={styles.slotInfoText}>
                {loadingSlots
                  ? 'Checking available slots...'
                  : `Next available slot: ${nextAvailableSlot || 'No slots available'}`}
              </Text>
              {!!computedEndTime && (
                <Text style={styles.slotInfoSubText}>Computed end time: {computedEndTime}</Text>
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}> 
                <View style={styles.labelContainer}>
                  <User size={18} color={colors.primary} />
                  <Text style={styles.label}>Doctor (optional)</Text>
                </View>
                {loadingDoctors ? (
                  <View style={styles.simpleLoader}><ActivityIndicator size="small" color={colors.primary} /></View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.selectorTrigger}
                      onPress={() => {
                        setShowDoctorDropdown((prev) => !prev);
                        setShowChairDropdown(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.selectorText,
                          !form.doctorId && styles.selectorPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {doctorOptions.find((d) => d.id === form.doctorId)?.name || 'Select doctor'}
                      </Text>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </TouchableOpacity>

                    {showDoctorDropdown && (
                      <View style={styles.optionList}>
                        <TouchableOpacity
                          style={styles.optionItem}
                          onPress={() => {
                            updateForm('doctorId', '');
                            setShowDoctorDropdown(false);
                          }}
                        >
                          <Text style={styles.optionText}>No doctor</Text>
                        </TouchableOpacity>

                        {doctorOptions.map((doc) => (
                          <TouchableOpacity
                            key={doc.id}
                            style={[styles.optionItem, form.doctorId === doc.id && styles.optionItemActive]}
                            onPress={() => {
                              updateForm('doctorId', doc.id);
                              setShowDoctorDropdown(false);
                            }}
                          >
                            <Text style={styles.optionText}>{doc.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={[styles.inputGroup, { width: 120, marginLeft: 8 }]}> 
                <View style={styles.labelContainer}>
                  <ChevronRight size={18} color={colors.primary} />
                  <Text style={styles.label}>Chair</Text>
                </View>
                <TouchableOpacity
                  style={styles.selectorTrigger}
                  onPress={() => {
                    setShowChairDropdown((prev) => !prev);
                    setShowDoctorDropdown(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.selectorText, !form.chairNumber && styles.selectorPlaceholder]}>
                    {form.chairNumber ? `Chair ${form.chairNumber}` : 'Select'}
                  </Text>
                  <ChevronRight size={16} color="#9CA3AF" />
                </TouchableOpacity>

                {showChairDropdown && (
                  <View style={styles.optionList}>
                    {chairOptions.map((chair) => (
                      <TouchableOpacity
                        key={chair}
                        style={[styles.optionItem, form.chairNumber === chair && styles.optionItemActive]}
                        onPress={() => {
                          updateForm('chairNumber', chair);
                          setShowChairDropdown(false);
                        }}
                      >
                        <Text style={styles.optionText}>Chair {chair}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Notes Section */}
          <Text style={styles.sectionTitle}>VISIT NOTES</Text>
          <View style={styles.inputCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <FileText size={18} color={colors.primary} />
                <Text style={styles.label}>Notes (optional)</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any specific instructions or notes"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={form.notes}
                onChangeText={(val) => updateForm('notes', val)}
              />
            </View>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.disabledButton]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Schedule Appointment</Text>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
  },
  slotInfoBox: {
    marginTop: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  slotInfoText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  slotInfoSubText: {
    marginTop: 3,
    fontSize: 11,
    color: '#3B82F6',
  },
  simpleLoader: {
    height: 44,
    justifyContent: 'center',
  },
  selectorTrigger: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    marginRight: 8,
  },
  selectorPlaceholder: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  optionList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  optionItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F3',
  },
  optionItemActive: {
    backgroundColor: '#EFF6FF',
  },
  optionText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
