import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

const Settings = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "receptionist"
  });

  // Helper function to check if user has permission
  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;
    if (user.role === "clinic_owner") return true;
    
    // Parse permission string (e.g., "billing:edit" -> ["billing", "edit"])
    const [section, action] = permission.split(":");
    
    // Check nested permission structure
    if (user.permissions[section] && user.permissions[section][action]) {
      return user.permissions[section][action] === true;
    }
    
    return false;
  };

  // Tab management
  const [activeTab, setActiveTab] = useState("billing");

  // Billing state
  const [scanTypes, setScanTypes] = useState([]);
  const [loadingScanTypes, setLoadingScanTypes] = useState(false);
  const [showAddScanModal, setShowAddScanModal] = useState(false);
  const [showEditScanModal, setShowEditScanModal] = useState(false);
  const [editingScan, setEditingScan] = useState(null);
  const [scanFormData, setScanFormData] = useState({
    name: "",
    price: ""
  });

  // Referred By state
  const [referringDoctors, setReferringDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [showEditDoctorModal, setShowEditDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorFormData, setDoctorFormData] = useState({
    name: "",
    hospital: ""
  });

  // Users state
  const [error, setError] = useState("");
  const [scanTypesError, setScanTypesError] = useState("");
  const [referringDoctorsError, setReferringDoctorsError] = useState("");
  
  // Permission editing state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);



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

  // Fallback roles for permission modal
  const fallbackRoles = [
    { value: "receptionist", label: "Receptionist" },
    { value: "doctor", label: "Doctor" },
    { value: "clinic_owner", label: "Clinic Owner" }
  ];

  useEffect(() => {
    if (activeTab === "billing") {
      fetchScanTypes();
    } else if (activeTab === "referred") {
      fetchReferringDoctors();
    } else if (activeTab === "users") {
      fetchUsers();
      fetchAvailableRoles();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get("/clinic-users/");
      console.log("Fetched users with permissions:", data);
        setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error fetching users");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRoles = async () => {
    try {
      const data = await api.get("/users/roles");
        setAvailableRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const fetchScanTypes = async () => {
    try {
      setLoadingScanTypes(true);
      setScanTypesError(""); // Clear previous error
      const data = await api.get("/scan-types/");
        setScanTypes(data);
    } catch (error) {
      console.error("Error fetching scan types:", error);
      setScanTypesError("Error fetching scan types");
    } finally {
      setLoadingScanTypes(false);
    }
  };

  const fetchReferringDoctors = async () => {
    try {
      setLoadingDoctors(true);
      setReferringDoctorsError(""); // Clear previous error
      const data = await api.get("/referring-doctors/");
        setReferringDoctors(data);
    } catch (error) {
      console.error("Error fetching referring doctors:", error);
      setReferringDoctorsError("Error fetching referring doctors");
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleScanInputChange = (e) => {
    const { name, value } = e.target;
    setScanFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDoctorInputChange = (e) => {
    const { name, value } = e.target;
    setDoctorFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/clinic-users/", formData);
        toast.success("User added successfully");
        setShowAddModal(false);
        setFormData({ name: "", email: "", role: "receptionist" });
        fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Error adding user");
    }
  };

  const handleAddScan = async (e) => {
    e.preventDefault();
    try {
      await api.post("/scan-types/", {
        name: scanFormData.name,
        price: parseFloat(scanFormData.price)
      });
        toast.success("Scan type added successfully");
        setShowAddScanModal(false);
        setScanFormData({ name: "", price: "" });
        fetchScanTypes();
    } catch (error) {
      console.error("Error adding scan type:", error);
      toast.error(error.message || "Error adding scan type");
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    try {
      await api.post("/referring-doctors/", doctorFormData);
        toast.success("Referring doctor added successfully");
        setShowAddDoctorModal(false);
        setDoctorFormData({ name: "", hospital: "" });
        fetchReferringDoctors();
    } catch (error) {
      console.error("Error adding referring doctor:", error);
      toast.error(error.message || "Error adding referring doctor");
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role
    });
    setShowEditModal(true);
  };

  const handleEditScan = (scan) => {
    setEditingScan(scan);
    setScanFormData({
      name: scan.name,
      price: scan.price.toString()
    });
    setShowEditScanModal(true);
  };

  const handleEditDoctor = (doctor) => {
    setEditingDoctor(doctor);
    setDoctorFormData({
      name: doctor.name,
      hospital: doctor.hospital
    });
    setShowEditDoctorModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };
      await api.put(`/clinic-users/${editingUser.id}`, updateData);
        toast.success("User updated successfully");
        setShowEditModal(false);
        setEditingUser(null);
        setFormData({ name: "", email: "", role: "receptionist" });
        fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Error updating user");
    }
  };

  const handleUpdateScan = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/scan-types/${editingScan.id}`, {
        name: scanFormData.name,
        price: parseFloat(scanFormData.price)
      });
        toast.success("Scan type updated successfully");
        setShowEditScanModal(false);
        setEditingScan(null);
        setScanFormData({ name: "", price: "" });
        fetchScanTypes();
    } catch (error) {
      console.error("Error updating scan type:", error);
      toast.error(error.message || "Error updating scan type");
    }
  };

  const handleUpdateDoctor = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/referring-doctors/${editingDoctor.id}`, doctorFormData);
        toast.success("Referring doctor updated successfully");
        setShowEditDoctorModal(false);
        setEditingDoctor(null);
        setDoctorFormData({ name: "", hospital: "" });
        fetchReferringDoctors();
    } catch (error) {
      console.error("Error updating referring doctor:", error);
      toast.error(error.message || "Error updating referring doctor");
    }
  };

  const handleDeleteUser = async (userId) => {
    // Find the user to check if they are a clinic owner
    const userToDelete = users.find(user => user.id === userId);
    
    if (userToDelete?.role === "clinic_owner") {
      toast.error("Clinic owners cannot be deleted");
      return;
    }
    
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        console.log("Deleting user with ID:", userId);
        await api.delete(`/clinic-users/${userId}`);
          toast.success("User deleted successfully");
          fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        toast.error(error.message || "Error deleting user");
      }
    }
  };

  const handleDeleteScan = async (id) => {
    if (window.confirm("Are you sure you want to delete this scan type?")) {
      try {
        console.log("Deleting scan type with ID:", id);
        await api.delete(`/scan-types/${id}`);
          toast.success("Scan type deleted successfully");
          fetchScanTypes();
      } catch (error) {
        console.error("Error deleting scan type:", error);
        toast.error(error.message || "Error deleting scan type");
      }
    }
  };

  const handleDeleteDoctor = async (id) => {
    if (window.confirm("Are you sure you want to delete this referring doctor?")) {
      try {
        console.log("Deleting referring doctor with ID:", id);
        await api.delete(`/referring-doctors/${id}`);
          toast.success("Referring doctor deleted successfully");
          fetchReferringDoctors();
      } catch (error) {
        console.error("Error deleting referring doctor:", error);
        toast.error(error.message || "Error deleting referring doctor");
      }
    }
  };

  // Permission editing functions
  const handleEditPermissions = (user) => {
    setSelectedUserForPermissions(user);
    setShowPermissionsModal(true);
  };

  const handleUpdatePermissions = async (userId, updateData) => {
    try {
      console.log("Updating user permissions:", { userId, updateData });
      
      // Use the same endpoint as DoctorProfile - clinic-users
      await api.put(`/clinic-users/${userId}`, updateData);
      
      toast.success("User permissions updated successfully");
      setShowPermissionsModal(false);
      setSelectedUserForPermissions(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user permissions:", error);
      toast.error(error.message || "Error updating user permissions");
    }
  };

  // Permission editing modal component
  const EditPermissionsModal = ({ user, onClose, onSave }) => {
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
              {(availableRoles.length > 0 ? availableRoles : fallbackRoles).map(role => (
                <option key={role.value || role} value={role.value || role}>{role.label || role}</option>
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
            <button className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400" onClick={onClose}>Cancel</button>
            <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your clinic settings and configurations</p>
      </div>

      {/* Tabbed Section */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex">
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "billing" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            onClick={() => setActiveTab("billing")}
          >
            Billing
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "referred" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            onClick={() => setActiveTab("referred")}
          >
            Referred By
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "users" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 ${activeTab === "other" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            onClick={() => setActiveTab("other")}
          >
            Other
          </button>
        </div>
      </div>
      <div>
          {activeTab === "billing" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Scan Types & Pricing</h3>
              {scanTypesError && <div className="text-red-500 mb-2">{scanTypesError}</div>}
              {!hasPermission("billing:view") ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">You don't have permission to view billing information.</p>
                </div>
              ) : loadingScanTypes ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading scan types...</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Current Scan Types</h4>
                    {hasPermission("billing:edit") && (
                    <button
                      onClick={() => setShowAddScanModal(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                      Add Scan Type
                    </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {scanTypes.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No scan types configured</p>
                    ) : (
                      scanTypes.map((scan) => (
                        <div key={scan.id} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-900">{scan.name}</span>
                              <span className="ml-4 text-gray-600">₹{scan.price}</span>
                            </div>
                            {hasPermission("billing:edit") && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditScan(scan)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteScan(scan.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                            )}
                          </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "referred" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Referring Doctors</h3>
              {referringDoctorsError && <div className="text-red-500 mb-2">{referringDoctorsError}</div>}
              {loadingDoctors ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading referring doctors...</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Current Referring Doctors</h4>
                    <button
                      onClick={() => setShowAddDoctorModal(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                      Add Doctor
                    </button>
                  </div>
                  <div className="space-y-3">
                    {referringDoctors.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No referring doctors configured</p>
                    ) : (
                      referringDoctors.map((doctor) => (
                        <div key={doctor.id} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-900">{doctor.name}</span>
                              <span className="ml-4 text-gray-600">{doctor.hospital}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditDoctor(doctor)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteDoctor(doctor.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "users" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">User Management</h3>
              {!hasPermission("users:view") ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">You don't have permission to view users.</p>
                </div>
              ) : loading ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading users...</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Current Users</h4>
                    {hasPermission("users:edit") && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                      Add User
                    </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {users.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No users found</p>
                    ) : (
                      users.map((user) => (
                        <div key={user.id} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <span className="font-medium text-gray-900">{user.name}</span>
                              <span className="ml-4 text-gray-600">{user.email}</span>
                              <span className="ml-4 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                {user.role}
                              </span>
                            </div>
                            {hasPermission("users:edit") && (
                            <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditPermissions(user)}
                                  className="text-green-600 hover:text-green-800 text-sm"
                                >
                                  Permissions
                                </button>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Edit
                              </button>
                                {user.role !== "clinic_owner" && hasPermission("users:delete") && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                                )}
                            </div>
                            )}
                          </div>
                          {user.permissions && (
                            <div className="mt-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">
                                Permissions:
                                {user.role === "clinic_owner" && (
                                  <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                    All Permissions (Clinic Owner)
                                  </span>
                                )}
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <h6 className="text-xs font-medium text-gray-600 mb-1">Patients</h6>
                                  <div className="flex flex-wrap gap-1">
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.patients?.view 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      View Patients
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.patients?.edit 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Edit Patients
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.patients?.delete 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Delete Patients
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <h6 className="text-xs font-medium text-gray-600 mb-1">Reports</h6>
                                  <div className="flex flex-wrap gap-1">
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.reports?.view 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      View Reports
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.reports?.edit 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Edit Reports
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.reports?.delete 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Delete Reports
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <h6 className="text-xs font-medium text-gray-600 mb-1">Billing</h6>
                                  <div className="flex flex-wrap gap-1">
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.billing?.view 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      View Billing
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.billing?.edit 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Edit Billing
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <h6 className="text-xs font-medium text-gray-600 mb-1">Users</h6>
                                  <div className="flex flex-wrap gap-1">
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.users?.view 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      View Users
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.users?.edit 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Edit Users
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.users?.delete 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Delete Users
                                    </span>
                                  </div>
                                </div>
                              </div>
                      </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "other" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Other Settings</h3>
              <p className="text-gray-600">Additional settings and configurations will be available here.</p>
            </div>
          )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add User</h3>
            <form onSubmit={handleAddUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {availableRoles.map((role) => (
                    <option key={role.value || role} value={role.value || role}>
                      {role.label || role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            <form onSubmit={handleUpdateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {availableRoles.map((role) => (
                    <option key={role.value || role} value={role.value || role}>
                      {role.label || role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Update User
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Scan Type Modal */}
      {showAddScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add Scan Type</h3>
            <form onSubmit={handleAddScan}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={scanFormData.name}
                  onChange={handleScanInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                <input
                  type="number"
                  name="price"
                  value={scanFormData.price}
                  onChange={handleScanInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Add Scan Type
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddScanModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Scan Type Modal */}
      {showEditScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Edit Scan Type</h3>
            <form onSubmit={handleUpdateScan}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={scanFormData.name}
                  onChange={handleScanInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                <input
                  type="number"
                  name="price"
                  value={scanFormData.price}
                  onChange={handleScanInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Update Scan Type
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditScanModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add Referring Doctor</h3>
            <form onSubmit={handleAddDoctor}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={doctorFormData.name}
                  onChange={handleDoctorInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hospital</label>
                <input
                  type="text"
                  name="hospital"
                  value={doctorFormData.hospital}
                  onChange={handleDoctorInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Add Doctor
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Doctor Modal */}
      {showEditDoctorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Edit Referring Doctor</h3>
            <form onSubmit={handleUpdateDoctor}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={doctorFormData.name}
                  onChange={handleDoctorInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hospital</label>
                <input
                  type="text"
                  name="hospital"
                  value={doctorFormData.hospital}
                  onChange={handleDoctorInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Update Doctor
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditDoctorModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedUserForPermissions && (
        <EditPermissionsModal
          user={selectedUserForPermissions}
          onClose={() => {
            setShowPermissionsModal(false);
            setSelectedUserForPermissions(null);
          }}
          onSave={handleUpdatePermissions}
        />
      )}
    </div>
  );
};

export default Settings; 