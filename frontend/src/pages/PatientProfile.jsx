import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  RealisticDentalChart,
  PatientTimeline,
  PatientBilling,
  PatientInfo,
  PatientPrescriptions,
  PatientFilesTab,
  CONDITION_LABELS,
  TOOTH_NAMES
} from "../components/patient";
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";
import { toast } from 'react-toastify';
import { patientService, appointmentService, paymentService, treatmentPlanService } from '../services/patientService';

const PatientProfile = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "chart");
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Dental chart state
  const [teethData, setTeethData] = useState({});
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [toothNotes, setToothNotes] = useState({});
  const [treatmentPlan, setTreatmentPlan] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  const tabs = [
    { id: "chart", name: "Dental Chart" },
    { id: "timeline", name: "Timeline" },
    { id: "billing", name: "Billing" },
    { id: "profile", name: "Patient Info" },
    { id: "prescriptions", name: "Prescriptions" },
    { id: "files", name: "Files" }
  ];

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
          toast.error('Failed to load patient data.');
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
            doctor: apt.doctor_name || 'Unassigned'
          }));

          setAppointments(transformedAppointments);
        } catch (error) {
          console.error('Error fetching appointments:', error);
          // Don't show alert, just log the error
          setAppointments([]);
        }

        // Fetch all payments and filter by patient_id (optional - don't show error)
        try {
          const allPayments = await paymentService.getPayments({ limit: 1000 });
          const patientPayments = allPayments.filter(payment => payment.patient_id === parseInt(patientId));

          // Transform payments for display
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
          // Don't show alert, just log the error
          setPayments([]);
        }

      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [patientId]);

  const savePatientData = async () => {
    try {
      setIsSaving(true);
      
      // Save dental chart, tooth notes, and prescriptions
      const dataToSave = {
        dental_chart: teethData,
        tooth_notes: toothNotes,
        prescriptions: prescriptions
      };
      console.log('💾 Saving patient data:', dataToSave);
      await patientService.updatePatient(patientId, dataToSave);
      
      // Save treatment plans via API to create appointments
      if (treatmentPlan && treatmentPlan.length > 0) {
        console.log('📋 Saving treatment plans with appointment creation...');
        for (const plan of treatmentPlan) {
          // Only create via API if it has date and time (for appointment creation)
          if (plan.date && plan.time && !plan.appointment_id) {
            try {
              console.log('Creating treatment plan with appointment:', plan);
              const createdPlan = await treatmentPlanService.createTreatmentPlan(patientId, {
                ...plan,
                create_appointment: true
              });
              console.log('✅ Treatment plan created:', createdPlan);
              // Update local state with appointment_id
              plan.appointment_id = createdPlan.appointment_id;
            } catch (err) {
              console.error('Failed to create treatment plan:', err);
            }
          }
        }
        // Update patient with treatment plans that now have appointment_ids
        await patientService.updatePatient(patientId, {
          treatment_plan: treatmentPlan
        });
      }
      
      console.log('✅ All data saved successfully');
      toast.success("Clinical records updated successfully.");
    } catch (error) {
      console.error("❌ Error saving patient data:", error);
      console.error("Error details:", error.response?.data);
      toast.error("Failed to update clinical records.");
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
    const newProcedure = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      procedure: procedureType,
      tooth: toothNum,
      dentist: 'Dr. Smith',
      notes: `${procedureType} for tooth #${toothNum}`,
      cost: 0,
      status: 'completed'
    };
    setTreatmentHistory(prev => [newProcedure, ...prev]);
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

          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
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

          {/* Tab Content */}
          <div className="pb-10">
            {activeTab === "chart" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                  <RealisticDentalChart
                    teethData={teethData}
                    toothNotes={toothNotes}
                    selectedTooth={selectedTooth}
                    onToothSelect={handleToothSelect}
                    onSurfaceConditionChange={handleSurfaceConditionChange}
                    onToothStatusChange={handleToothStatusChange}
                    onNotesChange={handleNotesChange}
                    editable={true}
                  />

                  {/* Tooth Notes */}
                  {selectedTooth && (
                    <div className="mt-10 p-6 bg-gradient-to-r from-[#9B8CFF]/5 to-transparent border-l-4 border-[#9B8CFF] rounded-r-xl">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-extrabold text-gray-900 text-lg">
                          Tooth #{selectedTooth} - {TOOTH_NAMES[selectedTooth]}
                        </h4>
                      </div>
                      <p className="text-gray-700 leading-relaxed font-medium">
                        {toothNotes[selectedTooth] || 'Clinical records for this tooth are being updated.'}
                      </p>
                    </div>
                  )}

                  {/* Teeth with Conditions Summary */}
                  <div className="mt-12">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-1.5 h-6 bg-[#2a276e] rounded-full"></div>
                      <h4 className="font-bold text-gray-900 text-xl">Active Conditions</h4>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase">Tooth</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase">Name</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase">Status</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase">Surfaces</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase">Clinical Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(teethData)
                            .filter(([_, data]) =>
                              data && (data.status !== 'present' || Object.keys(data.surfaces || {}).length > 0)
                            )
                            .map(([tooth, data]) => (
                              <tr
                                key={tooth}
                                onClick={() => handleToothSelect(parseInt(tooth))}
                                className={`group cursor-pointer transition-all border-b border-gray-50 last:border-0 ${selectedTooth === parseInt(tooth) ? 'bg-[#2a276e]/5' : 'hover:bg-gray-50'}`}
                              >
                                <td className="py-4 px-4">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${selectedTooth === parseInt(tooth) ? 'bg-[#2a276e] text-white shadow-md' : 'bg-gray-100 text-[#2a276e]'}`}>
                                    {tooth}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <p className="text-sm font-bold text-gray-900">{TOOTH_NAMES[tooth]}</p>
                                </td>
                                <td className="py-4 px-4">
                                  {data && data.status !== 'present' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                      {data.status}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide italic">Present</span>
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(data.surfaces || {}).map(([surface, condition]) => (
                                      <span key={surface} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-[10px] font-bold text-blue-700 border border-blue-100">
                                        {surface}: {CONDITION_LABELS[condition]}
                                      </span>
                                    ))}
                                    {Object.keys(data.surfaces || {}).length === 0 && <span className="text-xs text-gray-400">-</span>}
                                  </div>
                                </td>
                                <td className="py-4 px-4 max-w-xs">
                                  <p className="text-xs text-gray-500 truncate group-hover:whitespace-normal transition-all">
                                    {toothNotes[tooth] || <span className="italic opacity-30">No notes recorded</span>}
                                  </p>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {Object.entries(teethData).filter(([_, data]) => data && (data.status !== 'present' || Object.keys(data.surfaces || {}).length > 0)).length === 0 && (
                      <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 p-8 text-center">
                        <p className="text-gray-400 font-medium font-bold italic">Healthy Smile - No active conditions recorded.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "timeline" && (
              <PatientTimeline
                upcomingAppointments={upcomingAppointments}
                treatmentHistory={treatmentHistory}
                treatmentPlan={treatmentPlan}
                onUpdatePlan={handleTreatmentPlanUpdate}
                onGeneratePlan={generateTreatmentPlan}
              />
            )}

            {activeTab === "billing" && (
              <PatientBilling payments={payments} />
            )}

            {activeTab === "prescriptions" && (
              <PatientPrescriptions prescriptions={prescriptions} />
            )}

            {activeTab === "files" && (
              <PatientFilesTab patientId={patientId} />
            )}

            {activeTab === "profile" && (
              <PatientInfo patientData={patientData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;

