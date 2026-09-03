import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  CasePapersTab,
  ToothRightDrawer
} from "../components/patient";
import { SkeletonBox, SkeletonCards } from "../components/Skeleton";
import PatientOverviewTab from "../components/patient/PatientOverviewTab";
import ImagingTab from "../components/patient/ImagingTab";
import DocumentsTab from "../components/patient/DocumentsTab";
import VisitsTab from "../components/patient/VisitsTab";
import BillingTab from "../components/patient/BillingTab";
import PatientFileHeader from "../components/patient/PatientFileHeader";
// Everything the Overview's shortcuts open. All of these already existed and
// are used elsewhere; mounting them here means the Overview does the work
// rather than handing you to another screen to start over.
import BookingModal from "./appointments/components/BookingModal";
import useClinicSchedule from "./appointments/hooks/useClinicSchedule";
import PrescriptionDrawer from "../components/patient/PrescriptionDrawer";
import ScanUploadDrawer from "../components/patient/ScanUploadDrawer";
import InvoiceEditor from "../components/payments/InvoiceEditor";
import PatientEditModal from "../components/patient/PatientEditModal";
import MasterPasswordModal from "../components/common/MasterPasswordModal";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { notify } from '../utils/notify';
import { patientService, appointmentService, paymentService } from '../services/patientService';
import { useAuth } from '../contexts/AuthContext';
import { clinicToday } from '../utils/datetime';
import { printPatientFile } from '../utils/patientPrint';

