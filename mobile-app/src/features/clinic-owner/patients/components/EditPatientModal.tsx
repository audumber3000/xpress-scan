import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { toast } from '../../../../shared/components/toastService';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';

interface Props {
  visible: boolean;
  patient: Patient;
  onClose: () => void;
  onSaved: (updated: any) => void;
}

const GENDERS = ['Male', 'Female', 'Other'];

/**
 * Focused editor for a patient's core demographics (name, age, gender, phone,
 * village). Sends only these fields to PUT /patients/{id} (PatientUpdateDTO).
 * Kept separate from AddPatientScreen so the registration flow is untouched.
 */
export const EditPatientModal: React.FC<Props> = ({ visible, patient, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setName(patient.name || '');
    setAge(patient.age != null ? String(patient.age) : '');
    // Stored gender may be "Male"/"male"; normalise to a title-case option.
    const g = (patient.gender || '').toLowerCase();
    setGender(g ? g.charAt(0).toUpperCase() + g.slice(1) : '');
    setPhone(patient.phone || '');
    setVillage((patient as any).village || '');
    setErrors({});
  }, [visible, patient]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!age.trim() || isNaN(Number(age)) || Number(age) < 0 || Number(age) > 150) e.age = 'Enter a valid age (0-150)';
    if (!gender) e.gender = 'Select a gender';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload: any = {
        name: name.trim(),
        age: Number(age),
        gender: gender.toLowerCase(), // backend expects lower-case
        phone: phone.trim(),
      };
      if (village.trim()) payload.village = village.trim();
      const updated = await patientsApiService.updatePatient(patient.id, payload);
      toast.success('Patient updated');
      onSaved(updated);
      onClose();
    } catch (err: any) {
      toast.error(err?.message?.includes('body:') ? 'Could not save. Check the details and try again.' : (err?.message || 'Update failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={22} color={colors.gray700} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Patient</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <Field label="Patient Name *" error={errors.name}>
                <TextInput style={[styles.input, errors.name && styles.inputError]} value={name} onChangeText={setName}
                  placeholder="Enter patient name" placeholderTextColor={colors.gray400} />
              </Field>

              <Field label="Age *" error={errors.age}>
                <TextInput style={[styles.input, errors.age && styles.inputError]} value={age}
                  onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ''))} placeholder="Enter age"
                  placeholderTextColor={colors.gray400} keyboardType="numeric" maxLength={3} />
              </Field>

              <Field label="Gender *" error={errors.gender}>
                <View style={styles.rowChoices}>
                  {GENDERS.map((g) => (
                    <TouchableOpacity key={g} style={[styles.choice, gender === g && styles.choiceOn]} onPress={() => setGender(g)}>
                      <Text style={[styles.choiceText, gender === g && styles.choiceTextOn]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>

              <Field label="Phone Number *" error={errors.phone}>
                <TextInput style={[styles.input, errors.phone && styles.inputError]} value={phone} onChangeText={setPhone}
                  placeholder="Enter phone number" placeholderTextColor={colors.gray400} keyboardType="phone-pad" />
              </Field>

              <Field label="Village">
                <TextInput style={styles.input} value={village} onChangeText={setVillage}
                  placeholder="Enter village" placeholderTextColor={colors.gray400} />
              </Field>

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.label}>{label}</Text>
    {children}
    {!!error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.gray900 },
  content: { flex: 1 },
  form: { padding: 20 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.gray900, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: colors.gray300, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: colors.gray900, backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.error, borderWidth: 2 },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4 },
  rowChoices: { flexDirection: 'row', gap: 12 },
  choice: {
    flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: colors.gray300, borderRadius: 8,
    alignItems: 'center', backgroundColor: colors.white,
  },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  choiceText: { fontSize: 14, fontWeight: '500', color: colors.gray700 },
  choiceTextOn: { color: colors.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: colors.white },
});
