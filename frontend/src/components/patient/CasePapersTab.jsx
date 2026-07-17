import React, { useState, useEffect, useRef } from 'react';
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
import { toast } from 'react-toastify';
import { api } from "../../utils/api";
import { universalToFDI } from "../../utils/toothNumbering";
import { Clock, ChevronLeft, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigationGuard } from '../../contexts/NavigationGuardContext';
import { getUserDisplayName } from '../../utils/userName';

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
  const [selectedCasePaper, setSelectedCasePaper] = useState(null);
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
  // Tracks if a finalized invoice already exists for this case paper
  const [existingCasePaperInvoiceId, setExistingCasePaperInvoiceId] = useState(null);

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
      notes: ''
  });

  const [labOrders, setLabOrders] = useState([]);
  const [isLabDrawerOpen, setIsLabDrawerOpen] = useState(false);
  const [selectedLabOrder, setSelectedLabOrder] = useState(null);
  const [patientDocuments, setPatientDocuments] = useState([]);

  // Inventory used during this visit + the clinic's stock list for the picker.
  const [inventoryConsumptions, setInventoryConsumptions] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [visitPrescriptions, setVisitPrescriptions] = useState([]);

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
      setExistingCasePaperInvoiceId(null);
      setInventoryConsumptions([]);
    }
  }, [selectedCasePaper?.id]);

  const fetchExistingCasePaperInvoice = async () => {
    if (!selectedCasePaper?.id || selectedCasePaper?.isNew || !patientData?.id) return;
    try {
      const casePaperId = String(selectedCasePaper.id);
      // Fetch invoices filtered by appointment_id — includes ALL statuses (draft, finalized, paid)
      // so we never create a duplicate invoice for the same case paper
      const invoices = await api.get('/invoices', {
        params: { patient_id: patientData.id, appointment_id: casePaperId, limit: 10 }
      });
      const existing = (invoices || []).find(
        inv => String(inv.appointment_id) === casePaperId
      );
      setExistingCasePaperInvoiceId(existing?.id || null);
    } catch (err) {
      console.error('Failed to check existing invoice:', err);
    }
  };

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
    toast.success('Case paper saved automatically');
    return saved.id;
  };

  const handleAutoSaveForDrawer = async (openCallback) => {
    try {
      await ensureCasePaperSaved();
      openCallback();
    } catch (err) {
      console.error('Failed to auto-save case paper:', err);
      toast.error('Error saving case paper. Please save manually first.');
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

  const handleAddConsumption = async (inventoryItemId, quantity) => {
    try {
      const casePaperId = await ensureCasePaperSaved();
      await api.post('/clinical/inventory-consumption', {
        patient_id: patientData.id,
        case_paper_id: casePaperId,
        inventory_item_id: inventoryItemId,
        quantity,
      });
      // Refresh both: the record list AND stock counts (which just changed).
      await Promise.all([fetchInventoryConsumption(casePaperId), fetchInventoryItems()]);
      toast.success('Inventory recorded');
    } catch (err) {
      console.error('Failed to record inventory:', err);
      toast.error(err?.message || 'Failed to record inventory');
    }
  };

  const handleDeleteConsumption = async (consumptionId) => {
    try {
      await api.delete(`/clinical/inventory-consumption/${consumptionId}`);
      await Promise.all([fetchInventoryConsumption(), fetchInventoryItems()]);
      toast.success('Removed — stock restored');
    } catch (err) {
      console.error('Failed to remove inventory record:', err);
      toast.error('Failed to remove');
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
          toast.error("Failed to load clinical history");
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
      toast.success('Case paper deleted');
      fetchCasePapers();
    } catch (err) {
      console.error('Failed to delete case paper:', err);
      toast.error(err?.message || 'Failed to delete case paper');
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
          notes: ''
      });
      setSelectedCasePaper(newPaper);
      setLabOrders([]);
      setVisitPrescriptions([]);
      setDraftCharges([]);
      setDirty(false);
      onCasePaperStateChange?.(true);
  };

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
              toast.success("Case Paper saved with fresh clinical state!");
          } else {
              await api.put(`/clinical/case-papers/${selectedCasePaper.id}`, payload);
              toast.success("Case Paper updated successfully!");
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
              notes: ''
          });
          onCasePaperStateChange?.(false);
      } catch (err) {
          console.error("Failed to save case paper:", err);
          toast.error("Error saving clinical records");
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

  const onUpdatePlan = (updatedPlan) => {
    // Update local session plan
    setDirty(true);
    setSessionTreatmentPlan(updatedPlan);

    // Detect newly completed items for billing
    updatedPlan.forEach(item => {
      const oldItem = sessionTreatmentPlan.find(p => p.id === item.id);
      if (item.status === 'completed' && (!oldItem || oldItem.status !== 'completed')) {
        const unitPrice = Number(item.cost) || 0;
        const charge = {
          description: `${item.procedure} (Tooth #${item.tooth ? universalToFDI(item.tooth) : 'General'})`,
          quantity: item.qty || 1,
          unit_price: unitPrice
        };
        setDraftCharges(prev => [...prev, charge]);
        toast.info(
          unitPrice > 0
            ? `Treatment "${item.procedure}" added to billing draft`
            : `"${item.procedure}" added — set its fee in the invoice`
        );
      }
    });

    // Also update parent if needed (syncing global state)
    if (typeof parentUpdatePlan === 'function') {
      parentUpdatePlan(updatedPlan);
    }
  };

  const handleAddTreatment = (treatmentDetails) => {
      let newPlan;
      if (editingTreatment) {
          // Update existing item
          newPlan = sessionTreatmentPlan.map(item => 
              item.id === editingTreatment.id ? { ...item, ...treatmentDetails } : item
          );
          toast.success("Procedure updated");
      } else {
          // Create new item
          newPlan = [...sessionTreatmentPlan, {
              id: Date.now() + Math.random(),
              date: new Date().toISOString().split('T')[0],
              time: '10:00',
              ...treatmentDetails
          }];
          toast.success("Procedure added");
      }
      onUpdatePlan(newPlan);
      setEditingTreatment(null);
  };

  const handleSendLabOrder = () => {
      if (!labOrderForm.workType) {
          toast.error("Please specify Work Type");
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
      toast.success("Lab Order Sent & Added to Billing Draft");
      
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
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
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
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Treating Dentist</p>
                <p className="text-sm font-extrabold text-[#2a276e]">{selectedDentistName}</p>
            </div>
        </div>
      </div>

      <div className="space-y-12 pb-32">
        {/* 2. Clinical Examination Profile (Pills) */}
        <ClinicalExamSection form={form} onFormChange={handleFormChange} />

        {/* 3. Dental Charting Tabbed View */}
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

        {/* 4. Patient Progression (Timeline) - Scrollable columns */}
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
          onAddConsumption={handleAddConsumption}
          onDeleteConsumption={handleDeleteConsumption}
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
        onFormChange={handleFormChange}
        onSave={handleSaveCasePaper}
        onPrescription={() => {
          handleAutoSaveForDrawer(() => setPrescriptionOpen(true));
        }}
        hasExistingInvoice={!!existingCasePaperInvoiceId}
        onInvoice={() => {
          // Warn about treatments not yet marked complete — only completed ones
          // flow into billing, so pending ones would be silently left out.
          const pending = (sessionTreatmentPlan || []).filter((t) => {
            const s = (t.status || '').toLowerCase();
            return s !== 'completed' && s !== 'cancelled';
          });
          if (pending.length > 0) {
            toast.warn(
              `${pending.length} treatment${pending.length > 1 ? 's are' : ' is'} still pending — mark ${pending.length > 1 ? 'them' : 'it'} complete to add to billing.`
            );
          }
          if (existingCasePaperInvoiceId) {
            setInvoiceEditId(String(existingCasePaperInvoiceId));
            return;
          }
          handleAutoSaveForDrawer(() => setInvoiceEditId('new'));
        }}
      />

      <LabOrderDrawer 
          isOpen={isLabDrawerOpen}
          onClose={() => setIsLabDrawerOpen(false)}
          patientId={patientData?.id}
          casePaperId={selectedCasePaper?.isNew ? null : selectedCasePaper?.id}
          onSave={fetchLabOrders}
          order={selectedLabOrder}
      />

      <PrescriptionDrawer 
          isOpen={prescriptionOpen}
          onClose={() => setPrescriptionOpen(false)}
          patientId={patientData?.id}
          patientData={patientData}
          initialData={(() => {
            const casePrescriptions = selectedCasePaper?.isNew
              ? []
              : visitPrescriptions.filter(rx =>
                  rx.case_paper_id === selectedCasePaper?.id ||
                  rx.case_paper_id?.toString() === selectedCasePaper?.id?.toString()
                );
            return casePrescriptions.length > 0 ? casePrescriptions[casePrescriptions.length - 1] : null;
          })()}
          onSave={async (data) => {
              try {
                  if (selectedCasePaper?.isNew) {
                      toast.error("Please save case paper first");
                      return;
                  }
                  const casePrescriptions = selectedCasePaper?.isNew
                    ? []
                    : visitPrescriptions.filter(rx =>
                        rx.case_paper_id === selectedCasePaper?.id ||
                        rx.case_paper_id?.toString() === selectedCasePaper?.id?.toString()
                      );
                  const existingRx = casePrescriptions.length > 0 ? casePrescriptions[casePrescriptions.length - 1] : null;
                  if (existingRx?.id) {
                      await api.put(`/clinical/prescriptions/${existingRx.id}`, {
                          ...data,
                          patient_id: patientData.id,
                      });
                      toast.success("Prescription updated");
                  } else {
                      await api.post('/clinical/prescriptions', {
                          ...data,
                          patient_id: patientData.id,
                          case_paper_id: selectedCasePaper?.id?.toString().startsWith('new-') ? null : selectedCasePaper?.id
                      });
                      toast.success("Prescription saved");
                  }
                  await fetchVisitPrescriptions();
              } catch (err) {
                  console.error("Prescription save error:", err);
                  toast.error("Failed to save prescription");
              }
          }}
      />
      
      <ScanUploadDrawer 
          isOpen={scanOpen}
          onClose={() => setScanOpen(false)}
          patientId={patientData?.id}
          casePaperId={selectedCasePaper?.isNew ? null : selectedCasePaper?.id}
          onUpload={(data) => {
              toast.success(`${data.files.length} document(s) uploaded successfully!`);
              fetchPatientDocuments();
          }}
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
            notes: `Case Paper #${selectedVisitNumber || selectedCasePaper?.id}`,
            lineItems: [
              ...draftCharges,
              ...labOrders.map(order => ({
                description: `Lab Work: ${order.work_type}${order.tooth_number ? ` (Tooth #${order.tooth_number})` : ''} — ${order.vendor_name || 'Lab'}`,
                quantity: 1,
                unit_price: order.cost || 0
              }))
            ]
          } : null}
        />
      )}

      <ToothRightDrawer 
          isOpen={!!selectedTooth}
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
