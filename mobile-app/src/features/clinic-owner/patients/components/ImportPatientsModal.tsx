import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, FileSpreadsheet, Table2, CheckCircle2, AlertCircle, UploadCloud, Plus, Trash2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { colors } from '../../../../shared/constants/colors';
import { toast } from '../../../../shared/components/toastService';
import { patientsApiService } from '../../../../services/api/patients.api';

interface ImportPatientsModalProps {
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
}

// Columns the importer understands (same keys as the web importer / backend).
const COLUMNS = [
  'name', 'age', 'date_of_birth', 'gender', 'phone', 'village',
  'treatment_type', 'referred_by', 'blood_group', 'patient_history', 'notes', 'registered_at',
];

type ManualRow = {
  name: string;
  phone: string;
  ageMode: 'age' | 'dob';
  age: string;
  dateOfBirth: string;
  gender: string;
  village: string;
  treatmentType: string;
  referredBy: string;
  registeredAt: string;
};
const emptyRow = (): ManualRow => ({
  name: '', phone: '', ageMode: 'age', age: '', dateOfBirth: '',
  gender: '', village: '', treatmentType: '', referredBy: '', registeredAt: '',
});

const GENDERS = ['Male', 'Female', 'Other'];

// Masks free typing into a YYYY-MM-DD string (DOB / bulk back-date support).
const maskDate = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
};
const isValidDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = new Date(s);
  return !isNaN(dt.getTime()) && dt <= new Date();
};
const computeAge = (dob: string): number | null => {
  if (!isValidDate(dob)) return null;
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

// Minimal CSV parser: handles quoted fields and embedded commas/quotes.
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((v) => v.trim() !== '')) rows.push(row);
  }
  return rows;
};

const isValidPhone = (phone: string) => phone.replace(/\D/g, '').length >= 7;

