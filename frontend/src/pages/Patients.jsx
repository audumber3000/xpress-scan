import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const PATIENTS_PER_PAGE = 9;

const defaultProfile = name => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=E5E7EB&color=374151&size=80&rounded=true`;

const Patients = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/patients/`);
        if (!res.ok) throw new Error("Failed to fetch patients");
        const data = await res.json();
        setPatients(Array.isArray(data) ? data : []);
      } catch (e) {
        setPatients([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, []);

  // Filter and paginate
  const filteredPatients = useMemo(() => {
    let filtered = patients;
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(s) ||
          (p.phone && p.phone.toLowerCase().includes(s)) ||
          (p.village && p.village.toLowerCase().includes(s)) ||
          (p.referred_by && p.referred_by.toLowerCase().includes(s))
      );
    }
    return filtered;
  }, [patients, search]);

  const totalPages = Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE) || 1;
  const paginatedPatients = filteredPatients.slice(
    (page - 1) * PATIENTS_PER_PAGE,
    page * PATIENTS_PER_PAGE
  );

  useEffect(() => { setPage(1); }, [search]);

  // Dropdown close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      // Only close if click is outside any dropdown menu
      if (!e.target.closest('.dropdown-menu') && !e.target.closest('.dropdown-trigger')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Dropdown logic
  const toggleDropdown = id => setOpenDropdown(openDropdown === id ? null : id);

  // Edit logic
  const handleEditPatient = patient => {
    setEditingPatient(patient);
    setEditFormData({
      name: patient.name || "",
      age: patient.age || "",
      gender: patient.gender || "",
      village: patient.village || "",
      phone: patient.phone || "",
      referred_by: patient.referred_by || "",
      scan_type: patient.scan_type || "",
      notes: patient.notes || "",
      profile_image_url: patient.profile_image_url || ""
    });
    setEditModalOpen(true);
    setOpenDropdown(null);
  };
  const handleEditFormChange = e => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleEditSubmit = async e => {
    e.preventDefault();
    setEditLoading(true);
    try {
      // Remove profile_image_url before sending to backend
      const { profile_image_url, ...dataToSend } = editFormData;
      const response = await fetch(`${API_URL}/patients/${editingPatient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend)
      });
      if (response.ok) {
        const updated = await response.json();
        setPatients(patients.map(p => p.id === editingPatient.id ? updated : p));
        setEditModalOpen(false);
        setEditingPatient(null);
        setEditFormData({});
      } else {
        alert("Failed to update patient");
      }
    } catch (err) {
      alert("Error updating patient");
    } finally {
      setEditLoading(false);
    }
  };
  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingPatient(null);
    setEditFormData({});
  };

  // Delete logic
  const handleDeletePatient = async patient => {
    if (!window.confirm(`Are you sure you want to delete ${patient.name}?`)) return;
    setDeleteLoading(patient.id);
    try {
      const response = await fetch(`${API_URL}/patients/${patient.id}`, { method: "DELETE" });
      if (response.ok) {
        setPatients(patients.filter(p => p.id !== patient.id));
      } else {
        alert("Failed to delete patient");
      }
    } catch {
      alert("Error deleting patient");
    } finally {
      setDeleteLoading(null);
      setOpenDropdown(null);
    }
  };

  return (
    <div className="w-full h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
            <p className="text-gray-600 mt-1">Manage and view all patients</p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate("/patient-intake")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition"
            >
              + New Patient
            </button>
          </div>
        </div>
      </div>
      {/* Filters and Search */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, phone, village, or referred by..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>
      {/* Patients Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="w-full flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading patients...</p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Village/City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scan Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
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
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <img
                          src={profileImg}
                          alt={p.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm"
                          style={{ minWidth: 40, minHeight: 40 }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.village}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.scan_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.referred_by}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.age}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{p.gender}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="dropdown-container relative">
                          <button 
                            onClick={() => toggleDropdown(p.id)}
                            className="p-1 rounded hover:bg-gray-100 dropdown-trigger"
                          >
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="6" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="18" r="1" /></svg>
                          </button>
                          {openDropdown === p.id && (
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200 dropdown-menu">
                              <div className="py-1">
                                <button
                                  onClick={e => { e.stopPropagation(); handleEditPatient(p); }}
                                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6 6M3 21v-6.586a2 2 0 01.586-1.414l9-9a2 2 0 012.828 0l3.172 3.172a2 2 0 010 2.828l-9 9A2 2 0 019.586 21H3z" /></svg>
                                  Edit
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeletePatient(p); }}
                                  disabled={deleteLoading === p.id}
                                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0016.138 5H7.862a2 2 0 00-1.995 1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                                  {deleteLoading === p.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
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
      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-xs text-gray-500 px-6 pb-6">
        <div>
          Showing {filteredPatients.length === 0 ? 0 : (page - 1) * PATIENTS_PER_PAGE + 1}
          -{Math.min(page * PATIENTS_PER_PAGE, filteredPatients.length)} of {filteredPatients.length} entries
        </div>
        <div className="flex gap-1">
          <button
            className="w-8 h-8 rounded border border-gray-200 bg-white hover:bg-green-50"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            &lt;
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={`w-8 h-8 rounded border border-gray-200 bg-white hover:bg-green-50 ${page === i + 1 ? 'bg-green-100 border-green-600 font-bold' : ''}`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            className="w-8 h-8 rounded border border-gray-200 bg-white hover:bg-green-50"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            &gt;
          </button>
        </div>
      </div>
      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Edit Patient</h2>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" name="name" value={editFormData.name} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
                  <input type="number" name="age" value={editFormData.age} onChange={handleEditFormChange} required min="0" max="150" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select name="gender" value={editFormData.gender} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Village/City *</label>
                  <input type="text" name="village" value={editFormData.village} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input type="tel" name="phone" value={editFormData.phone} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referred By *</label>
                  <input type="text" name="referred_by" value={editFormData.referred_by} onChange={handleEditFormChange} required placeholder="Dr. Name or Hospital" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scan Type *</label>
                  <select name="scan_type" value={editFormData.scan_type} onChange={handleEditFormChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Select Scan Type</option>
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
                  <input type="url" name="profile_image_url" value={editFormData.profile_image_url} onChange={handleEditFormChange} placeholder="https://example.com/image.jpg" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea name="notes" value={editFormData.notes} onChange={handleEditFormChange} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Additional notes about the patient..." />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closeEditModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancel</button>
                <button type="submit" disabled={editLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">{editLoading ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients; 