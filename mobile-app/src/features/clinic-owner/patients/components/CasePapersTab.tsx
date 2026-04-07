import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  Plus, ChevronLeft, ChevronRight, Clock, FileText, FlaskConical,
  Pill, Upload, StickyNote, Save, X, Check, Trash2,
} from 'lucide-react-native';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { colors } from '../../../../shared/constants/colors';
import { DentalChart } from './DentalChart';

// ─── Helpers ──────────────────────────────────────────────────
const parsePills = (val: any): string[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try { return JSON.parse(val); } catch { return [val]; }
  }
  if (typeof val === 'string' && val.trim() !== '') return [val];
  return [];
};

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

// ─── Types ────────────────────────────────────────────────────
interface CasePapersTabProps {
  patient: Patient;
  patientId: string;
}

interface CasePaperForm {
  chief_complaint: string[];
  medical_history: string[];
  dental_history: string[];
  allergies: string[];
  clinical_examination: string;
  diagnosis: string;
  next_visit_recommendation: string;
  notes: string;
}

const EMPTY_FORM: CasePaperForm = {
  chief_complaint: [],
  medical_history: [],
  dental_history: [],
  allergies: [],
  clinical_examination: '',
  diagnosis: '',
  next_visit_recommendation: 'Not specified',
  notes: '',
};

