import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  Plus, ChevronLeft, ChevronRight, Clock, FileText, FlaskConical,
  Pill, Upload, Save, X, Check, Trash2, Receipt, Eye, Edit3,
} from 'lucide-react-native';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { colors } from '../../../../shared/constants/colors';
import { DentalChart } from './DentalChart';
import { WhatsAppIcon } from '../../../../shared/components/icons/WhatsAppIcon';

// ─── Constants ────────────────────────────────────────────────
const NEXT_VISIT_OPTIONS = [
  'Not specified',
  'Review After 1 Week',
  'Review After 15 Days',
  'Review After 1 Month',
  'SOS (If Pain / Swelling)',
  'No Further Treatment',
];

const PAYMENT_MODES = [
  { key: 'cash',         label: 'Cash' },
  { key: 'card',         label: 'Card' },
  { key: 'upi',          label: 'UPI' },
  { key: 'bank_transfer',label: 'Bank Transfer' },
  { key: 'other',        label: 'Other' },
];

const INVOICE_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:           { label: 'Draft',          color: '#92400E', bg: '#FEF3C7' },
  finalized:       { label: 'Finalized',       color: '#1D4ED8', bg: '#DBEAFE' },
  partially_paid:  { label: 'Part Paid',       color: '#7C3AED', bg: '#EDE9FE' },
  paid:            { label: 'Paid',            color: '#065F46', bg: '#D1FAE5' },
  paid_verified:   { label: 'Paid',            color: '#065F46', bg: '#D1FAE5' },
  paid_unverified: { label: 'Paid',            color: '#065F46', bg: '#D1FAE5' },
};

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

