import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { toast } from 'react-toastify';
import { FaEye, FaFilePdf, FaSync, FaEdit, FaTrash, FaUser } from 'react-icons/fa';
import LoadingButton from "../components/LoadingButton";
import GearLoader from "../components/GearLoader";
import { useAuth } from "../contexts/AuthContext";

const PATIENTS_PER_PAGE = 8;

const defaultProfile = name => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=E5E7EB&color=374151&size=80&rounded=true`;

const Patients = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [patientsWithReports, setPatientsWithReports] = useState(new Set());
  const navigate = useNavigate();

  // Helper function to check if user has permission
  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;
    if (user.role === "clinic_owner") return true;
    
    const [section, action] = permission.split(":");
    
    if (user.permissions[section] && user.permissions[section][action]) {
      return user.permissions[section][action] === true;
    }
    
    return false;
  };

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await api.get("/patients/");
      setPatients(Array.isArray(data) ? data : []);
      
      // Also fetch reports to determine which patients have reports
      try {
        const reports = await api.get("/reports/");
        const patientsWithReportsSet = new Set();
        reports.forEach(report => {
          patientsWithReportsSet.add(report.patient_name);
        });
        setPatientsWithReports(patientsWithReportsSet);
      } catch (reportsError) {
        console.error("Error fetching reports:", reportsError);
      }
    } catch (e) {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Filtered and paginated patients
    const filteredPatients = patients.filter((patient) => {
    const matchesSearch = 
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.village.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.scan_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.referred_by.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE) || 1;
  const paginatedPatients = filteredPatients.slice(
    (page - 1) * PATIENTS_PER_PAGE,
    page * PATIENTS_PER_PAGE
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, patients]);

  const handleEditPatient = (patient) => {
    setEditingPatient(patient);
    setEditFormData({
      name: patient.name || "",
      age: patient.age || "",
      gender: patient.gender || "",
      village: patient.village || "",
      phone: patient.phone || "",
      referred_by: patient.referred_by || "",
      scan_type: patient.scan_type || "",
      profile_image_url: patient.profile_image_url || "",
      notes: patient.notes || ""
    });
    setEditModalOpen(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      await api.put(`/patients/${editingPatient.id}`, editFormData);
      toast.success("Patient updated successfully");
      closeEditModal();
      fetchPatients();
    } catch (error) {
      console.error("Error updating patient:", error);
      toast.error("Error updating patient");
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingPatient(null);
    setEditFormData({});
  };

  const handleDeletePatient = async (patient) => {
    if (!window.confirm(`Are you sure you want to delete ${patient.name}?`)) return;
    
    setDeleteLoading(patient.id);
    try {
      await api.delete(`/patients/${patient.id}`);
      toast.success("Patient deleted successfully");
      fetchPatients();
    } catch (error) {
      console.error("Error deleting patient:", error);
      toast.error("Error deleting patient");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleViewPatientReports = async (patient) => {
    try {
      const reports = await api.get("/reports/");
      const patientReports = reports.filter(report => 
        report.patient_name === patient.name
      );
      
      if (patientReports.length === 0) {
        toast.info("No reports found for this patient");
        return;
      }
      
      // Show the most recent report
      const reportToShow = patientReports[0];
      if (reportToShow.pdf_url) {
        window.open(reportToShow.pdf_url, "_blank");
      } else if (reportToShow.docx_url) {
        window.open(reportToShow.docx_url, "_blank");
      } else {
        toast.error("No report document available for this patient");
      }
    } catch (error) {
      console.error("Error fetching patient reports:", error);
      toast.error("Error loading patient reports");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 pb-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
              <button
                onClick={fetchPatients}
                disabled={loading}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Refresh patients"
              >
                <FaSync className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-gray-600 mt-1">Manage and track all patient records</p>
          </div>
          <div className="flex items-center space-x-4">
            {hasPermission("patients:edit") && (
              <button 
                onClick={() => navigate("/patient-intake")}
                className="px-4 py-2 bg-[#6C4CF3] text-white rounded-lg font-semibold text-sm hover:bg-[#5b3dd9] transition"
              >
                + New Patient
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]"
            />
          </div>
        </div>
      </div>

      {/* Patients Table Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {loading ? (
            <div className="w-full flex items-center justify-center py-16">
              <div className="text-center">
                <GearLoader size="w-8 h-8" className="mx-auto" />
                <p className="mt-2 text-sm text-gray-600">Loading patients...</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">MRN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Village/City</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Treatment Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div>
                        <p className="text-lg font-medium">No patients found</p>
                        <p className="text-sm mt-1">Patients will appear here once registered</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPatients.map((p) => {
                    const profileImg = p.profile_image_url || defaultProfile(p.name);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className="text-gray-900 font-medium text-sm">
                            #{p.id}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-semibold text-gray-900">{p.name}</div>
                            <div className="text-sm text-gray-500">{p.age} years • {p.gender}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.village}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.scan_type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.referred_by}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewPatientReports(p)}
                              className="text-gray-400 hover:text-gray-600 transition-colors duration-150"
                              title="View Reports"
                            >
                              <FaEye className="w-4 h-4" />
                            </button>
                            {hasPermission("patients:edit") && (
                              <button
                                onClick={() => handleEditPatient(p)}
                                className="text-gray-400 hover:text-[#9B8CFF] transition-colors duration-150"
                                title="Edit Patient"
                              >
                                <FaEdit className="w-4 h-4" />
                              </button>
                            )}
                            {hasPermission("patients:delete") && (
                              <button
                                onClick={() => handleDeletePatient(p)}
                                disabled={deleteLoading === p.id}
                                className="text-gray-400 hover:text-red-600 transition-colors duration-150 disabled:opacity-50"
                                title="Delete Patient"
                              >
                                <FaTrash className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Sticky Pagination at Bottom */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 flex-shrink-0 sticky bottom-0 z-20 shadow-lg">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(page - 1) * PATIENTS_PER_PAGE + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * PATIENTS_PER_PAGE, filteredPatients.length)}</span> of{' '}
                <span className="font-medium">{filteredPatients.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === pageNum
                        ? 'z-10 bg-[#9B8CFF]/10 border-[#6C4CF3] text-[#6C4CF3]'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={closeEditModal}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Patient</h2>
              <button onClick={closeEditModal} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <form id="edit-patient-form" onSubmit={handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" name="name" value={editFormData.name} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
                  <input type="number" name="age" value={editFormData.age} onChange={handleEditFormChange} required min="0" max="150" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select name="gender" value={editFormData.gender} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]">
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Village/City *</label>
                  <input type="text" name="village" value={editFormData.village} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input type="tel" name="phone" value={editFormData.phone} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referred By *</label>
                  <input type="text" name="referred_by" value={editFormData.referred_by} onChange={handleEditFormChange} required placeholder="Dr. Name or Hospital" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Type *</label>
                  <select name="scan_type" value={editFormData.scan_type} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]">
                    <option value="">Select Treatment Type</option>
                    <option value="CT Scan">CT Scan</option>
                    <option value="MRI">MRI</option>
                    <option value="X-Ray">X-Ray</option>
                    <option value="Ultrasound">Ultrasound</option>
                    <option value="PET Scan">PET Scan</option>
                    <option value="Mammography">Mammography</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profile Image URL</label>
                  <input type="url" name="profile_image_url" value={editFormData.profile_image_url} onChange={handleEditFormChange} placeholder="https://example.com/image.jpg" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea name="notes" value={editFormData.notes} onChange={handleEditFormChange} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C4CF3]" placeholder="Additional notes about the patient..." />
                </div>
              </div>
            </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <LoadingButton type="button" onClick={closeEditModal} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">Cancel</LoadingButton>
                <LoadingButton type="submit" form="edit-patient-form" loading={editLoading} disabled={editLoading} className="px-6 py-2 bg-[#6C4CF3] text-white rounded-lg hover:bg-[#5b3dd9] transition font-medium">Save Changes</LoadingButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients; 