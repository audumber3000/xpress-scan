import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, getPermissionAwareErrorMessage, getFriendlyErrorMessage } from "../utils/api";
import { toast } from 'react-toastify';
import { FaEye, FaEdit, FaTrash, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Search, Plus, User, Users, Folder, X, Edit2, Trash2, UploadCloud, UserPlus, CheckCircle2 } from "lucide-react";
import { isValidPhone } from "../utils/validators";
import GearLoader from "../components/GearLoader";
import { SkeletonTableRows } from "../components/Skeleton";
import Pagination from "../components/Pagination";
import FilterDropdown from "../components/FilterDropdown";
import { generatePatientPersona, generateInitialsAvatar } from "../utils/avatar";
import ImportPatientsModal from "../components/patient/ImportPatientsModal";
import EmptyState from "../components/common/EmptyState";
import { medicalCare } from "../assets/illustrations";
import AgeOrDobField, { computeAgeFromDob } from "../components/patient/AgeOrDobField";
import { clinicToday } from "../utils/datetime";
import DailyRegisterTab from "../components/patient/DailyRegisterTab";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";

const PATIENTS_PER_PAGE = 20;

// How long a freshly added patient stays highlighted with a "New" badge.
const NEW_WINDOW_MS = 15 * 1000;

/** Clip long cell text to a fixed length so columns keep a stable width. */
const truncate = (text, max = 15) => {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
};

