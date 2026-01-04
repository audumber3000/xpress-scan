import React, { useState, useEffect } from "react";
import { useHeader } from "../contexts/HeaderContext";
import { api } from "../utils/api";
import { isWindows, isMac } from "../utils/twain";
import TwainConnector from "../components/xray/TwainConnector";
import XrayCapture from "../components/xray/XrayCapture";
import XrayEditor from "../components/xray/XrayEditor";
import { toast } from 'react-toastify';
// GearLoader component - inline for desktop app
const GearLoader = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C4CF3]"></div>
);

const IMAGE_TYPES = [
  { value: 'bitewing', label: 'Bitewing' },
  { value: 'panoramic', label: 'Panoramic' },
  { value: 'periapical', label: 'Periapical' },
  { value: 'occlusal', label: 'Occlusal' },
  { value: 'ceph', label: 'Cephalometric' },
  { value: 'other', label: 'Other' }
];

const Xray = () => {
  const { setTitle } = useHeader();
  const [twainConnected, setTwainConnected] = useState(false);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [editedImage, setEditedImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setTitle('X-ray');
  }, [setTitle]);

  // Auto-connect TWAIN on page load (Windows only)
  useEffect(() => {
    if (isWindows() && !twainConnected) {
      // Auto-connect will be handled by TwainConnector component
    }
  }, [twainConnected]);

  // Fetch patients for search
  const fetchPatients = async () => {
    if (searchQuery.length < 2) {
      setPatients([]);
      return;
    }

    try {
      setLoadingPatients(true);
      const response = await api.get("/patients/");
      const filtered = response.filter(patient =>
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone?.includes(searchQuery) ||
        patient.village?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setPatients(filtered);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Error fetching patients:", error);
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch appointments for selected patient
  useEffect(() => {
    if (selectedPatient) {
      fetchAppointments();
    } else {
      setAppointments([]);
    }
  }, [selectedPatient]);

  const fetchAppointments = async () => {
    if (!selectedPatient) return;

    try {
      const response = await api.get("/appointments/");
      const patientAppointments = response.filter(apt =>
        apt.patient_id === selectedPatient.id
      );
      setAppointments(patientAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      setAppointments([]);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setSearchQuery(patient.name);
    setShowSearchResults(false);
    setSelectedAppointment(null);
  };

  const handleImageCaptured = (imageData) => {
    setCapturedImage(imageData);
    setEditedImage(imageData);
  };

  const handleImageEdit = (editedData) => {
    setEditedImage(editedData);
  };

  const handleSave = async () => {
    if (!selectedPatient || !capturedImage) {
      toast.error("Please select a patient and capture an X-ray first");
      return;
    }

    if (!capturedImage.imageData) {
      toast.error("No image data to upload");
      return;
    }

    setUploading(true);
    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // Convert image data to File/Blob
      const blob = new Blob([capturedImage.imageData], { type: 'application/dicom' });
      const file = new File([blob], `${capturedImage.imageType}_${Date.now()}.dcm`, {
        type: 'application/dicom'
      });
      
      formData.append('file', file);
      formData.append('patient_id', selectedPatient.id.toString());
      if (selectedAppointment) {
        formData.append('appointment_id', selectedAppointment.id.toString());
      }
      formData.append('image_type', capturedImage.imageType);
      if (editedImage?.brightness !== undefined) {
        formData.append('brightness', editedImage.brightness.toString());
      }
      if (editedImage?.contrast !== undefined) {
        formData.append('contrast', editedImage.contrast.toString());
      }

      await api.post("/xray/upload", formData);

      toast.success("X-ray image saved successfully!");
      
      // Reset state
      setCapturedImage(null);
      setEditedImage(null);
      setSelectedAppointment(null);
    } catch (error) {
      console.error("Error uploading X-ray:", error);
      toast.error(error.message || "Failed to upload X-ray image");
    } finally {
      setUploading(false);
    }
  };

  // Mac detection - show not supported message
  if (isMac()) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">X-ray Feature Not Supported</h2>
          <p className="text-gray-600 mb-4">
            The X-ray feature using TWAIN protocol is only available on Windows.
          </p>
          <p className="text-sm text-gray-500">
            Please use the Windows version of the desktop app to access X-ray features.
          </p>
        </div>
      </div>
    );
  }

  // Web browser detection - show download message
  // Check if running in Tauri (desktop app)
  const isTauri = typeof window !== 'undefined' && window.__TAURI__;
  if (typeof window !== 'undefined' && !isTauri) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Desktop App Required</h2>
          <p className="text-gray-600 mb-4">
            X-ray feature requires the Windows desktop app to connect with TWAIN-compatible RVG sensors.
          </p>
          <button
            onClick={() => window.open('#', '_blank')}
            className="px-4 py-2 bg-[#6C4CF3] hover:bg-[#5b3dd9] text-white rounded-lg font-medium transition-colors"
          >
            Download Desktop App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* TWAIN Connection Status */}
          <TwainConnector
            onConnected={() => setTwainConnected(true)}
            onDisconnected={() => setTwainConnected(false)}
            onError={(error) => {
              console.error("TWAIN error:", error);
              toast.error(`TWAIN connection error: ${error.message}`);
            }}
          />

          {/* Patient Selection */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Selection</h3>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                placeholder="Search patient by name, phone, or village..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]"
                disabled={loadingPatients}
              />
              {showSearchResults && searchQuery && patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {patients.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => handlePatientSelect(patient)}
                      className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{patient.name}</div>
                      <div className="text-sm text-gray-600">
                        {patient.age} years, {patient.gender} • {patient.phone || 'No phone'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedPatient && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-medium text-purple-900">
                  Selected: {selectedPatient.name}
                </p>
              </div>
            )}
          </div>

          {/* Appointment Selection */}
          {selectedPatient && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Appointment Selection (Optional)</h3>
              {appointments.length > 0 ? (
                <select
                  value={selectedAppointment?.id || ''}
                  onChange={(e) => {
                    const apt = appointments.find(a => a.id === parseInt(e.target.value));
                    setSelectedAppointment(apt || null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]"
                >
                  <option value="">No appointment (standalone X-ray)</option>
                  {appointments.map((apt) => (
                    <option key={apt.id} value={apt.id}>
                      {new Date(apt.appointment_date).toLocaleDateString()} - {apt.treatment || 'Treatment'}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500">No appointments found for this patient</p>
              )}
            </div>
          )}

          {/* X-ray Capture */}
          {selectedPatient && twainConnected && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Capture X-ray</h3>
              <XrayCapture
                onImageCaptured={handleImageCaptured}
                disabled={!twainConnected}
              />
            </div>
          )}

          {/* Image Editor */}
          {capturedImage && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Image</h3>
              <XrayEditor
                imageData={capturedImage}
                onImageChange={handleImageEdit}
                onSave={handleSave}
              />
            </div>
          )}

          {/* Save Button */}
          {capturedImage && selectedPatient && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={uploading}
                className="px-6 py-3 bg-[#6C4CF3] hover:bg-[#5b3dd9] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <GearLoader size="w-5 h-5" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save X-ray Image
                  </>
                )}
              </button>
            </div>
          )}

          {/* Instructions */}
          {!twainConnected && isWindows() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Please connect to the TWAIN driver above to start capturing X-ray images.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Xray;