interface RxMedicine {
  name: string;
  dosage: string;
  duration: string;
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

const EMPTY_MED: RxMedicine = { name: '', dosage: '', duration: '', notes: '' };

// ─── Pill Tag Input (with inline suggestions) ─────────────────
const PillInput: React.FC<{
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}> = ({ label, values, onChange, placeholder, suggestions = [] }) => {
  const [text, setText] = useState('');

  const addValue = (val: string) => {
    const t = val.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setText('');
  };

  // Show top-5 defaults when empty; filter when typing
  const visibleSuggestions = text.trim().length > 0
    ? suggestions.filter(sg => sg.toLowerCase().includes(text.toLowerCase()) && !values.includes(sg))
    : suggestions.filter(sg => !values.includes(sg)).slice(0, 5);

  return (
    <View style={s.pillSection}>
      <Text style={s.pillLabel}>{label}</Text>
      {values.length > 0 && (
        <View style={s.pillWrap}>
          {values.map((v, i) => (
            <TouchableOpacity key={i} style={s.pill} onPress={() => onChange(values.filter((_, idx) => idx !== i))}>
              <Text style={s.pillText}>{v}</Text>
              <X size={10} color="#6B7280" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={s.pillInputRow}>
        <TextInput
          style={s.pillInput}
          value={text}
          onChangeText={setText}
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
          placeholderTextColor="#9CA3AF"
          onSubmitEditing={() => addValue(text)}
          returnKeyType="done"
        />
        {text.trim() ? (
          <TouchableOpacity style={s.pillAddBtn} onPress={() => addValue(text)}>
            <Plus size={14} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
      {/* Inline suggestion chips — no z-index issues */}
      {visibleSuggestions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }} keyboardShouldPersistTaps="handled">
          {visibleSuggestions.map((sg, i) => (
            <TouchableOpacity key={i} style={s.suggestChip} onPress={() => addValue(sg)}>
              <Text style={s.suggestChipText}>{sg}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// ─── Suggestion TextArea (diagnosis / clinical notes) ──────────
const SuggestionTextArea: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suggestions?: string[];
  minHeight?: number;
}> = ({ label, value, onChange, placeholder, suggestions = [], minHeight = 70 }) => {
  const visible = value.trim().length > 0
    ? suggestions.filter(sg => sg.toLowerCase().includes(value.toLowerCase()) && sg.toLowerCase() !== value.toLowerCase())
    : suggestions.slice(0, 6);

  return (
    <View style={s.pillSection}>
      <Text style={s.pillLabel}>{label}</Text>
      <TextInput
        style={[s.textArea, { minHeight }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        placeholderTextColor="#9CA3AF"
        multiline
      />
      {visible.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }} keyboardShouldPersistTaps="handled">
          {visible.map((sg, i) => (
            <TouchableOpacity key={i} style={s.suggestChip} onPress={() => onChange(sg)}>
              <Text style={s.suggestChipText}>{sg}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
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
  const [invoice, setInvoice] = useState<any | null>(null);
  const [sendingRxId, setSendingRxId] = useState<number | string | null>(null);

  const handleSendPrescriptionWhatsApp = async (rxId: number | string) => {
    if (sendingRxId) return;
    setSendingRxId(rxId);
    try {
      await patientsApiService.sendPrescriptionWhatsApp(rxId);
      Alert.alert('Sent', 'Prescription sent to patient via WhatsApp.');
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('phone')) {
        Alert.alert('Patient phone missing', 'Add the patient’s phone number to send via WhatsApp.');
      } else {
        Alert.alert('Failed to send', e?.message || 'Could not send prescription. Please try again.');
      }
    } finally {
      setSendingRxId(null);
    }
  };

  // ─── Modals ──────────────────────────────────────────────
  const [treatmentModal, setTreatmentModal] = useState(false);
  const [prescriptionModal, setPrescriptionModal] = useState(false);
  const [labOrderModal, setLabOrderModal] = useState(false);
  const [nextVisitModal, setNextVisitModal] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);

  // ─── Treatment form ──────────────────────────────────────
  const [txProcedure, setTxProcedure] = useState('');
  const [txTooth, setTxTooth] = useState('');
  const [txCost, setTxCost] = useState('');
  const [txNotes, setTxNotes] = useState('');

  // ─── Prescription form ───────────────────────────────────
  const [rxMode, setRxMode] = useState<'edit' | 'preview'>('edit');
  const [rxMedicines, setRxMedicines] = useState<RxMedicine[]>([]);
  const [rxDraft, setRxDraft] = useState<RxMedicine>({ ...EMPTY_MED });
  const [rxNotes, setRxNotes] = useState('');
  const [masterMeds, setMasterMeds] = useState<{ id: number; name: string; dosage?: string; duration?: string }[]>([]);
  const [showMedSuggest, setShowMedSuggest] = useState(false);
  const [filteredMeds, setFilteredMeds] = useState<any[]>([]);

  // ─── Clinical suggestions (autocomplete) ─────────────────
  const [clinicalSuggestions, setClinicalSuggestions] = useState<Record<string, string[]>>({});

  const loadClinicalSuggestions = useCallback(async () => {
    if (Object.keys(clinicalSuggestions).length > 0) return;
    try {
      const [complaint, medHist, dentalHist, allergy, diagnosis] = await Promise.all([
        patientsApiService.getClinicalSuggestions('complaint'),
        patientsApiService.getClinicalSuggestions('medical_history'),
        patientsApiService.getClinicalSuggestions('dental_history'),
        patientsApiService.getClinicalSuggestions('allergy'),
        patientsApiService.getClinicalSuggestions('diagnosis'),
      ]);
      setClinicalSuggestions({
        complaint:      complaint.map(s => s.name),
        medical_history: medHist.map(s => s.name),
        dental_history:  dentalHist.map(s => s.name),
        allergy:         allergy.map(s => s.name),
        diagnosis:       diagnosis.map(s => s.name),
      });
    } catch { /* silent — suggestions are optional */ }
  }, [clinicalSuggestions]);

  // ─── Lab order form ──────────────────────────────────────
  const [labVendor, setLabVendor] = useState('');
  const [labWorkType, setLabWorkType] = useState('');
  const [labTooth, setLabTooth] = useState('');
  const [labShade, setLabShade] = useState('');
  const [labInstructions, setLabInstructions] = useState('');

  // ─── Invoice state ───────────────────────────────────────
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('cash');

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
      const [lo, invs] = await Promise.all([
        patientsApiService.getLabOrders(paperId),
        patientsApiService.getInvoicesByAppointment(patientId, paperId),
      ]);
      setLabOrders(Array.isArray(lo) ? lo : []);
      setInvoice(invs.length > 0 ? invs[0] : null);
      if (invs.length > 0) setDiscount(String(invs[0].discount || 0));
    } else {
      setLabOrders([]);
      setInvoice(null);
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
    loadClinicalSuggestions();
  };

  const startNewCasePaper = () => {
    const newPaper = { id: 'new-' + Date.now(), date: new Date().toISOString(), status: 'In Progress', isNew: true };
    setSelectedPaper(newPaper);
    setForm({ ...EMPTY_FORM });
    loadClinicalSuggestions();
    setSessionTeethData(patient.dentalChart || {});
    setSessionToothNotes(patient.toothNotes || {});
    setSessionTreatmentPlan(patient.treatmentPlan || []);
    setPrescriptions([]);
    setLabOrders([]);
    setDocuments([]);
    setInvoice(null);
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
      await patientsApiService.updatePatient(patientId, {
        dental_chart: sessionTeethData,
        treatment_plan: sessionTreatmentPlan,
        tooth_notes: sessionToothNotes,
      });
      Alert.alert('Saved', 'Case paper saved successfully.');
      closeCasePaper();
      fetchCasePapers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save case paper.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Treatment plan ──────────────────────────────────────
  const addTreatment = () => {
    if (!txProcedure.trim()) return;
    setSessionTreatmentPlan(prev => [...prev, {
      id: Date.now() + Math.random(),
      procedure: txProcedure,
      tooth: txTooth ? parseInt(txTooth) : null,
      cost: txCost ? parseFloat(txCost) : 0,
      notes: txNotes,
      status: 'planned',
      date: new Date().toISOString().split('T')[0],
    }]);
    setTxProcedure(''); setTxTooth(''); setTxCost(''); setTxNotes('');
    setTreatmentModal(false);
  };

  const addTreatmentFromTooth = (item: any) => {
    setSessionTreatmentPlan(prev => [...prev, {
      id: Date.now() + Math.random(),
      ...item,
      date: new Date().toISOString().split('T')[0],
    }]);
  };

  const handleToothNotesChange = (toothNum: number, notes: string) => {
    setSessionToothNotes((prev: any) => ({ ...prev, [toothNum]: notes }));
  };

  const cycleTreatmentStatus = (id: number) => {
    setSessionTreatmentPlan(prev => prev.map(item => {
      if (item.id !== id) return item;
      const next: Record<string, string> = { planned: 'in-progress', 'in-progress': 'completed', completed: 'planned' };
      return { ...item, status: next[item.status] || 'planned' };
    }));
  };

  const removeTreatment = (id: number) => {
    setSessionTreatmentPlan(prev => prev.filter(p => p.id !== id));
  };

  // ─── Prescriptions ───────────────────────────────────────
  const openPrescriptionModal = async () => {
    setRxMode('edit');
    setRxMedicines([]);
    setRxDraft({ ...EMPTY_MED });
    setRxNotes('');
    setPrescriptionModal(true);
    if (masterMeds.length === 0) {
      const meds = await patientsApiService.getMedications();
      setMasterMeds(meds);
    }
  };

  const addMedRow = () => {
    if (!rxDraft.name.trim()) return;
    setRxMedicines(prev => [...prev, { ...rxDraft }]);
    setRxDraft({ ...EMPTY_MED });
  };

  const savePrescription = async () => {
    const allMeds = rxDraft.name.trim()
      ? [...rxMedicines, { ...rxDraft }]
      : rxMedicines;
    if (allMeds.length === 0) {
      Alert.alert('Add Medicines', 'Please add at least one medicine.');
      return;
    }
    if (selectedPaper?.isNew) {
      Alert.alert('Save First', 'Save the case paper first, then add prescriptions.');
      return;
    }
    try {
      await patientsApiService.createClinicalPrescription({
        patient_id: parseInt(patientId),
        appointment_id: selectedPaper?.id,
        medicines: allMeds,
        notes: rxNotes,
      });
      setPrescriptionModal(false);
      fetchSubData(selectedPaper?.id?.toString());
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save prescription.');
    }
  };

  // ─── Lab orders ──────────────────────────────────────────
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

  // ─── Invoice ─────────────────────────────────────────────
  const openInvoice = async () => {
    if (selectedPaper?.isNew) {
      Alert.alert('Save First', 'Save the case paper first, then create an invoice.');
      return;
    }
    setInvoiceLoading(true);
    try {
      if (!invoice) {
        const lineItems = sessionTreatmentPlan
          .filter(t => t.cost > 0 && t.status === 'completed')
          .map(t => ({
            description: t.procedure + (t.tooth ? ` (Tooth #${t.tooth})` : ''),
            quantity: 1,
            unit_price: t.cost,
          }));
        const newInv = await patientsApiService.createInvoice({
          patient_id: parseInt(patientId),
          appointment_id: parseInt(selectedPaper.id),
          notes: `Case Paper #${visitNum}`,
          line_items: lineItems.length > 0 ? lineItems : undefined,
        });
        setInvoice(newInv);
        setDiscount(String(newInv.discount || 0));
      }
      setInvoiceModal(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to open invoice.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const addInvoiceItem = async () => {
    if (!newItemDesc.trim() || !newItemPrice.trim()) return;
    setInvoiceSaving(true);
    try {
      const updated = await patientsApiService.addInvoiceLineItem(invoice.id.toString(), {
        description: newItemDesc,
        quantity: parseInt(newItemQty) || 1,
        unit_price: parseFloat(newItemPrice),
      });
      setInvoice(updated);
      setNewItemDesc(''); setNewItemQty('1'); setNewItemPrice('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add item.');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const removeInvoiceItem = async (lineItemId: string) => {
    try {
      await patientsApiService.deleteInvoiceLineItem(invoice.id.toString(), lineItemId);
      setInvoice((prev: any) => ({
        ...prev,
        line_items: prev.line_items.filter((li: any) => li.id.toString() !== lineItemId),
      }));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove item.');
    }
  };

  const handleFinalize = async () => {
    Alert.alert('Generate Invoice', 'This will lock the invoice. You won\'t be able to edit items after this.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Generate', style: 'default', onPress: async () => {
          setInvoiceSaving(true);
          try {
            const updated = await patientsApiService.finalizeInvoice(invoice.id.toString());
            setInvoice(updated);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to finalize invoice.');
          } finally {
            setInvoiceSaving(false);
          }
        },
      },
    ]);
  };

  const handleMarkPaid = async () => {
    setInvoiceSaving(true);
    setPaymentModal(false);
    try {
      const updated = await patientsApiService.markInvoicePaid(invoice.id.toString(), paymentMode);
      setInvoice(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to mark as paid.');
    } finally {
      setInvoiceSaving(false);
    }
  };

  // ─── Tooth update ────────────────────────────────────────
  const handleToothUpdate = (toothNum: number, toothData: any) => {
    setSessionTeethData((prev: any) => ({ ...prev, [toothNum]: toothData }));
  };

  // ─── Computed ────────────────────────────────────────────
  const casePrescriptions = prescriptions.filter(
    rx => rx.appointment_id === selectedPaper?.id ||
      rx.appointment_id?.toString() === selectedPaper?.id?.toString()
  );

  const invoiceSubtotal = (invoice?.line_items || []).reduce(
    (sum: number, li: any) => sum + (li.quantity || 1) * (li.unit_price || 0), 0
  );
  const invoiceTotal = Math.max(0, invoiceSubtotal - (parseFloat(discount) || 0));

  const invMeta = INVOICE_STATUS_META[invoice?.status] || INVOICE_STATUS_META.draft;
  const invoiceIsDraft = !invoice?.status || invoice.status === 'draft';
  const invoiceIsFinalized = invoice?.status === 'finalized';
  const invoiceIsPaid = ['paid', 'paid_verified', 'paid_unverified', 'partially_paid'].includes(invoice?.status);

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
                  {fmtDate(paper.date)} · {paper.dentist?.name || paper.dentist_name || 'Doctor'}
                </Text>
                <View style={s.cardFooter}>
                  <Text style={s.cardLink}>Open Case Paper</Text>
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
              onChange={v => setForm(f => ({ ...f, chief_complaint: v }))}
              placeholder="e.g. Pain, Swelling"
              suggestions={clinicalSuggestions.complaint} />
            <PillInput label="Medical History" values={form.medical_history}
              onChange={v => setForm(f => ({ ...f, medical_history: v }))}
              placeholder="e.g. Diabetes"
              suggestions={clinicalSuggestions.medical_history} />
            <PillInput label="Dental History" values={form.dental_history}
              onChange={v => setForm(f => ({ ...f, dental_history: v }))}
              placeholder="e.g. Previous RCT"
              suggestions={clinicalSuggestions.dental_history} />
            <PillInput label="Allergies" values={form.allergies}
              onChange={v => setForm(f => ({ ...f, allergies: v }))}
              placeholder="e.g. Penicillin"
              suggestions={clinicalSuggestions.allergy} />
            <SuggestionTextArea
              label="Diagnosis"
              value={form.diagnosis}
              onChange={v => setForm(f => ({ ...f, diagnosis: v }))}
              placeholder="Enter diagnosis..."
              suggestions={clinicalSuggestions.diagnosis} />
          </View>

          {/* ─── 2. Dental Chart ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Dental Chart</Text>
            <DentalChart
              teethData={sessionTeethData}
              toothNotes={sessionToothNotes}
              onToothUpdate={handleToothUpdate}
              onNotesChange={handleToothNotesChange}
              onAddTreatment={addTreatmentFromTooth}
            />
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
            ) : sessionTreatmentPlan.map((item: any, i: number) => {
              const txStatus: Record<string, { label: string; color: string; bg: string }> = {
                planned:     { label: 'Plan',       color: '#92400E', bg: '#FEF3C7' },
                'in-progress': { label: 'In Progress', color: '#1D4ED8', bg: '#DBEAFE' },
                completed:   { label: 'Complete',   color: '#065F46', bg: '#D1FAE5' },
              };
              const sm = txStatus[item.status] || txStatus.planned;
              return (
                <TouchableOpacity
                  key={item.id || i}
                  style={s.txRow}
                  onPress={() => cycleTreatmentStatus(item.id)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <Text style={s.txProcedure}>{item.procedure}</Text>
                      <View style={[s.txStatusBadge, { backgroundColor: sm.bg }]}>
                        <Text style={[s.txStatusText, { color: sm.color }]}>{sm.label}</Text>
                      </View>
                    </View>
                    <Text style={s.txDetail}>
                      {item.tooth ? `Tooth #${item.tooth}` : 'General'}
                      {item.cost > 0 ? ` · ₹${(item.cost || 0).toLocaleString('en-IN')}` : ''}
                      {item.diagnosis ? ` · ${item.diagnosis}` : ''}
                    </Text>
                    <Text style={s.txTapHint}>Tap to cycle status</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeTreatment(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ─── 4. Prescriptions ─── */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Prescriptions</Text>
              <TouchableOpacity style={s.sectionAddBtn} onPress={openPrescriptionModal}>
                <Pill size={14} color={colors.primary} />
                <Text style={s.sectionAddText}>{casePrescriptions.length > 0 ? 'View / Edit' : 'Add'}</Text>
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
                  {(!rx.medicines || rx.medicines.length === 0) && <Text style={s.rxText}>Prescription #{rx.id}</Text>}
                </View>
                {rx.id ? (
                  <TouchableOpacity
                    onPress={() => handleSendPrescriptionWhatsApp(rx.id)}
                    disabled={sendingRxId === rx.id}
                    style={{ padding: 6, opacity: sendingRxId === rx.id ? 0.5 : 1 }}
                    accessibilityLabel="Send prescription via WhatsApp"
                  >
                    {sendingRxId === rx.id
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <WhatsAppIcon size={18} />}
                  </TouchableOpacity>
                ) : null}
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
                  <Text style={s.loMeta}>{lo.vendor_name || 'Lab'} · {lo.status}</Text>
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

          {/* ─── 7. Clinical Notes ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Clinical Notes</Text>
            <TextInput style={[s.textArea, { minHeight: 80 }]} value={form.notes}
              onChangeText={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Add clinical notes..." placeholderTextColor="#9CA3AF" multiline />
          </View>

          {/* ─── 8. Next Visit ─── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Next Visit</Text>
            <TouchableOpacity style={s.nextVisitBtn} onPress={() => setNextVisitModal(true)} activeOpacity={0.7}>
              <Clock size={14} color={colors.primary} />
              <Text style={s.nextVisitBtnText}>{form.next_visit_recommendation || 'Not specified'}</Text>
              <ChevronRight size={14} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Action Bar ─── */}
      <View style={s.actionBar}>
        {/* Save */}
        <TouchableOpacity style={s.actionSave} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <><Save size={15} color={colors.primary} /><Text style={s.actionSaveText}>Save</Text></>}
        </TouchableOpacity>

        {/* Prescription */}
        <TouchableOpacity style={s.actionBtn} onPress={openPrescriptionModal} activeOpacity={0.8}>
          <Pill size={15} color="#10B981" />
          <Text style={[s.actionBtnText, { color: '#10B981' }]}>Rx</Text>
          {casePrescriptions.length > 0 && (
            <View style={s.actionBadge}><Text style={s.actionBadgeText}>{casePrescriptions.length}</Text></View>
          )}
        </TouchableOpacity>

        {/* Invoice */}
        <TouchableOpacity
          style={[s.actionBtn, invoice && { borderColor: invMeta.color + '40' }]}
          onPress={openInvoice}
          disabled={invoiceLoading}
          activeOpacity={0.8}
        >
          {invoiceLoading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <>
              <Receipt size={15} color={invoice ? invMeta.color : colors.textMuted} />
              <Text style={[s.actionBtnText, invoice && { color: invMeta.color }]}>
                {invoice ? invMeta.label : 'Invoice'}
              </Text>
            </>}
        </TouchableOpacity>
      </View>

      {/* ════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════ */}

      {/* ─── Add Treatment ─── */}
      <Modal visible={treatmentModal} transparent animationType="slide" onRequestClose={() => setTreatmentModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.modalSheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Add Treatment</Text>
              <TextInput style={s.fieldInput} placeholder="Procedure *" placeholderTextColor="#9CA3AF" value={txProcedure} onChangeText={setTxProcedure} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Tooth #" placeholderTextColor="#9CA3AF" value={txTooth} onChangeText={setTxTooth} keyboardType="number-pad" />
                <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Cost (₹)" placeholderTextColor="#9CA3AF" value={txCost} onChangeText={setTxCost} keyboardType="numeric" />
              </View>
              <TextInput style={s.fieldInput} placeholder="Notes" placeholderTextColor="#9CA3AF" value={txNotes} onChangeText={setTxNotes} />
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setTreatmentModal(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.confirmBtn} onPress={addTreatment}>
                  <Text style={s.confirmBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Prescription (Edit / Preview) ─── */}
      <Modal visible={prescriptionModal} transparent animationType="slide" onRequestClose={() => setPrescriptionModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={[s.modalSheet, { maxHeight: '85%' }]}>
              <View style={s.sheetHandle} />

              {/* Header with mode toggle */}
              <View style={s.rxHeader}>
                <Text style={s.sheetTitle}>Prescription</Text>
                <View style={s.rxModeTabs}>
                  <TouchableOpacity
                    style={[s.rxModeTab, rxMode === 'edit' && s.rxModeTabActive]}
                    onPress={() => setRxMode('edit')}
                  >
                    <Edit3 size={12} color={rxMode === 'edit' ? colors.primary : '#9CA3AF'} />
                    <Text style={[s.rxModeTabText, rxMode === 'edit' && { color: colors.primary }]}>New</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.rxModeTab, rxMode === 'preview' && s.rxModeTabActive]}
                    onPress={() => setRxMode('preview')}
                  >
                    <Eye size={12} color={rxMode === 'preview' ? colors.primary : '#9CA3AF'} />
                    <Text style={[s.rxModeTabText, rxMode === 'preview' && { color: colors.primary }]}>
                      History {casePrescriptions.length > 0 ? `(${casePrescriptions.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                {rxMode === 'edit' ? (
                  <View style={{ gap: 12 }}>
                    {/* Added medicines */}
                    {rxMedicines.map((m, i) => (
                      <View key={i} style={s.rxAddedRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rxAddedName}>{m.name}</Text>
                          <Text style={s.rxAddedDetail}>{m.dosage}{m.duration ? ` · ${m.duration}` : ''}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setRxMedicines(prev => prev.filter((_, idx) => idx !== i))}>
                          <X size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* Input row for new medicine */}
                    <View style={s.rxInputCard}>
                      <Text style={s.rxInputLabel}>Medicine Name *</Text>
                      <View style={s.medSuggestWrap}>
                        <TextInput
                          style={s.fieldInput}
                          placeholder="e.g. Amoxicillin 500mg"
                          placeholderTextColor="#9CA3AF"
                          value={rxDraft.name}
                          onChangeText={v => {
                            setRxDraft(d => ({ ...d, name: v }));
                            if (v.trim().length > 1) {
                              setFilteredMeds(masterMeds.filter(m => m.name.toLowerCase().includes(v.toLowerCase())));
                              setShowMedSuggest(true);
                            } else {
                              setShowMedSuggest(false);
                            }
                          }}
                          onBlur={() => setTimeout(() => setShowMedSuggest(false), 150)}
                        />
                        {showMedSuggest && filteredMeds.length > 0 && (
                          <ScrollView style={s.medSuggestDropdown} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                            {filteredMeds.map((m, i) => (
                              <TouchableOpacity
                                key={m.id || i}
                                style={s.medSuggestRow}
                                onPress={() => {
                                  setRxDraft(d => ({
                                    ...d,
                                    name: m.name,
                                    dosage: m.dosage || d.dosage,
                                    duration: m.duration || d.duration,
                                  }));
                                  setShowMedSuggest(false);
                                }}
                              >
                                <Text style={s.medSuggestName}>{m.name}</Text>
                                {(m.dosage || m.duration) && (
                                  <Text style={s.medSuggestMeta}>{[m.dosage, m.duration].filter(Boolean).join(' · ')}</Text>
                                )}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rxInputLabel}>Dosage</Text>
                          <TextInput style={s.fieldInput} placeholder="1-0-1" placeholderTextColor="#9CA3AF"
                            value={rxDraft.dosage} onChangeText={v => setRxDraft(d => ({ ...d, dosage: v }))} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rxInputLabel}>Duration</Text>
                          <TextInput style={s.fieldInput} placeholder="5 days" placeholderTextColor="#9CA3AF"
                            value={rxDraft.duration} onChangeText={v => setRxDraft(d => ({ ...d, duration: v }))} />
                        </View>
                      </View>
                      <TouchableOpacity style={s.rxAddMedBtn} onPress={addMedRow}>
                        <Plus size={14} color={colors.primary} />
                        <Text style={s.rxAddMedText}>Add Another Medicine</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={s.pillSection}>
                      <Text style={s.pillLabel}>General Notes / Instructions</Text>
                      <TextInput style={[s.textArea, { minHeight: 60 }]} value={rxNotes}
                        onChangeText={setRxNotes} placeholder="e.g. Take after food, avoid cold drinks..."
                        placeholderTextColor="#9CA3AF" multiline />
                    </View>
                  </View>
                ) : (
                  /* Preview mode */
                  <View style={{ gap: 12 }}>
                    {casePrescriptions.length === 0 ? (
                      <Text style={s.emptyRow}>No prescriptions for this visit yet.</Text>
                    ) : casePrescriptions.map((rx: any, i: number) => (
                      <View key={rx.id || i} style={s.rxPreviewCard}>
                        <Text style={s.rxPreviewDate}>Rx #{i + 1} · {fmtDate(rx.created_at || rx.date || '')}</Text>
                        {(rx.medicines || []).map((m: any, mi: number) => (
                          <View key={mi} style={s.rxPreviewRow}>
                            <Pill size={12} color="#10B981" />
                            <View style={{ flex: 1 }}>
                              <Text style={s.rxPreviewMed}>{m.name}</Text>
                              {(m.dosage || m.duration) && (
                                <Text style={s.rxPreviewDetail}>
                                  {[m.dosage, m.duration, m.notes].filter(Boolean).join(' · ')}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                        {rx.notes ? <Text style={s.rxPreviewNotes}>{rx.notes}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setPrescriptionModal(false)}>
                  <Text style={s.cancelBtnText}>Close</Text>
                </TouchableOpacity>
                {rxMode === 'edit' && (
                  <TouchableOpacity style={s.confirmBtn} onPress={savePrescription}>
                    <Text style={s.confirmBtnText}>Save Rx</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Lab Order ─── */}
      <Modal visible={labOrderModal} transparent animationType="slide" onRequestClose={() => setLabOrderModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.modalSheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>New Lab Order</Text>
              <TextInput style={s.fieldInput} placeholder="Work Type *" placeholderTextColor="#9CA3AF" value={labWorkType} onChangeText={setLabWorkType} />
              <TextInput style={s.fieldInput} placeholder="Vendor / Lab Name" placeholderTextColor="#9CA3AF" value={labVendor} onChangeText={setLabVendor} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Tooth #" placeholderTextColor="#9CA3AF" value={labTooth} onChangeText={setLabTooth} keyboardType="number-pad" />
                <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="Shade" placeholderTextColor="#9CA3AF" value={labShade} onChangeText={setLabShade} />
              </View>
              <TextInput style={s.fieldInput} placeholder="Instructions" placeholderTextColor="#9CA3AF" value={labInstructions} onChangeText={setLabInstructions} multiline />
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setLabOrderModal(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.confirmBtn} onPress={addLabOrder}>
                  <Text style={s.confirmBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Next Visit Picker ─── */}
      <Modal visible={nextVisitModal} transparent animationType="slide" onRequestClose={() => setNextVisitModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Next Visit</Text>
            {NEXT_VISIT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={s.nextVisitOption}
                onPress={() => { setForm(f => ({ ...f, next_visit_recommendation: opt })); setNextVisitModal(false); }}
              >
                <Text style={[s.nextVisitOptionText, form.next_visit_recommendation === opt && s.nextVisitOptionActive]}>
                  {opt}
                </Text>
                {form.next_visit_recommendation === opt && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.cancelBtn, { marginTop: 8 }]} onPress={() => setNextVisitModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Invoice Modal ─── */}
      <Modal visible={invoiceModal} transparent animationType="slide" onRequestClose={() => setInvoiceModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={[s.modalSheet, { maxHeight: '90%' }]}>
              <View style={s.sheetHandle} />

              {/* Invoice header */}
              <View style={s.invHeader}>
                <View>
                  <Text style={s.sheetTitle}>Invoice</Text>
                  {invoice?.invoice_number && <Text style={s.invNum}>#{invoice.invoice_number}</Text>}
                </View>
                {invoice && (
                  <View style={[s.invStatusBadge, { backgroundColor: invMeta.bg }]}>
                    <Text style={[s.invStatusText, { color: invMeta.color }]}>{invMeta.label}</Text>
                  </View>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>

                {/* Line items */}
                <Text style={s.invSectionLabel}>ITEMS</Text>
                {(invoice?.line_items || []).length === 0 ? (
                  <Text style={s.emptyRow}>No items yet.</Text>
                ) : (invoice?.line_items || []).map((li: any) => (
                  <View key={li.id} style={s.invLineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.invLineDesc}>{li.description}</Text>
                      <Text style={s.invLineMeta}>{li.quantity} × ₹{li.unit_price?.toLocaleString('en-IN')}</Text>
                    </View>
                    <Text style={s.invLineAmt}>₹{((li.quantity || 1) * (li.unit_price || 0)).toLocaleString('en-IN')}</Text>
                    {invoiceIsDraft && (
                      <TouchableOpacity onPress={() => removeInvoiceItem(li.id.toString())} style={{ marginLeft: 8 }}>
                        <Trash2 size={14} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* Add line item (draft only) */}
                {invoiceIsDraft && (
                  <View style={s.invAddRow}>
                    <TextInput style={[s.fieldInput, { flex: 2 }]} placeholder="Description" placeholderTextColor="#9CA3AF"
                      value={newItemDesc} onChangeText={setNewItemDesc} />
                    <TextInput style={[s.fieldInput, { flex: 0.6 }]} placeholder="Qty" placeholderTextColor="#9CA3AF"
                      value={newItemQty} onChangeText={setNewItemQty} keyboardType="number-pad" />
                    <TextInput style={[s.fieldInput, { flex: 1 }]} placeholder="₹ Price" placeholderTextColor="#9CA3AF"
                      value={newItemPrice} onChangeText={setNewItemPrice} keyboardType="numeric" />
                    <TouchableOpacity style={s.invAddBtn} onPress={addInvoiceItem} disabled={invoiceSaving}>
                      <Plus size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Totals */}
                <View style={s.invTotals}>
                  <View style={s.invTotalRow}>
                    <Text style={s.invTotalLabel}>Subtotal</Text>
                    <Text style={s.invTotalValue}>₹{invoiceSubtotal.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={s.invTotalRow}>
                    <Text style={s.invTotalLabel}>Discount</Text>
                    {invoiceIsDraft ? (
                      <TextInput
                        style={s.discountInput}
                        value={discount}
                        onChangeText={setDiscount}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                      />
                    ) : (
                      <Text style={s.invTotalValue}>₹{(parseFloat(discount) || 0).toLocaleString('en-IN')}</Text>
                    )}
                  </View>
                  <View style={[s.invTotalRow, s.invGrandTotal]}>
                    <Text style={s.invGrandLabel}>Total</Text>
                    <Text style={s.invGrandValue}>₹{invoiceTotal.toLocaleString('en-IN')}</Text>
                  </View>
                </View>

              </ScrollView>

              {/* Action buttons */}
              <View style={s.invActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setInvoiceModal(false)}>
                  <Text style={s.cancelBtnText}>Close</Text>
                </TouchableOpacity>

                {invoiceIsDraft && (
                  <TouchableOpacity style={s.confirmBtn} onPress={handleFinalize} disabled={invoiceSaving}>
                    {invoiceSaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.confirmBtnText}>Generate Invoice</Text>}
                  </TouchableOpacity>
                )}

                {invoiceIsFinalized && (
                  <TouchableOpacity style={[s.confirmBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => setPaymentModal(true)} disabled={invoiceSaving}>
                    <Text style={s.confirmBtnText}>Mark as Paid</Text>
                  </TouchableOpacity>
                )}

                {invoiceIsPaid && (
                  <View style={[s.confirmBtn, { backgroundColor: '#D1FAE5' }]}>
                    <Check size={15} color="#10B981" />
                    <Text style={[s.confirmBtnText, { color: '#10B981' }]}>Paid</Text>
                  </View>
                )}
              </View>

            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Payment Mode Modal ─── */}
      <Modal visible={paymentModal} transparent animationType="fade" onRequestClose={() => setPaymentModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Payment Mode</Text>
            <Text style={s.invNum}>Total: ₹{invoiceTotal.toLocaleString('en-IN')}</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {PAYMENT_MODES.map(pm => (
                <TouchableOpacity
                  key={pm.key}
                  style={[s.payModeRow, paymentMode === pm.key && s.payModeRowActive]}
                  onPress={() => setPaymentMode(pm.key)}
                >
                  <Text style={[s.payModeText, paymentMode === pm.key && { color: colors.primary, fontWeight: '700' }]}>
                    {pm.label}
                  </Text>
                  {paymentMode === pm.key && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s.modalBtns, { marginTop: 16 }]}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setPaymentModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confirmBtn, { backgroundColor: '#10B981' }]} onPress={handleMarkPaid}>
                <Text style={s.confirmBtnText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // List
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  listTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  // Cards
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  visitBadge: { backgroundColor: colors.primaryBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  visitBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusCompleted: { backgroundColor: '#D1FAE5' },
  statusProgress: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextCompleted: { color: '#065F46' },
  statusTextProgress: { color: '#92400E' },
  cardComplaint: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#9CA3AF', marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: '#F9FAFB', paddingTop: 10 },
  cardLink: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  // Session Header
  sessionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10, backgroundColor: '#fff' },
  sessionBackBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  sessionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sessionMeta: { fontSize: 11, color: '#9CA3AF' },

  // Sections
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12, letterSpacing: 0.2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.primary + '30', backgroundColor: colors.primaryBg },
  sectionAddText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  // Pill input
  pillSection: { marginBottom: 10 },
  pillLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  pillInputRow: { flexDirection: 'row', gap: 8 },
  pillInput: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  pillAddBtn: { width: 34, height: 34, backgroundColor: colors.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Text area & field
  textArea: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, fontSize: 13, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', textAlignVertical: 'top' },
  fieldInput: { backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },

  // Rows
  emptyRow: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F9FAFB', gap: 10 },
  txProcedure: { fontSize: 13, fontWeight: '600', color: '#111827' },
  txDetail: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  rxText: { fontSize: 12, color: '#374151' },
  loRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  loType: { fontSize: 13, fontWeight: '600', color: '#111827' },
  loMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  docName: { fontSize: 13, color: '#374151', flex: 1 },

  // Next visit
  nextVisitBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  nextVisitBtnText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },

  // Action Bar
  actionBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 10, gap: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 10 },
  actionSave: { flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingVertical: 10 },
  actionSaveText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 10, position: 'relative' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  actionBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#10B981', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  actionBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  confirmBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  // Next visit options
  nextVisitOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  nextVisitOptionText: { fontSize: 14, color: '#374151' },
  nextVisitOptionActive: { color: colors.primary, fontWeight: '700' },

  // Prescription
  rxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  rxModeTabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 2 },
  rxModeTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  rxModeTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  rxModeTabText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  rxInputCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 4 },
  rxInputLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 2 },
  rxAddMedBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  rxAddMedText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  rxAddedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 12, marginBottom: 6 },
  rxAddedName: { fontSize: 13, fontWeight: '600', color: '#065F46' },
  rxAddedDetail: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  rxPreviewCard: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  rxPreviewDate: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 8 },
  rxPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  rxPreviewMed: { fontSize: 13, fontWeight: '600', color: '#111827' },
  rxPreviewDetail: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  rxPreviewNotes: { fontSize: 12, color: '#6B7280', marginTop: 6, fontStyle: 'italic' },

  // Invoice
  invHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  invNum: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  invStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  invStatusText: { fontSize: 12, fontWeight: '700' },
  invSectionLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  invLineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  invLineDesc: { fontSize: 13, color: '#111827', fontWeight: '500' },
  invLineMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  invLineAmt: { fontSize: 13, fontWeight: '700', color: '#111827', marginRight: 4 },
  invAddRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  invAddBtn: { width: 36, height: 36, backgroundColor: colors.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  invTotals: { marginTop: 12, gap: 6 },
  invTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invTotalLabel: { fontSize: 13, color: '#6B7280' },
  invTotalValue: { fontSize: 13, color: '#374151', fontWeight: '600' },
  invGrandTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 },
  invGrandLabel: { fontSize: 15, fontWeight: '800', color: '#111827' },
  invGrandValue: { fontSize: 17, fontWeight: '800', color: colors.primary },
  invActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  discountInput: { backgroundColor: '#F9FAFB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', width: 80, textAlign: 'right' },

  // Payment mode
  payModeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  payModeRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  payModeText: { fontSize: 14, color: '#374151' },

  // Treatment plan status
  txStatusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  txStatusText: { fontSize: 10, fontWeight: '700' },
  txTapHint: { fontSize: 10, color: '#9CA3AF', marginTop: 3, fontStyle: 'italic' },

  // Inline suggestion chips
  suggestChip: {
    backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    marginRight: 6, borderWidth: 1, borderColor: '#E5E7EB',
  },
  suggestChipText: { fontSize: 12, color: '#374151', fontWeight: '500' },

  // Medication autocomplete
  medSuggestWrap: { position: 'relative', zIndex: 10 },
  medSuggestDropdown: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    marginTop: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 6,
    maxHeight: 160,
  },
  medSuggestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  medSuggestName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  medSuggestMeta: { fontSize: 11, color: '#9CA3AF' },
});
