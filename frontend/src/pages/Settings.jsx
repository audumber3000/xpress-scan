import React, { useState, useEffect, useMemo } from "react";
import { toast } from 'react-toastify';
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import StaffTable from "../components/settings/StaffTable";
import StaffTableHeader from "../components/settings/StaffTableHeader";
import UserDetailsPanel from "../components/settings/UserDetailsPanel";
import EditUserTab from "../components/settings/EditUserTab";
import PermissionsTab from "../components/settings/PermissionsTab";

// Settings page with Security tab for password management
const Settings = () => {
  const { user } = useAuth();
  const { setTitle } = useHeader();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "receptionist",
    password: ""
  });
  const [addingUser, setAddingUser] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [showStaffPasswordModal, setShowStaffPasswordModal] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [staffPassword, setStaffPassword] = useState("");
  const [staffPasswordConfirm, setStaffPasswordConfirm] = useState("");
  const [staffPasswordLoading, setStaffPasswordLoading] = useState(false);
  const [showPasswordAfterSet, setShowPasswordAfterSet] = useState(false);
  const [lastSetPassword, setLastSetPassword] = useState("");

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
  const [activeTab, setActiveTab] = useState("profile");
  const [profileSubTab, setProfileSubTab] = useState("users"); // 'users', 'clinic', or 'devices'
  
  // Device management state
  const [userDevices, setUserDevices] = useState({}); // { userId: [devices] }
  const [loadingUserDevices, setLoadingUserDevices] = useState({});
  const [expandedUserDevices, setExpandedUserDevices] = useState(new Set());
  
  // Right panel state
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [userPanelTab, setUserPanelTab] = useState("accounts"); // "accounts", "devices", "activity", "edit", "permissions"
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Billing state
  const [treatmentTypes, setTreatmentTypes] = useState([]);
  const [loadingTreatmentTypes, setLoadingTreatmentTypes] = useState(false);
  const [showAddTreatmentModal, setShowAddTreatmentModal] = useState(false);
  const [showEditTreatmentModal, setShowEditTreatmentModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [treatmentFormData, setTreatmentFormData] = useState({
    name: "",
    price: ""
  });
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [updatingTreatment, setUpdatingTreatment] = useState(false);

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
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [updatingDoctor, setUpdatingDoctor] = useState(false);
  const [savingEditUser, setSavingEditUser] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Message Templates state
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateFormData, setTemplateFormData] = useState({
    title: "",
    content: "",
    is_active: true
  });

  // Users state
  const [error, setError] = useState("");
  const [treatmentTypesError, setTreatmentTypesError] = useState("");
  const [referringDoctorsError, setReferringDoctorsError] = useState("");
  
  // Permission editing state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);


  // Password Management state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Test Email state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailError, setTestEmailError] = useState('');

  // Clinic Profile state
  const [clinicData, setClinicData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    timings: {
      monday: { open: '08:00', close: '20:00', closed: false },
      tuesday: { open: '08:00', close: '20:00', closed: false },
      wednesday: { open: '08:00', close: '20:00', closed: false },
      thursday: { open: '08:00', close: '20:00', closed: false },
      friday: { open: '08:00', close: '20:00', closed: false },
      saturday: { open: '08:00', close: '20:00', closed: false },
      sunday: { open: '08:00', close: '20:00', closed: true }
    }
  });
  const [loadingClinicData, setLoadingClinicData] = useState(false);
  const [savingClinicData, setSavingClinicData] = useState(false);


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
    setTitle('Settings');
  }, [setTitle]);

  useEffect(() => {
    if (activeTab === "billing") {
      fetchTreatmentTypes();
    } else if (activeTab === "templates") {
      fetchMessageTemplates();
    } else if (activeTab === "users") {
      fetchUsers();
      fetchAvailableRoles();
    } else if (activeTab === "profile") {
      if (profileSubTab === "users") {
        fetchUsers();
        fetchAvailableRoles();
      } else if (profileSubTab === "clinic") {
        fetchClinicData();
      }
    }
  }, [activeTab, profileSubTab]);

  // Fetch clinic data
  const fetchClinicData = async () => {
    try {
      setLoadingClinicData(true);
      console.log('🔄 Fetching clinic data...');
      console.log('👤 User data:', { id: user?.id, clinic_id: user?.clinic_id, role: user?.role });

      // Check if user has clinic access
      if (!user?.clinic_id) {
        console.warn('⚠️ User has no clinic_id');
        toast.error('You are not associated with any clinic. Please contact support.');
        return;
      }

      const data = await api.get("/auth/me");
      console.log('✅ Auth data received:', data);

      if (data.clinic) {
        console.log('🏥 Clinic data found:', data.clinic);
        console.log('⏰ Clinic timings:', data.clinic.timings);
        const newClinicData = {
          name: data.clinic.name || '',
          address: data.clinic.address || '',
          phone: data.clinic.phone || '',
          email: data.clinic.email || '',
          gst_number: data.clinic.gst_number || '',
          timings: data.clinic.timings || {
            monday: { open: '08:00', close: '20:00', closed: false },
            tuesday: { open: '08:00', close: '20:00', closed: false },
            wednesday: { open: '08:00', close: '20:00', closed: false },
            thursday: { open: '08:00', close: '20:00', closed: false },
            friday: { open: '08:00', close: '20:00', closed: false },
            saturday: { open: '08:00', close: '20:00', closed: false },
            sunday: { open: '08:00', close: '20:00', closed: true }
          }
        };
        console.log('📝 Setting clinic data to:', newClinicData);
        setClinicData(newClinicData);
        console.log('✅ Clinic data set successfully');
      } else {
        console.warn('⚠️ No clinic data in response');
        toast.error('No clinic information found for your account. Please contact support.');
      }
    } catch (error) {
      console.error('❌ Error fetching clinic data:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);

      const errorMessage = error.response?.data?.detail ||
                          error.response?.data?.message ||
                          error.message ||
                          'Unknown error';

      toast.error(`Failed to load clinic data: ${errorMessage}`);
    } finally {
      setLoadingClinicData(false);
    }
  };

  // Save clinic data
  const saveClinicData = async () => {
    try {
      setSavingClinicData(true);
      console.log('🔄 Saving clinic data for clinic ID:', user?.clinic_id);
      console.log('📤 Current clinicData state:', clinicData);
      console.log('👤 User info:', { id: user?.id, clinic_id: user?.clinic_id, role: user?.role });

      if (!user?.clinic_id) {
        console.error('❌ No clinic_id found for user');
        toast.error('You are not associated with a clinic. Please contact support.');
        return;
      }

      // Ensure timings is properly formatted
      const dataToSend = {
        ...clinicData,
        timings: clinicData.timings || {}
      };

      console.log('📤 Final data being sent:', JSON.stringify(dataToSend, null, 2));

      const response = await api.put(`/clinics/${user.clinic_id}`, dataToSend);
      console.log('✅ Save response:', response);
      console.log('✅ Response data:', JSON.stringify(response, null, 2));

      console.log('✅ Clinic data saved successfully!');
      toast.success('Clinic information updated successfully!');

      // Wait a moment then refresh clinic data
      console.log('🔄 Refreshing clinic data...');
      setTimeout(async () => {
        await fetchClinicData();
        console.log('✅ Clinic data refreshed');
      }, 500);
    } catch (error) {
      console.error('❌ Error saving clinic data:', error);
      console.error('❌ Error response:', error?.response?.data);
      console.error('❌ Error status:', error?.response?.status);
      console.error('❌ Full error:', error);

      const errorMessage = error?.response?.data?.detail ||
                          error?.response?.data?.message ||
                          error?.message ||
                          'Unknown error';
      toast.error(`Failed to save clinic data: ${errorMessage}`);
    } finally {
      setSavingClinicData(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get("/clinic-users/");
      
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

  const fetchTreatmentTypes = async () => {
    try {
      setLoadingTreatmentTypes(true);
      setTreatmentTypesError(""); // Clear previous error
      const data = await api.get("/treatment-types/");
        setTreatmentTypes(data);
    } catch (error) {
      console.error("Error fetching treatment types:", error);
      setTreatmentTypesError("Error fetching treatment types");
    } finally {
      setLoadingTreatmentTypes(false);
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

  const fetchMessageTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await api.get("/message-templates/");
      setMessageTemplates(data);
    } catch (error) {
      console.error("Error fetching message templates:", error);
      toast.error("Error fetching message templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateFormData({
      title: template.title,
      content: template.content,
      is_active: template.is_active
    });
    setShowEditTemplateModal(true);
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/message-templates/${editingTemplate.id}`, templateFormData);
      toast.success("Template updated successfully");
      setShowEditTemplateModal(false);
      setEditingTemplate(null);
      setTemplateFormData({ title: "", content: "", is_active: true });
      fetchMessageTemplates();
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error(error.message || "Error updating template");
    }
  };

  const fetchUserDevices = async (userId) => {
    try {
      setLoadingUserDevices(prev => ({ ...prev, [userId]: true }));
      const data = await api.get(`/devices/?user_id=${userId}`);
      setUserDevices(prev => ({ ...prev, [userId]: data }));
    } catch (error) {
      console.error("Error fetching user devices:", error);
      setUserDevices(prev => ({ ...prev, [userId]: [] }));
    } finally {
      setLoadingUserDevices(prev => ({ ...prev, [userId]: false }));
    }
  };

  const toggleUserDevices = (userId) => {
    const newExpanded = new Set(expandedUserDevices);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
      // Fetch devices if not already loaded
      if (!userDevices[userId]) {
        fetchUserDevices(userId);
      }
    }
    setExpandedUserDevices(newExpanded);
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setShowUserPanel(true);
    setUserPanelTab("accounts");
    // Fetch devices if not already loaded
    if (!userDevices[user.id]) {
      fetchUserDevices(user.id);
    }
  };

  const closeUserPanel = () => {
    setShowUserPanel(false);
    setSelectedUser(null);
    setUserPanelTab("accounts");
  };

  const handleEditUserFromPanel = (user) => {
    setSelectedUser(user);
    setShowUserPanel(true);
    setUserPanelTab("edit");
    setFormData({ name: user.name, email: user.email, role: user.role, password: "" });
  };

  const handleManagePermissionsFromPanel = (user) => {
    setSelectedUser(user);
    setShowUserPanel(true);
    setUserPanelTab("permissions");
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    setSavingEditUser(true);
    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };
      if (formData.password && formData.password.trim()) {
        updateData.password = formData.password;
      }
      await api.put(`/clinic-users/${selectedUser.id}`, updateData);
      toast.success("User updated successfully");
      setUserPanelTab("accounts");
      setFormData({ name: "", email: "", role: "receptionist", password: "" });
      fetchUsers();
      // Refresh selected user
      const updatedUsers = await api.get("/clinic-users/");
      const updatedUser = updatedUsers.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Error updating user");
    } finally {
      setSavingEditUser(false);
    }
  };

  const handleSavePermissions = async (userId, updateData) => {
    setSavingPermissions(true);
    try {
      await api.put(`/clinic-users/${userId}`, updateData);
      toast.success("User permissions updated successfully");
      setUserPanelTab("accounts");
      fetchUsers();
      // Refresh selected user
      const updatedUsers = await api.get("/clinic-users/");
      const updatedUser = updatedUsers.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }
    } catch (error) {
      console.error("Error updating permissions:", error);
      toast.error(error.message || "Error updating permissions");
    } finally {
      setSavingPermissions(false);
    }
  };

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getUserInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getDeviceIcon = (deviceType, devicePlatform) => {
    if (deviceType === 'mobile') {
      return '📱';
    } else if (deviceType === 'desktop') {
      if (devicePlatform === 'Windows') return '🪟';
      if (devicePlatform === 'macOS') return '🍎';
      if (devicePlatform === 'Linux') return '🐧';
      return '💻';
    } else {
      return '🌐';
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTreatmentInputChange = (e) => {
    const { name, value } = e.target;
    setTreatmentFormData(prev => ({
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

  const handleTemplateInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTemplateFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };


  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const userData = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };
      // Only include password if provided
      if (formData.password && formData.password.trim()) {
        userData.password = formData.password;
      }
      await api.post("/clinic-users/", userData);
        toast.success("User added successfully");
        setShowAddModal(false);
        setFormData({ name: "", email: "", role: "receptionist", password: "" });
        fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Error adding user");
    } finally {
      setAddingUser(false);
    }
  };

  const handleAddTreatment = async (e) => {
    e.preventDefault();
    setAddingTreatment(true);
    try {
      await api.post("/treatment-types/", {
        name: treatmentFormData.name,
        price: parseFloat(treatmentFormData.price)
      });
        toast.success("Treatment type added successfully");
        setShowAddTreatmentModal(false);
        setTreatmentFormData({ name: "", price: "" });
        fetchTreatmentTypes();
    } catch (error) {
      console.error("Error adding treatment type:", error);
      toast.error(error.message || "Error adding treatment type");
    } finally {
      setAddingTreatment(false);
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setAddingDoctor(true);
    try {
      await api.post("/referring-doctors/", doctorFormData);
        toast.success("Referring doctor added successfully");
        setShowAddDoctorModal(false);
        setDoctorFormData({ name: "", hospital: "" });
        fetchReferringDoctors();
    } catch (error) {
      console.error("Error adding referring doctor:", error);
      toast.error(error.message || "Error adding referring doctor");
    } finally {
      setAddingDoctor(false);
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmailAddress || !testEmailAddress.trim()) {
      setTestEmailError("Please enter an email address");
      toast.error("Please enter an email address");
      return;
    }
    
    setTestEmailError('');
    setTestEmailLoading(true);
    try {
      const response = await api.post("/notifications/test-email", {
        to_email: testEmailAddress.trim()
      });
      toast.success(response.message || "Test email sent successfully!");
      setTestEmailAddress("");
      setTestEmailError('');
    } catch (error) {
      console.error("Error sending test email:", error);
      const errorMessage = error?.message || error?.detail || "Failed to send test email. Please check your email configuration.";
      setTestEmailError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: ""
    });
    setShowEditModal(true);
  };

  const handleEditTreatment = (treatment) => {
    setEditingTreatment(treatment);
    setTreatmentFormData({
      name: treatment.name,
      price: treatment.price.toString()
    });
    setShowEditTreatmentModal(true);
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
    setUpdatingUser(true);
    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };
      // Only include password if provided
      if (formData.password && formData.password.trim()) {
        updateData.password = formData.password;
      }
      await api.put(`/clinic-users/${editingUser.id}`, updateData);
        toast.success("User updated successfully");
        setShowEditModal(false);
        setEditingUser(null);
        setFormData({ name: "", email: "", role: "receptionist", password: "" });
        fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Error updating user");
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleSetStaffPassword = async (e) => {
    e.preventDefault();
    
    if (staffPassword !== staffPasswordConfirm) {
      toast.error("Passwords don't match");
      return;
    }
    
    if (staffPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    
    setStaffPasswordLoading(true);
    try {
      await api.post(`/clinic-users/${selectedUserForPassword.id}/set-password`, {
        password: staffPassword
      });
      toast.success("Password set successfully for " + selectedUserForPassword.name);
      // Store password to show it
      setLastSetPassword(staffPassword);
      setShowPasswordAfterSet(true);
      // Refresh users to update has_password status
      fetchUsers();
    } catch (error) {
      console.error("Error setting password:", error);
      toast.error(error.response?.data?.detail || error.message || "Error setting password");
    } finally {
      setStaffPasswordLoading(false);
    }
  };

  const handleUpdateTreatment = async (e) => {
    e.preventDefault();
    setUpdatingTreatment(true);
    try {
      await api.put(`/treatment-types/${editingTreatment.id}`, {
        name: treatmentFormData.name,
        price: parseFloat(treatmentFormData.price)
      });
        toast.success("Treatment type updated successfully");
        setShowEditTreatmentModal(false);
        setEditingTreatment(null);
        setTreatmentFormData({ name: "", price: "" });
        fetchTreatmentTypes();
    } catch (error) {
      console.error("Error updating treatment type:", error);
      toast.error(error.message || "Error updating treatment type");
    } finally {
      setUpdatingTreatment(false);
    }
  };

  const handleUpdateDoctor = async (e) => {
    e.preventDefault();
    setUpdatingDoctor(true);
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
    } finally {
      setUpdatingDoctor(false);
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

        await api.delete(`/clinic-users/${userId}`);
          toast.success("User deleted successfully");
          fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        toast.error(error.message || "Error deleting user");
      }
    }
  };

  const handleDeleteTreatment = async (id) => {
    if (window.confirm("Are you sure you want to delete this treatment type?")) {
      try {

        await api.delete(`/treatment-types/${id}`);
          toast.success("Treatment type deleted successfully");
          fetchTreatmentTypes();
      } catch (error) {
        console.error("Error deleting treatment type:", error);
        toast.error(error.message || "Error deleting treatment type");
      }
    }
  };

  const handleDeleteDoctor = async (id) => {
    if (window.confirm("Are you sure you want to delete this referring doctor?")) {
      try {

        await api.delete(`/referring-doctors/${id}`);
          toast.success("Referring doctor deleted successfully");
          fetchReferringDoctors();
      } catch (error) {
        console.error("Error deleting referring doctor:", error);
        toast.error(error.message || "Error deleting referring doctor");
      }
    }
  };


  // Password management functions
  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    
    setPasswordLoading(true);
    try {
      // Check if user has a password already
      const hasPassword = user.supabase_user_id && !user.supabase_user_id.startsWith('local_');
      const endpoint = hasPassword ? '/auth/change-password' : '/auth/set-password';
      
      const payload = hasPassword 
        ? {
            current_password: passwordForm.currentPassword,
            new_password: passwordForm.newPassword
          }
        : {
            password: passwordForm.newPassword
          };
      
      await api.post(endpoint, payload);
      toast.success("Password updated successfully! You can now login on desktop with your email and password.");
      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Error updating password");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Permission editing functions
  const handleEditPermissions = (user) => {
    setSelectedUserForPermissions(user);
    setShowPermissionsModal(true);
  };

  const handleUpdatePermissions = async (userId, updateData) => {
    try {
      
      
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

  // Permission editing modal component - Right side drawer
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
      <div className="fixed inset-0 z-50">
        {/* Backdrop with blur */}
        <div 
          className="absolute inset-0 backdrop-blur-sm bg-black/20"
          onClick={onClose}
        ></div>
        
        {/* Right side drawer */}
        <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white sticky top-0 z-10">
            <div>
              <h4 className="text-xl font-semibold text-gray-900">Edit Permissions</h4>
              <p className="text-sm text-gray-600 mt-1">{user?.email}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Role Selection */}
            <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Role</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
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
                    ? "bg-[#2a276e] text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Receptionist
              </button>
              <button
                onClick={() => handlePresetChange("doctor")}
                className={`px-3 py-1 rounded text-sm ${
                  selectedRole === "doctor" && !customMode 
                    ? "bg-[#2a276e] text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Doctor
              </button>
              <button
                onClick={() => handlePresetChange("clinic_owner")}
                className={`px-3 py-1 rounded text-sm ${
                  selectedRole === "clinic_owner" && !customMode 
                    ? "bg-[#2a276e] text-white" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Clinic Owner
              </button>
              <button
                onClick={() => handlePresetChange("custom")}
                className={`px-3 py-1 rounded text-sm ${
                  customMode 
                    ? "bg-[#2a276e] text-white" 
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
                            className="accent-[#2a276e] w-4 h-4"
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

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-white sticky bottom-0">
            <div className="flex justify-end gap-3">
              <button 
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium" 
                onClick={handleSave}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header - Removed, now in global Header */}

      {/* Tabbed Section */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex overflow-x-auto">
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 whitespace-nowrap ${activeTab === "profile" ? "border-[#2a276e] text-[#2a276e]" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            onClick={() => setActiveTab("profile")}
          >
            👤 Profile
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 whitespace-nowrap ${activeTab === "billing" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            onClick={() => setActiveTab("billing")}
          >
            Billing
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 whitespace-nowrap ${activeTab === "templates" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            onClick={() => setActiveTab("templates")}
          >
            📝 Message Templates
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm focus:outline-none transition border-b-2 whitespace-nowrap ${activeTab === "other" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
            onClick={() => setActiveTab("other")}
          >
            Other
          </button>
        </div>
      </div>
      <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
          {activeTab === "profile" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Profile Settings</h3>
              
              {/* Sub-tabs for Users and Clinic */}
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  className={`px-4 py-2 font-medium text-sm focus:outline-none transition border-b-2 ${profileSubTab === "users" ? "border-[#2a276e] text-[#2a276e]" : "border-transparent text-gray-600 hover:text-gray-900"}`}
                  onClick={() => setProfileSubTab("users")}
                >
                  👥 Users (Staff)
                </button>
                <button
                  className={`px-4 py-2 font-medium text-sm focus:outline-none transition border-b-2 ${profileSubTab === "clinic" ? "border-[#2a276e] text-[#2a276e]" : "border-transparent text-gray-600 hover:text-gray-900"}`}
                  onClick={() => setProfileSubTab("clinic")}
                >
                  🏥 Clinic
                </button>
              </div>

              {/* User Profile Sub-tab */}
              {profileSubTab === "users" && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Staff Management</h3>
                  {!hasPermission("users:view") ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">You don't have permission to view users.</p>
                    </div>
                  ) : loading ? (
                    <div className="w-full flex items-center justify-center py-16">
                      <div className="text-center">
                        <GearLoader size="w-8 h-8" className="mx-auto" />
                        <p className="mt-2 text-sm text-gray-600">Loading users...</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {error && <div className="text-red-500 mb-2">{error}</div>}
                      
                      <StaffTableHeader
                        userCount={filteredUsers.length}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onFiltersClick={() => setShowFilters(!showFilters)}
                        onAddUser={() => setShowAddModal(true)}
                      />

                      <StaffTable
                        users={filteredUsers}
                        userDevices={userDevices}
                        loadingUserDevices={loadingUserDevices}
                        onUserClick={handleUserClick}
                        getUserInitials={getUserInitials}
                        formatDate={formatDate}
                        formatLastSeen={formatLastSeen}
                        getDeviceIcon={getDeviceIcon}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Clinic Profile Sub-tab */}
              {profileSubTab === "clinic" && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Clinic Information</h4>

                  {loadingClinicData ? (
                    <div className="text-center py-8">
                      <GearLoader size="w-8 h-8" className="mx-auto" />
                      <p className="mt-2 text-sm text-gray-600">Loading clinic data...</p>
                    </div>
                  ) : !user?.clinic_id ? (
                    <div className="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="text-yellow-600 mb-2">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-yellow-800 mb-2">Clinic Access Required</h3>
                      <p className="text-yellow-700">You are not associated with any clinic. Please contact your administrator or support team to get clinic access.</p>
                      <div className="mt-4 text-sm text-yellow-600">
                        <p><strong>User ID:</strong> {user?.id}</p>
                        <p><strong>Role:</strong> {user?.role}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="space-y-6">
                        {/* Basic Information */}
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Clinic Name */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Clinic Name *</label>
                              <input
                                type="text"
                                value={clinicData.name}
                                onChange={(e) => setClinicData({ ...clinicData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                                placeholder="Enter clinic name"
                              />
                            </div>

                            {/* GST Number */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                              <input
                                type="text"
                                value={clinicData.gst_number}
                                onChange={(e) => setClinicData({ ...clinicData, gst_number: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                                placeholder="Enter GST number (optional)"
                              />
                            </div>

                            {/* Address */}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                              <input
                                type="text"
                                value={clinicData.address}
                                onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                                placeholder="Enter clinic address"
                              />
                            </div>

                            {/* Phone */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                              <input
                                type="tel"
                                value={clinicData.phone}
                                onChange={(e) => setClinicData({ ...clinicData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                                placeholder="Enter phone number"
                              />
                            </div>

                            {/* Email */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                              <input
                                type="email"
                                value={clinicData.email}
                                onChange={(e) => setClinicData({ ...clinicData, email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                                placeholder="Enter clinic email"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Operating Hours */}
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 mb-3">Operating Hours</h5>
                          <p className="text-xs text-gray-500 mb-4">Default: 8:00 AM - 8:00 PM</p>
                          <div className="space-y-3">
                            {Object.entries(clinicData.timings).map(([day, timing]) => (
                              <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                <div className="w-24">
                                  <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
                                </div>
                                
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="time"
                                    value={timing.open}
                                    onChange={(e) => setClinicData({
                                      ...clinicData,
                                      timings: {
                                        ...clinicData.timings,
                                        [day]: { ...timing, open: e.target.value }
                                      }
                                    })}
                                    disabled={timing.closed}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent disabled:bg-gray-200 disabled:text-gray-500"
                                  />
                                  <span className="text-gray-500">to</span>
                                  <input
                                    type="time"
                                    value={timing.close}
                                    onChange={(e) => setClinicData({
                                      ...clinicData,
                                      timings: {
                                        ...clinicData.timings,
                                        [day]: { ...timing, close: e.target.value }
                                      }
                                    })}
                                    disabled={timing.closed}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent disabled:bg-gray-200 disabled:text-gray-500"
                                  />
                                </div>

                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={timing.closed}
                                    onChange={(e) => setClinicData({
                                      ...clinicData,
                                      timings: {
                                        ...clinicData.timings,
                                        [day]: { ...timing, closed: e.target.checked }
                                      }
                                    })}
                                    className="w-4 h-4 text-[#2a276e] border-gray-300 rounded focus:ring-[#2a276e]"
                                  />
                                  <span className="text-sm text-gray-600">Closed</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-4 border-t border-gray-200">
                          <button
                            onClick={saveClinicData}
                            disabled={savingClinicData}
                            className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {savingClinicData ? (
                              <>
                                <GearLoader size="w-4 h-4" className="text-white" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save Changes
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "billing" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Treatment Types and Pricing</h3>
              {treatmentTypesError && <div className="text-red-500 mb-2">{treatmentTypesError}</div>}
              {!hasPermission("billing:view") ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">You don't have permission to view billing information.</p>
                </div>
              ) : loadingTreatmentTypes ? (
                <div className="w-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <GearLoader size="w-8 h-8" className="mx-auto" />
                    <p className="mt-2 text-sm text-gray-600">Loading treatment types...</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">Current Treatment Types</h4>
                    {hasPermission("billing:edit") && (
                    <button
                      onClick={() => setShowAddTreatmentModal(true)}
                      className="bg-[#2a276e] text-white px-4 py-2 rounded-lg hover:bg-[#1a1548] transition"
                    >
                      Add Treatment Type
                    </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {treatmentTypes.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No treatment types configured</p>
                    ) : (
                      treatmentTypes.map((treatment) => (
                        <div key={treatment.id} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-900">{treatment.name}</span>
                              <span className="ml-4 text-gray-600">₹{treatment.price}</span>
                            </div>
                            {hasPermission("billing:edit") && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditTreatment(treatment)}
                                className="text-[#9B8CFF] hover:text-[#2a276e] text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTreatment(treatment.id)}
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
                    <GearLoader size="w-8 h-8" className="mx-auto" />
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
                      className="bg-[#2a276e] text-white px-4 py-2 rounded-lg hover:bg-[#1a1548] transition"
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
                                  className="text-[#2a276e] hover:text-[#2a276e] text-sm"
                                >
                                  Permissions
                                </button>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-[#9B8CFF] hover:text-[#2a276e] text-sm"
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
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      View Patients
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.patients?.edit 
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Edit Patients
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.patients?.delete 
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
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
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      View Reports
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.reports?.edit 
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Edit Reports
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.reports?.delete 
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
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
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      View Billing
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.billing?.edit 
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
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
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      View Users
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.users?.edit 
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      Edit Users
                                    </span>
                                    <span
                                      className={`text-xs px-2 py-1 rounded ${
                                        user.role === "clinic_owner" || user.permissions?.users?.delete 
                                          ? 'bg-[#9B8CFF]/20 text-[#2a276e]' 
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


          {activeTab === "templates" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Message Templates</h3>
              <p className="text-sm text-gray-600 mb-6">
                Customize automated messages sent to patients. Use variables like {"{patient_name}"}, {"{clinic_name}"}, etc.
              </p>
              
              {loadingTemplates ? (
                <div className="text-center py-8">
                  <GearLoader size="w-8 h-8" className="mx-auto" />
                  <p className="mt-2 text-sm text-gray-600">Loading templates...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messageTemplates.map((template) => (
                    <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{template.title}</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Template: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{template.name}</span>
                          </p>
                          {template.variables && template.variables.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 mb-1">Available variables:</p>
                              <div className="flex flex-wrap gap-1">
                                {template.variables.map((varName, idx) => (
                                  <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {"{"}{varName}{"}"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-3 py-1 rounded-full ${
                            template.is_active 
                              ? "bg-green-100 text-green-800" 
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {template.is_active ? "Active" : "Inactive"}
                          </span>
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="text-[#2a276e] hover:text-[#1a1548] text-sm font-medium"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{template.content}</p>
                      </div>
                    </div>
                  ))}
                  
                  {messageTemplates.length === 0 && (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-500">No templates found. Default templates will be used.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "other" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Other Settings</h3>
              
              {/* Email Notification Testing */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-2">📧 Test Email Service</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Send a test email to verify that your email notification service is configured correctly.
                </p>
                <form onSubmit={handleSendTestEmail} className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => {
                          setTestEmailAddress(e.target.value);
                          setTestEmailError(''); // Clear error when user types
                        }}
                        placeholder="Enter email address to send test email"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          testEmailError 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-[#2a276e]'
                        }`}
                        required
                        disabled={testEmailLoading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={testEmailLoading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      {testEmailLoading ? (
                        <>
                          <GearLoader size="w-4 h-4" className="text-white" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        "Send Test Email"
                      )}
                    </button>
                  </div>
                  {testEmailError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800">Error</p>
                          <p className="text-sm text-red-700 mt-1">{testEmailError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Make sure your Zoho email credentials are configured in the backend environment variables.
                  </p>
                </form>
              </div>
            </div>
          )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowAddModal(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Add User</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <form id="add-user-form" onSubmit={handleAddUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                >
                  {availableRoles.map((role) => (
                    <option key={role.value || role} value={role.value || role}>
                      {role.label || role}
                    </option>
                  ))}
                </select>
              </div>
            </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-user-form"
                  disabled={addingUser}
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addingUser ? (
                    <>
                      <GearLoader size="w-4 h-4" className="text-white" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    "Add User"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowEditModal(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Edit User</h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <form id="edit-user-form" onSubmit={handleUpdateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                >
                  {availableRoles.map((role) => (
                    <option key={role.value || role} value={role.value || role}>
                      {role.label || role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password (for desktop app) <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Leave empty to keep current password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters. Leave empty to keep current password.</p>
              </div>
            </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-user-form"
                  disabled={updatingUser}
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingUser ? (
                    <>
                      <GearLoader size="w-4 h-4" className="text-white" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    "Update User"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal for Staff */}
      {showStaffPasswordModal && selectedUserForPassword && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => { setShowStaffPasswordModal(false); setSelectedUserForPassword(null); setStaffPassword(""); setStaffPasswordConfirm(""); }}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Set Password for Desktop App</h3>
              <button onClick={() => { setShowStaffPasswordModal(false); setSelectedUserForPassword(null); setStaffPassword(""); setStaffPasswordConfirm(""); }} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>User:</strong> {selectedUserForPassword.name} ({selectedUserForPassword.email})
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  This password will be used for desktop app login. The user can login with their email and this password.
                </p>
              </div>
              
              {showPasswordAfterSet ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-800 mb-2">✓ Password Set Successfully!</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-700">Desktop Login Username:</label>
                        <div className="mt-1 p-2 bg-white border border-gray-300 rounded font-mono text-sm text-gray-900">
                          {selectedUserForPassword.email}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">Desktop Login Password:</label>
                        <div className="mt-1 p-2 bg-white border border-gray-300 rounded font-mono text-sm text-gray-900">
                          {lastSetPassword}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-green-700 mt-3">
                      Copy these credentials to share with the staff member for desktop app login.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowStaffPasswordModal(false);
                      setSelectedUserForPassword(null);
                      setStaffPassword("");
                      setStaffPasswordConfirm("");
                      setShowPasswordAfterSet(false);
                      setLastSetPassword("");
                    }}
                    className="w-full px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form id="set-password-form" onSubmit={handleSetStaffPassword}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input
                      type="text"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Enter password (min 8 characters)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e] font-mono"
                      required
                      minLength={8}
                    />
                    <p className="text-xs text-gray-500 mt-1">Password is shown in plain text for easy copying</p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                    <input
                      type="text"
                      value={staffPasswordConfirm}
                      onChange={(e) => setStaffPasswordConfirm(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e] font-mono"
                      required
                      minLength={8}
                    />
                  </div>
                </form>
              )}
            </div>
            {!showPasswordAfterSet && (
              <div className="p-6 border-t border-gray-200">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowStaffPasswordModal(false); setSelectedUserForPassword(null); setStaffPassword(""); setStaffPasswordConfirm(""); }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="set-password-form"
                    disabled={staffPasswordLoading}
                    className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {staffPasswordLoading ? (
                      <>
                        <GearLoader size="w-4 h-4" className="text-white" />
                        <span>Setting...</span>
                      </>
                    ) : (
                      "Set Password"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Treatment Type Modal */}
      {showAddTreatmentModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowAddTreatmentModal(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Add Treatment Type</h3>
              <button onClick={() => setShowAddTreatmentModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <form id="add-treatment-form" onSubmit={handleAddTreatment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={treatmentFormData.name}
                  onChange={handleTreatmentInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                <input
                  type="number"
                  name="price"
                  value={treatmentFormData.price}
                  onChange={handleTreatmentInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  required
                />
              </div>
            </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddTreatmentModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-treatment-form"
                  disabled={addingTreatment}
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addingTreatment ? (
                    <>
                      <GearLoader size="w-4 h-4" className="text-white" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    "Add Treatment Type"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Treatment Type Modal */}
      {showEditTreatmentModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowEditTreatmentModal(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Edit Treatment Type</h3>
              <button onClick={() => setShowEditTreatmentModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <form id="edit-treatment-form" onSubmit={handleUpdateTreatment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={treatmentFormData.name}
                  onChange={handleTreatmentInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                <input
                  type="number"
                  name="price"
                  value={treatmentFormData.price}
                  onChange={handleTreatmentInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  required
                />
              </div>
            </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditTreatmentModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-treatment-form"
                  disabled={updatingTreatment}
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingTreatment ? (
                    <>
                      <GearLoader size="w-4 h-4" className="text-white" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    "Update Treatment Type"
                  )}
                </button>
              </div>
            </div>
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

      {/* Password Management Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => { setShowPasswordModal(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">{user?.supabase_user_id && !user.supabase_user_id.startsWith('local_') ? "Set Password for Desktop Access" : "Change Password"}</h3>
              <button onClick={() => { setShowPasswordModal(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <form id="password-form" onSubmit={handleSetPassword}>
              {user?.supabase_user_id && user.supabase_user_id.startsWith('local_') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    required
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  placeholder="Re-enter your password"
                  required
                />
              </div>
              {user?.supabase_user_id && !user.supabase_user_id.startsWith('local_') && (
                <div className="mb-4 p-3 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                  <p className="text-sm text-[#2a276e]">
                    <strong>Note:</strong> After setting a password, you'll be able to login on the desktop app using your email and this password.
                  </p>
                </div>
              )}
            </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowPasswordModal(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">Cancel</button>
                <button 
                  type="submit" 
                  form="password-form" 
                  disabled={passwordLoading} 
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {passwordLoading ? (
                    <>
                      <GearLoader size="w-4 h-4" className="text-white" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {showEditTemplateModal && editingTemplate && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => { setShowEditTemplateModal(false); setEditingTemplate(null); }}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Edit {editingTemplate.title}</h3>
              <button onClick={() => { setShowEditTemplateModal(false); setEditingTemplate(null); }} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-template-form" onSubmit={handleUpdateTemplate}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    name="title"
                    value={templateFormData.title}
                    onChange={handleTemplateInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
                  <textarea
                    name="content"
                    value={templateFormData.content}
                    onChange={handleTemplateInputChange}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e] font-mono text-sm"
                    placeholder="Enter your message template. Use variables like {patient_name}, {clinic_name}, etc."
                    required
                  />
                  {editingTemplate.variables && editingTemplate.variables.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 mb-1">Available variables:</p>
                      <div className="flex flex-wrap gap-1">
                        {editingTemplate.variables.map((varName, idx) => (
                          <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {"{"}{varName}{"}"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={templateFormData.is_active}
                      onChange={handleTemplateInputChange}
                      className="mr-2 w-4 h-4 text-[#2a276e] border-gray-300 rounded focus:ring-[#2a276e]"
                    />
                    <span className="text-sm font-medium text-gray-700">Active (use this template)</span>
                  </label>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setShowEditTemplateModal(false); setEditingTemplate(null); setTemplateFormData({ title: "", content: "", is_active: true }); }} 
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  form="edit-template-form" 
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium"
                >
                  Update Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Details Right Panel */}
      {showUserPanel && selectedUser && (
        <UserDetailsPanel
          selectedUser={selectedUser}
          userPanelTab={userPanelTab}
          setUserPanelTab={setUserPanelTab}
          onClose={closeUserPanel}
          userDevices={userDevices}
          loadingUserDevices={loadingUserDevices}
          getUserInitials={getUserInitials}
          formatDate={formatDate}
          formatLastSeen={formatLastSeen}
          getDeviceIcon={getDeviceIcon}
          hasPermission={hasPermission}
          user={user}
          onSetPassword={(user) => {
            setSelectedUserForPassword(user);
            setShowStaffPasswordModal(true);
          }}
          onEditUser={handleEditUserFromPanel}
          onManagePermissions={handleManagePermissionsFromPanel}
          onDeleteUser={handleDeleteUser}
          formData={formData}
          setFormData={setFormData}
          availableRoles={availableRoles}
          handleInputChange={handleInputChange}
          handleSaveEditUser={handleSaveEditUser}
          availablePermissions={availablePermissions}
          defaultPermissions={defaultPermissions}
          handleSavePermissions={handleSavePermissions}
          savingEditUser={savingEditUser}
          savingPermissions={savingPermissions}
        />
      )}
    </div>
  );
};

export default Settings; 