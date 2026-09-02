import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PatientTimeline from './PatientTimeline';
import ToothRightDrawer from './ToothRightDrawer';
import PrescriptionDrawer from './PrescriptionDrawer';
import ScanUploadDrawer from './ScanUploadDrawer';
import LabOrderDrawer from './LabOrderDrawer';
import CasePaperList from './CasePaperList';
import ClinicalExamSection from './ClinicalExamSection';
import DentalChartSection from './DentalChartSection';
import DiagnosticsGrid from './DiagnosticsGrid';
import DocumentsNotesGrid from './DocumentsNotesGrid';
import CasePaperActionBar from './CasePaperActionBar';
import InvoiceEditor from '../payments/InvoiceEditor';
import CasePaperInvoicesPanel from './CasePaperInvoicesPanel';
import NextVisitModal from './NextVisitModal';
import { notify } from '../../utils/notify';
import { api } from "../../utils/api";
import { universalToFDI } from "../../utils/toothNumbering";
import { Clock, ChevronLeft, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigationGuard } from '../../contexts/NavigationGuardContext';
import { getUserDisplayName } from '../../utils/userName';
import { useCasePaperLabels } from '../../utils/casePaper';
import DermClinicalSections from './derm/DermClinicalSections';

const CasePapersTab = ({
  patientData,
  teethData,
  toothNotes,
  selectedTooth,
  onToothSelect,
  onSurfaceConditionChange,
  onToothStatusChange,
  onNotesChange,
  upcomingAppointments,
  treatmentHistory,
  treatmentPlan,
  onUpdatePlan: parentUpdatePlan,
  onGeneratePlan,
  prescriptions,
  patientPhone,
  onCasePaperStateChange,
  onSaveClinicalRecords,
  payments,
  patientId,
  appointments,
  refreshPayments,
  refreshInvoices
}) => {
  const { user } = useAuth();
  const { registerBlocker, attemptNavigate } = useNavigationGuard();
  const currentUserName = getUserDisplayName(user); // logged-in dentist, used as fallback
  // Which case paper this clinic keeps. Drives the tooth chart and the two
  // labels that would otherwise say 'dental' to a dermatologist.
  const { isDental, clinicianLabel } = useCasePaperLabels();
  const [selectedCasePaper, setSelectedCasePaper] = useState(null);
  // ?casePaper=<id> opens that paper directly. Guarded by a ref so it only
  // fires on the first load: without it, closing the paper would immediately
  // reopen it and there would be no way back to the list.
  const autoOpened = useRef(false);
  const [activeChartTab, setActiveChartTab] = useState('dental_chart');
  const [isAddingLabOrder, setIsAddingLabOrder] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  
  // Drawer States
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  
  // Clinical Session State (Isolated per Case Paper)
  const [sessionTeethData, setSessionTeethData] = useState({});
  const [sessionToothNotes, setSessionToothNotes] = useState({});
  const [sessionTreatmentPlan, setSessionTreatmentPlan] = useState([]);

  // Draft Billing State (Local to Case Paper session)
  const [draftCharges, setDraftCharges] = useState([]);

  // Invoice editing: null=closed, 'new'=create, number=existing
  const [invoiceEditId, setInvoiceEditId] = useState(null);
  // A case paper can carry several invoices — the list panel shows them all.
  const [invoiceListOpen, setInvoiceListOpen] = useState(false);
  // Every invoice on this case paper, fetched once here rather than inside the
  // panel: the action bar's badge and the panel's list must never disagree.
  const [casePaperInvoices, setCasePaperInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  // Tracks if an invoice already exists for this case paper
  const [existingCasePaperInvoiceId, setExistingCasePaperInvoiceId] = useState(null);
  const [nextVisitOpen, setNextVisitOpen] = useState(false);

  // Unsaved-changes guard: flips true on any edit, resets after save/load.
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const saveRef = useRef(null);
  
  // Form state for Lab Order
  const [labOrderForm, setLabOrderForm] = useState({
      vendor: 'Precision Dental Lab',
      dueDate: '',
      workType: '',
      tooth: '',
      shade: '',
      instructions: ''
  });

  const [caseHistory, setCaseHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Active form state for the current case paper session
  const [form, setForm] = useState({
      chief_complaint: [],
      medical_history: [],
      dental_history: [],
      allergies: [],
      clinical_examination: '', // Move to notes/secondary
      diagnosis: '',            // Move to notes/secondary
      next_visit_recommendation: 'Not specified',
      next_visit_date: null,
      notes: '',
      // Null on a dental case paper. The derm sections fill this in and it is
      // spread into the save payload with everything else, so it needs no
      // special handling on either the create or the update path.
      derm_findings: null
  });

  const [labOrders, setLabOrders] = useState([]);
  const [isLabDrawerOpen, setIsLabDrawerOpen] = useState(false);
  const [selectedLabOrder, setSelectedLabOrder] = useState(null);
  const [patientDocuments, setPatientDocuments] = useState([]);

  // Inventory used during this visit + the clinic's stock list for the picker.
  const [inventoryConsumptions, setInventoryConsumptions] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [medicationStock, setMedicationStock] = useState([]);

  const [visitPrescriptions, setVisitPrescriptions] = useState([]);

  const openCasePaper = useCallback((paper) => {
    const pills = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim().startsWith('[')) {
        try { return JSON.parse(val); } catch { return [val]; }
      }
      return typeof val === 'string' && val.trim() ? [val] : [];
    };
    setSelectedCasePaper(paper);
    setForm({
      chief_complaint: pills(paper.chief_complaint),
      medical_history: pills(paper.medical_history),
      dental_history: pills(paper.dental_history),
      allergies: pills(paper.allergies),
      clinical_examination: paper.clinical_examination || '',
      diagnosis: paper.diagnosis || '',
      next_visit_recommendation: paper.next_visit_recommendation || 'Not specified',
      next_visit_date: paper.next_visit_date || null,
      notes: paper.notes || '',
      derm_findings: paper.derm_findings || null,
    });
    setDirty(false);
    onCasePaperStateChange?.(true);
  }, [onCasePaperStateChange]);

  useEffect(() => {
    if (autoOpened.current || !caseHistory.length) return;
    const wanted = new URLSearchParams(window.location.search).get('casePaper');
    if (!wanted) return;
    const paper = caseHistory.find((c) => String(c.id) === String(wanted));
    if (!paper) return;
    autoOpened.current = true;
    openCasePaper(paper);
  }, [caseHistory]);

  const selectedCasePaperIndex = caseHistory.findIndex(
    (paper) => paper.id?.toString() === selectedCasePaper?.id?.toString()
  );
  const selectedVisitNumber =
    selectedCasePaper?.isNew
      ? caseHistory.length + 1
      : selectedCasePaperIndex >= 0
        ? caseHistory.length - selectedCasePaperIndex
        : null;
  const selectedDentistName =
    selectedCasePaper?.dentist?.name ||
    selectedCasePaper?.dentist_name ||
    (typeof selectedCasePaper?.dentist === 'string' && selectedCasePaper.dentist !== 'Current Doctor'
      ? selectedCasePaper.dentist
      : '') ||
    (selectedCasePaper?.dentist_id ? `Doctor #${selectedCasePaper.dentist_id}` : '') ||
    currentUserName ||
    'Not Assigned';

  useEffect(() => {
    if (patientData?.id) {
        fetchCasePapers();
        fetchVisitPrescriptions();
        fetchInventoryItems();
        fetchMedicationStock();
    }
  }, [patientData?.id]);

  useEffect(() => {
    if (patientData?.id && selectedCasePaper) {
        fetchPatientDocuments();
    }
  }, [patientData?.id, selectedCasePaper?.id]);

  const fetchVisitPrescriptions = async () => {
    if (!patientData?.id) return;
    try {
        const data = await api.get(`/clinical/prescriptions/patient/${patientData.id}`);
        setVisitPrescriptions(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error("Failed to fetch prescriptions:", err);
    }
  };

  // Initialize session data when case paper selection changes
  useEffect(() => {
    if (selectedCasePaper) {
      if (selectedCasePaper.isNew) {
        setSessionTeethData({});
        setSessionToothNotes({});
        setSessionTreatmentPlan([]);
      } else {
        setSessionTeethData(selectedCasePaper.dental_chart_snapshot || {});
        setSessionToothNotes(selectedCasePaper.tooth_notes_snapshot || {});
        setSessionTreatmentPlan(selectedCasePaper.treatment_plan_snapshot || []);
      }
    }
  }, [selectedCasePaper]);

  // Sync with parent props only when NOT in a case paper session
  useEffect(() => {
    if (!selectedCasePaper) {
      setSessionTeethData(teethData || {});
      setSessionToothNotes(toothNotes || {});
      setSessionTreatmentPlan(treatmentPlan || []);
    }
  }, [selectedCasePaper, teethData, toothNotes, treatmentPlan]);

  useEffect(() => {
    if (selectedCasePaper?.id) {
      fetchLabOrders();
      fetchInventoryConsumption(selectedCasePaper.id);
      if (!selectedCasePaper?.isNew) fetchExistingCasePaperInvoice();
    } else {
      setCasePaperInvoices([]);
      setExistingCasePaperInvoiceId(null);
      setInventoryConsumptions([]);
    }
  }, [selectedCasePaper?.id]);

  /**
   * Every invoice on this case paper, in one list.
   *
   * Two linkages have to be asked for. Newer invoices carry case_paper_id;
   * ones written before that column existed overload appointment_id with the
   * case paper's id. All statuses are included (draft, finalized, paid) so we
   * never create a duplicate invoice for the same case paper, and so the
   * action bar's badge counts a draft that is quietly sitting there waiting.
   *
   * The patient filter on the legacy lookup is what stops an appointment that
   * happens to share the case paper's id from being pulled in.
   */
  const fetchExistingCasePaperInvoice = async () => {
    if (!selectedCasePaper?.id || selectedCasePaper?.isNew || !patientData?.id) {
      setCasePaperInvoices([]);
      setExistingCasePaperInvoiceId(null);
      return;
    }
    const casePaperId = String(selectedCasePaper.id);
    setInvoicesLoading(true);
    try {
      const [byCase, byLegacy] = await Promise.all([
        api.get('/invoices', { params: { case_paper_id: casePaperId, limit: 100 } }).catch(() => []),
        api.get('/invoices', { params: { patient_id: patientData.id, appointment_id: casePaperId, limit: 100 } }).catch(() => []),
      ]);
      const merged = new Map();
      for (const inv of [...(byCase || []), ...(byLegacy || [])]) {
        if (inv?.id != null) merged.set(String(inv.id), inv);
      }
      const list = [...merged.values()].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
      setCasePaperInvoices(list);
      setExistingCasePaperInvoiceId(list[0]?.id || null);
    } catch (err) {
      console.error('Failed to check existing invoice:', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Medicines already written for this visit. Drives the count on the
  // Prescription button, and is the same list the drawer reopens.
  const casePaperPrescriptions = useMemo(() => {
    if (!selectedCasePaper || selectedCasePaper.isNew) return [];
    return visitPrescriptions.filter(
      (rx) => String(rx.case_paper_id) === String(selectedCasePaper.id)
    );
  }, [visitPrescriptions, selectedCasePaper]);

  const prescribedMedicineCount = useMemo(
    () => casePaperPrescriptions.reduce(
      (n, rx) => n + (Array.isArray(rx.items)
        ? rx.items.filter((i) => (i?.medicine_name || '').trim()).length
        : 0),
      0
    ),
    [casePaperPrescriptions]
  );

  // Persist a brand-new case paper if needed and return its id — so actions that
  // must attach to a real case_paper_id (lab orders, inventory) work even on a
  // freshly opened, unsaved paper.
  const ensureCasePaperSaved = async () => {
    if (!selectedCasePaper?.isNew) return selectedCasePaper?.id;
    const payload = {
      ...form,
      patient_id: patientData.id,
      clinic_id: patientData.clinic_id,
      date: new Date().toISOString(),
      status: 'In Progress',
      dental_chart_snapshot: sessionTeethData,
      treatment_plan_snapshot: sessionTreatmentPlan,
      tooth_notes_snapshot: sessionToothNotes
    };
    const saved = await api.post('/clinical/case-papers', payload);
    setSelectedCasePaper(saved);
    setDirty(false);
    fetchCasePapers();
    if (typeof onSaveClinicalRecords === 'function') {
      onSaveClinicalRecords({ dental_chart: sessionTeethData, treatment_plan: sessionTreatmentPlan, tooth_notes: sessionToothNotes }).catch(() => {});
    }
    notify.done('Case paper saved automatically');
    return saved.id;
  };

  const handleAutoSaveForDrawer = async (openCallback) => {
    try {
      await ensureCasePaperSaved();
      openCallback();
    } catch (err) {
      console.error('Failed to auto-save case paper:', err);
      notify.problem('Error saving case paper. Please save manually first.');
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const data = await api.get('/inventory');
      setInventoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    }
  };

  const fetchMedicationStock = async () => {
    try {
      const data = await api.get('/medication-stock');
      setMedicationStock(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch medication stock:', err);
    }
  };

  const fetchInventoryConsumption = async (casePaperId) => {
    const id = casePaperId ?? selectedCasePaper?.id;
    if (!id || selectedCasePaper?.isNew) { setInventoryConsumptions([]); return; }
    try {
      const data = await api.get(`/clinical/inventory-consumption?case_paper_id=${id}`);
      setInventoryConsumptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch inventory consumption:', err);
    }
  };

  // kind: 'inv' (general stock) | 'med' (medication stock)
  // addToBilling: also add a priced line to the visit's draft invoice (default
  // true — auto-record paths like the prescription drawer keep billing).
  const handleAddConsumption = async (kind, id, quantity, addToBilling = true) => {
    try {
      const casePaperId = await ensureCasePaperSaved();
      await api.post('/clinical/inventory-consumption', {
        patient_id: patientData.id,
        case_paper_id: casePaperId,
        ...(kind === 'med' ? { medication_stock_id: id } : { inventory_item_id: id }),
        quantity,
        add_to_billing: addToBilling,
      });
      // Refresh the record list AND both stock lists (counts just changed).
      await Promise.all([fetchInventoryConsumption(casePaperId), fetchInventoryItems(), fetchMedicationStock()]);
      // Billing this may have opened the case paper's first draft invoice, which
      // is exactly what the count on the Invoice button is there to announce.
      if (addToBilling) fetchExistingCasePaperInvoice();
      notify.done(addToBilling ? 'Recorded and added to bill' : 'Recorded (not billed)');
    } catch (err) {
      console.error('Failed to record inventory:', err);
      notify.problem(err?.message || 'Failed to record');
    }
  };

  // mode: 'entirely' (delete + restock + unbill) | 'billing_only' (drop from bill, keep usage)
  const handleDeleteConsumption = async (consumptionId, mode = 'entirely') => {
    try {
      await api.delete(`/clinical/inventory-consumption/${consumptionId}`, { params: { mode } });
      await Promise.all([fetchInventoryConsumption(), fetchInventoryItems(), fetchMedicationStock()]);
      notify.done(mode === 'billing_only' ? 'Removed from bill' : 'Removed — stock restored');
    } catch (err) {
      console.error('Failed to remove inventory record:', err);
      notify.problem('Failed to remove');
    }
  };

  // Bill an already-recorded usage that wasn't billed at the time.
  const handleBillConsumption = async (consumptionId) => {
    try {
      await api.post(`/clinical/inventory-consumption/${consumptionId}/bill`);
      await fetchInventoryConsumption();
    } catch (err) {
      console.error('Failed to bill inventory record:', err);
      notify.problem(err?.message || 'Failed to add to bill');
    }
  };

  const fetchLabOrders = async () => {
    try {
      if (selectedCasePaper?.isNew) {
        setLabOrders([]);
        return;
      }
      const url = `/clinical/lab-orders?case_paper_id=${selectedCasePaper.id}`;
      const response = await api.get(url);
      setLabOrders(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error("Failed to fetch lab orders:", err);
    }
  };

  const fetchPatientDocuments = async () => {
    try {
      if (selectedCasePaper?.isNew) {
        setPatientDocuments([]);
        return;
      }
      const casePaperId = selectedCasePaper?.id;
      const url = `/documents/patient/${patientData.id}?case_paper_id=${casePaperId}`;
      const response = await api.get(url);
      setPatientDocuments(response);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  const fetchCasePapers = async () => {
      setLoading(true);
      try {
          const response = await api.get(`/clinical/case-papers/patient/${patientData.id}`);
          setCaseHistory(response);
      } catch (err) {
          console.error("Failed to fetch case papers:", err);
          notify.problem("Failed to load clinical history");
      } finally {
          setLoading(false);
      }
  };

  // Deleting a case paper destroys clinical history, so confirm with the
  // complaint name rather than a bare "are you sure".
  const handleDeleteCasePaper = async (paper) => {
    const title = (() => {
      const raw = paper.chief_complaint;
      if (Array.isArray(raw)) return raw.join(', ');
      if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        try { return JSON.parse(raw).join(', '); } catch { return raw; }
      }
      return raw || 'General Checkup';
    })();

    const ok = window.confirm(
      `Delete this case paper?\n\n"${title}" — ${new Date(paper.date).toLocaleDateString()}\n\n` +
      'This permanently removes the clinical record and cannot be undone.'
    );
    if (!ok) return;

    try {
      await api.delete(`/clinical/case-papers/${paper.id}`);
      fetchCasePapers();
    } catch (err) {
      console.error('Failed to delete case paper:', err);
      notify.problem(err?.message || 'Failed to delete case paper');
    }
  };

  const startNewCasePaper = () => {
      const newPaper = {
          id: 'new-' + Date.now(),
          date: new Date().toISOString(),
          status: 'In Progress',
          dentist: currentUserName || 'Current Doctor',
          isNew: true
      };
      setForm({
          chief_complaint: [],
          medical_history: [],
          dental_history: [],
          allergies: [],
          clinical_examination: '',
          diagnosis: '',
          next_visit_recommendation: 'Not specified',
          next_visit_date: null,
          notes: '',
          derm_findings: null
      });
      setSelectedCasePaper(newPaper);
      setLabOrders([]);
      setVisitPrescriptions([]);
      setDraftCharges([]);
      setDirty(false);
      onCasePaperStateChange?.(true);
  };

  // Deep link from the daily register: ?action=new-case-paper opens a blank case
  // paper, ?action=prescribe opens the prescription drawer, so a row there leads
  // straight into the work instead of dumping the user on the profile. Runs once,
  // and strips the param so a refresh or back-navigation doesn't re-trigger it.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || !patientData?.id) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action !== 'new-case-paper' && action !== 'prescribe') return;

    deepLinkHandled.current = true;
    startNewCasePaper();
    if (action === 'prescribe') setPrescriptionOpen(true);

    params.delete('action');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientData?.id]);

  const handleSaveCasePaper = async () => {
      try {
          const payload = {
              ...form,
              patient_id: patientData.id,
              clinic_id: patientData.clinic_id, // Ensure clinic_id is sent
              date: new Date().toISOString(),
              status: 'Completed',
              // Clinical Snapshots
              dental_chart_snapshot: sessionTeethData,
              treatment_plan_snapshot: sessionTreatmentPlan,
              tooth_notes_snapshot: sessionToothNotes
          };

          if (selectedCasePaper?.isNew) {
              await api.post('/clinical/case-papers', payload);
          } else {
              await api.put(`/clinical/case-papers/${selectedCasePaper.id}`, payload);
          }
          
          // Sync global clinical data (treatment plans, dental chart, etc.)
          if (typeof onSaveClinicalRecords === 'function') {
              await onSaveClinicalRecords({
                  dental_chart: sessionTeethData,
                  treatment_plan: sessionTreatmentPlan,
                  tooth_notes: sessionToothNotes
              });
          }

          fetchCasePapers();
          setDirty(false);
          setSelectedCasePaper(null);
          setForm({
              chief_complaint: [],
              medical_history: [],
              dental_history: [],
              allergies: [],
              clinical_examination: '',
              diagnosis: '',
              next_visit_recommendation: 'Not specified',
              next_visit_date: null,
              notes: '',
              derm_findings: null
          });
          onCasePaperStateChange?.(false);
      } catch (err) {
          console.error("Failed to save case paper:", err);
          notify.problem("Error saving clinical records");
          throw err; // let the navigation guard keep the work if the save failed
      }
  };

  // Keep the guard's save handler pointing at the latest closure.
  saveRef.current = handleSaveCasePaper;

  // Register the unsaved-changes blocker: while this case paper has pending edits,
  // ANY exit (sidebar/header link, the Back button, browser Back, refresh) prompts.
  useEffect(() => registerBlocker({
    isDirty: () => dirtyRef.current,
    onSave: async () => { await saveRef.current?.(); },
  }), [registerBlocker]);

  // Add a history entry while dirty so the browser Back button is catchable.
  useEffect(() => {
    if (!dirty) return;
    try { window.history.pushState(null, '', window.location.href); } catch { /* noop */ }
  }, [dirty]);

  // Billing description for a procedure line — kept identical across add/update
  // so we can detect real detail changes on an already-completed procedure.
  const procedureChargeDesc = (item) =>
    `${item.procedure} (Tooth #${item.tooth ? universalToFDI(item.tooth) : 'General'})`;
  const isCompleted = (item) => (item?.status || '').toLowerCase() === 'completed';

  // Auto-bill a newly completed procedure straight to the case paper's draft
  // invoice (creating the draft if needed), just like used stock does. Returns
  // the item with its invoice/line ids attached so we can update/remove it later.
  const addProcedureLine = async (item, casePaperId) => {
    const unitPrice = Number(item.cost) || 0;
    const res = await api.post('/invoices/procedure-charge', {
      patient_id: patientData.id,
      case_paper_id: casePaperId,
      description: procedureChargeDesc(item),
      quantity: item.qty || 1,
      unit_price: unitPrice,
    });
    fetchExistingCasePaperInvoice();
    notify.done(
      unitPrice > 0
        ? `"${item.procedure}" billed to draft ${res.invoice_number || ''}`.trim()
        : `"${item.procedure}" added, set its fee in the invoice`
    );
    return { ...item, invoice_line_item_id: res.line_item_id, invoice_id: res.invoice_id };
  };

  // Remove a procedure's billed line (un-completed or deleted). Best-effort:
  // if the invoice was already finalised the line stays — you did charge for it.
  const removeProcedureLine = async (item) => {
    if (!item?.invoice_id || !item?.invoice_line_item_id) return;
    try {
      await api.delete(`/invoices/${item.invoice_id}/line-items/${item.invoice_line_item_id}`);
      fetchExistingCasePaperInvoice();
    } catch (err) {
      console.warn('Could not remove procedure line:', err);
    }
  };

  // Keep an already-billed procedure's line in sync when its fee/qty/tooth changes.
  const updateProcedureLine = async (item) => {
    if (!item?.invoice_id || !item?.invoice_line_item_id) return;
    try {
      await api.put(`/invoices/${item.invoice_id}/line-items/${item.invoice_line_item_id}`, {
        description: procedureChargeDesc(item),
        quantity: item.qty || 1,
        unit_price: Number(item.cost) || 0,
      });
      fetchExistingCasePaperInvoice();
    } catch (err) {
      console.warn('Could not update procedure line:', err);
    }
  };

  // Reconcile billing side-effects between the old and new plan, returning the
  // new plan with line ids attached/removed. Handles: newly completed (bill),
  // un-completed or deleted (remove line), and edits to a completed item (update).
  const syncProcedureBilling = async (updatedPlan) => {
    const oldPlan = sessionTreatmentPlan;

    // Completed items dropped from the plan entirely → remove their lines.
    for (const oldItem of oldPlan) {
      if (isCompleted(oldItem) && oldItem.invoice_line_item_id &&
          !updatedPlan.some(p => p.id === oldItem.id)) {
        await removeProcedureLine(oldItem);
      }
    }

    // Resolve the case paper once. ensureCasePaperSaved persists a brand-new
    // paper and returns its id; calling it per item in the loop would create
    // duplicates because selectedCasePaper state lags within a single pass.
    const hasNewlyCompleted = updatedPlan.some((item) => {
      const oldItem = oldPlan.find(p => p.id === item.id);
      return isCompleted(item) && !isCompleted(oldItem);
    });
    const casePaperId = hasNewlyCompleted ? await ensureCasePaperSaved() : selectedCasePaper?.id;

    const result = [];
    for (const item of updatedPlan) {
      const oldItem = oldPlan.find(p => p.id === item.id);
      const wasCompleted = isCompleted(oldItem);
      const nowCompleted = isCompleted(item);

      if (nowCompleted && !wasCompleted) {
        result.push(await addProcedureLine(item, casePaperId));
      } else if (!nowCompleted && wasCompleted && oldItem?.invoice_line_item_id) {
        await removeProcedureLine(oldItem);
        const unlinked = { ...item };
        delete unlinked.invoice_line_item_id;
        delete unlinked.invoice_id;
        result.push(unlinked);
      } else if (nowCompleted && item.invoice_line_item_id) {
        const changed = oldItem && (
          (Number(oldItem.cost) || 0) !== (Number(item.cost) || 0) ||
          (oldItem.qty || 1) !== (item.qty || 1) ||
          procedureChargeDesc(oldItem) !== procedureChargeDesc(item)
        );
        if (changed) await updateProcedureLine(item);
        result.push(item);
      } else {
        result.push(item);
      }
    }
    return result;
  };

  const onUpdatePlan = async (updatedPlan) => {
    setDirty(true);
    let nextPlan = updatedPlan;
    try {
      nextPlan = await syncProcedureBilling(updatedPlan);
    } catch (err) {
      console.error('Procedure billing sync failed:', err);
      notify.problem('Could not update the bill for that procedure');
    }
    setSessionTreatmentPlan(nextPlan);

    // Also update parent if needed (syncing global state)
    if (typeof parentUpdatePlan === 'function') {
      parentUpdatePlan(nextPlan);
    }
  };

  const handleAddTreatment = (treatmentDetails) => {
      let newPlan;
      if (editingTreatment) {
          // Update existing item
          newPlan = sessionTreatmentPlan.map(item => 
              item.id === editingTreatment.id ? { ...item, ...treatmentDetails } : item
          );
      } else {
          // Create new item
          newPlan = [...sessionTreatmentPlan, {
              id: Date.now() + Math.random(),
              date: new Date().toISOString().split('T')[0],
              time: '10:00',
              ...treatmentDetails
          }];
      }
      onUpdatePlan(newPlan);
      setEditingTreatment(null);
  };

  const handleSendLabOrder = () => {
      if (!labOrderForm.workType) {
          notify.problem("Please specify Work Type");
          return;
      }
      
      // Add a Generic Lab Fee to draft charges
      const labFee = {
          description: `Lab Fee: ${labOrderForm.workType} (${labOrderForm.vendor})`,
          quantity: 1,
          unit_price: 2500 // Generic base fee, can be edited in invoice drawer
      };
      
      setDraftCharges(prev => [...prev, labFee]);
      setIsAddingLabOrder(false);
      
      // Reset form
      setLabOrderForm({
        vendor: 'Precision Dental Lab',
        dueDate: '',
        workType: '',
        tooth: '',
        shade: '',
        instructions: ''
      });
  };

  // Local Handlers for Clinical Session
  const handleSurfaceConditionChange = (toothId, surface, condition) => {
    setDirty(true);
    setSessionTeethData(prev => {
      const toothData = prev[toothId] || { surfaces: {}, status: 'healthy', isAdult: true };
      const newSurfaces = { ...toothData.surfaces, [surface]: condition };
      return { ...prev, [toothId]: { ...toothData, surfaces: newSurfaces } };
    });
  };

  const handleToothStatusChange = (toothId, status) => {
    setDirty(true);
    setSessionTeethData(prev => {
      const toothData = prev[toothId] || { surfaces: {}, status: 'healthy', isAdult: true };
      return { ...prev, [toothId]: { ...toothData, status } };
    });
  };

  const handleNotesChange = (toothId, notes) => {
    setDirty(true);
    setSessionToothNotes(prev => ({ ...prev, [toothId]: notes }));
  };

  // Form edits from the clinical sections — mark the session dirty.
  const handleFormChange = (f) => {
    setDirty(true);
    setForm(f);
  };

  // Exit the case paper back to the history list.
  const doExit = () => {
    setDirty(false);
    setSelectedCasePaper(null);
    onCasePaperStateChange?.(false);
  };

  // Guarded exit (Back button): routes through the global guard, which shows the
  // shared "Save & continue / Don't save / Cancel" prompt when there are edits.
  const requestExit = () => attemptNavigate(doExit);

  const formatStatus = (status) => {
    switch (status) {
      case 'missing': return 'Teeth Removed';
      case 'implant': return 'Treatment Taken Before';
      case 'rootCanal': return 'Recommended To Take Treatment';
      default: return status;
    }
  };

  if (!selectedCasePaper) {
    return (
      <CasePaperList
        caseHistory={caseHistory}
        loading={loading}
        onNewCasePaper={startNewCasePaper}
        onDeleteCasePaper={handleDeleteCasePaper}
        onSelectCasePaper={(paper, formData) => {
          setSelectedCasePaper(paper);
          setForm(formData);
          setDirty(false);
          onCasePaperStateChange?.(true);
        }}
      />
    );
  }

  // Detail View of a Case Paper
  return (
    <div className="relative min-h-[calc(100vh-140px)] animate-fade-in flex flex-col">
      {/* 1. Standard Header (Non-sticky) */}
      <div className="bg-white border-b border-gray-100 -mx-6 px-8 py-4 flex items-center justify-between mb-8">
        <div className="flex items-center gap-5">
            <button
                onClick={requestExit}
                className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#2a276e] hover:bg-gray-50 transition-all active:scale-95"
            >
                <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-gray-900">
                      Case Paper {selectedVisitNumber ? `#${selectedVisitNumber}` : `#${selectedCasePaper.id}`}
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                        selectedCasePaper.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                        {selectedCasePaper.status}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={12} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-500">{new Date(selectedCasePaper.date).toLocaleDateString()} at {new Date(selectedCasePaper.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div className="text-xs font-semibold text-gray-500 mt-1">
                  {patientData?.name || 'Patient'}{patientData?.age ? ` • ${patientData.age}y` : ''}
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{clinicianLabel}</p>
                <p className="text-sm font-extrabold text-[#2a276e]">{selectedDentistName}</p>
            </div>
        </div>
      </div>

      <div className="space-y-12 pb-32">
        {/* 2. The clinical middle.
             Dental gets the pill exam plus the tooth chart plus the treatment
             timeline. Dermatology gets its own case paper: skin profile,
             history, lesion examination, scalp and hair, grading,
             investigations, diagnosis and plan. Everything BELOW this point —
             lab orders, prescriptions, documents, inventory used, clinical
             notes and the whole action bar — is shared, because none of it is
             dental. */}
        {isDental ? (
          <ClinicalExamSection form={form} onFormChange={handleFormChange} />
        ) : (
          <DermClinicalSections
            form={form}
            onFormChange={handleFormChange}
            patientData={patientData}
          />
        )}

        {/* 3. Dental Charting Tabbed View — dental case paper only.
             Hidden rather than emptied on the general paper: a skin clinic has
             no use for a tooth chart, and an empty one invites somebody to fill
             it in. The snapshots keep saving either way (see the save handler),
             so a clinic that switches back finds its charts intact. */}
        {isDental && (
          <DentalChartSection
            activeChartTab={activeChartTab}
            onTabChange={setActiveChartTab}
            sessionTeethData={sessionTeethData}
            sessionToothNotes={sessionToothNotes}
            selectedTooth={selectedTooth}
            onToothSelect={onToothSelect}
            onSurfaceConditionChange={handleSurfaceConditionChange}
            onToothStatusChange={handleToothStatusChange}
            onNotesChange={handleNotesChange}
          />
        )}

        {/* 4. Patient Progression (Timeline) — dental only.
             Every card on this board is tooth-keyed and clicking one opens the
             tooth drawer, so on a derm paper it would read as a bug. The
             dermatology equivalent is "Procedures planned" in the assessment
             section above. */}
        {isDental && (
        <section className="pt-8 border-t border-gray-100 timeline-kanban-fixed">
            <style>{`
                .timeline-kanban-fixed [onDragOver] { 
                    max-height: 500px;
                    overflow-y: auto;
                }
            `}</style>
            <PatientTimeline
                upcomingAppointments={upcomingAppointments}
                treatmentHistory={treatmentHistory}
                treatmentPlan={sessionTreatmentPlan}
                onUpdatePlan={onUpdatePlan}
                onGeneratePlan={onGeneratePlan}
                onToothSelect={(toothNum, treatmentToEdit) => {
                    onToothSelect(toothNum);
                    if (treatmentToEdit) {
                        setEditingTreatment(treatmentToEdit);
                    } else {
                        setEditingTreatment(null);
                    }
                }}
                teethData={sessionTeethData}
            />
        </section>
        )}

        {/* 5. Diagnostics Grid Row 1: Lab Orders & Prescriptions */}
        <DiagnosticsGrid
          labOrders={labOrders}
          visitPrescriptions={visitPrescriptions}
          selectedCasePaper={selectedCasePaper}
          isNewCasePaper={selectedCasePaper?.isNew}
          onNewLabOrder={() => {
            handleAutoSaveForDrawer(() => {
              setSelectedLabOrder(null);
              setIsLabDrawerOpen(true);
            });
          }}
          onEditLabOrder={(order) => { setSelectedLabOrder(order); setIsLabDrawerOpen(true); }}
          onNewPrescription={() => {
            handleAutoSaveForDrawer(() => setPrescriptionOpen(true));
          }}
        />

        {/* 6. Grid Row 2: Documents & Inventory Used */}
        <DocumentsNotesGrid
          patientDocuments={patientDocuments}
          onUploadClick={() => {
            handleAutoSaveForDrawer(() => setScanOpen(true));
          }}
          consumptions={inventoryConsumptions}
          inventoryItems={inventoryItems}
          medicationItems={medicationStock}
          onAddConsumption={handleAddConsumption}
          onDeleteConsumption={handleDeleteConsumption}
          onBillConsumption={handleBillConsumption}
        />

        {/* 7. Clinical Notes — full width, below the grid */}
        <section className="pt-8 border-t border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-[#2a276e]" />
            Clinical Notes
          </h3>
          <textarea
            value={form.notes}
            onChange={(e) => handleFormChange({ ...form, notes: e.target.value })}
            placeholder="Refined observations for this session..."
            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm font-medium min-h-[120px] resize-none transition-all"
          />
        </section>
      </div>

      {/* 7. Sticky Bottom Action Bar */}
      <CasePaperActionBar
        form={form}
        onSave={handleSaveCasePaper}
        onNextVisit={() => setNextVisitOpen(true)}
        onPrescription={() => {
          handleAutoSaveForDrawer(() => setPrescriptionOpen(true));
        }}
        prescriptionCount={prescribedMedicineCount}
        invoiceCount={casePaperInvoices.length}
        hasExistingInvoice={!!existingCasePaperInvoiceId}
        onInvoice={() => {
          // Warn about treatments not yet marked complete — only completed ones
          // flow into billing, so pending ones would be silently left out.
          const pending = (sessionTreatmentPlan || []).filter((t) => {
            const s = (t.status || '').toLowerCase();
            return s !== 'completed' && s !== 'cancelled';
          });
          if (pending.length > 0) {
            notify.problem(
              `${pending.length} treatment${pending.length > 1 ? 's are' : ' is'} still pending — mark ${pending.length > 1 ? 'them' : 'it'} complete to add to billing.`
            );
          }
          handleAutoSaveForDrawer(() => {
            // Refresh before showing: a procedure or used stock may have opened
            // a draft since this case paper was loaded.
            fetchExistingCasePaperInvoice();
            setInvoiceListOpen(true);
          });
        }}
      />

      <NextVisitModal
        open={nextVisitOpen}
        onClose={() => setNextVisitOpen(false)}
        value={{ label: form.next_visit_recommendation, date: form.next_visit_date }}
        onSave={({ label, date }) =>
          handleFormChange({ ...form, next_visit_recommendation: label, next_visit_date: date })
        }
      />

      <LabOrderDrawer 
          isOpen={isLabDrawerOpen}
          onClose={() => setIsLabDrawerOpen(false)}
          patientId={patientData?.id}
          casePaperId={selectedCasePaper?.isNew ? null : selectedCasePaper?.id}
          onSave={() => { fetchLabOrders(); fetchExistingCasePaperInvoice(); }}
          order={selectedLabOrder}
      />

      <PrescriptionDrawer 
          isOpen={prescriptionOpen}
          onClose={() => setPrescriptionOpen(false)}
          patientId={patientData?.id}
          patientData={patientData}
          initialData={casePaperPrescriptions.length > 0
            ? casePaperPrescriptions[casePaperPrescriptions.length - 1]
            : null}
          onSave={async (data) => {
              try {
                  if (selectedCasePaper?.isNew) {
                      notify.problem("Please save case paper first");
                      return;
                  }
                  const { dispenses = [], ...rxData } = data;
                  const existingRx = casePaperPrescriptions.length > 0
                    ? casePaperPrescriptions[casePaperPrescriptions.length - 1]
                    : null;
                  if (existingRx?.id) {
                      await api.put(`/clinical/prescriptions/${existingRx.id}`, {
                          ...rxData,
                          patient_id: patientData.id,
                      });
                  } else {
                      await api.post('/clinical/prescriptions', {
                          ...rxData,
                          patient_id: patientData.id,
                          case_paper_id: selectedCasePaper?.id?.toString().startsWith('new-') ? null : selectedCasePaper?.id
                      });
                  }
                  await fetchVisitPrescriptions();
                  // Deduct any medicines the doctor chose to dispense from stock.
                  for (const d of dispenses) {
                      await handleAddConsumption('med', d.medication_stock_id, d.quantity);
                  }
              } catch (err) {
                  console.error("Prescription save error:", err);
                  notify.problem("Failed to save prescription");
              }
          }}
      />
      
      <ScanUploadDrawer 
          isOpen={scanOpen}
          onClose={() => setScanOpen(false)}
          patientId={patientData?.id}
          casePaperId={selectedCasePaper?.isNew ? null : selectedCasePaper?.id}
          onUpload={(data) => {
              notify.done(`${data.files.length} document(s) uploaded successfully!`);
              fetchPatientDocuments();
          }}
      />
      
      <CasePaperInvoicesPanel
        open={invoiceListOpen}
        onClose={() => setInvoiceListOpen(false)}
        invoices={casePaperInvoices}
        loading={invoicesLoading}
        onNew={async () => {
          setInvoiceListOpen(false);
          if (selectedCasePaper?.isNew) { setInvoiceEditId('new'); return; }
          // If used stock already opened a draft for this case paper, add the
          // pending procedures to that same draft instead of spawning another.
          try {
            const drafts = await api.get('/invoices', { params: { case_paper_id: selectedCasePaper.id, status: 'draft', limit: 1 } });
            const draft = (drafts || [])[0];
            if (draft) {
              for (const ch of draftCharges) {
                await api.post(`/invoices/${draft.id}/line-items`, { description: ch.description, quantity: ch.quantity || 1, unit_price: ch.unit_price || 0 });
              }
              setDraftCharges([]);
              setInvoiceEditId(String(draft.id));
              return;
            }
          } catch { /* fall through to a fresh invoice */ }
          setInvoiceEditId('new');
        }}
        onOpen={(id) => { setInvoiceListOpen(false); setInvoiceEditId(String(id)); }}
      />

      {invoiceEditId && (
        <InvoiceEditor
          invoiceId={invoiceEditId}
          onClose={() => setInvoiceEditId(null)}
          onSave={() => {
            setDraftCharges([]);
            setInvoiceEditId(null);
            fetchExistingCasePaperInvoice();
            refreshPayments?.();
            refreshInvoices?.();
          }}
          prefill={invoiceEditId === 'new' ? {
            patientId: patientData?.id,
            appointmentId: selectedCasePaper?.isNew ? null : selectedCasePaper?.id,
            caseId: selectedCasePaper?.isNew ? null : selectedCasePaper?.id,
            notes: `Case Paper #${selectedVisitNumber || selectedCasePaper?.id}`,
            // Procedures, used stock, and lab orders all bill themselves onto the
            // case paper's draft the moment they happen, so nothing is prefilled
            // here — that would double-bill.
            lineItems: [...draftCharges]
          } : null}
        />
      )}

      <ToothRightDrawer 
          isOpen={isDental && !!selectedTooth}
          onClose={() => onToothSelect(null)}
          selectedTooth={selectedTooth}
          teethData={sessionTeethData}
          toothNotes={sessionToothNotes}
          onSurfaceConditionChange={handleSurfaceConditionChange}
          onToothStatusChange={handleToothStatusChange}
          onNotesChange={handleNotesChange}
          onAddTreatment={handleAddTreatment}
          editingTreatment={editingTreatment}
      />

    </div>
  );
};

export default CasePapersTab;