// ─── Pill Tag Input ───────────────────────────────────────────
const PillInput: React.FC<{
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}> = ({ label, values, onChange, placeholder }) => {
  const [text, setText] = useState('');
  const add = () => {
    const t = text.trim();
    if (t && !values.includes(t)) { onChange([...values, t]); }
    setText('');
  };
  return (
    <View style={s.pillSection}>
      <Text style={s.pillLabel}>{label}</Text>
      <View style={s.pillWrap}>
        {values.map((v, i) => (
          <TouchableOpacity key={i} style={s.pill} onPress={() => onChange(values.filter((_, idx) => idx !== i))}>
            <Text style={s.pillText}>{v}</Text>
            <X size={10} color="#6B7280" />
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.pillInputRow}>
        <TextInput
          style={s.pillInput}
          value={text}
          onChangeText={setText}
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
          placeholderTextColor="#9CA3AF"
          onSubmitEditing={add}
          returnKeyType="done"
        />
        {text.trim() ? (
          <TouchableOpacity style={s.pillAddBtn} onPress={add}>
            <Plus size={14} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const CasePapersTab: React.FC<CasePapersTabProps> = ({ patient, patientId }) => {
  // ─── List state ──────────────────────────────────────────
  const [caseHistory, setCaseHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Session state ───────────────────────────────────────
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [form, setForm] = useState<CasePaperForm>({ ...EMPTY_FORM });
  const [sessionTeethData, setSessionTeethData] = useState<any>({});
  const [sessionToothNotes, setSessionToothNotes] = useState<any>({});
  const [sessionTreatmentPlan, setSessionTreatmentPlan] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // ─── Sub-data ────────────────────────────────────────────
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  // ─── Modals ──────────────────────────────────────────────
  const [treatmentModal, setTreatmentModal] = useState(false);
  const [prescriptionModal, setPrescriptionModal] = useState(false);
  const [labOrderModal, setLabOrderModal] = useState(false);

  // Treatment form
  const [txProcedure, setTxProcedure] = useState('');
  const [txTooth, setTxTooth] = useState('');
  const [txCost, setTxCost] = useState('');
  const [txNotes, setTxNotes] = useState('');

  // Prescription form
  const [rxMedicine, setRxMedicine] = useState('');
  const [rxDosage, setRxDosage] = useState('');
  const [rxDuration, setRxDuration] = useState('');
  const [rxNotes, setRxNotes] = useState('');

  // Lab order form
  const [labVendor, setLabVendor] = useState('');
  const [labWorkType, setLabWorkType] = useState('');
  const [labTooth, setLabTooth] = useState('');
  const [labShade, setLabShade] = useState('');
  const [labInstructions, setLabInstructions] = useState('');

  // ─── Fetchers ────────────────────────────────────────────
  const fetchCasePapers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientsApiService.getCasePapers(patientId);
      setCaseHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('❌ fetchCasePapers:', e);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const fetchSubData = useCallback(async (paperId?: string) => {
    const [rx, docs] = await Promise.all([
      patientsApiService.getClinicalPrescriptions(patientId),
      paperId ? patientsApiService.getPatientDocuments(patientId, paperId) : Promise.resolve([]),
    ]);
    setPrescriptions(Array.isArray(rx) ? rx : []);
    setDocuments(Array.isArray(docs) ? docs : []);
    if (paperId && !paperId.startsWith('new-')) {
      const lo = await patientsApiService.getLabOrders(paperId);
      setLabOrders(Array.isArray(lo) ? lo : []);
    } else {
      setLabOrders([]);
    }
  }, [patientId]);

  useEffect(() => { fetchCasePapers(); }, [fetchCasePapers]);

  // ─── Open / New ──────────────────────────────────────────
  const openCasePaper = (paper: any) => {
    setSelectedPaper(paper);
    setForm({
      chief_complaint: parsePills(paper.chief_complaint),
      medical_history: parsePills(paper.medical_history),
      dental_history: parsePills(paper.dental_history),
      allergies: parsePills(paper.allergies),
      clinical_examination: paper.clinical_examination || '',
      diagnosis: paper.diagnosis || '',
      next_visit_recommendation: paper.next_visit_recommendation || 'Not specified',
      notes: paper.notes || '',
    });
    setSessionTeethData(paper.dental_chart_snapshot || patient.dentalChart || {});
    setSessionToothNotes(paper.tooth_notes_snapshot || patient.toothNotes || {});
    setSessionTreatmentPlan(paper.treatment_plan_snapshot || patient.treatmentPlan || []);
    fetchSubData(paper.id?.toString());
  };

  const startNewCasePaper = () => {
    const newPaper = { id: 'new-' + Date.now(), date: new Date().toISOString(), status: 'In Progress', isNew: true };
    setSelectedPaper(newPaper);
    setForm({ ...EMPTY_FORM });
    setSessionTeethData(patient.dentalChart || {});
    setSessionToothNotes(patient.toothNotes || {});
    setSessionTreatmentPlan(patient.treatmentPlan || []);
    setPrescriptions([]);
    setLabOrders([]);
    setDocuments([]);
  };

  const closeCasePaper = () => {
    setSelectedPaper(null);
    setForm({ ...EMPTY_FORM });
  };

  // ─── Save ────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        patient_id: parseInt(patientId),
        date: new Date().toISOString(),
        status: 'Completed',
        dental_chart_snapshot: sessionTeethData,
        treatment_plan_snapshot: sessionTreatmentPlan,
        tooth_notes_snapshot: sessionToothNotes,
      };
      if (selectedPaper?.isNew) {
        await patientsApiService.createCasePaper(payload);
      } else {
        await patientsApiService.updateCasePaper(selectedPaper.id.toString(), payload);
      }
      // Sync global clinical data
      await patientsApiService.updatePatient(patientId, {
        dental_chart: sessionTeethData,
        treatment_plan: sessionTreatmentPlan,
        tooth_notes: sessionToothNotes,
      });
      Alert.alert('Saved', 'Case paper saved successfully.');
      closeCasePaper();
      fetchCasePapers();
    } catch (e: any) {
      console.error('❌ handleSave:', e);
      Alert.alert('Error', e.message || 'Failed to save case paper.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Treatment plan helpers ──────────────────────────────
  const addTreatment = () => {
    if (!txProcedure.trim()) return;
    const item = {
      id: Date.now() + Math.random(),
      procedure: txProcedure,
      tooth: txTooth ? parseInt(txTooth) : null,
      cost: txCost ? parseFloat(txCost) : 0,
      notes: txNotes,
      status: 'planned',
      date: new Date().toISOString().split('T')[0],
    };
    setSessionTreatmentPlan(prev => [...prev, item]);
    setTxProcedure(''); setTxTooth(''); setTxCost(''); setTxNotes('');
    setTreatmentModal(false);
  };

  const removeTreatment = (id: number) => {
    setSessionTreatmentPlan(prev => prev.filter(p => p.id !== id));
  };

  // ─── Prescription helpers ────────────────────────────────
  const addPrescription = async () => {
    if (!rxMedicine.trim()) return;
    if (selectedPaper?.isNew) {
      Alert.alert('Save First', 'Save the case paper first, then add prescriptions.');
      return;
    }
    try {
      await patientsApiService.createClinicalPrescription({
        patient_id: parseInt(patientId),
        appointment_id: selectedPaper?.id,
        medicines: [{ name: rxMedicine, dosage: rxDosage, duration: rxDuration, notes: rxNotes }],
      });
      setRxMedicine(''); setRxDosage(''); setRxDuration(''); setRxNotes('');
      setPrescriptionModal(false);
      fetchSubData(selectedPaper?.id?.toString());
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save prescription.');
    }
  };

  // ─── Lab order helpers ───────────────────────────────────
  const addLabOrder = async () => {
    if (!labWorkType.trim()) return;
    if (selectedPaper?.isNew) {
      Alert.alert('Save First', 'Save the case paper first, then add lab orders.');
      return;
    }
    try {
      await patientsApiService.createLabOrder({
        patient_id: parseInt(patientId),
        case_paper_id: selectedPaper?.id,
        vendor_name: labVendor || 'Lab',
        work_type: labWorkType,
        tooth_number: labTooth || null,
        shade: labShade || null,
        instructions: labInstructions || null,
        status: 'pending',
      });
      setLabVendor(''); setLabWorkType(''); setLabTooth(''); setLabShade(''); setLabInstructions('');
      setLabOrderModal(false);
      fetchSubData(selectedPaper?.id?.toString());
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create lab order.');
    }
  };

  // ─── Tooth update handler ────────────────────────────────
  const handleToothUpdate = (toothNum: number, toothData: any) => {
    setSessionTeethData((prev: any) => ({ ...prev, [toothNum]: toothData }));
  };

  // ─── Computed ────────────────────────────────────────────
  const casePrescriptions = prescriptions.filter(
    rx => rx.appointment_id === selectedPaper?.id || rx.appointment_id?.toString() === selectedPaper?.id?.toString()
  );

  // ═══════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════
  if (!selectedPaper) {
    return (
      <View style={{ flex: 1 }}>
        <View style={s.listHeader}>
          <Text style={s.listTitle}>Clinical Case Papers</Text>
          <TouchableOpacity style={s.newBtn} onPress={startNewCasePaper}>
            <Plus size={16} color="#fff" />
            <Text style={s.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : caseHistory.length === 0 ? (
          <View style={s.emptyState}>
            <FileText size={40} color="#D1D5DB" />
            <Text style={s.emptyTitle}>No case papers yet</Text>
            <Text style={s.emptySubtitle}>Start a new clinical session to begin charting.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            {caseHistory.map((paper, index) => (
              <TouchableOpacity key={paper.id} style={s.card} onPress={() => openCasePaper(paper)} activeOpacity={0.7}>
                <View style={s.cardTopRow}>
                  <View style={s.visitBadge}>
                    <Text style={s.visitBadgeText}>Visit #{caseHistory.length - index}</Text>
                  </View>
                  <View style={[s.statusBadge, paper.status === 'Completed' ? s.statusCompleted : s.statusProgress]}>
                    <Text style={[s.statusText, paper.status === 'Completed' ? s.statusTextCompleted : s.statusTextProgress]}>
                      {paper.status}
                    </Text>
                  </View>
                </View>
                <Text style={s.cardComplaint} numberOfLines={1}>
                  {Array.isArray(paper.chief_complaint) ? paper.chief_complaint.join(', ') : paper.chief_complaint || 'General Checkup'}
                </Text>
                <Text style={s.cardMeta}>
                  {fmtDate(paper.date)} • {paper.dentist?.name || paper.dentist_name || 'Doctor'}
                </Text>
                <View style={s.cardFooter}>
                  <Text style={s.cardLink}>Clinical Profile</Text>
                  <ChevronRight size={14} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SESSION VIEW
  // ═══════════════════════════════════════════════════════════
  const visitNum = selectedPaper.isNew
    ? caseHistory.length + 1
    : caseHistory.length - caseHistory.findIndex(p => p.id?.toString() === selectedPaper.id?.toString());

  return (
    <View style={{ flex: 1 }}>
      {/* Session Header */}
      <View style={s.sessionHeader}>
        <TouchableOpacity onPress={closeCasePaper} style={s.sessionBackBtn}>
          <ChevronLeft size={20} color="#6B7280" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.sessionTitle}>Case Paper #{visitNum}</Text>
            <View style={[s.statusBadge, selectedPaper.status === 'Completed' ? s.statusCompleted : s.statusProgress]}>
              <Text style={[s.statusText, selectedPaper.status === 'Completed' ? s.statusTextCompleted : s.statusTextProgress]}>
                {selectedPaper.status || 'In Progress'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Clock size={10} color="#9CA3AF" />
            <Text style={s.sessionMeta}>{fmtDate(selectedPaper.date)}</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 20 }} showsVerticalScrollIndicator={false}>

          {/* ─── 1. Clinical Examination ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Clinical Examination</Text>
            <PillInput label="Chief Complaints" values={form.chief_complaint}
              onChange={v => setForm(f => ({ ...f, chief_complaint: v }))} placeholder="e.g. Pain, Swelling" />
            <PillInput label="Medical History" values={form.medical_history}
              onChange={v => setForm(f => ({ ...f, medical_history: v }))} placeholder="e.g. Diabetes" />
            <PillInput label="Dental History" values={form.dental_history}
              onChange={v => setForm(f => ({ ...f, dental_history: v }))} placeholder="e.g. Previous RCT" />
            <PillInput label="Allergies" values={form.allergies}
              onChange={v => setForm(f => ({ ...f, allergies: v }))} placeholder="e.g. Penicillin" />
            <View style={s.pillSection}>
              <Text style={s.pillLabel}>Diagnosis</Text>
              <TextInput style={s.textArea} value={form.diagnosis}
                onChangeText={v => setForm(f => ({ ...f, diagnosis: v }))}
                placeholder="Enter diagnosis..." placeholderTextColor="#9CA3AF" multiline />
            </View>
          </View>

          {/* ─── 2. Dental Chart ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Dental Chart</Text>
            <DentalChart teethData={sessionTeethData} onToothUpdate={handleToothUpdate} />
          </View>

          {/* ─── 3. Treatment Plan ─── */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Treatment Plan</Text>
              <TouchableOpacity style={s.sectionAddBtn} onPress={() => setTreatmentModal(true)}>
                <Plus size={14} color={colors.primary} />
                <Text style={s.sectionAddText}>Add</Text>
              </TouchableOpacity>
            </View>
            {sessionTreatmentPlan.length === 0 ? (
              <Text style={s.emptyRow}>No treatments planned yet.</Text>
            ) : sessionTreatmentPlan.map((item: any, i: number) => (
              <View key={item.id || i} style={s.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.txProcedure}>{item.procedure}</Text>
                  <Text style={s.txDetail}>
                    {item.tooth ? `Tooth #${item.tooth}` : 'General'} • ₹{(item.cost || 0).toLocaleString('en-IN')} • {item.status}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeTreatment(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* ─── 4. Prescriptions ─── */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Prescriptions</Text>
              <TouchableOpacity style={s.sectionAddBtn} onPress={() => setPrescriptionModal(true)}>
                <Pill size={14} color={colors.primary} />
                <Text style={s.sectionAddText}>Add</Text>
              </TouchableOpacity>
            </View>
            {casePrescriptions.length === 0 ? (
              <Text style={s.emptyRow}>No prescriptions for this visit.</Text>
            ) : casePrescriptions.map((rx: any, i: number) => (
              <View key={rx.id || i} style={s.rxRow}>
                <Pill size={14} color="#10B981" />
                <View style={{ flex: 1 }}>
                  {(rx.medicines || []).map((m: any, mi: number) => (
                    <Text key={mi} style={s.rxText}>{m.name} — {m.dosage} × {m.duration}</Text>
                  ))}
                  {rx.medicines?.length === 0 && <Text style={s.rxText}>Prescription #{rx.id}</Text>}
                </View>
              </View>
            ))}
          </View>

          {/* ─── 5. Lab Orders ─── */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Lab Orders</Text>
              <TouchableOpacity style={s.sectionAddBtn} onPress={() => setLabOrderModal(true)}>
                <FlaskConical size={14} color={colors.primary} />
                <Text style={s.sectionAddText}>Add</Text>
              </TouchableOpacity>
            </View>
            {labOrders.length === 0 ? (
              <Text style={s.emptyRow}>No lab orders for this visit.</Text>
            ) : labOrders.map((lo: any, i: number) => (
              <View key={lo.id || i} style={s.loRow}>
                <FlaskConical size={14} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={s.loType}>{lo.work_type}</Text>
                  <Text style={s.loMeta}>{lo.vendor_name || 'Lab'} • {lo.status}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ─── 6. Documents ─── */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Documents</Text>
              <TouchableOpacity style={s.sectionAddBtn} onPress={() => Alert.alert('Coming Soon', 'Document upload from mobile is coming soon.')}>
                <Upload size={14} color={colors.primary} />
                <Text style={s.sectionAddText}>Upload</Text>
              </TouchableOpacity>
            </View>
            {documents.length === 0 ? (
              <Text style={s.emptyRow}>No documents attached.</Text>
            ) : documents.map((doc: any, i: number) => (
              <View key={doc.id || i} style={s.docRow}>
                <FileText size={14} color="#6366F1" />
                <Text style={s.docName} numberOfLines={1}>{doc.file_name || doc.name || `Document ${i + 1}`}</Text>
              </View>
            ))}
          </View>

          {/* ─── 7. Notes ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Clinical Notes</Text>
            <TextInput style={[s.textArea, { minHeight: 80 }]} value={form.notes}
              onChangeText={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Add clinical notes..." placeholderTextColor="#9CA3AF" multiline />
          </View>

          {/* ─── 8. Next Visit ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Next Visit Recommendation</Text>
            <TextInput style={s.fieldInput} value={form.next_visit_recommendation}
              onChangeText={v => setForm(f => ({ ...f, next_visit_recommendation: v }))}
              placeholder="e.g. 2 weeks" placeholderTextColor="#9CA3AF" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save Bar */}
      <View style={s.saveBar}>
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" />
            : <><Save size={16} color="#fff" /><Text style={s.saveBtnText}>Save Case Paper</Text></>}
        </TouchableOpacity>
      </View>

      {/* ─── Add Treatment Modal ─── */}
      <Modal visible={treatmentModal} transparent animationType="slide" onRequestClose={() => setTreatmentModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add Treatment</Text>
            <TextInput style={s.fieldInput} placeholder="Procedure *" placeholderTextColor="#9CA3AF" value={txProcedure} onChangeText={setTxProcedure} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Tooth #" placeholderTextColor="#9CA3AF" value={txTooth} onChangeText={setTxTooth} keyboardType="number-pad" />
              <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Cost (₹)" placeholderTextColor="#9CA3AF" value={txCost} onChangeText={setTxCost} keyboardType="numeric" />
            </View>
            <TextInput style={s.fieldInput} placeholder="Notes" placeholderTextColor="#9CA3AF" value={txNotes} onChangeText={setTxNotes} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setTreatmentModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={addTreatment}>
                <Text style={s.confirmBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Add Prescription Modal ─── */}
      <Modal visible={prescriptionModal} transparent animationType="slide" onRequestClose={() => setPrescriptionModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add Prescription</Text>
            <TextInput style={s.fieldInput} placeholder="Medicine *" placeholderTextColor="#9CA3AF" value={rxMedicine} onChangeText={setRxMedicine} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Dosage" placeholderTextColor="#9CA3AF" value={rxDosage} onChangeText={setRxDosage} />
              <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Duration" placeholderTextColor="#9CA3AF" value={rxDuration} onChangeText={setRxDuration} />
            </View>
            <TextInput style={s.fieldInput} placeholder="Notes" placeholderTextColor="#9CA3AF" value={rxNotes} onChangeText={setRxNotes} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setPrescriptionModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={addPrescription}>
                <Text style={s.confirmBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Add Lab Order Modal ─── */}
      <Modal visible={labOrderModal} transparent animationType="slide" onRequestClose={() => setLabOrderModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>New Lab Order</Text>
            <TextInput style={s.fieldInput} placeholder="Work Type *" placeholderTextColor="#9CA3AF" value={labWorkType} onChangeText={setLabWorkType} />
            <TextInput style={s.fieldInput} placeholder="Vendor / Lab Name" placeholderTextColor="#9CA3AF" value={labVendor} onChangeText={setLabVendor} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Tooth #" placeholderTextColor="#9CA3AF" value={labTooth} onChangeText={setLabTooth} keyboardType="number-pad" />
              <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Shade" placeholderTextColor="#9CA3AF" value={labShade} onChangeText={setLabShade} />
            </View>
            <TextInput style={[s.fieldInput]} placeholder="Instructions" placeholderTextColor="#9CA3AF" value={labInstructions} onChangeText={setLabInstructions} multiline />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setLabOrderModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={addLabOrder}>
                <Text style={s.confirmBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // List
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  listTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  newBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  // Card
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  visitBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  visitBadgeText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8', letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusCompleted: { backgroundColor: '#F0FDF4' },
  statusProgress: { backgroundColor: '#FFFBEB' },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusTextCompleted: { color: '#15803D' },
  statusTextProgress: { color: '#B45309' },
  cardComplaint: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#6B7280', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cardLink: { fontSize: 13, fontWeight: '600', color: colors.primary },
  // Session header
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sessionBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  sessionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sessionMeta: { fontSize: 11, color: '#9CA3AF' },
  // Sections
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.primary },
  sectionAddText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  emptyRow: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  // Pill input
  pillSection: { marginBottom: 12 },
  pillLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  pillText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  pillInputRow: { flexDirection: 'row', gap: 8 },
  pillInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#111827' },
  pillAddBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  // Fields
  textArea: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#111827', textAlignVertical: 'top' },
  fieldInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#111827', marginBottom: 10 },
  // Treatment rows
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  txProcedure: { fontSize: 14, fontWeight: '600', color: '#111827' },
  txDetail: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  // Prescription rows
  rxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  rxText: { fontSize: 13, color: '#374151' },
  // Lab order rows
  loRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  loType: { fontSize: 13, fontWeight: '600', color: '#111827' },
  loMeta: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  // Document rows
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  docName: { fontSize: 13, color: '#374151', flex: 1 },
  // Save bar
  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