const Patients = () => {
  const { user } = useAuth();
  const { setTitle, setRefreshFunction } = useHeader();
  const navigate = useNavigate();
  const location = useLocation();

  // Tabs state
  // 'today' | 'list' | 'files' | 'birthdays'. The daily register leads, the way
  // Payments opens on Today's Collection — it's the screen the front desk lives on.
  const [activeTab, setActiveTab] = useState('today');
  
  // Data states. `patients` now holds ONE server page, not the whole clinic.
  const [patients, setPatients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);     // matches current search/filters
  const [totalPatients, setTotalPatients] = useState(0); // whole clinic, for the header count
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Filter states
  const [filterTreatment, setFilterTreatment] = useState('');
  const [filterGender, setFilterGender] = useState('');

  // Edit/Create states
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('edit'); // 'edit' or 'create'
  const [editingPatient, setEditingPatient] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    age: "",
    date_of_birth: "",
    gender: "Male",
    phone: "",
    village: "",
    treatment_type: "General",
    referred_by: "",
    blood_group: "",
    patient_history: "",
    display_id: "",
    registered_on: clinicToday(),
    notes: ""
  });
  // Whether the Age/DOB field is collecting an age or a date of birth.
  const [ageMode, setAgeMode] = useState("age");
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState({}); // { fieldName: message } for inline validation
  const [casePaperPrompt, setCasePaperPrompt] = useState(null); // { id, name } of a just-created patient
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // patient pending delete-confirm
  const [showImportModal, setShowImportModal] = useState(false);

  // Upcoming birthdays tab
  const [birthdays, setBirthdays] = useState([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);

  // Daily register tab. When the register sends someone into the create form,
  // this flag makes the new patient land in the day's register on save — the
  // register reuses this one patient form rather than growing its own.
  const [addToRegisterAfterCreate, setAddToRegisterAfterCreate] = useState(false);
  const [registerRefreshKey, setRegisterRefreshKey] = useState(0);

  // Parse URL params for tab state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'files') setActiveTab('files');
    else if (tab === 'birthdays') setActiveTab('birthdays');
    else if (tab === 'list') setActiveTab('list');
    else setActiveTab('today');
  }, [location.search]);

  const fetchBirthdays = async () => {
    try {
      setBirthdaysLoading(true);
      const data = await api.get("/patients/birthdays/upcoming?days=30");
      setBirthdays(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching birthdays:", e);
      setBirthdays([]);
    } finally {
      setBirthdaysLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'birthdays') fetchBirthdays();
  }, [activeTab]);

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

  // Server-side pagination: fetch one page + the matching total. Search and
  // filters run against the whole clinic, not a preloaded slice — so a clinic
  // with thousands of patients loads fast and search finds everyone.
  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      // Backend requires 2+ chars for search; below that, list everything.
      if (debouncedSearch.trim().length >= 2) filters.search = debouncedSearch.trim();
      if (filterGender) filters.gender = filterGender;
      if (filterTreatment) filters.treatment_type = filterTreatment;

      const [list, countRes] = await Promise.all([
        api.get("/patients/", { params: { skip: (page - 1) * PATIENTS_PER_PAGE, limit: PATIENTS_PER_PAGE, ...filters } }),
        api.get("/patients/count", { params: filters }),
      ]);
      setPatients(Array.isArray(list) ? list : []);
      const count = Number(countRes?.total) || 0;
      setTotalCount(count);
      // On the unfiltered view this count IS the clinic total — capture it for
      // the header stat so it stays steady while searching (no extra request).
      if (!filters.search && !filters.gender && !filters.treatment_type) {
        setTotalPatients(count);
      }
    } catch (e) {
      console.error("Error fetching patients:", e);
      toast.error(getPermissionAwareErrorMessage(
        e,
        "Failed to load patients",
        "You don't have permission to view patients."
      ));
      setPatients([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterGender, filterTreatment]);

  useEffect(() => {
    setTitle(
      activeTab === 'list' ? 'All Patients'
        : activeTab === 'birthdays' ? 'Upcoming Birthdays'
        : activeTab === 'today' ? "Today's Patients"
        : 'All Files'
    );
    setRefreshFunction(() => fetchPatients);
  }, [setTitle, setRefreshFunction, activeTab, fetchPatients]);

  // Refetch whenever the page, search or filters change. The birthdays and
  // daily-register tabs load their own data and don't need the patient page.
  useEffect(() => {
    if (activeTab !== 'birthdays' && activeTab !== 'today') fetchPatients();
  }, [fetchPatients, activeTab]);

  // A new search or filter always returns to page 1.
  useEffect(() => {
    setPage(1);
  }, [filterTreatment, filterGender]);

  // Treatment options for the filter dropdown, from the current page. (Selecting
  // one still filters server-side across all patients.)
  const uniqueTreatmentTypes = useMemo(() => {
    const types = new Set();
    patients.forEach(p => { if (p.treatment_type) types.add(p.treatment_type); });
    return [...types].sort();
  }, [patients]);

  // The server already returned exactly this page, filtered and searched.
  const paginatedData = patients;
  const isFiltered = debouncedSearch.trim().length >= 2 || !!filterGender || !!filterTreatment;

  // "Just added" highlight: patients created in the last few seconds get a New
  // badge + tinted row, then fade on their own — brief, so it reads as "just now".
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Age in ms of a created_at, parsed as UTC (the API sends naive UTC, no 'Z',
  // which the browser would otherwise misread as local time).
  const ageMs = (createdAt) => {
    if (!createdAt) return Infinity;
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(createdAt)
      ? createdAt
      : createdAt.replace(' ', 'T') + 'Z';
    return nowTick - new Date(iso).getTime();
  };
  const isRecentlyAdded = (p) => ageMs(p.created_at) < NEW_WINDOW_MS;

  // Tick once a second only while a row on this page is still "new", then stop —
  // no perpetual re-render when nothing is highlighted.
  useEffect(() => {
    const anyRecent = () =>
      patients.some((p) => Date.now() - new Date(
        /[zZ]|[+-]\d{2}:?\d{2}$/.test(p.created_at || '') ? p.created_at : (p.created_at || '').replace(' ', 'T') + 'Z'
      ).getTime() < NEW_WINDOW_MS);
    if (!anyRecent()) return;
    const t = setInterval(() => {
      setNowTick(Date.now());
      if (!anyRecent()) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [patients]);

  const handleEditPatient = (patient) => {
    setAddToRegisterAfterCreate(false);
    setEditingPatient(patient);
    setEditFormData({
      name: patient.name || "",
      age: patient.age || "",
      date_of_birth: patient.date_of_birth || "",
      gender: patient.gender || "Male",
      phone: patient.phone || "",
      village: patient.village || "",
      treatment_type: patient.treatment_type || "General",
      referred_by: patient.referred_by || "",
      blood_group: patient.blood_group || "",
      patient_history: patient.patient_history || "",
      display_id: patient.display_id || "",
      // Older rows are backfilled from created_at server-side; fall back here
      // too so the field is never blank on an unmigrated record.
      registered_on: patient.registered_on || (patient.created_at || "").slice(0, 10),
      notes: patient.notes || ""
    });
    setAgeMode(patient.date_of_birth ? "dob" : "age");
    setEditErrors({});
    setDrawerMode('edit');
    setEditDrawerOpen(true);
  };

  const handleCreatePatient = () => {
    setDrawerMode('create');
    setEditingPatient(null);
    // Plain "Create Patient" is not the register flow (handleRegisterNewFromRegister
    // re-arms this straight after calling us).
    setAddToRegisterAfterCreate(false);
    setEditFormData({
      name: "",
      age: "",
      date_of_birth: "",
      gender: "Male",
      phone: "",
      village: "",
      treatment_type: "General",
      referred_by: "",
      blood_group: "",
      patient_history: "",
      display_id: "",
      registered_on: clinicToday(),
      notes: ""
    });
    setAgeMode("age");
    setEditErrors({});
    setEditDrawerOpen(true);
  };

  // The daily register found no existing match: open the normal create-patient
  // drawer with what the front desk already typed, and remember to add the
  // patient to the day's register once they're saved.
  const handleRegisterNewFromRegister = ({ name = "", phone = "" } = {}) => {
    handleCreatePatient();
    setEditFormData(prev => ({ ...prev, name, phone }));
    setAddToRegisterAfterCreate(true);
  };

  // Deep link: /patients?new=1 opens the create drawer — the entry point the
  // "Add patient" shortcut uses. The param is stripped straight away so a
  // refresh or back-navigation doesn't reopen the drawer.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') !== '1') return;
    handleCreatePatient();
    params.delete('new');
    navigate({ search: params.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Checks all required fields up-front and returns a { field: message } map.
  // Empty map = valid. This catches problems before hitting the server.
  const validatePatientForm = () => {
    const errors = {};
    if (!editFormData.name?.trim()) errors.name = "Name is required.";

    if (ageMode === "dob") {
      if (!editFormData.date_of_birth) {
        errors.age = "Date of birth is required.";
      } else if (new Date(editFormData.date_of_birth) > new Date()) {
        errors.age = "Date of birth can't be in the future.";
      }
    } else {
      const age = String(editFormData.age ?? "").trim();
      if (!age) {
        errors.age = "Age is required.";
      } else {
        const ageNum = Number(age);
        if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 150) {
          errors.age = "Enter a valid age between 0 and 150.";
        }
      }
    }

    if (!editFormData.gender?.trim()) errors.gender = "Gender is required.";

    if (!editFormData.phone?.trim()) {
      errors.phone = "Phone number is required.";
    } else if (editFormData.phone.replace(/\D/g, "").length < 7) {
      errors.phone = "Enter a valid phone number (at least 7 digits).";
    }

    if (!editFormData.registered_on) {
      errors.registered_on = "Registration date is required.";
    } else if (editFormData.registered_on > clinicToday()) {
      // String compare is safe: both are YYYY-MM-DD.
      errors.registered_on = "Registration date can't be in the future.";
    }

    if (!editFormData.village?.trim()) errors.village = "Village/City is required.";
    if (!editFormData.treatment_type?.trim()) errors.treatment_type = "Treatment type is required.";
    if (!editFormData.referred_by?.trim()) errors.referred_by = "Referred by is required.";

    return errors;
  };

  const handleSavePatient = async () => {
    // Validate on the frontend first so the user sees exactly which field is missing.
    const errors = validatePatientForm();
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      const summary =
        Object.keys(errors).length === 1
          ? Object.values(errors)[0]
          : `Please fix these fields: ${Object.values(errors).join(" ")}`;
      toast.error(summary);
      return;
    }
    setEditErrors({});

    // Build the payload, sending either age or date_of_birth based on the toggle.
    const buildPayload = () => {
      const payload = { ...editFormData };
      if (ageMode === "dob") {
        payload.date_of_birth = editFormData.date_of_birth || null;
        payload.age = computeAgeFromDob(editFormData.date_of_birth) || null;
      } else {
        payload.age = editFormData.age === "" ? null : Number(editFormData.age);
        payload.date_of_birth = null;
      }
      return payload;
    };

    try {
      setEditLoading(true);
      if (drawerMode === 'edit') {
        await api.put(`/patients/${editingPatient.id}`, buildPayload());
        toast.success("Patient updated successfully");
        setEditDrawerOpen(false);
      } else {
        const payload = buildPayload();
        const created = await api.post(`/patients/`, payload);
        toast.success("Patient created successfully");
        setEditDrawerOpen(false);

        // Came from the daily register: put them straight into today's list, so
        // the front desk doesn't have to register the same person twice.
        if (created?.id && addToRegisterAfterCreate) {
          try {
            await api.post('/daily-register', { patient_id: created.id });
            setRegisterRefreshKey(k => k + 1);
            toast.success(`${created.name || editFormData.name} added to today's register`);
          } catch (regError) {
            console.error("Error adding the new patient to the register:", regError);
            toast.error("Patient saved, but we couldn't add them to today's register.");
          }
        }
        setAddToRegisterAfterCreate(false);

        // Nudge the user to start the patient's case paper — turns creation
        // into a flow rather than a dead end. Skipped when the register is
        // driving, so the front desk isn't pulled out of the day's list.
        if (created?.id && !addToRegisterAfterCreate) {
          setCasePaperPrompt({ id: created.id, name: created.name || editFormData.name });
        }
      }
      if (activeTab !== 'today') fetchPatients();
    } catch (e) {
      console.error("Error saving patient:", e);
      // Surface the real reason (duplicate phone, etc.) instead of a generic message.
      toast.error(getFriendlyErrorMessage(e, "We couldn't save this patient. Please check the details and try again."));
    } finally {
      setEditLoading(false);
    }
  };

  // Open the confirm modal (single, on-brand — replaces the native window.confirm).
  const handleDeletePatient = (patient) => setDeleteTarget(patient);

  const confirmDeletePatient = async () => {
    if (!deleteTarget) return;
    const patient = deleteTarget;
    setDeleteLoading(patient.id);
    try {
      await api.delete(`/patients/${patient.id}`);
      toast.success("Patient deleted successfully");
      setDeleteTarget(null);
      fetchPatients();
    } catch (error) {
      console.error("Error deleting patient:", error);
      // Surface the backend's reason when it has one (e.g. "Cannot delete patient
      // with existing payments") instead of a generic message.
      toast.error(error?.response?.data?.detail || error?.message || "Error deleting patient");
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

  const getRelativeTime = (dateString) => {
    if (!dateString) return { relative: 'Never', exact: '' };
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    let relative;
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = 'Yesterday';
    else if (diffDays < 7) relative = `${diffDays} days ago`;
    else if (diffDays < 30) relative = `${Math.floor(diffDays / 7)}w ago`;
    else if (diffDays < 365) relative = `${Math.floor(diffDays / 30)}mo ago`;
    else relative = `${Math.floor(diffDays / 365)}y ago`;
    return { relative, exact: formatDate(dateString) };
  };

  const getTreatmentBadge = (type) => {
    if (!type) return { bg: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
    const t = type.toLowerCase();
    if (t.includes('crown') || t.includes('bridge')) return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    if (t.includes('root') || t.includes('rct')) return { bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
    if (t.includes('cleaning') || t.includes('scaling')) return { bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' };
    if (t.includes('implant')) return { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' };
    if (t.includes('extraction')) return { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
    if (t.includes('filling') || t.includes('restoration')) return { bg: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' };
    if (t.includes('ortho') || t.includes('braces')) return { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' };
    if (t.includes('consultation') || t.includes('general')) return { bg: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
    if (t.includes('denture')) return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
    return { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
  };

  const getGenderStyle = (gender) => {
    if (!gender) return 'bg-gray-100 text-gray-600';
    const g = gender.toLowerCase();
    if (g === 'male') return 'bg-blue-50 text-blue-600';
    if (g === 'female') return 'bg-pink-50 text-pink-600';
    return 'bg-gray-100 text-gray-600';
  };

  // Update a patient form field and clear its validation error as the user types.
  const setField = (name, value) => {
    setEditFormData(prev => ({ ...prev, [name]: value }));
    if (editErrors[name]) {
      setEditErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Input border styling — turns red when the field has a validation error.
  const fieldClass = (name) =>
    `w-full px-4 py-2 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all ${
      editErrors[name] ? "border-red-400 bg-red-50" : "border-gray-200"
    }`;

  // Inline red error message shown under a field.
  const FieldError = ({ name }) =>
    editErrors[name] ? <p className="mt-1 text-sm text-red-600">{editErrors[name]}</p> : null;

  return (
    <div className="flex flex-col h-screen bg-gray-50/30">
      
      {/* Tabs Design */}
      <div className="px-6 pt-4 border-b border-gray-200 bg-white flex items-end justify-between">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('today')}
            className={`${
              activeTab === 'today'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Today's Patients
          </button>
          <button
            onClick={() => handleTabChange('list')}
            className={`${
              activeTab === 'list'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            All Patients
          </button>
          <button
            onClick={() => handleTabChange('files')}
            className={`${
              activeTab === 'files'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            All Files
          </button>
          <button
            onClick={() => handleTabChange('birthdays')}
            className={`${
              activeTab === 'birthdays'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Birthdays
          </button>
        </nav>

        {/* Patient-base stat — steady clinic total, or "X of Y" while filtering. */}
        {activeTab !== 'birthdays' && activeTab !== 'today' && totalPatients > 0 && (
          <div className="mb-2 hidden sm:inline-flex items-center gap-2 rounded-full bg-[#2a276e]/[0.06] border border-[#2a276e]/10 px-3.5 py-1.5">
            <Users size={15} className="text-[#2a276e]" />
            <span className="text-sm font-semibold text-[#2a276e]">
              {isFiltered
                ? `${totalCount.toLocaleString()} of ${totalPatients.toLocaleString()}`
                : totalPatients.toLocaleString()}
            </span>
            <span className="text-sm text-[#2a276e]/60">
              {isFiltered ? 'matching' : (totalPatients === 1 ? 'patient' : 'patients')}
            </span>
          </div>
        )}
      </div>

      {/* Search, Filters & Actions Area — the daily register carries its own
          day picker and register button, so this bar would only get in its way. */}
      {activeTab !== 'today' && (
      <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="w-full md:max-w-sm relative">
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
          {activeTab === 'list' && (
            <>
              <FilterDropdown
                label="Treatment"
                value={filterTreatment}
                onChange={(v) => { setFilterTreatment(v); setPage(1); }}
                options={uniqueTreatmentTypes}
              />
              <FilterDropdown
                label="Gender"
                value={filterGender}
                onChange={(v) => { setFilterGender(v); setPage(1); }}
                options={['Male', 'Female', 'Other']}
              />
            </>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap"
          >
            <UploadCloud size={18} className="text-blue-500" /> Import Patients
          </button>
          <button
            onClick={handleCreatePatient}
            className="flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-all shadow-sm whitespace-nowrap"
          >
            <UserPlus size={18} /> Create Patient
          </button>
        </div>
      </div>
      )}

      {activeTab === 'today' ? (
        <DailyRegisterTab
          onRegisterNew={handleRegisterNewFromRegister}
          refreshKey={registerRefreshKey}
        />
      ) : (
      /* Content Area */
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">

          {loading ? (
            <div className="flex-1 overflow-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-[#f8fafc] sticky top-0 z-10">
                  <tr>
                    {['Patient ID', 'Patient Details', 'Contact', 'Gender / Age', 'Treatment', 'Last Visit', 'Actions'].map((h, i) => (
                      <th key={h} className={`px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i === 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <SkeletonTableRows rows={10} />
              </table>
            </div>
          ) : activeTab === 'list' ? (
            <div className="flex-1 overflow-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-[#f8fafc] sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender / Age</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Treatment</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Visit</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8">
                        <EmptyState
                          image={medicalCare}
                          title="No patients yet"
                          subtitle="Add your first patient, or adjust your search to find someone."
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((patient) => {
                      const treatmentStyle = getTreatmentBadge(patient.treatment_type);
                      const lastVisit = getRelativeTime(patient.last_visit);
                      const justAdded = isRecentlyAdded(patient);
                      return (
                        <tr
                          key={patient.id}
                          className={`cursor-pointer transition-colors duration-150 group ${
                            justAdded ? 'bg-[#00ba7c]/[0.07] hover:bg-[#00ba7c]/[0.12]' : 'hover:bg-indigo-50/30'
                          }`}
                          onClick={() => navigate(`/patient-profile/${patient.id}`)}
                        >
                          {/* Patient ID */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-[#2a276e]">{patient.display_id || '---'}</span>
                          </td>

                          {/* Patient Details — Name + Village */}
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <img 
                                src={generatePatientPersona(patient, 80)} 
                                onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(patient.name || 'Patient'); }}
                                alt={patient.name} 
                                className="w-9 h-9 rounded-full flex-shrink-0 object-cover border border-gray-100"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">{patient.name}</span>
                                  {justAdded && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#00ba7c] text-white">
                                      New
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400">{patient.village || 'No location'}</div>
                              </div>
                            </div>
                          </td>

                          {/* Contact — Phone */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-700">{patient.phone || '—'}</span>
                          </td>

                          {/* Gender / Age */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getGenderStyle(patient.gender)}`}>
                                {patient.gender || '—'}
                              </span>
                              <span className="text-sm text-gray-500">{patient.age ? `${patient.age}y` : ''}</span>
                            </div>
                          </td>

                          {/* Treatment Type — Pill Badge. Truncated to a fixed
                              length so a long treatment name can't widen the
                              column; full text shows on hover. */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${treatmentStyle.bg}`}
                              title={patient.treatment_type || 'General'}
                            >
                              {truncate(patient.treatment_type || 'General', 15)}
                            </span>
                          </td>

                          {/* Last Visit — Relative + Exact */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{lastVisit.relative}</div>
                              <div className="text-xs text-gray-400">{lastVisit.exact}</div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditPatient(patient); }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                                title="Edit"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient); }}
                                disabled={deleteLoading === patient.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex disabled:opacity-30"
                                title="Delete"
                              >
                                {deleteLoading === patient.id ? <GearLoader size="w-4 h-4" /> : <Trash2 size={15} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'birthdays' ? (
            <div className="flex-1 overflow-auto p-6">
              {birthdaysLoading ? (
                <div className="flex items-center justify-center py-16"><GearLoader /></div>
              ) : birthdays.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  <p className="text-sm font-medium text-gray-900">No upcoming birthdays</p>
                  <p className="text-xs text-gray-400 mt-1">Birthdays appear here once patients have a date of birth on file.</p>
                </div>
              ) : (
                <div className="space-y-2 max-w-3xl mx-auto">
                  {birthdays.map((b) => {
                    const label = b.days_until === 0 ? "Today 🎂" : b.days_until === 1 ? "Tomorrow" : `in ${b.days_until} days`;
                    const phoneDigits = (b.phone || "").replace(/\D/g, "");
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:bg-indigo-50/30 transition-colors">
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                          onClick={() => navigate(`/patient-profile/${b.id}`)}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${b.days_until === 0 ? 'bg-pink-100 text-pink-600' : 'bg-indigo-50 text-[#2a276e]'}`}>
                            <span className="text-lg">🎂</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{b.name} <span className="text-xs font-normal text-gray-400">#{b.display_id || '—'}</span></div>
                            <div className="text-xs text-gray-500">
                              {new Date(b.next_birthday).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • turning {b.turning_age}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${b.days_until === 0 ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>{label}</span>
                          {phoneDigits && (
                            <a
                              href={`https://wa.me/${phoneDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                            >
                              Wish
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10">
                {paginatedData.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      image={medicalCare}
                      title="No patients yet"
                      subtitle="Add your first patient, or adjust your search to find someone."
                    />
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

          {activeTab !== 'birthdays' && (
            <Pagination
              page={page}
              pageSize={PATIENTS_PER_PAGE}
              totalItems={totalCount}
              onPageChange={setPage}
              alwaysShow
            />
          )}
        </div>
      </div>
      )}

      {/* Edit Drawer (Modern update but keeping original fields) */}
      {editDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setEditDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
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
              <form id="edit-patient-form" onSubmit={(e) => { e.preventDefault(); handleSavePatient(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className={fieldClass("name")}
                  />
                  <FieldError name="name" />
                </div>
                {drawerMode === 'edit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                    <input 
                      type="text" 
                      readOnly
                      value={editFormData.display_id}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <AgeOrDobField
                    mode={ageMode}
                    onModeChange={setAgeMode}
                    age={editFormData.age}
                    onAgeChange={(v) => setField("age", v)}
                    dob={editFormData.date_of_birth}
                    onDobChange={(v) => setField("date_of_birth", v)}
                    error={editErrors.age}
                    inputClass={fieldClass("age")}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-red-500">*</span></label>
                    <select
                      value={editFormData.gender}
                      onChange={(e) => setField("gender", e.target.value)}
                      className={fieldClass("gender")}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <FieldError name="gender" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Registration <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editFormData.registered_on || ""}
                    max={clinicToday()}
                    onChange={(e) => setField("registered_on", e.target.value)}
                    className={fieldClass("registered_on")}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Defaults to today. Change it if this patient first came in earlier.
                  </p>
                  <FieldError name="registered_on" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={editFormData.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      className={`${fieldClass("phone")} pr-11`}
                    />
                    {isValidPhone(editFormData.phone) && (
                      <CheckCircle2
                        size={20}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-green-500 animate-in fade-in zoom-in duration-200"
                      />
                    )}
                  </div>
                  <FieldError name="phone" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Village/City <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editFormData.village}
                    onChange={(e) => setField("village", e.target.value)}
                    className={fieldClass("village")}
                  />
                  <FieldError name="village" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Type <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editFormData.treatment_type}
                    onChange={(e) => setField("treatment_type", e.target.value)}
                    className={fieldClass("treatment_type")}
                  />
                  <FieldError name="treatment_type" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referred By <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editFormData.referred_by}
                    onChange={(e) => setField("referred_by", e.target.value)}
                    className={fieldClass("referred_by")}
                  />
                  <FieldError name="referred_by" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                    <select 
                      value={editFormData.blood_group}
                      onChange={(e) => setEditFormData({...editFormData, blood_group: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all"
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
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows="3"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all resize-none"
                  />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 mt-auto">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditDrawerOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-patient-form"
                  disabled={editLoading}
                  className="flex-1 px-4 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {editLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                  {drawerMode === 'edit' ? 'Update Patient' : 'Create Patient'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-create nudge: start the patient's case paper */}
      {casePaperPrompt && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setCasePaperPrompt(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-[#2a276e]/10 text-[#2a276e] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Patient created 🎉</h3>
            <p className="text-sm text-gray-500 mt-1">
              Start a case paper for <span className="font-semibold text-gray-700">{casePaperPrompt.name}</span> now?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCasePaperPrompt(null)}
                className="flex-1 px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={() => {
                  const id = casePaperPrompt.id;
                  setCasePaperPrompt(null);
                  navigate(`/patient-profile/${id}?tab=case-papers`);
                }}
                className="flex-1 px-4 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
              >
                Yes, create
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportPatientsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={fetchPatients}
      />

      {/* Delete patient — single on-brand confirm (soft backdrop, matches the app's dialogs). */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => deleteLoading !== deleteTarget.id && setDeleteTarget(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">Delete patient?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to delete <span className="font-semibold">{deleteTarget.name}</span>?
                  This will remove their records and <span className="font-semibold">cannot be undone</span>.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading === deleteTarget.id}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeletePatient}
                disabled={deleteLoading === deleteTarget.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteLoading === deleteTarget.id && <GearLoader size="w-4 h-4" />}
                {deleteLoading === deleteTarget.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;