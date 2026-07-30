import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { toast } from '../../../../shared/components/toastService';
import { authApiService, BackendUser } from '../../../../services/api/auth.api';

interface Props {
  visible: boolean;
  user: BackendUser | null;
  onClose: () => void;
  onSaved: () => void; // parent refreshes backendUser
}

/** Split a full name into first + rest, used when the API didn't send parts. */
const splitName = (name?: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
};

/**
 * Edit the signed-in user's own profile (name + phone). Sends only these fields
 * to PATCH /auth/me — role, email, clinic and password are never touched.
 */
export const EditProfileModal: React.FC<Props> = ({ visible, user, onClose, onSaved }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    const fallback = splitName(user?.name);
    setFirstName(user?.first_name || fallback.first);
    setLastName(user?.last_name || fallback.last);
    setPhone(user?.phone || '');
    setErrors({});
  }, [visible, user]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (phone.trim() && phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      await authApiService.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
      });
      toast.success('Profile updated');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message?.includes('HTTP') ? 'Could not save. Please try again.' : (err?.message || 'Update failed'));
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
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <Field label="First Name *" error={errors.firstName}>
                <TextInput style={[styles.input, errors.firstName && styles.inputError]} value={firstName}
                  onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.gray400} />
              </Field>

              <Field label="Last Name">
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName}
                  placeholder="Last name" placeholderTextColor={colors.gray400} />
              </Field>

              <Field label="Phone" error={errors.phone}>
                <TextInput style={[styles.input, errors.phone && styles.inputError]} value={phone}
                  onChangeText={setPhone} placeholder="Your contact number" placeholderTextColor={colors.gray400}
                  keyboardType="phone-pad" />
              </Field>

              <Text style={styles.note}>Your email, role and clinic aren't changed here.</Text>

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
  note: { fontSize: 12, color: colors.gray500, marginTop: -8, marginBottom: 12 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: colors.white },
});
