import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";

const DoctorProfile = () => {
  // All state and hooks at the top
  const { user } = useAuth();
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.email?.split("@")[0] ||
    "User";
  const userEmail = user?.email || "";
  
  // User and clinic data state
  const [userData, setUserData] = useState(null);
  const [clinicData, setClinicData] = useState(null);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [userDataError, setUserDataError] = useState("");
  
  const [activeTab, setActiveTab] = useState("billing");
  const [scanTypes, setScanTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newScan, setNewScan] = useState({ name: "", price: "" });
  const [editId, setEditId] = useState(null);
  const [editScan, setEditScan] = useState({ name: "", price: "" });
  // Referred By state
  const [referringDoctors, setReferringDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [newDoctor, setNewDoctor] = useState({ name: "", hospital: "" });
  const [editDoctorId, setEditDoctorId] = useState(null);
  const [editDoctor, setEditDoctor] = useState({ name: "", hospital: "" });
  // Receptionist management states
  const [clinicUsers, setClinicUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [newUser, setNewUser] = useState({ 
    email: "", 
    role: "receptionist",
    name: "",
    permissions: {}
  });
  const [editUserModal, setEditUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);

  // Available roles
  const availableRoles = [
    { value: "receptionist", label: "Receptionist" },
    { value: "doctor", label: "Doctor" },
    { value: "clinic_owner", label: "Clinic Owner" }
  ];

  // Default permissions for each role
  const defaultPermissions = {
    receptionist: {
      patients: { view: true, edit: true, delete: false },
      reports: { view: true, edit: false, delete: false },
      billing: { view: true, edit: false },
      users: { view: false, edit: false, delete: false }
    },
    doctor: {
      patients: { view: true, edit: true, delete: true },
      reports: { view: true, edit: true, delete: true },
      billing: { view: true, edit: true },
      users: { view: true, edit: false, delete: false }
    },
    clinic_owner: {
      patients: { view: true, edit: true, delete: true },
      reports: { view: true, edit: true, delete: true },
      billing: { view: true, edit: true },
      users: { view: true, edit: true, delete: true }
    }
  };

  // Available permissions
  const availablePermissions = [
    { key: "patients", label: "Patients", permissions: ["view", "edit", "delete"] },
    { key: "reports", label: "Reports", permissions: ["view", "edit", "delete"] },
    { key: "billing", label: "Billing", permissions: ["view", "edit"] },
    { key: "users", label: "Users", permissions: ["view", "edit", "delete"] }
  ];

  // Handle role change and update default permissions
  const handleRoleChange = (role) => {
    setNewUser({
      ...newUser,
      role,
      permissions: defaultPermissions[role] || {}
    });
  };

  // Open permissions modal for a specific user
  const handleEditPermissions = (user) => {
    setSelectedUserForPermissions(user);
    setShowPermissionsModal(true);
  };

  // Fetch user and clinic data
  const fetchUserAndClinicData = async () => {
    try {
      setLoadingUserData(true);
      setUserDataError("");
      const data = await api.get('/auth/me');
      setUserData(data);
      setClinicData(data.clinic);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setUserDataError('Failed to load user data');
    } finally {
      setLoadingUserData(false);
    }
  };

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserAndClinicData();
  }, []);

  // Fetch receptionist users
  const fetchClinicUsers = async () => {
    setLoadingUsers(true);
    setUsersError("");
    try {
      const data = await api.get("/clinic-users/");
      setClinicUsers(data);
    } catch (e) {
      setUsersError(e.message);
    } finally {
      setLoadingUsers(false);
    }
  };
  useEffect(() => {
    if (activeTab === "users") fetchClinicUsers();
    // eslint-disable-next-line
  }, [activeTab]);

  // Add receptionist
  const handleAddReceptionist = async (e) => {
    e.preventDefault();
    setUsersError("");
    try {
      await api.post("/clinic-users/", { 
        email: newUser.email, 
        name: newUser.name || newUser.email.split('@')[0], // Use email prefix as name
        role: newUser.role,
        permissions: newUser.permissions
      });
      setNewUser({ 
        email: "", 
        role: "receptionist",
        name: "",
        permissions: {}
      });
      fetchClinicUsers();
    } catch (e) {
      setUsersError(e.message);
    }
  };

  // Update receptionist permissions
  const handleUpdatePermissions = async (userId, updateData) => {
    setUsersError("");
    try {
      console.log("Updating user permissions:", { userId, updateData });
      await api.put(`/clinic-users/${userId}`, updateData);
      setShowPermissionsModal(false);
      setSelectedUserForPermissions(null);
      fetchClinicUsers();
    } catch (e) {
      console.error("Permission update error:", e);
      setUsersError(e.message);
    }
  };

  // Delete receptionist
  const handleDeleteReceptionist = async (userId) => {
    if (!window.confirm("Delete this receptionist?")) return;
    setUsersError("");
    try {
      await api.delete(`/clinic-users/${userId}`);
      fetchClinicUsers();
    } catch (e) {
      setUsersError(e.message);
    }
  };

  // Update user role
  const handleUpdateRole = async (userId, newRole) => {
    setUsersError("");
    try {
      await api.put(`/clinic-users/${userId}`, { role: newRole });
      fetchClinicUsers();
    } catch (e) {
      setUsersError(e.message);
    }
  };

  const SECTION_OPTIONS = [
    { key: 'patients', label: 'Patients' },
    { key: 'reports', label: 'Reports' },
    { key: 'billing', label: 'Billing' },
    // Add more sections as needed
  ];

  const PERMISSION_KEYS = [
    { key: 'can_view', label: 'View' },
    { key: 'can_edit', label: 'Edit' },
    { key: 'can_delete', label: 'Delete' },
  ];

  const EditReceptionistModal = ({ user, onClose, onSave }) => {
    const [permissions, setPermissions] = useState({});
    const [selectedRole, setSelectedRole] = useState("");
    const [customMode, setCustomMode] = useState(false);

    useEffect(() => {
      if (user) {
        setPermissions(user.permissions || {});
        setSelectedRole(user.role || "receptionist");
      }
    }, [user]);

    const handleCheckbox = (section, permission) => {
      setPermissions(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [permission]: !prev[section]?.[permission]
        }
      }));
    };

    const handleRoleChange = (role) => {
      setSelectedRole(role);
      setPermissions(defaultPermissions[role] || {});
      setCustomMode(false);
    };

    const handlePresetChange = (preset) => {
      switch (preset) {
        case "receptionist":
          setPermissions(defaultPermissions.receptionist);
          setSelectedRole("receptionist");
          break;
        case "doctor":
          setPermissions(defaultPermissions.doctor);
          setSelectedRole("doctor");
          break;
        case "clinic_owner":
          setPermissions(defaultPermissions.clinic_owner);
          setSelectedRole("clinic_owner");
          break;
        case "custom":
          setCustomMode(true);
          break;
      }
    };

    const handleSave = () => {
      // Update both role and permissions
      onSave(user.id, { role: selectedRole, permissions });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 min-w-[700px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <h4 className="text-lg font-semibold mb-4">Manage User: {user?.email}</h4>
          
          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Role</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={selectedRole}
              onChange={(e) => handleRoleChange(e.target.value)}
            >
              {availableRoles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>

          {/* Permission Presets */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Quick Presets</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handlePresetChange("receptionist")}
                className={`px-3 py-1 rounded text-sm ${
                  selectedRole === "receptionist" && !customMode 
                    ? "bg-green-600 text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Receptionist
              </button>
              <button
                onClick={() => handlePresetChange("doctor")}
                className={`px-3 py-1 rounded text-sm ${
                  selectedRole === "doctor" && !customMode 
                    ? "bg-green-600 text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Doctor
              </button>
              <button
                onClick={() => handlePresetChange("clinic_owner")}
                className={`px-3 py-1 rounded text-sm ${
                  selectedRole === "clinic_owner" && !customMode 
                    ? "bg-green-600 text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Clinic Owner
              </button>
              <button
                onClick={() => handlePresetChange("custom")}
                className={`px-3 py-1 rounded text-sm ${
                  customMode 
                    ? "bg-blue-600 text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="mb-4">
            <h5 className="text-md font-medium mb-3">Permissions Matrix</h5>
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 border">Section</th>
                    {availablePermissions[0]?.permissions.map(p => (
                      <th key={p} className="text-left px-3 py-2 border text-center">{p.charAt(0).toUpperCase() + p.slice(1)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {availablePermissions.map(section => (
                    <tr key={section.key} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border font-medium">{section.label}</td>
                      {section.permissions.map(permission => (
                        <td key={permission} className="px-3 py-2 border text-center">
                          <input
                            type="checkbox"
                            checked={!!permissions[section.key]?.[permission]}
                            onChange={() => handleCheckbox(section.key, permission)}
                            className="accent-green-600 w-4 h-4"
                            disabled={!customMode && selectedRole !== "clinic_owner"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Permission Descriptions */}
          <div className="mb-6 text-sm text-gray-600">
            <h6 className="font-medium mb-2">Permission Descriptions:</h6>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>View:</strong> Can see and list items</p>
                <p><strong>Edit:</strong> Can create and modify items</p>
                <p><strong>Delete:</strong> Can remove items</p>
              </div>
              <div>
                <p><strong>Patients:</strong> Patient records management</p>
                <p><strong>Reports:</strong> Medical reports and documents</p>
                <p><strong>Billing:</strong> Financial and billing data</p>
                <p><strong>Users:</strong> User management and permissions</p>
              </div>
            </div>
          </div>

          {/* Current Permissions Summary */}
          <div className="mb-6 p-3 bg-gray-50 rounded">
            <h6 className="font-medium mb-2">Current Permissions Summary:</h6>
            <div className="text-sm">
              {availablePermissions.map(section => {
                const sectionPerms = permissions[section.key] || {};
                const activePerms = Object.entries(sectionPerms)
                  .filter(([_, enabled]) => enabled)
                  .map(([perm, _]) => perm);
                
                return (
                  <div key={section.key} className="mb-1">
                    <span className="font-medium">{section.label}:</span> {activePerms.length > 0 ? activePerms.join(", ") : "No permissions"}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn btn-gray px-4 py-2 rounded" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary bg-green-600 text-white px-4 py-2 rounded" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  // Fetch scan types
  useEffect(() => {
    if (activeTab === "billing") fetchScanTypes();
    // eslint-disable-next-line
  }, [activeTab]);

  const fetchScanTypes = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get("/scan-types/");
      setScanTypes(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Add scan type
  const handleAddScan = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/scan-types/", { 
        name: newScan.name, 
        price: parseFloat(newScan.price),
        is_active: true
      });
      setNewScan({ name: "", price: "" });
      fetchScanTypes();
    } catch (e) {
      setError(e.message);
    }
  };

  // Edit scan type
  const handleEditScan = (scan) => {
    setEditId(scan.id);
    setEditScan({ name: scan.name, price: scan.price });
  };
  const handleUpdateScan = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.put(`/scan-types/${editId}`, { 
        name: editScan.name, 
        price: parseFloat(editScan.price)
      });
      setEditId(null);
      setEditScan({ name: "", price: "" });
      fetchScanTypes();
    } catch (e) {
      setError(e.message);
    }
  };
  // Delete scan type
  const handleDeleteScan = async (id) => {
    if (!window.confirm("Delete this scan type?")) return;
    setError("");
    try {
      await api.delete(`/scan-types/${id}`);
      fetchScanTypes();
    } catch (e) {
      setError(e.message);
    }
  };

  // Fetch referring doctors
  useEffect(() => {
    if (activeTab === "referred") fetchReferringDoctors();
    // eslint-disable-next-line
  }, [activeTab]);

  const fetchReferringDoctors = async () => {
    setLoadingDoctors(true);
    setDoctorError("");
    try {
      const data = await api.get("/referring-doctors/");
      setReferringDoctors(data);
    } catch (e) {
      setDoctorError(e.message);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Add referring doctor
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setDoctorError("");
    try {
      await api.post("/referring-doctors/", {
        name: newDoctor.name,
        hospital: newDoctor.hospital,
        is_active: true
      });
      setNewDoctor({ name: "", hospital: "" });
      fetchReferringDoctors();
    } catch (e) {
      setDoctorError(e.message);
    }
  };

  // Edit referring doctor
  const handleEditDoctor = (doctor) => {
    setEditDoctorId(doctor.id);
    setEditDoctor({ name: doctor.name, hospital: doctor.hospital || "" });
  };
  const handleUpdateDoctor = async (e) => {
    e.preventDefault();
    setDoctorError("");
    try {
      await api.put(`/referring-doctors/${editDoctorId}`, {
        name: editDoctor.name,
        hospital: editDoctor.hospital
      });
      setEditDoctorId(null);
      setEditDoctor({ name: "", hospital: "" });
      fetchReferringDoctors();
    } catch (e) {
      setDoctorError(e.message);
    }
  };
  // Delete referring doctor
  const handleDeleteDoctor = async (id) => {
    if (!window.confirm("Delete this doctor?")) return;
    setDoctorError("");
    try {
      await api.delete(`/referring-doctors/${id}`);
      fetchReferringDoctors();
    } catch (e) {
      setDoctorError(e.message);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
      <h1 className="text-3xl font-bold mb-6">Doctor Profile</h1>
      
      {/* Personal Information Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
        {loadingUserData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-3 text-gray-600">Loading user data...</span>
            </div>
          </div>
        ) : userDataError ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-red-600 text-center py-4">{userDataError}</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              {/* Profile Picture */}
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mr-4">
                <span className="text-white text-xl font-bold">
                  {(userData?.first_name || userData?.name || userName).charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {userData?.first_name && userData?.last_name 
                    ? `${userData.first_name} ${userData.last_name}`
                    : userData?.name || userName
                  }
                </h3>
                <p className="text-gray-600">{userData?.email || userEmail}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Role</label>
                <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  {userData?.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'N/A'}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  {userData?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">User ID</label>
                <p className="text-gray-900 font-medium">{userData?.id || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clinic Information Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Clinic Information</h2>
        {loadingUserData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-3 text-gray-600">Loading clinic data...</span>
            </div>
          </div>
        ) : userDataError ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-red-600 text-center py-4">{userDataError}</div>
          </div>
        ) : clinicData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Clinic Name</label>
                <p className="text-gray-900 font-medium">{clinicData.name || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
                <p className="text-gray-900 font-medium">{clinicData.address || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                <p className="text-gray-900 font-medium">{clinicData.phone || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                <p className="text-gray-900 font-medium">{clinicData.email || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Specialization</label>
                <p className="text-gray-900 font-medium">{clinicData.specialization || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Plan</label>
                <p className="text-gray-900 font-medium">{clinicData.subscription_plan || 'N/A'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-4">
              <p className="text-gray-500">No clinic information available</p>
              <p className="text-sm text-gray-400 mt-1">Complete onboarding to set up clinic details</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabbed Section */}
      <div className="bg-white rounded-xl shadow p-0">
        <div className="border-b flex">
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "billing" ? "border-green-600 text-green-700" : "border-transparent text-gray-600 hover:text-green-700"}`}
            onClick={() => setActiveTab("billing")}
          >
            Billing
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "referred" ? "border-green-600 text-green-700" : "border-transparent text-gray-600 hover:text-green-700"}`}
            onClick={() => setActiveTab("referred")}
          >
            Referred By
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "users" ? "border-green-600 text-green-700" : "border-transparent text-gray-600 hover:text-green-700"}`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "other" ? "border-green-600 text-green-700" : "border-transparent text-gray-600 hover:text-green-700"}`}
            onClick={() => setActiveTab("other")}
          >
            Other
          </button>
        </div>
        <div className="p-6">
          {activeTab === "billing" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Scan Types & Pricing</h3>
              {error && <div className="text-red-500 mb-2">{error}</div>}
              {loading ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full mb-6">
                  <thead>
                    <tr className="text-left text-gray-700 border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Price (₹)</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanTypes.map((scan) => (
                      <tr key={scan.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 pr-4">
                          {editId === scan.id ? (
                            <input
                              className="input input-bordered px-2 py-1 rounded border"
                              value={editScan.name}
                              onChange={e => setEditScan({ ...editScan, name: e.target.value })}
                            />
                          ) : (
                            scan.name
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editId === scan.id ? (
                            <input
                              type="number"
                              className="input input-bordered px-2 py-1 rounded border"
                              value={editScan.price}
                              onChange={e => setEditScan({ ...editScan, price: e.target.value })}
                            />
                          ) : (
                            scan.price
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editId === scan.id ? (
                            <>
                              <button className="text-green-600 mr-2" onClick={handleUpdateScan}>Save</button>
                              <button className="text-gray-500" onClick={() => setEditId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="text-blue-600 mr-2" onClick={() => handleEditScan(scan)}>Edit</button>
                              <button className="text-red-600" onClick={() => handleDeleteScan(scan.id)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Add new scan type */}
              <form className="flex gap-4 items-end" onSubmit={handleAddScan}>
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newScan.name}
                    onChange={e => setNewScan({ ...newScan, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (₹)</label>
                  <input
                    type="number"
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newScan.price}
                    onChange={e => setNewScan({ ...newScan, price: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Add</button>
              </form>
            </div>
          )}
          {activeTab === "referred" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Referring Doctors</h3>
              {doctorError && <div className="text-red-500 mb-2">{doctorError}</div>}
              {loadingDoctors ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full mb-6">
                  <thead>
                    <tr className="text-left text-gray-700 border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Hospital</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referringDoctors.map((doctor) => (
                      <tr key={doctor.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 pr-4">
                          {editDoctorId === doctor.id ? (
                            <input
                              className="input input-bordered px-2 py-1 rounded border"
                              value={editDoctor.name}
                              onChange={e => setEditDoctor({ ...editDoctor, name: e.target.value })}
                            />
                          ) : (
                            doctor.name
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editDoctorId === doctor.id ? (
                            <input
                              className="input input-bordered px-2 py-1 rounded border"
                              value={editDoctor.hospital}
                              onChange={e => setEditDoctor({ ...editDoctor, hospital: e.target.value })}
                            />
                          ) : (
                            doctor.hospital || "-"
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editDoctorId === doctor.id ? (
                            <>
                              <button className="text-green-600 mr-2" onClick={handleUpdateDoctor}>Save</button>
                              <button className="text-gray-500" onClick={() => setEditDoctorId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="text-blue-600 mr-2" onClick={() => handleEditDoctor(doctor)}>Edit</button>
                              <button className="text-red-600" onClick={() => handleDeleteDoctor(doctor.id)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Add new referring doctor */}
              <form className="flex gap-4 items-end" onSubmit={handleAddDoctor}>
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newDoctor.name}
                    onChange={e => setNewDoctor({ ...newDoctor, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hospital (optional)</label>
                  <input
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newDoctor.hospital}
                    onChange={e => setNewDoctor({ ...newDoctor, hospital: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Add</button>
              </form>
            </div>
          )}
          {activeTab === "users" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Receptionist Users</h3>
              {usersError && <div className="text-red-500 mb-2">{usersError}</div>}
              {loadingUsers ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading users...</p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full border">
                  <thead>
                    <tr className="text-left text-gray-700 border-b">
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Current Permissions</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicUsers.map(user => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 pr-4">{user.email}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            user.role === 'clinic_owner' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="text-xs text-gray-600">
                            {availablePermissions.map(section => {
                              const sectionPerms = user.permissions?.[section.key] || {};
                              const activePerms = Object.entries(sectionPerms)
                                .filter(([_, enabled]) => enabled)
                                .map(([perm, _]) => perm);
                              
                              if (activePerms.length === 0) return null;
                              
                              return (
                                <div key={section.key} className="mb-1">
                                  <span className="font-medium">{section.label}:</span> {activePerms.join(", ")}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <button className="text-blue-600 mr-2" onClick={() => handleEditPermissions(user)}>Edit Permissions</button>
                          <button className="text-red-600" onClick={() => handleDeleteReceptionist(user.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Add new receptionist */}
              <form className="flex gap-4 items-end" onSubmit={handleAddReceptionist}>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    type="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newUser.role}
                    onChange={e => handleRoleChange(e.target.value)}
                  >
                    {availableRoles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Name (optional)</label>
                  <input
                    className="input input-bordered px-2 py-1 rounded border"
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Add</button>
              </form>
              {/* Edit permissions modal */}
              {showPermissionsModal && (
                <EditReceptionistModal
                  user={selectedUserForPermissions}
                  onClose={() => setShowPermissionsModal(false)}
                  onSave={handleUpdatePermissions}
                />
              )}
            </div>
          )}
          {activeTab === "other" && (
            <div className="text-gray-500">Other tab content (placeholder)</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorProfile; 