const PatientProfile = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "overview");
  const [loading, setLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [isCasePaperOpen, setIsCasePaperOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Dental chart state
  const [teethData, setTeethData] = useState({});
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [toothNotes, setToothNotes] = useState({});
  const [treatmentPlan, setTreatmentPlan] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [normalizedPrescriptions, setNormalizedPrescriptions] = useState([]);
  const [casePapers, setCasePapers] = useState([]);
  const [dailyVisits, setDailyVisits] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Overview shortcuts, opened in place. `uploadKind` splits the same drawer
  // between an X-ray and a document so the two tiles land in the right tab.
  const [bookingOpen, setBookingOpen] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [rxEditing, setRxEditing] = useState(null);
  const [uploadKind, setUploadKind] = useState(null);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  // Doctors, treatments and the day's chair count, the three things
  // BookingModal needs. Same hook the calendar uses, so the two agree on what
  // the clinic looks like.
  const { treatmentTypes, doctors, dayShape } = useClinicSchedule(new Date());

  // Memoised, and it matters. BookingModal re-seeds its form from `initial` in
  // an effect keyed on that object, so an inline literal here would hand it a
  // new identity on every render of this page and wipe whatever was half-typed.
  //
  // startTime is required, not optional: without it the modal opens with an
  // empty time, and its end-time and slot-availability checks both run on
  // undefined. Defaults to the next half hour, which is what someone booking
  // from a patient's file almost always wants.
  const bookingInitial = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + (30 - (now.getMinutes() % 30)), 0, 0);
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return {
      patientId: Number(patientId),
      patientName: patientData?.name || '',
      patientPhone: patientData?.phone || '',
      date: clinicToday(),
      startTime,
      duration: 30,
    };
  }, [patientId, patientData?.name, patientData?.phone]);

  const tabs = [
    { id: "overview", name: "Overview" },
    { id: "case-papers", name: "Case Papers" },
    { id: "visits", name: "Visits" },
    { id: "billing", name: "Billing" },
    { id: "imaging", name: "Imaging" },
    { id: "files", name: "Documents" }
  ];

  // Lightweight placeholder for tabs whose data is still streaming in.
  const TabSkeleton = () => (
    <div className="space-y-4">
      <SkeletonCards count={3} />
      <SkeletonBox className="h-32 w-full rounded-xl" />
      <SkeletonBox className="h-32 w-full rounded-xl" />
    </div>
  );


  const fetchPayments = async () => {
    try {
      const allPayments = await paymentService.getPayments({ limit: 1000 });
      const patientPayments = allPayments.filter(payment => payment.patient_id === parseInt(patientId));

      const transformedPayments = patientPayments.map(payment => ({
        id: payment.id,
        date: payment.created_at ? payment.created_at.split('T')[0] : '',
        procedure: payment.treatment_type || 'Treatment',
        amount: payment.amount,
        payment_method: payment.payment_method,
        status: payment.status,
        notes: payment.notes || ''
      }));

      setPayments(transformedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    }
  };

  // Hoisted out of the load effect so the Overview's drawers can refresh what
  // they changed. They were closures inside a useEffect; calling one from a
  // save handler would have thrown a ReferenceError, and optional chaining
  // does not save you from an identifier that was never declared.
  const loadAppointments = useCallback(async () => {
    try {
      const all = await appointmentService.getAppointments();
      const mine = all.filter((apt) => apt.patient_id === parseInt(patientId));
      setAppointments(mine.map((apt) => ({
        id: apt.id,
        date: apt.appointment_date,
        time: apt.start_time,
        procedure: apt.treatment,
        status: apt.status,
        duration: apt.duration || null,
        notes: apt.notes || '',
        doctor: apt.doctor_name || 'Unassigned',
        visit_number: apt.visit_number || null,
        clinic_name: apt.clinic_name || 'Zendral Dental Central',
      })));
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    }
  }, [patientId]);

  const loadPrescriptions = useCallback(async () => {
    try {
      const res = await api.get(`/clinical/prescriptions/patient/${patientId}`);
      setNormalizedPrescriptions(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error('Error fetching normalized prescriptions:', error);
      setNormalizedPrescriptions([]);
    }
  }, [patientId]);

  const fetchInvoices = async () => {
    try {
      const res = await api.get(`/invoices?patient_id=${patientId}`);
      setInvoices(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices([]);
    }
  };

  // Fetch patient data
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId) return;

      try {
        setLoading(true);

        // Fetch patient details (required - show error if this fails).
        // Once this resolves we render the page shell immediately; the
        // secondary data below streams in behind per-tab skeletons.
        try {
          const patient = await patientService.getPatient(patientId);
          setPatientData(patient);

          // Initializing clinical state from patient dental data
          setTeethData(patient.dental_chart || {});
          setToothNotes(patient.tooth_notes || {});
          setTreatmentPlan(patient.treatment_plan || []);
          setPrescriptions(patient.prescriptions || []);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching patient data:', error);
          notify.problem(getPermissionAwareErrorMessage(
            error,
            'Failed to load patient data.',
            "You don't have permission to view this patient profile."
          ));
          setLoading(false);
          return;
        }

        // Secondary data (appointments, payments, invoices, prescriptions,
        // case papers) — fetched in parallel so the page fills in quickly.
        // Each settles independently; a failure just leaves that slice empty.
        const fetchAppointments = loadAppointments;


        const fetchNormalizedPrescriptions = loadPrescriptions;

        const fetchCasePapers = async () => {
          try {
            const res = await api.get(`/clinical/case-papers/patient/${patientId}`);
            setCasePapers(Array.isArray(res) ? res : []);
          } catch (error) {
            console.error('Error fetching case papers:', error);
            setCasePapers([]);
          }
        };

        // Days this patient appeared in the daily register. Without these, a
        // walk-in seen briefly with no case paper and no bill leaves no trace
        // anywhere on their file.
        const fetchDailyVisits = async () => {
          try {
            const res = await api.get(`/daily-register/patient/${patientId}`);
            setDailyVisits(Array.isArray(res) ? res : []);
          } catch (error) {
            console.error('Error fetching daily visits:', error);
            setDailyVisits([]);
          }
        };

        await Promise.allSettled([
          fetchAppointments(),
          fetchPayments(),
          fetchInvoices(),
          fetchNormalizedPrescriptions(),
          fetchCasePapers(),
          fetchDailyVisits(),
        ]);

      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
        setSecondaryLoading(false);
      }
    };

    setSecondaryLoading(true);
    fetchPatientData();
  }, [patientId]);


  const savePatientData = async (sessionData = null) => {
    try {
      const currentTeethData = sessionData?.dental_chart || teethData;
      const currentToothNotes = sessionData?.tooth_notes || toothNotes;
      const currentTreatmentPlan = sessionData?.treatment_plan || treatmentPlan;

      // Save dental chart, tooth notes, and prescriptions
      const dataToSave = {
        dental_chart: currentTeethData,
        tooth_notes: currentToothNotes,
        prescriptions: prescriptions,
        treatment_plan: currentTreatmentPlan
      };

      console.log('💾 Saving patient data:', dataToSave);
      await patientService.updatePatient(patientId, dataToSave);
      
      // Update local state so it's fresh even without a reload
      if (sessionData) {
        setTeethData(currentTeethData);
        setToothNotes(currentToothNotes);
        setTreatmentPlan(currentTreatmentPlan);
      }

      // NOTE: Treatment-plan items are a *plan* only — they are persisted with the
      // patient above and must never silently create calendar appointments. An
      // appointment is created only when a doctor explicitly books one from the
      // scheduling UI. (Previously this loop auto-created "accepted" appointments
      // for every planned procedure, flooding the calendar on patient/case-paper save.)

      console.log('✅ All data saved successfully');
    } catch (error) {
      console.error("❌ Error saving patient data:", error);
      notify.problem(getPermissionAwareErrorMessage(
        error,
        "Failed to update clinical records.",
        "You don't have permission to update clinical records."
      ));
    }
  };



  // Calculate age from birth date (if we had DOB) - for now just use age field
  // Group appointments by status
  const upcomingAppointments = appointments.filter(apt =>
    apt.status === 'confirmed' || apt.status === 'accepted'
  ).sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateA - dateB;
  });

  /**
   * What the doctor needs at a glance, so the answer is on screen instead of a
   * tab away. Both are derived from data this page already loaded, so neither
   * costs a request.
   */

  // What this patient still owes. Drafts are not bills yet and cancelled ones
  // are not owed, so neither counts. The `due_amount ?? total - paid` fallback
  // is the pattern used everywhere else invoices are totalled.
  const outstandingDue = invoices
    .filter((inv) => inv.status !== 'draft' && inv.status !== 'cancelled')
    .reduce(
      (sum, inv) => sum + Number(inv.due_amount ?? Math.max(0, (inv.total || 0) - (inv.paid_amount || 0))),
      0
    );

  // Derived once for both the header and the Overview tab. Two copies of
  // "which visit was last" is two chances to disagree.
  const latestCasePaper = useMemo(
    () => [...casePapers].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0] || null,
    [casePapers],
  );
  const nextAppointment = useMemo(() => {
    const now = new Date();
    return [...appointments]
      // `date`, not `appointment_date`: the loader above renames every field
      // on the way in, and reading the raw names here meant this was null for
      // every patient and the header always said "Not booked".
      .filter((a) => a.date && new Date(a.date) >= now)
      .filter((a) => !['cancelled', 'no_show', 'no-show'].includes(String(a.status || '').toLowerCase()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
  }, [appointments]);

  // Deleting a patient takes their case papers, bills and receipted payments
  // with them, so the master password prompt IS the confirmation. The token
  // comes from the modal, which has already checked the code.
  const confirmDeletePatient = async (masterToken) => {
    await api.delete(`/patients/${patientId}`, {
      headers: { 'X-Master-Token': masterToken },
    });
    setDeleteOpen(false);
    // The record being displayed no longer exists, so staying is not an option.
    navigate('/patient-files');
  };

  const handlePrintFile = () => {
    const opened = printPatientFile({
      patient: patientData,
      casePapers,
      invoices,
      prescriptions: normalizedPrescriptions,
      user,
    });
    if (!opened) notify.problem('Your browser blocked the print window. Allow pop-ups for this site.');
  };

  const pastAppointments = appointments.filter(apt =>
    apt.status === 'completed' || apt.status === 'rejected'
  ).sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateB - dateA; // Reverse order for past appointments
  });

  // Treatment history from payments
  const treatmentHistory = payments.filter(payment => payment.status === 'success')
    .map(payment => ({
      id: payment.id,
      date: payment.date,
      procedure: payment.procedure,
      cost: payment.amount,
      status: 'completed',
      notes: payment.notes
    }))
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA; // Most recent first
    });

  // Prescriptions from state (now connected to backend)
  // Treatment Plan from state (now connected to backend)

  const generateTreatmentPlan = () => {
    const newPlan = [];
    let visitNumber = treatmentPlan.length + 1;
    
    Object.entries(teethData).forEach(([tooth, data]) => {
      const toothNum = parseInt(tooth);
      if (!data || data.status === 'missing') return;

      // Suggest treatments based on conditions
      Object.entries(data.surfaces || {}).forEach(([surface, condition]) => {
        if (condition === 'caries') {
          newPlan.push({
            id: Date.now() + Math.random(),
            procedure: `Composite Restoration (${surface})`,
            tooth: toothNum,
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '10:00',
            status: 'planned',
            cost: 1500,
            notes: `Decay detected on ${surface} surface`,
            visit_number: visitNumber++
          });
        }
      });

      if (data && data.status === 'planned') {
        newPlan.push({
          id: Date.now() + Math.random(),
          procedure: `Implant Placement`,
          tooth: toothNum,
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time: '10:00',
          status: 'planned',
          cost: 45000,
          notes: 'Planned as per initial consultation',
          visit_number: visitNumber++
        });
      }
    });

    if (newPlan.length > 0) {
      setTreatmentPlan(prev => [...prev, ...newPlan]);
    } else {
      alert("No new conditions found on the chart to generate a plan from.");
    }
  };

  const handleTreatmentPlanUpdate = (updatedPlan) => {
    setTreatmentPlan(updatedPlan);
  };

  const handleToothSelect = (toothNum) => {
    setSelectedTooth(toothNum === selectedTooth ? null : toothNum);
  };

  const handleSurfaceConditionChange = (toothNum, surface, condition) => {
    setTeethData(prev => {
      const toothData = prev[toothNum] || { status: 'present', surfaces: {} };
      const newSurfaces = { ...toothData.surfaces };
      if (condition === 'none') {
        delete newSurfaces[surface];
      } else {
        newSurfaces[surface] = condition;
      }
      return {
        ...prev,
        [toothNum]: {
          ...toothData,
          surfaces: newSurfaces,
        },
      };
    });
  };

  const handleToothStatusChange = (toothNum, status) => {
    setTeethData(prev => {
      const toothData = prev[toothNum] || { status: 'present', surfaces: {} };
      return {
        ...prev,
        [toothNum]: {
          ...toothData,
          status: status,
        },
      };
    });
  };

  const handleNotesChange = (toothNum, notes) => {
    setToothNotes(prev => ({
      ...prev,
      [toothNum]: notes
    }));
  };

  const addProcedure = (toothNum, procedureType) => {
    // Legacy helper - can be removed if not used elsewhere
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col bg-gray-50 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header skeleton */}
            <div className="flex items-center gap-3 py-4">
              <SkeletonBox className="w-9 h-9 rounded-full" />
              <SkeletonBox className="w-12 h-12 rounded-full" />
              <div>
                <SkeletonBox className="h-7 w-48 mb-2" />
                <div className="flex gap-1.5">
                  <SkeletonBox className="h-5 w-16 rounded-full" />
                  <SkeletonBox className="h-5 w-20 rounded-full" />
                  <SkeletonBox className="h-5 w-24 rounded-full" />
                </div>
              </div>
            </div>
            {/* Tab strip skeleton */}
            <div className="border-b border-gray-200 mb-4">
              <div className="flex gap-8 pb-2">
                {[...Array(4)].map((_, i) => <SkeletonBox key={i} className="h-5 w-24" />)}
              </div>
            </div>
            {/* Content skeleton */}
            <SkeletonCards count={4} />
            <div className="mt-6 space-y-3">
              <SkeletonBox className="h-24 w-full rounded-xl" />
              <SkeletonBox className="h-24 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Patient not found</p>
          <button
            onClick={() => navigate("/patient-files")}
            className="px-4 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548]"
          >
            Back to Patient Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {!isCasePaperOpen && (
            <PatientFileHeader
              patient={patientData}
              user={user}
              lastVisit={latestCasePaper?.date || patientData.last_visit}
              nextAppointment={nextAppointment}
              outstanding={outstandingDue}
              onBack={() => navigate("/patient-files")}
              onEdit={() => setEditOpen(true)}
              onPrint={handlePrintFile}
              onDelete={() => setDeleteOpen(true)}
              onViewBilling={() => setActiveTab('billing')}
            />
          )}

          {/* Tab Navigation */}
          {!isCasePaperOpen && (
            <div className="mb-4">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 md:space-x-8 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${activeTab === tab.id
                        ? "border-[#2a276e] text-[#2a276e]"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {/* Tab Content */}
          <div className="pb-10">
            {activeTab === "overview" && (
              <PatientOverviewTab
                patient={patientData}
                casePapers={casePapers}
                appointments={appointments}
                invoices={invoices}
                outstandingDue={outstandingDue}
                prescriptions={normalizedPrescriptions}
                onOpenTab={setActiveTab}
                onOpenCalendar={() => navigate('/calendar')}
                onBookAppointment={() => setBookingOpen(true)}
                onNewPayment={() => setNewInvoiceOpen(true)}
                onNewPrescription={() => { setRxEditing(null); setRxOpen(true); }}
                onOpenPrescription={(rx) => { setRxEditing(rx); setRxOpen(true); }}
                onQuickAction={(key) => {
                  // Every tile does the thing rather than pointing at the tab
                  // that could. The three that open a drawer do it here; the
                  // two that are genuinely a different screen still navigate,
                  // and Print reuses the header menu's handler so there is one
                  // print path and not two.
                  if (key === 'visit') setActiveTab('case-papers');
                  if (key === 'prescription') { setRxEditing(null); setRxOpen(true); }
                  if (key === 'plan') setActiveTab('case-papers');
                  if (key === 'document') setUploadKind('document');
                  if (key === 'photo') setUploadKind('xray');
                  if (key === 'print') handlePrintFile();
                }}
              />
            )}

            {activeTab === "case-papers" && (
              <CasePapersTab
                patientData={patientData}
                teethData={teethData}
                toothNotes={toothNotes}
                selectedTooth={selectedTooth}
                onToothSelect={handleToothSelect}
                onSurfaceConditionChange={handleSurfaceConditionChange}
                onToothStatusChange={handleToothStatusChange}
                onNotesChange={handleNotesChange}
                upcomingAppointments={upcomingAppointments}
                treatmentHistory={treatmentHistory}
                treatmentPlan={treatmentPlan}
                onUpdatePlan={handleTreatmentPlanUpdate}
                onGeneratePlan={generateTreatmentPlan}
                onSaveClinicalRecords={savePatientData}
                prescriptions={prescriptions}
                patientPhone={patientData?.phone}
                payments={payments}
                patientId={patientId}
                appointments={appointments}
                refreshPayments={fetchPayments}
                refreshInvoices={fetchInvoices}
                onCasePaperStateChange={(isOpen) => setIsCasePaperOpen(isOpen)}
              />
            )}

            {activeTab === "billing" && (
              secondaryLoading ? (
                <TabSkeleton />
              ) : (
                <BillingTab
                  patient={patientData}
                  invoices={invoices}
                  casePapers={casePapers}
                  prescriptions={normalizedPrescriptions}
                  patientId={patientId}
                  refreshInvoices={fetchInvoices}
                />
              )
            )}

            {activeTab === "imaging" && <ImagingTab patientId={patientId} patient={patientData} user={user} />}



            {activeTab === "files" && (
              <DocumentsTab
                patientId={patientId}
                patient={patientData}
                prescriptions={normalizedPrescriptions}
                invoices={invoices}
                onQuickAction={(key) => {
                  if (key === 'prescription') { setRxEditing(null); setRxOpen(true); }
                  if (key === 'invoice') setNewInvoiceOpen(true);
                  // Consents are authored per clinic, not per patient, so this
                  // is the one that legitimately leaves the patient file.
                  if (key === 'consent') navigate('/consent-forms');
                }}
              />
            )}

            {activeTab === "visits" && (
              secondaryLoading ? (
                <TabSkeleton />
              ) : (
                <VisitsTab
                  casePapers={casePapers}
                  appointments={appointments}
                  nextAppointment={nextAppointment}
                  onOpenVisit={() => setActiveTab('case-papers')}
                  onBookAppointment={() => setBookingOpen(true)}
                  onOpenCalendar={() => navigate('/calendar')}
                />
              )
            )}
          </div>
        </div>
      </div>
      {/* Overview shortcuts. Each is the same component its own tab uses, so
          a prescription written here and one written on the tab are the same
          record through the same code. */}
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSaved={() => { setBookingOpen(false); loadAppointments(); }}
        initial={bookingInitial}
        doctors={doctors || []}
        treatments={treatmentTypes || []}
        chairCount={dayShape?.chairs || 1}
      />

      <PrescriptionDrawer
        isOpen={rxOpen}
        onClose={() => { setRxOpen(false); setRxEditing(null); }}
        onSave={() => { setRxOpen(false); setRxEditing(null); loadPrescriptions(); }}
        patientId={patientId}
        patientData={patientData}
        initialData={rxEditing}
      />

      <ScanUploadDrawer
        isOpen={Boolean(uploadKind)}
        onClose={() => setUploadKind(null)}
        onUpload={() => setUploadKind(null)}
        patientId={patientId}
      />

      {/* camelCase on the prefill: InvoiceEditor reads prefill.patientId, so
          passing patient_id was silently ignored and the drawer would have
          opened on an empty patient picker. */}
      {newInvoiceOpen && (
        <InvoiceEditor
          invoiceId="new"
          prefill={{ patientId: Number(patientId) }}
          onClose={() => setNewInvoiceOpen(false)}
          onSave={() => { setNewInvoiceOpen(false); fetchInvoices(); }}
        />
      )}

      {!isCasePaperOpen && (
        <ToothRightDrawer 
            isOpen={!!selectedTooth}
            onClose={() => handleToothSelect(null)}
            selectedTooth={selectedTooth}
            teethData={teethData}
            toothNotes={toothNotes}
            onSurfaceConditionChange={handleSurfaceConditionChange}
            onToothStatusChange={handleToothStatusChange}
            onNotesChange={handleNotesChange}
            onAddTreatment={(details) => {
                const newPlanItem = {
                    id: Date.now() + Math.random(),
                    date: new Date().toISOString().split('T')[0],
                    time: '10:00',
                    ...details
                };
                setTreatmentPlan(prev => [...prev, newPlanItem]);
                handleToothSelect(null);
                notify.done(`Treatment added to plan`);
            }}
        />
      )}

      <PatientEditModal
        open={editOpen}
        patient={patientData}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setPatientData((prev) => ({ ...prev, ...updated }))}
      />

      {/* Delete — gated on the clinic's master password, which doubles as the
          confirmation. There is deliberately no plain "are you sure" in front. */}
      <MasterPasswordModal
        open={deleteOpen}
        title="Delete this patient?"
        message={
          <>
            <span className="font-semibold text-gray-700">{patientData?.name}</span> and everything on
            their file goes with them: case papers, x-rays, prescriptions, bills and any payments already
            recorded. This <span className="font-semibold">cannot be undone</span>.
          </>
        }
        confirmLabel="Delete patient"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDeletePatient}
      />
    </div>
  );
};

export default PatientProfile;