export const ImportPatientsModal: React.FC<ImportPatientsModalProps> = ({
  visible, onClose, onImported,
}) => {
  const [mode, setMode] = useState<null | 'csv' | 'manual'>(null);
  // CSV preview rows
  const [rows, setRows] = useState<Array<{ data: Record<string, string>; valid: boolean }>>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  // Manual table rows
  const [manualRows, setManualRows] = useState<ManualRow[]>([emptyRow(), emptyRow(), emptyRow()]);

  const reset = () => {
    setMode(null);
    setRows([]);
    setFileName('');
    setParsing(false);
    setImporting(false);
    setManualRows([emptyRow(), emptyRow(), emptyRow()]);
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setFileName(asset.name);
      setParsing(true);

      const content = await FileSystem.readAsStringAsync(asset.uri);
      const matrix = parseCsv(content);
      if (matrix.length < 2) {
        toast.error('No rows found. Make sure the file has a header row and at least one patient.');
        setParsing(false);
        return;
      }
      const headers = matrix[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const parsed = matrix.slice(1).map((cells) => {
        const data: Record<string, string> = {};
        COLUMNS.forEach((key) => {
          const idx = headers.indexOf(key);
          data[key] = idx >= 0 ? String(cells[idx] ?? '').trim() : '';
        });
        const valid = !!data.name && isValidPhone(data.phone);
        return { data, valid };
      });
      setRows(parsed);
      setParsing(false);
    } catch (err) {
      console.error('CSV pick/parse error:', err);
      toast.error('Could not read that file.');
      setParsing(false);
    }
  };

  const csvValid = rows.filter((r) => r.valid);
  const csvInvalid = rows.length - csvValid.length;

  // Manual table helpers
  const updateManual = (i: number, field: keyof ManualRow, value: string) => {
    let v: any = value;
    if (field === 'age') v = value.replace(/[^0-9]/g, '');
    else if (field === 'dateOfBirth' || field === 'registeredAt') v = maskDate(value);
    setManualRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)));
  };
  const setManualAgeMode = (i: number, ageMode: 'age' | 'dob') =>
    setManualRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ageMode } : r)));
  const addManualRow = () => setManualRows((prev) => [...prev, emptyRow()]);
  const removeManualRow = (i: number) => setManualRows((prev) => prev.filter((_, idx) => idx !== i));
  const manualValid = manualRows.filter((r) => r.name.trim() && isValidPhone(r.phone));

  const importPayload = (): Record<string, any>[] => {
    if (mode === 'csv') return csvValid.map((r) => r.data);
    return manualValid.map((r) => {
      const out: Record<string, any> = {
        name: r.name.trim(),
        phone: r.phone.trim(),
        gender: r.gender.trim() || undefined,
        village: r.village.trim() || undefined,
        treatment_type: r.treatmentType.trim() || undefined,
        referred_by: r.referredBy.trim() || undefined,
        registered_at: isValidDate(r.registeredAt) ? r.registeredAt : undefined,
      };
      if (r.ageMode === 'dob' && isValidDate(r.dateOfBirth)) {
        out.date_of_birth = r.dateOfBirth;
        const derived = computeAge(r.dateOfBirth);
        if (derived !== null) out.age = String(derived);
      } else if (r.age) {
        out.age = r.age;
      }
      return out;
    });
  };

  const handleImport = async () => {
    const payload = importPayload();
    if (!payload.length) return;
    setImporting(true);
    try {
      const res = await patientsApiService.importPatients(payload);
      if (res.imported_count > 0) {
        toast.success(res.message || `Imported ${res.imported_count} patients`);
      } else {
        toast.error(res.errors?.[0] || 'No patients were imported. Please check the rows.');
      }
      if (res.imported_count > 0) {
        reset();
        onImported();
        onClose();
      }
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const footerCount = mode === 'csv' ? csvValid.length : mode === 'manual' ? manualValid.length : 0;
  const showFooter = (mode === 'csv' && rows.length > 0) || mode === 'manual';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Bulk Add Patients</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} disabled={importing}>
              <X size={22} color={colors.gray700} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {mode === null ? (
              <>
                <TouchableOpacity style={styles.choiceCard} onPress={() => setMode('csv')}>
                  <View style={[styles.choiceIcon, { backgroundColor: '#EFF6FF' }]}>
                    <FileSpreadsheet size={22} color="#3B82F6" />
                  </View>
                  <Text style={styles.choiceTitle}>Upload a CSV</Text>
                  <Text style={styles.choiceSub}>Add many patients from a spreadsheet. Supports back-dated registration.</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.choiceCard} onPress={() => setMode('manual')}>
                  <View style={[styles.choiceIcon, { backgroundColor: '#F5F3FF' }]}>
                    <Table2 size={22} color="#8B5CF6" />
                  </View>
                  <Text style={styles.choiceTitle}>Enter manually in a table</Text>
                  <Text style={styles.choiceSub}>Type several patients row by row, then import them all together.</Text>
                </TouchableOpacity>
              </>
            ) : mode === 'csv' ? (
              rows.length === 0 ? (
                <>
                  <TouchableOpacity onPress={() => setMode(null)}>
                    <Text style={styles.backLink}>← Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.guide}>
                    Your CSV should have a header row. <Text style={{ fontWeight: '700' }}>name</Text> and{' '}
                    <Text style={{ fontWeight: '700' }}>phone</Text> are required. Optional columns: age, date_of_birth,
                    gender, village, treatment_type, referred_by, blood_group, patient_history, notes, registered_at.
                  </Text>
                  <TouchableOpacity style={styles.dropzone} onPress={pickFile} disabled={parsing}>
                    {parsing ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <UploadCloud size={32} color={colors.gray400} />
                        <Text style={styles.dropzoneText}>Tap to choose a CSV file</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.previewHeader}>
                    <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
                    <TouchableOpacity onPress={() => { setRows([]); setFileName(''); }}>
                      <Text style={styles.backLink}>Choose another</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.countRow}>
                    <View style={styles.countItem}>
                      <CheckCircle2 size={16} color="#16A34A" />
                      <Text style={[styles.countText, { color: '#16A34A' }]}>{csvValid.length} ready</Text>
                    </View>
                    {csvInvalid > 0 && (
                      <View style={styles.countItem}>
                        <AlertCircle size={16} color="#EF4444" />
                        <Text style={[styles.countText, { color: '#EF4444' }]}>{csvInvalid} will be skipped</Text>
                      </View>
                    )}
                  </View>
                  {rows.slice(0, 50).map((r, i) => (
                    <View key={i} style={[styles.rowItem, !r.valid && styles.rowItemInvalid]}>
                      {r.valid ? <CheckCircle2 size={16} color="#16A34A" /> : <AlertCircle size={16} color="#EF4444" />}
                      <Text style={styles.rowName} numberOfLines={1}>{r.data.name || '—'}</Text>
                      <Text style={styles.rowPhone}>{r.data.phone || '—'}</Text>
                    </View>
                  ))}
                  {rows.length > 50 && <Text style={styles.moreText}>+ {rows.length - 50} more rows</Text>}
                </>
              )
            ) : (
              /* Manual table mode */
              <>
                <View style={styles.previewHeader}>
                  <TouchableOpacity onPress={() => setMode(null)}>
                    <Text style={styles.backLink}>← Back</Text>
                  </TouchableOpacity>
                  <View style={styles.countItem}>
                    <CheckCircle2 size={16} color="#16A34A" />
                    <Text style={[styles.countText, { color: '#16A34A' }]}>{manualValid.length} ready</Text>
                  </View>
                </View>
                <Text style={styles.guide}>
                  Add a row per patient. <Text style={{ fontWeight: '700' }}>Name</Text> and{' '}
                  <Text style={{ fontWeight: '700' }}>Phone</Text> are required. Fill either{' '}
                  <Text style={{ fontWeight: '700' }}>Age</Text> or <Text style={{ fontWeight: '700' }}>DOB</Text>.
                </Text>
                {manualRows.map((r, i) => {
                  const rowValid = r.name.trim() && isValidPhone(r.phone);
                  const touched = r.name.trim() || r.phone.trim();
                  return (
                    <View key={i} style={styles.manualCard}>
                      <View style={styles.manualCardHeader}>
                        <Text style={styles.manualIndex}>#{i + 1}</Text>
                        {touched ? (
                          rowValid
                            ? <CheckCircle2 size={16} color="#16A34A" />
                            : <AlertCircle size={16} color="#EF4444" />
                        ) : <View />}
                        {manualRows.length > 1 && (
                          <TouchableOpacity onPress={() => removeManualRow(i)} style={{ marginLeft: 'auto' }}>
                            <Trash2 size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <TextInput
                        style={styles.manualInput}
                        value={r.name}
                        onChangeText={(v) => updateManual(i, 'name', v)}
                        placeholder="Full name *"
                        placeholderTextColor={colors.gray400}
                      />

                      <TextInput
                        style={styles.manualInput}
                        value={r.phone}
                        onChangeText={(v) => updateManual(i, 'phone', v)}
                        placeholder="Phone *"
                        placeholderTextColor={colors.gray400}
                        keyboardType="phone-pad"
                      />

                      {/* Age or Date of birth */}
                      <View style={styles.fieldWithToggle}>
                        <View style={styles.miniSegmented}>
                          <TouchableOpacity
                            style={[styles.miniSegBtn, r.ageMode === 'age' && styles.miniSegBtnActive]}
                            onPress={() => setManualAgeMode(i, 'age')}
                          >
                            <Text style={[styles.miniSegText, r.ageMode === 'age' && styles.miniSegTextActive]}>Age</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.miniSegBtn, r.ageMode === 'dob' && styles.miniSegBtnActive]}
                            onPress={() => setManualAgeMode(i, 'dob')}
                          >
                            <Text style={[styles.miniSegText, r.ageMode === 'dob' && styles.miniSegTextActive]}>DOB</Text>
                          </TouchableOpacity>
                        </View>
                        {r.ageMode === 'dob' ? (
                          <TextInput
                            style={[styles.manualInput, { flex: 1 }]}
                            value={r.dateOfBirth}
                            onChangeText={(v) => updateManual(i, 'dateOfBirth', v)}
                            placeholder="Date of birth (YYYY-MM-DD)"
                            placeholderTextColor={colors.gray400}
                            keyboardType="numeric"
                            maxLength={10}
                          />
                        ) : (
                          <TextInput
                            style={[styles.manualInput, { flex: 1 }]}
                            value={r.age}
                            onChangeText={(v) => updateManual(i, 'age', v)}
                            placeholder="Age"
                            placeholderTextColor={colors.gray400}
                            keyboardType="numeric"
                            maxLength={3}
                          />
                        )}
                      </View>
                      {r.ageMode === 'dob' && computeAge(r.dateOfBirth) !== null && (
                        <Text style={styles.ageHint}>Age: {computeAge(r.dateOfBirth)} years</Text>
                      )}

                      {/* Gender */}
                      <View style={styles.genderRow}>
                        {GENDERS.map((g) => (
                          <TouchableOpacity
                            key={g}
                            style={[styles.genderChip, r.gender === g && styles.genderChipActive]}
                            onPress={() => updateManual(i, 'gender', r.gender === g ? '' : g)}
                          >
                            <Text style={[styles.genderChipText, r.gender === g && styles.genderChipTextActive]}>{g}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={styles.manualRowTwo}>
                        <TextInput
                          style={[styles.manualInput, styles.manualInputHalf]}
                          value={r.village}
                          onChangeText={(v) => updateManual(i, 'village', v)}
                          placeholder="Village"
                          placeholderTextColor={colors.gray400}
                        />
                        <TextInput
                          style={[styles.manualInput, styles.manualInputHalf]}
                          value={r.treatmentType}
                          onChangeText={(v) => updateManual(i, 'treatmentType', v)}
                          placeholder="Treatment type"
                          placeholderTextColor={colors.gray400}
                        />
                      </View>

                      <TextInput
                        style={styles.manualInput}
                        value={r.referredBy}
                        onChangeText={(v) => updateManual(i, 'referredBy', v)}
                        placeholder="Referred by (doctor)"
                        placeholderTextColor={colors.gray400}
                      />

                      <TextInput
                        style={styles.manualInput}
                        value={r.registeredAt}
                        onChangeText={(v) => updateManual(i, 'registeredAt', v)}
                        placeholder="Registered on (YYYY-MM-DD, optional)"
                        placeholderTextColor={colors.gray400}
                        keyboardType="numeric"
                        maxLength={10}
                      />
                    </View>
                  );
                })}
                <TouchableOpacity style={styles.addRowBtn} onPress={addManualRow}>
                  <Plus size={18} color={colors.primary} />
                  <Text style={styles.addRowText}>Add another patient</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>

          {showFooter && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.importBtn, (!footerCount || importing) && { opacity: 0.5 }]}
                onPress={handleImport}
                disabled={!footerCount || importing}
              >
                {importing
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.importBtnText}>Import {footerCount} patient{footerCount === 1 ? '' : 's'}</Text>}
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.gray900 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20, gap: 16 },
  choiceCard: { borderWidth: 1, borderColor: colors.gray200, borderRadius: 14, padding: 18, gap: 8 },
  choiceIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  choiceTitle: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  choiceSub: { fontSize: 13, color: colors.gray500, lineHeight: 18 },
  backLink: { fontSize: 14, fontWeight: '600', color: colors.primary, marginBottom: 8 },
  guide: { fontSize: 13, color: colors.gray700, lineHeight: 19 },
  dropzone: {
    borderWidth: 2, borderColor: colors.gray300, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  dropzoneText: { fontSize: 14, fontWeight: '500', color: colors.gray700 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fileName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.gray900 },
  countRow: { flexDirection: 'row', gap: 16 },
  countItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countText: { fontSize: 13, fontWeight: '600' },
  rowItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  rowItemInvalid: { backgroundColor: '#FEF2F2' },
  rowName: { flex: 1, fontSize: 14, color: colors.gray900 },
  rowPhone: { fontSize: 13, color: colors.gray500 },
  moreText: { fontSize: 13, color: colors.gray400, marginTop: 8, textAlign: 'center' },
  manualCard: { borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, padding: 12, gap: 10 },
  manualCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manualIndex: { fontSize: 13, fontWeight: '700', color: colors.gray500 },
  manualInput: {
    borderWidth: 1, borderColor: colors.gray300, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.gray900, backgroundColor: colors.white,
  },
  manualRowTwo: { flexDirection: 'row', gap: 10 },
  manualInputHalf: { flex: 1 },
  manualInputQuarter: { width: 80 },
  fieldWithToggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniSegmented: {
    flexDirection: 'row', borderWidth: 1, borderColor: colors.gray300, borderRadius: 8, overflow: 'hidden',
  },
  miniSegBtn: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.white },
  miniSegBtnActive: { backgroundColor: colors.primary },
  miniSegText: { fontSize: 12, fontWeight: '600', color: colors.gray500 },
  miniSegTextActive: { color: colors.white },
  ageHint: { fontSize: 12, color: colors.gray400, marginTop: -4 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderChip: {
    flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.gray300,
    alignItems: 'center', backgroundColor: colors.white,
  },
  genderChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  genderChipText: { fontSize: 13, fontWeight: '500', color: colors.gray700 },
  genderChipTextActive: { color: colors.primary, fontWeight: '600' },
  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
  },
  addRowText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.gray200 },
  importBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  importBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
