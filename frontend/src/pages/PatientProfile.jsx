import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import RealisticDentalChart, { CONDITION_LABELS, TOOTH_NAMES } from "../components/RealisticDentalChart";
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";

const PatientProfile = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("chart");
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [xrayImages, setXrayImages] = useState([]);

  const tabs = [
    { id: "chart", name: "Dental Chart" },
    { id: "timeline", name: "Timeline" },
    { id: "billing", name: "Billing" },
    { id: "profile", name: "Patient Info" },
    { id: "prescriptions", name: "Prescriptions" }
  ];

  // Fetch patient data
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId) return;
      
      try {
        setLoading(true);
        
        // Fetch patient details (required - show error if this fails)
        try {
          const patient = await api.get(`/patients/${patientId}`);
          setPatientData(patient);
        } catch (error) {
          console.error('Error fetching patient data:', error);
          alert('Failed to load patient data. Please try again.');
          setLoading(false);
          return;
        }
        
        // Fetch all appointments and filter by patient_id (optional - don't show error)
        try {
          const allAppointments = await api.get('/appointments');
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
          const allPayments = await api.get('/payments', { params: { limit: 1000 } });
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
        
        // Fetch X-ray images for patient (optional - don't show error)
        try {
          const xrays = await api.get(`/xray/patient/${patientId}`);
          setXrayImages(xrays || []);
        } catch (error) {
          console.error('Error fetching X-ray images:', error);
          setXrayImages([]);
        }
        
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [patientId]);

  // Dental chart state
  const [teethData, setTeethData] = useState({
    16: { status: 'present', surfaces: { O: 'filling_amalgam', M: 'filling_amalgam' } },
    26: { status: 'present', surfaces: { O: 'cavity', D: 'cavity' } },
    36: { status: 'present', surfaces: { O: 'crown', M: 'crown', D: 'crown', B: 'crown', L: 'crown' } },
    46: { status: 'rootCanal', surfaces: { O: 'filling_composite' } },
    38: { status: 'missing', surfaces: {} },
    18: { status: 'implant', surfaces: {} },
  });
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [toothNotes, setToothNotes] = useState({
    16: 'Amalgam filling placed on 2024-06-15 (MO surfaces)',
    26: 'Cavity detected on OD surfaces, treatment scheduled',
    36: 'Full porcelain crown placed on 2024-01-20',
    46: 'Root canal completed on 2023-11-10, composite restoration',
    38: 'Extracted due to impaction on 2024-12-01',
    18: 'Implant placed on 2023-06-15',
  });

  // Format time from HH:MM to HH:MM AM/PM
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Get patient initials for avatar
  const getPatientInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

  // Prescriptions - empty for now as there's no prescription data in the backend
  const prescriptions = [];

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
            className="px-4 py-2 bg-[#6C4CF3] text-white rounded-lg hover:bg-[#5b3dd9]"
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
          <div className="mb-6">
            <button
              onClick={() => navigate("/patient-files")}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Patient Files
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{patientData.name}</h1>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? "border-[#6C4CF3] text-[#6C4CF3]"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Dental Chart Tab */}
          {activeTab === "chart" && (
            <div className="space-y-6 pb-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
              <RealisticDentalChart
                teethData={teethData}
                selectedTooth={selectedTooth}
                onToothSelect={handleToothSelect}
                onSurfaceConditionChange={handleSurfaceConditionChange}
                onToothStatusChange={handleToothStatusChange}
                editable={true}
              />

              {/* Tooth Notes */}
              {selectedTooth && (
                <div className="mt-6 p-4 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">
                      Tooth #{selectedTooth} - {TOOTH_NAMES[selectedTooth]}
                    </h4>
                  </div>
                  <p className="text-sm text-gray-700">
                    {toothNotes[selectedTooth] || 'No notes for this tooth yet.'}
                  </p>
                </div>
              )}

              {/* Teeth with Conditions Summary */}
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-3">Teeth with Conditions</h4>
                <div className="space-y-2">
                  {Object.entries(teethData)
                    .filter(([_, data]) => 
                      data.status !== 'present' || Object.keys(data.surfaces || {}).length > 0
                    )
                    .map(([tooth, data]) => (
                      <button
                        key={tooth}
                        onClick={() => handleToothSelect(parseInt(tooth))}
                        className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-gray-900">Tooth #{tooth}</span>
                            <span className="text-sm text-gray-600 ml-2">{TOOTH_NAMES[tooth]}</span>
                            {data.status !== 'present' && (
                              <span className="ml-2 text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                                {data.status}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {Object.entries(data.surfaces || {}).map(([surface, condition]) => (
                              <span key={surface} className="text-xs px-2 py-1 bg-[#9B8CFF]/20 text-[#6C4CF3] rounded">
                                {surface}: {CONDITION_LABELS[condition]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  {Object.keys(teethData).length === 0 && (
                    <p className="text-gray-500 text-center py-4">No conditions recorded yet. Click on teeth to add.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Tab - Improved UI with Patient Journey */}
        {activeTab === "timeline" && (
          <div className="space-y-6">
            {/* Upcoming Appointments */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-[#6C4CF3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h3>
              </div>
              
              {upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.map((apt) => (
                    <div key={apt.id} className="p-4 border-l-4 border-[#6C4CF3] bg-[#9B8CFF]/10 rounded-r-lg hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-[#9B8CFF]/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-[#6C4CF3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{apt.procedure}</p>
                            <p className="text-sm text-[#6C4CF3] font-medium mt-1">
                              {new Date(apt.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at {formatTime(apt.time)}
                            </p>
                            {apt.doctor && (
                              <p className="text-sm text-gray-600 mt-1">Dr. {apt.doctor}</p>
                            )}
                            {apt.notes && (
                              <p className="text-sm text-gray-600 mt-1">{apt.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                            apt.status === 'accepted' ? 'bg-[#9B8CFF]/20 text-[#6C4CF3]' :
                            apt.status === 'confirmed' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No upcoming appointments</p>
              )}
            </div>

            {/* Treatment History Timeline */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-6 h-6 text-[#9B8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Treatment Journey</h3>
              </div>
              
              {/* Timeline with vertical line */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                
                <div className="space-y-6">
                  {treatmentHistory.map((treatment, index) => (
                    <div key={treatment.id} className="relative pl-12">
                      {/* Timeline dot with icon */}
                      <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        treatment.status === 'completed' ? 'bg-[#9B8CFF]/20' : 'bg-gray-100'
                      }`}>
                        {treatment.procedure.toLowerCase().includes('extraction') ? (
                          <svg className="w-5 h-5 text-[#9B8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : treatment.procedure.toLowerCase().includes('crown') ? (
                          <svg className="w-5 h-5 text-[#9B8CFF]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L4 5v6.5c0 5.25 3.5 10.15 8 11.5 4.5-1.35 8-6.25 8-11.5V5l-8-3z"/>
                          </svg>
                        ) : treatment.procedure.toLowerCase().includes('filling') ? (
                          <svg className="w-5 h-5 text-[#9B8CFF]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C10.34 2 9 3.34 9 5C9 5.87 9.32 6.67 9.84 7.28C8.78 8.13 8 9.46 8 11C8 11.7 8.13 12.36 8.37 12.97C7.55 13.23 6.87 13.77 6.42 14.47C5.97 15.17 5.76 16 5.76 16.84C5.76 18.58 7.18 20 8.92 20C10.2 20 11.3 19.23 11.78 18.13C11.92 18.21 12.07 18.26 12.22 18.26C12.37 18.26 12.52 18.21 12.66 18.13C13.14 19.23 14.24 20 15.52 20C17.26 20 18.68 18.58 18.68 16.84C18.68 16 18.47 15.17 18.02 14.47C17.57 13.77 16.89 13.23 16.07 12.97C16.31 12.36 16.44 11.7 16.44 11C16.44 9.46 15.66 8.13 14.6 7.28C15.12 6.67 15.44 5.87 15.44 5C15.44 3.34 14.1 2 12.44 2H12Z"/>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-[#9B8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Treatment Card */}
                      <div className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-base">{treatment.procedure}</h4>
                            <p className="text-sm text-gray-500 mt-1">{new Date(treatment.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}</p>
                          </div>
                          <span className="text-base font-semibold text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-300">
                            ₹{treatment.cost.toLocaleString('en-IN')}
                          </span>
                        </div>
                        
                        {treatment.notes && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-sm text-gray-600">{treatment.notes}</p>
                          </div>
                        )}

                        {/* Status badge */}
                        <div className="mt-3">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            treatment.status === 'completed' 
                              ? 'bg-[#9B8CFF]/20 text-[#6C4CF3] border border-[#9B8CFF]' 
                              : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                          }`}>
                            {treatment.status === 'completed' ? (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Completed
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                In Progress
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            {/* X-ray Images Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">X-ray Images</h3>
              {xrayImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {xrayImages.map((xray) => (
                    <div
                      key={xray.id}
                      className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        // Download or view X-ray
                        const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                        window.open(`${apiUrl}/xray/${xray.id}/download`, '_blank');
                      }}
                    >
                      <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-gray-900 truncate capitalize">{xray.image_type}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(xray.capture_date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No X-ray images found</p>
              )}
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Summary</h3>
              
              {/* Total Balance */}
              <div className="mb-6 p-4 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Total Paid</span>
                  <span className="text-2xl font-bold text-[#6C4CF3]">
                    ₹{payments.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-700">Total Payments</span>
                  <span className="text-xl font-semibold text-gray-900">
                    {payments.filter(p => p.status === 'success').length} transactions
                  </span>
                </div>
              </div>

              {/* Billing History */}
              <h4 className="font-semibold text-gray-900 mb-3">Payment History</h4>
              <div className="space-y-2">
                {payments.length > 0 ? (
                  payments.filter(p => p.status === 'success').map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{payment.procedure}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(payment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - {payment.payment_method}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-gray-400 mt-1">{payment.notes}</p>
                        )}
                      </div>
                      <span className="font-semibold text-gray-900">₹{payment.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No payment history available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Prescriptions Tab */}
        {activeTab === "prescriptions" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Prescriptions</h3>
            <div className="space-y-4">
              {prescriptions.length > 0 ? (
                prescriptions.map((rx) => (
                <div key={rx.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-[#6C4CF3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h4 className="font-semibold text-gray-900">{rx.medication}</h4>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      rx.status === 'active' ? 'bg-[#9B8CFF]/20 text-[#6C4CF3]' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rx.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-1"><strong>Dosage:</strong> {rx.dosage}</p>
                  <p className="text-sm text-gray-700 mb-1"><strong>Duration:</strong> {rx.duration}</p>
                  <p className="text-sm text-gray-500 mb-2">Prescribed: {rx.date}</p>
                  {rx.notes && (
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{rx.notes}</p>
                  )}
                </div>
              ))
              ) : (
                <p className="text-gray-500 text-center py-4">No prescriptions available</p>
              )}
            </div>
          </div>
        )}

        {/* Patient Info Tab */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 rounded-full bg-[#9B8CFF]/20 flex items-center justify-center text-xl font-semibold text-[#6C4CF3]">
                    {getPatientInitials(patientData.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{patientData.name}</p>
                    <p className="text-sm text-gray-600">{patientData.gender}, {patientData.age} years</p>
                  </div>
                </div>
                <div className="pt-3 space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-gray-600">{patientData.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-gray-600">{patientData.village}</span>
                  </div>
                  {patientData.created_at && (
                    <div className="flex items-center space-x-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-600">
                        Registered: {new Date(patientData.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Treatment Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Treatment Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Treatment Type</p>
                  <p className="text-sm text-gray-900">{patientData.treatment_type}</p>
                </div>
                {patientData.referred_by && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Referred By</p>
                    <p className="text-sm text-gray-900">{patientData.referred_by}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Payment Type</p>
                  <p className="text-sm text-gray-900">{patientData.payment_type}</p>
                </div>
                {patientData.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
                    <p className="text-sm text-gray-900">{patientData.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;

