import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { toast } from 'react-toastify';
import { FaEye, FaEdit, FaTrash, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Search, Plus, User, Folder, X, Edit2, Trash2, Eye, UploadCloud, UserPlus } from "lucide-react";
import GearLoader from "../components/GearLoader";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";

const PATIENTS_PER_PAGE = 10;

const Patients = () => {
  const { user } = useAuth();
  const { setTitle, setRefreshFunction } = useHeader();
  const navigate = useNavigate();
  const location = useLocation();

  // Tabs state
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'files'
  
  // Data states
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Edit/Create states
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('edit'); // 'edit' or 'create'
  const [editingPatient, setEditingPatient] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    age: "",
    gender: "Male",
    phone: "",
    village: "",
    treatment_type: "General",
    referred_by: "",
    blood_group: "",
    patient_history: "",
    display_id: "",
    notes: ""
  });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef(null);

  // Parse URL params for tab state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'files') setActiveTab('files');
    else setActiveTab('list');
  }, [location.search]);

  // Handle tab change with URL sync
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm("");
    setPage(1);
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ search: params.toString() }, { replace: true });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;
    if (user.role === "clinic_owner") return true;
    const [section, action] = permission.split(":");
    return user.permissions[section]?.[action] === true;
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await api.get("/patients/");
      console.log("Fetched patients sample:", data[0]); // Debugging display_id
      setPatients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching patients:", e);
      toast.error(getPermissionAwareErrorMessage(
        e,
        "Failed to load patients",
        "You don't have permission to view patients."
      ));
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTitle(activeTab === 'list' ? 'Patients' : 'Patient Files');
    setRefreshFunction(() => fetchPatients);
  }, [setTitle, setRefreshFunction, activeTab]);

  useEffect(() => {
    fetchPatients();
  }, []);

  // Filtered and paginated logic
  const filteredData = useMemo(() => {
    return patients.filter((p) => {
      if (!debouncedSearch) return true;
      const s = debouncedSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(s) ||
        p.phone.toLowerCase().includes(s) ||
        p.village.toLowerCase().includes(s) ||
        p.treatment_type?.toLowerCase().includes(s) ||
        p.referred_by?.toLowerCase().includes(s) ||
        String(p.id).includes(s)
      );
    });
  }, [patients, debouncedSearch]);

  const totalPages = Math.ceil(filteredData.length / PATIENTS_PER_PAGE) || 1;
  const paginatedData = filteredData.slice(
    (page - 1) * PATIENTS_PER_PAGE,
    page * PATIENTS_PER_PAGE
  );

  const handleEditPatient = (patient) => {
    setEditingPatient(patient);
    setEditFormData({
      name: patient.name || "",
      age: patient.age || "",
      gender: patient.gender || "Male",
      phone: patient.phone || "",
      village: patient.village || "",
      treatment_type: patient.treatment_type || "General",
      referred_by: patient.referred_by || "",
      blood_group: patient.blood_group || "",
      patient_history: patient.patient_history || "",
      display_id: patient.display_id || "",
      notes: patient.notes || ""
    });
    setEditDrawerOpen(true);
  };

  const handleCreatePatient = () => {
    setDrawerMode('create');
    setEditingPatient(null);
    setEditFormData({
      name: "",
      age: "",
      gender: "Male",
      phone: "",
      village: "",
      treatment_type: "General",
      referred_by: "",
      blood_group: "",
      patient_history: "",
      display_id: "",
      notes: ""
    });
    setEditDrawerOpen(true);
  };

  const handleSavePatient = async () => {
    try {
      setEditLoading(true);
      if (drawerMode === 'edit') {
        await api.put(`/patients/${editingPatient.id}`, editFormData);
        toast.success("Patient updated successfully");
      } else {
        await api.post(`/patients/`, editFormData);
        toast.success("Patient created successfully");
      }
      setEditDrawerOpen(false);
      fetchPatients();
    } catch (e) {
      console.error("Error saving patient:", e);
      toast.error(e.response?.data?.detail || "Failed to save patient");
    } finally {
      setEditLoading(false);
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImporting(true);
      const res = await api.post("/patients/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(res.message || `Successfully imported ${res.imported_count} patients`);
      if (res.errors && res.errors.length > 0) {
        console.warn("Import errors:", res.errors);
        toast.warning(`Imported with ${res.errors.length} errors. Check console.`);
      }
      fetchPatients();
    } catch (err) {
      console.error("Import error:", err);
      toast.error(err.response?.data?.detail || "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  const getFolderIcon = () => (
    <div className="relative transform group-hover:scale-105 transition-transform duration-200">
      <svg width="84" height="68" viewBox="0 0 84 68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12C4 7.58172 7.58172 4 12 4H34.4853C36.607 4 38.6419 4.84286 40.1421 6.34315L45.8579 12.0569C47.3581 13.5571 49.393 14.4 51.5147 14.4H72C76.4183 14.4 80 17.9817 80 22.4V24H4V12Z" fill="#75B6F2"/>
        <path d="M4 21C4 16.5817 7.58172 13 12 13H72C76.4183 13 80 16.5817 80 21V56C80 60.4183 76.4183 64 72 64H12C7.58172 64 4 60.4183 4 56V21Z" fill="#90CAF9"/>
        <path d="M4 22C4 17.5817 7.58172 14 12 14H72C76.4183 14 80 17.5817 80 22V56C80 60.4183 76.4183 64 72 64H12C7.58172 64 4 60.4183 4 56V22Z" fill="url(#folder_grad)"/>
        <defs>
          <linearGradient id="folder_grad" x1="42" y1="14" x2="42" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#90CAF9"/>
            <stop offset="1" stopColor="#64B5F6"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50/30">
      
      {/* Tabs Design */}
      <div className="px-6 pt-4 border-b border-gray-200 bg-white">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('list')}
            className={`${
              activeTab === 'list'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Patient List
          </button>
          <button
            onClick={() => handleTabChange('files')}
            className={`${
              activeTab === 'files'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Patient Files
          </button>
        </nav>
      </div>

      {/* Search & Actions Area */}
      <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:max-w-md relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={activeTab === 'list' ? "Search for patients..." : "Search patient files..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportCSV} 
            accept=".csv" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap disabled:opacity-50"
          >
            <UploadCloud size={18} className="text-blue-500" /> {importing ? "Importing..." : "Import Patient"}
          </button>
          <button
            onClick={handleCreatePatient}
            className="flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-all shadow-sm whitespace-nowrap"
          >
            <UserPlus size={18} /> Create Patient
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12">
              <GearLoader size="w-10 h-10" />
              <p className="mt-4 text-gray-500 font-medium">Loading patients...</p>
            </div>
          ) : activeTab === 'list' ? (
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#f8fafc] sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">MRN</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Village/City</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender/Age</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Treatment Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Visit</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No patients found.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((patient) => (
                      <tr key={patient.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{patient.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{patient.display_id || '---'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.village}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.gender}/{patient.age}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.treatment_type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(patient.last_visit)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button 
                            onClick={() => navigate(`/patient-profile/${patient.id}`)}
                            className="p-1.5 text-[#2a276e] hover:bg-indigo-50 rounded-md transition-colors inline-flex"
                            title="View Reports"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditPatient(patient); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient); }}
                            disabled={deleteLoading === patient.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors inline-flex disabled:opacity-30"
                            title="Delete"
                          >
                            {deleteLoading === patient.id ? <GearLoader size="w-4 h-4" /> : <Trash2 size={16} />}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10">
                {paginatedData.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-gray-500 font-medium">
                    No folders found.
                  </div>
                ) : (
                  paginatedData.map((p) => (
                    <div 
                      key={p.id}
                      onClick={() => navigate(`/patient-profile/${p.id}`)}
                      className="group flex flex-col items-center p-4 rounded-xl hover:bg-blue-50/50 transition-all cursor-pointer"
                    >
                      {getFolderIcon()}
                      <div className="mt-4 flex flex-col items-center text-center">
                        <span className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">
                          {formatDate(p.created_at)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Pagination Matching Old Style */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum;
                  if (totalPages <= 5) pNum = i + 1;
                  else if (page <= 3) pNum = i + 1;
                  else if (page >= totalPages - 2) pNum = totalPages - 4 + i;
                  else pNum = page - 2 + i;
                  
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-all ${
                        page === pNum 
                          ? 'bg-[#2a276e] text-white' 
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Drawer (Modern update but keeping original fields) */}
      {editDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setEditDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-xl flex flex-col pt-6 animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {drawerMode === 'edit' ? 'Edit Patient' : 'Create New Patient'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {drawerMode === 'edit' ? 'Update patient details' : 'Enter patient information'}
              </p>
            </div>
            <button 
              onClick={() => setEditDrawerOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

            <div className="flex-1 overflow-y-auto px-6">
              <form id="edit-patient-form" onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input 
                    type="text" 
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                  />
                </div>
                {drawerMode === 'edit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                    <input 
                      type="text" 
                      readOnly
                      value={editFormData.display_id}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-500 text-sm cursor-not-allowed"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input 
                      type="number" 
                      required
                      value={editFormData.age}
                      onChange={(e) => setEditFormData({...editFormData, age: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select 
                      required
                      value={editFormData.gender}
                      onChange={(e) => setEditFormData({...editFormData, gender: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input 
                    type="tel" 
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Village/City</label>
                  <input 
                    type="text" 
                    required
                    value={editFormData.village}
                    onChange={(e) => setEditFormData({...editFormData, village: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Type</label>
                  <input 
                    type="text" 
                    value={editFormData.treatment_type}
                    onChange={(e) => setEditFormData({...editFormData, treatment_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referred By</label>
                  <input 
                    type="text" 
                    value={editFormData.referred_by}
                    onChange={(e) => setEditFormData({...editFormData, referred_by: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                    <select 
                      value={editFormData.blood_group}
                      onChange={(e) => setEditFormData({...editFormData, blood_group: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient History</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Diabetics, Hypertension"
                      value={editFormData.patient_history}
                      onChange={(e) => setEditFormData({...editFormData, patient_history: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea 
                    rows="3"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm resize-none"
                  />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 mt-auto">
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setEditDrawerOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                onClick={handleSavePatient}
                disabled={editLoading}
                className="flex-1 bg-[#2a276e] text-white py-3 rounded-xl font-bold hover:bg-[#1a1548] transition-all shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {editLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                {drawerMode === 'edit' ? 'Update Patient' : 'Create Patient'}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;