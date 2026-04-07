import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  RealisticDentalChart,
  PatientTimeline,
  PatientBilling,
  PatientInfo,
  PatientPrescriptions,
  PatientFilesTab,
  PatientVisitHistory,
  CasePapersTab,
  CONDITION_LABELS,
  TOOTH_NAMES,
  ToothRightDrawer
} from "../components/patient";
import GearLoader from "../components/GearLoader";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { toast } from 'react-toastify';
import { patientService, appointmentService, paymentService, treatmentPlanService } from '../services/patientService';

const PatientProfile = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "case-papers");
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [isCasePaperOpen, setIsCasePaperOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Dental chart state
  const [teethData, setTeethData] = useState({});
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [toothNotes, setToothNotes] = useState({});
  const [treatmentPlan, setTreatmentPlan] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [normalizedPrescriptions, setNormalizedPrescriptions] = useState([]);

  const tabs = [
    { id: "case-papers", name: "Case Papers" },
    { id: "billing", name: "Billing" },
    { id: "profile", name: "Patient Info" },
    { id: "files", name: "Files" }
  ];


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

        // Fetch patient details (required - show error if this fails)
        try {
          const patient = await patientService.getPatient(patientId);
          setPatientData(patient);

          // Initializing clinical state from patient dental data
          setTeethData(patient.dental_chart || {});
          setToothNotes(patient.tooth_notes || {});
          setTreatmentPlan(patient.treatment_plan || []);
          setPrescriptions(patient.prescriptions || []);
        } catch (error) {
          console.error('Error fetching patient data:', error);
          toast.error(getPermissionAwareErrorMessage(
            error,
            'Failed to load patient data.',
            "You don't have permission to view this patient profile."
          ));
          setLoading(false);
          return;
        }

        // Fetch all appointments and filter by patient_id (optional - don't show error)
        try {
          const allAppointments = await appointmentService.getAppointments();
          const patientAppointments = allAppointments.filter(apt => apt.patient_id === parseInt(patientId));

          // Transform appointments for display
          const transformedAppointments = patientAppointments.map(apt => ({
            id: apt.id,
            date: apt.appointment_date,
            time: apt.start_time,
            procedure: apt.treatment,
            status: apt.status,
            notes: apt.notes || '',
            doctor: apt.doctor_name || 'Unassigned',
            visit_number: apt.visit_number || null,
            clinic_name: apt.clinic_name || 'Zendral Dental Central'
          }));

          setAppointments(transformedAppointments);
        } catch (error) {
          console.error('Error fetching appointments:', error);
          // Don't show alert, just log the error
          setAppointments([]);
        }

        // Fetch all payments and filter by patient_id (optional - don't show error)
        await fetchPayments();
        
        // Fetch all invoices
        await fetchInvoices();

        // Fetch normalized prescriptions (new table)
        try {
          const res = await api.get(`/clinical/prescriptions/patient/${patientId}`);
          setNormalizedPrescriptions(Array.isArray(res) ? res : []);
        } catch (error) {
          console.error('Error fetching normalized prescriptions:', error);
          setNormalizedPrescriptions([]);
        }

      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [patientId]);


  const savePatientData = async (sessionData = null) => {
    try {
      setIsSaving(true);
      
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

      // Save treatment plans via API to create appointments (if needed)
      if (currentTreatmentPlan && currentTreatmentPlan.length > 0) {
        console.log('📋 Checking treatment plans for appointment creation...');
        for (const plan of currentTreatmentPlan) {
          if (plan.date && plan.time && !plan.appointment_id) {
            try {
              const createdPlan = await treatmentPlanService.createTreatmentPlan(patientId, {
                ...plan,
                create_appointment: true
              });
              plan.appointment_id = createdPlan.appointment_id;
            } catch (err) {
              console.error('Failed to create treatment plan:', err);
            }
          }
        }
        // Update patient one last time with appointment_ids
        await patientService.updatePatient(patientId, {
          treatment_plan: currentTreatmentPlan
        });
      }
      
      console.log('✅ All data saved successfully');
      toast.success("Clinical records updated successfully.");
    } catch (error) {
      console.error("❌ Error saving patient data:", error);
      toast.error(getPermissionAwareErrorMessage(
        error,
        "Failed to update clinical records.",
        "You don't have permission to update clinical records."
      ));
    } finally {
      setIsSaving(false);
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
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <GearLoader size="w-12 h-12" className="mx-auto mb-4" />
          <p className="text-gray-600">Loading patient data...</p>
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
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          {!isCasePaperOpen && (
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/patient-files")}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{patientData.name}</h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={savePatientData}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${isSaving
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#2a276e] text-white hover:bg-[#1a1548] shadow-blue-900/10'
                    }`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      Save Clinical Records
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          {!isCasePaperOpen && (
            <div className="mb-4">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm transition-all ${activeTab === tab.id
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
              <PatientBilling 
                invoices={invoices}
                payments={payments} 
                patientId={patientId} 
                appointments={appointments}
                refreshInvoices={fetchInvoices}
                refreshPayments={fetchPayments}
                patientPhone={patientData?.phone}
              />
            )}

            {activeTab === "files" && (
              <PatientFilesTab patientId={patientId} />
            )}

            {activeTab === "profile" && (
              <PatientInfo 
                patientData={patientData} 
                appointments={appointments}
                prescriptions={normalizedPrescriptions}
                invoices={payments}
              />
            )}
          </div>
        </div>
      </div>
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
                toast.success(`Treatment added to plan`);
            }}
        />
      )}
    </div>
  );
};

export default PatientProfile;

