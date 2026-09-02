import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, getPermissionAwareErrorMessage, getFriendlyErrorMessage } from "../utils/api";
import { FaEye, FaEdit, FaTrash, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Search, Plus, User, Users, Folder, X, Edit2, Trash2, UploadCloud, UserPlus, CheckCircle2, Download, Columns3 } from "lucide-react";
import { isValidPhone } from "../utils/validators";
import GearLoader from "../components/GearLoader";
import Spinner from "../components/common/Spinner";
import { SkeletonTableRows } from "../components/Skeleton";
import Pagination from "../components/Pagination";
import MoreMenu from "../components/common/MoreMenu";
import ColumnsModal from "../components/common/ColumnsModal";
import PatientMatchModal from "../components/patient/PatientMatchModal";
import { ColGroup, ResizeHandle } from "../components/common/ColumnResizer";
import useColumnWidths from "../utils/useColumnWidths";
import FilterPanel from "../components/FilterPanel";
import { generatePatientPersona, generateInitialsAvatar } from "../utils/avatar";
import ImportPatientsModal from "../components/patient/ImportPatientsModal";
import HelpBulb from "../components/common/HelpBulb";
import EmptyState from "../components/common/EmptyState";
import SectionError from "../components/common/SectionError";
import InlineFeedback from "../components/common/InlineFeedback";
import { notify } from "../utils/notify";
import MasterPasswordModal from "../components/common/MasterPasswordModal";
import PatientEditModal from "../components/patient/PatientEditModal";
import { medicalCare } from "../assets/illustrations";
import AgeOrDobField, { computeAgeFromDob } from "../components/patient/AgeOrDobField";
import { clinicToday, formatDateTime, formatRelative, formatDate as formatDayOnly } from "../utils/datetime";
import DailyRegisterTab from "../components/patient/DailyRegisterTab";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import { track, EVENTS } from '../analytics/track';

const PATIENTS_PER_PAGE = 20;

// The list table's columns, in the order they appear.
//
// `width` is a relative weight — the visible set is normalised to fill the table,
// so hiding a column never means renumbering the rest. `min` is the pixel floor a
// drag can reach, and it doubles as the input to the picker's "these columns need
// at least Npx" warning. `optional` starts a column hidden and offers it in the
// picker; `fixed` means it cannot be hidden at all.
//
// Everything here is already on the list payload. Aggregates like outstanding
// balance or visit count would need the endpoint to join other tables first.
const PATIENT_COLUMNS = [
  { key: 'display_id',    label: 'Patient ID',      width: 11, min: 84 },
  // A patient list with no names is not a list.
  { key: 'details',       label: 'Patient Details', width: 24, min: 160, fixed: true },
  { key: 'phone',         label: 'Contact',         width: 13, min: 96 },
  { key: 'gender',        label: 'Gender / Age',    width: 12, min: 104 },
  { key: 'treatment',     label: 'Treatment',       width: 15, min: 96 },
  { key: 'village',       label: 'Address',         width: 13, min: 100, optional: true },
  { key: 'email',         label: 'Email',           width: 18, min: 150, optional: true },
  { key: 'date_of_birth', label: 'Date of birth',   width: 12, min: 110, optional: true },
  { key: 'blood_group',   label: 'Blood group',     width: 10, min: 96,  optional: true },
  { key: 'allergies',     label: 'Allergies',       width: 14, min: 110, optional: true },
  { key: 'referred_by',   label: 'Referred by',     width: 14, min: 120, optional: true },
  { key: 'payment_type',  label: 'Payment type',    width: 11, min: 110, optional: true },
  { key: 'registered_on', label: 'Registered',      width: 12, min: 110, optional: true },
  { key: 'last_visit',    label: 'Last Visit',      width: 15, min: 104 },
  { key: 'actions',       label: 'Actions',         width: 10, min: 88, align: 'right' },
];


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
  // 'today' | 'list' | 'files' | 'birthdays'. Opens on the full patient list:
  // most trips to this screen are to find a specific person, and the daily
  // register is one click away for the front desk that wants it.
  const [activeTab, setActiveTab] = useState('list');
  // Column widths for the list table, dragged by the handles on the header
  // and remembered in this browser.
  const {
    tableRef, columns, widths, hidden, setHidden, startResize, reset: resetColumns,
  } = useColumnWidths('patients.list', PATIENT_COLUMNS);
  const [columnPicker, setColumnPicker] = useState(false);
  // Existing-patient check. The endpoint and the picker modal were already
  // built for the daily register and the calendar; this drawer was the one
  // creation path that never asked, which is where duplicate records come from.
  const [dupMatches, setDupMatches] = useState([]);
  const [dupOpen, setDupOpen] = useState(false);
  // The phone we last checked, so tabbing back through the field does not
  // re-open the same question.
  const [dupCheckedPhone, setDupCheckedPhone] = useState('');
  const nameInputRef = useRef(null);
  // Measured when the picker opens, so its fit warning describes this window
  // rather than a guess about a typical one.
  const [tableWidth, setTableWidth] = useState(0);
  // The narrowest the table can honestly be: every visible column at its own
  // floor. Below this the container scrolls rather than crushing the columns,
  // and it is the same sum the picker warns against, so the two agree.
  const minTableWidth = columns.reduce((sum, c) => sum + (c.min || 72), 0);
  
  // Monotonic id for the newest patients request, so a slow stale response
  // can't overwrite a newer one. See fetchPatients.
  const patientsRequestIdRef = useRef(0);
  // Data states. `patients` now holds ONE server page, not the whole clinic.
  const [patients, setPatients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);     // matches current search/filters
  const [totalPatients, setTotalPatients] = useState(0); // whole clinic, for the header count
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Filter states — all live in one unified FilterPanel (like All Payments).
  const [filterTreatment, setFilterTreatment] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [exporting, setExporting] = useState(false);

  // Applied together by the FilterPanel's Apply button.
  const applyPatientFilters = (next) => {
    setFilterGender(next.gender || '');
    setFilterTreatment(next.treatment_type || '');
    setDateFrom(next.dateFrom || '');
    setDateTo(next.dateTo || '');
    setDatePreset(next.preset || '');
    setPage(1);
  };

  const patientFilterValue = {
    dateFrom, dateTo, preset: datePreset,
    gender: filterGender, treatment_type: filterTreatment,
  };

  // Export the current filtered list to CSV (respects search + all filters).
  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (debouncedSearch.trim().length >= 2) params.set('search', debouncedSearch.trim());
      if (filterGender) params.set('gender', filterGender);
      if (filterTreatment) params.set('treatment_type', filterTreatment);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${baseURL}/api/v1/patients/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${clinicToday()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notify.done('Patients exported');
    } catch (e) {
      console.error('Export error:', e);
      notify.problem(e, 'Could not export the patient list');
    } finally {
      setExporting(false);
    }
  };

  // Edit/Create states
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  // Edit opens a modal; the drawer below is only ever for creating someone new.
  const [editModalOpen, setEditModalOpen] = useState(false);
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
    allergies: "",
    patient_history: "",
    display_id: "",
    registered_on: clinicToday(),
    notes: ""
  });
  // Whether the Age/DOB field is collecting an age or a date of birth.
  const [ageMode, setAgeMode] = useState("age");
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState({}); // { fieldName: message } for inline validation
  // The list failed to load. A state, not an event: it stays in the table's
  // own space with a Retry until the data arrives (tier 3, utils/notify.js).
  const [loadError, setLoadError] = useState('');
  // Why the drawer could not save. Sits above its own Save button.
  const [saveError, setSaveError] = useState('');
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
    else if (tab === 'today') setActiveTab('today');
    else setActiveTab('list');
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
    // Debouncing does not stop a slow earlier response landing after a newer
    // one — type "sha" then "sharm", and if "sha" is slower it overwrites the
    // correct list with no error shown. Every response checks it is still the
    // newest before writing state.
    const reqId = ++patientsRequestIdRef.current;
    try {
      setLoading(true);
      const filters = {};
      // Backend requires 2+ chars for search; below that, list everything.
      if (debouncedSearch.trim().length >= 2) filters.search = debouncedSearch.trim();
      if (filterGender) filters.gender = filterGender;
      if (filterTreatment) filters.treatment_type = filterTreatment;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const [list, countRes] = await Promise.all([
        api.get("/patients/", { params: { skip: (page - 1) * PATIENTS_PER_PAGE, limit: PATIENTS_PER_PAGE, ...filters } }),
        api.get("/patients/count", { params: filters }),
      ]);
      if (reqId !== patientsRequestIdRef.current) return;  // superseded
      setLoadError('');   // a good answer clears whatever the last bad one said
      setPatients(Array.isArray(list) ? list : []);
      const count = Number(countRes?.total) || 0;
      setTotalCount(count);
      // On the unfiltered view this count IS the clinic total — capture it for
      // the header stat so it stays steady while searching (no extra request).
      if (!filters.search && !filters.gender && !filters.treatment_type && !filters.date_from && !filters.date_to) {
        setTotalPatients(count);
      }
    } catch (e) {
      if (reqId !== patientsRequestIdRef.current) return;
      console.error("Error fetching patients:", e);
      setLoadError(getPermissionAwareErrorMessage(
        e,
        "Something went wrong loading your patients.",
        "You don't have permission to view patients."
      ));
      setPatients([]);
      setTotalCount(0);
    } finally {
      // Only the newest request owns the spinner, or a stale one clears it
      // while the current search is still in flight.
      if (reqId === patientsRequestIdRef.current) setLoading(false);
    }
  }, [page, debouncedSearch, filterGender, filterTreatment, dateFrom, dateTo]);

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
  const isFiltered = debouncedSearch.trim().length >= 2 || !!filterGender || !!filterTreatment || !!dateFrom || !!dateTo;

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

  // Editing is a modal, shared with the patient file page so there is one
  // patient form to keep correct. The drawer stays for creation, which carries
  // a post-create flow (daily register, case paper nudge) that editing has no
  // use for. The modal seeds itself from the record, so nothing to fill in here.
  const handleEditPatient = (patient) => {
    setEditingPatient(patient);
    setEditModalOpen(true);
  };

  const checkForDuplicates = async (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 7 || digits === dupCheckedPhone) return;
    setDupCheckedPhone(digits);
    try {
      const matches = await api.get('/patients/check-duplicates', { params: { phone } });
      if (Array.isArray(matches) && matches.length) {
        setDupMatches(matches);
        setDupOpen(true);
      }
    } catch {
      // A lookup that fails must never block creation. Worst case they get the
      // behaviour they had before this existed.
    }
  };

  const handleCreatePatient = () => {
    setEditingPatient(null);
    // Plain "Create Patient" is not the register flow (handleRegisterNewFromRegister
    // re-arms this straight after calling us).
    setAddToRegisterAfterCreate(false);
    setEditFormData({
      name: "",
      age: "",
      date_of_birth: "",
      // Deliberately blank. It used to open on "Male", so every patient nobody
      // consciously set was silently recorded male, and the dashboard's gender
      // split was quietly counting those as answers.
      gender: "",
      phone: "",
      village: "",
      treatment_type: "General",
      referred_by: "",
      blood_group: "",
      allergies: "",
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

    // Stored as `village`; the label says Address because that is what a
    // receptionist is looking at when they type it.
    if (!editFormData.village?.trim()) errors.village = "Address is required.";
    // Treatment type and referred-by are no longer gates. A receptionist taking
    // a walk-in often knows neither, and a required field they cannot answer
    // gets filled with a guess, which is worse than the default we would have
    // written ourselves. Both fall back on save.

    return errors;
  };

  // Keeps what the next patient in a run is likely to share and clears what
  // they will not. Address and registration date survive a camp day or a
  // Monday morning; a name and a phone never do.
  const resetFormForNext = () => {
    setEditFormData((prev) => ({
      ...prev,
      name: '', age: '', date_of_birth: '', gender: '', phone: '',
      treatment_type: 'General', referred_by: '', blood_group: '', allergies: '',
      patient_history: '', notes: '', display_id: '',
    }));
    setAgeMode('age');
    setEditErrors({});
    setDupCheckedPhone('');
    // Straight back to the first field, so a run of entries never needs the
    // mouse between one patient and the next.
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleSavePatient = async (andAnother = false) => {
    // The two soft fields fall back to what the form promised underneath them.
    // Resolved into a local value rather than through setEditFormData: a state
    // update does not land before the lines below read it, so the save would
    // have posted the blanks and only shown the defaults on the next render.
    const data = {
      ...editFormData,
      treatment_type: editFormData.treatment_type?.trim() || 'General',
      referred_by: editFormData.referred_by?.trim() || 'Self',
    };
    // Validate on the frontend first so the user sees exactly which field is missing.
    const errors = validatePatientForm();
    setSaveError('');
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      // No toast: every bad field is already outlined in red with its reason
      // underneath it, which is where the fix has to happen anyway.
      return;
    }
    setEditErrors({});

    // Build the payload, sending either age or date_of_birth based on the toggle.
    const buildPayload = () => {
      const payload = { ...data };
      if (ageMode === "dob") {
        payload.date_of_birth = data.date_of_birth || null;
        payload.age = computeAgeFromDob(data.date_of_birth) || null;
      } else {
        payload.age = data.age === "" ? null : Number(data.age);
        payload.date_of_birth = null;
      }
      return payload;
    };

    try {
      setEditLoading(true);
      const payload = buildPayload();
      const created = await api.post(`/patients/`, payload);
      track(EVENTS.PATIENT_CREATED, { source: 'patients_list' });
      if (andAnother) {
        notify.done(`${created?.name || data.name} saved`);
        resetFormForNext();
      } else {
        setEditDrawerOpen(false);
      }

      // Came from the daily register: put them straight into today's list, so
      // the front desk doesn't have to register the same person twice.
      if (created?.id && addToRegisterAfterCreate && !andAnother) {
        try {
          await api.post('/daily-register', { patient_id: created.id });
          setRegisterRefreshKey(k => k + 1);
          notify.done(`${created.name || editFormData.name} added to today's register`);
        } catch (regError) {
          console.error("Error adding the new patient to the register:", regError);
          notify.problem("Patient saved, but we couldn't add them to today's register.");
        }
      }
      setAddToRegisterAfterCreate(false);

      // Nudge the user to start the patient's case paper — turns creation
      // into a flow rather than a dead end. Skipped when the register is
      // driving, so the front desk isn't pulled out of the day's list.
      if (created?.id && !addToRegisterAfterCreate && !andAnother) {
        setCasePaperPrompt({ id: created.id, name: created.name || editFormData.name });
      }
      if (activeTab !== 'today') fetchPatients();
    } catch (e) {
      console.error("Error saving patient:", e);
      // Surface the real reason (duplicate phone, etc.) instead of a generic message.
      setSaveError(getFriendlyErrorMessage(e, "We couldn't save this patient. Please check the details and try again."));
    } finally {
      setEditLoading(false);
    }
  };

  // Open the confirm modal (single, on-brand — replaces the native window.confirm).
  const handleDeletePatient = (patient) => setDeleteTarget(patient);

  // Deleting a patient takes their case papers, bills and receipted payments
  // with them, so the confirmation IS the master password prompt — there is no
  // plain "are you sure" step in front of it. The token comes from the modal,
  // which has already checked the code before we get here.
  const confirmDeletePatient = async (masterToken) => {
    if (!deleteTarget) return;
    const patient = deleteTarget;
    setDeleteLoading(patient.id);
    try {
      await api.delete(`/patients/${patient.id}`, {
        headers: { 'X-Master-Token': masterToken },
      });
      setDeleteTarget(null);
      fetchPatients();
    } catch (error) {
      console.error("Error deleting patient:", error);
      // Rethrown so the reason lands inside the prompt that is still open,
      // rather than as a toast behind it.
      throw error;
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

  // Timestamps come back from the API without a timezone marker. Parsing those
  // with a bare `new Date()` reads them as the viewer's local clock, which put
  // every record 5.5 hours in the past for a clinic in IST. formatDateTime and
  // formatRelative parse them as UTC and render in the clinic's timezone.
  const formatDate = formatDateTime;
  const getRelativeTime = formatRelative;

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

  // A dash rather than an empty cell, so a blank field reads as "nothing
  // recorded" instead of a rendering fault.
  const plain = (value, title) => (
    <span className="block truncate text-sm text-gray-700" title={title ?? value ?? ''}>
      {value || <span className="text-gray-300">—</span>}
    </span>
  );

  /**
   * One cell, chosen by column key.
   *
   * Keyed rather than positional because the row now renders whichever columns
   * are switched on, in whatever order the spec lists them.
   */
  const renderPatientCell = (key, patient) => {
    switch (key) {
      case 'display_id':
        return (
          <span className="block truncate text-sm font-semibold text-[#2a276e]">
            {patient.display_id || '---'}
          </span>
        );

      case 'details': {
        const justAdded = isRecentlyAdded(patient);
        // The village sits under the name only while it has no column of its
        // own. Two cells showing the same value is how a table starts looking
        // like it is padding itself out.
        const villageInline = hidden.includes('village');
        return (
          // min-w-0 all the way down. A flex item's automatic minimum size is
          // its content, so without it a long name refuses to shrink and shoves
          // the avatar out of the cell rather than truncating.
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={generatePatientPersona(patient, 80)}
              onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(patient.name || 'Patient'); }}
              alt={patient.name}
              className="w-9 h-9 rounded-full flex-shrink-0 object-cover border border-gray-100"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-gray-900 truncate" title={patient.name}>{patient.name}</span>
                {justAdded && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[#00ba7c] text-white flex-shrink-0">
                    New
                  </span>
                )}
              </div>
              {villageInline && (
                <div className="text-xs text-gray-400 truncate">{patient.village || 'No location'}</div>
              )}
            </div>
          </div>
        );
      }

      case 'phone':
        return plain(patient.phone);

      case 'gender':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getGenderStyle(patient.gender)}`}>
              {patient.gender || '—'}
            </span>
            <span className="text-sm text-gray-500 truncate">{patient.age ? `${patient.age}y` : ''}</span>
          </div>
        );

      case 'treatment': {
        const treatmentStyle = getTreatmentBadge(patient.treatment_type);
        return (
          // inline-block, not inline-flex: a flex box will not truncate its own
          // text, so a narrowed column would burst the pill instead of clipping.
          <span
            className={`inline-block max-w-full truncate align-middle px-2.5 py-1 rounded text-xs font-medium border ${treatmentStyle.bg}`}
            title={patient.treatment_type || 'General'}
          >
            {truncate(patient.treatment_type || 'General', 15)}
          </span>
        );
      }

      case 'village':
        return plain(patient.village);

      case 'email':
        return plain(patient.email);

      // Bare calendar dates, so formatDayOnly rather than the page's
      // formatDate, which is the datetime formatter and would shift them a
      // timezone offset into the previous day.
      case 'date_of_birth':
        return plain(patient.date_of_birth ? formatDayOnly(patient.date_of_birth) : '');

      case 'registered_on':
        return plain(patient.registered_on ? formatDayOnly(patient.registered_on) : '');

      case 'allergies':
        return patient.allergies ? (
          <span className="inline-block max-w-full truncate align-middle px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-600" title={patient.allergies}>
            {patient.allergies}
          </span>
        ) : plain('');

      case 'blood_group':
        return patient.blood_group ? (
          <span className="inline-block max-w-full truncate align-middle px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-600">
            {patient.blood_group}
          </span>
        ) : plain('');

      case 'referred_by':
        return plain(patient.referred_by);

      case 'payment_type':
        return plain(patient.payment_type);

      case 'last_visit': {
        const lastVisit = getRelativeTime(patient.last_visit);
        return (
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{lastVisit.relative}</div>
            <div className="text-xs text-gray-400 truncate">{lastVisit.exact}</div>
          </div>
        );
      }

      case 'actions':
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleEditPatient(patient); }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex cursor-pointer"
              title="Edit"
            >
              <Edit2 size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient); }}
              disabled={deleteLoading === patient.id}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex cursor-pointer disabled:opacity-30"
              title="Delete"
            >
              {deleteLoading === patient.id ? <Spinner /> : <Trash2 size={15} />}
            </button>
          </div>
        );

      default:
        return null;
    }
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

        <div className="flex items-center">
        {/* Patient-base stat — steady clinic total, or "X of Y" while filtering. */}
        {activeTab !== 'birthdays' && activeTab !== 'today' && totalPatients > 0 && (
          <div className="mb-2 hidden sm:inline-flex items-center gap-2 rounded bg-[#2a276e]/[0.06] border border-[#2a276e]/10 px-3.5 py-1.5">
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
          <HelpBulb section="patients" className="mb-2 ml-2" />
        </div>
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
            <FilterPanel
              value={patientFilterValue}
              onApply={applyPatientFilters}
              dateLabel="Registered"
              filters={[
                { key: 'gender', label: 'Gender', options: ['Male', 'Female', 'Other'] },
                { key: 'treatment_type', label: 'Treatment', options: uniqueTreatmentTypes },
              ]}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Two controls, not four: the one thing you came to do, and the rest
              behind More. */}
          <MoreMenu
            items={[
              activeTab === 'list' && {
                key: 'export',
                label: exporting ? 'Exporting…' : 'Export to CSV',
                icon: <Download size={15} />,
                hint: 'Every row your filters select',
                disabled: exporting,
                onClick: handleExport,
              },
              {
                key: 'import',
                label: 'Import patients',
                icon: <UploadCloud size={15} />,
                hint: 'From a spreadsheet, with a preview first',
                onClick: () => setShowImportModal(true),
              },
              activeTab === 'list' && {
                key: 'columns',
                label: 'Choose columns',
                icon: <Columns3 size={15} />,
                hint: 'Show, hide, and reset the layout',
                onClick: () => {
                  // The scroll container, not the table. Once the table is wide
                  // enough to overflow, its own clientWidth is the overflowing
                  // width, so measuring it would report that everything fits at
                  // exactly the moment it stops fitting.
                  setTableWidth(tableRef.current?.parentElement?.clientWidth || 0);
                  setColumnPicker(true);
                },
              },
            ]}
          />
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

          {loadError ? (
            <div className="flex-1 overflow-auto p-6">
              <SectionError
                title="Couldn't load your patients"
                detail={loadError}
                onRetry={() => { setLoadError(''); fetchPatients(); }}
                retrying={loading}
              />
            </div>
          ) : loading ? (
            <div className="flex-1 overflow-auto">
              {/* Same geometry as the real table below, so the header does not
                  jump sideways the moment the rows land. */}
              <table style={{ minWidth: minTableWidth }} className="w-full table-fixed divide-y divide-gray-200">
                <ColGroup widths={widths} />
                <thead className="bg-[#f8fafc] sticky top-0 z-10">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        <span className="block truncate">{col.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <SkeletonTableRows rows={10} />
              </table>
            </div>
          ) : activeTab === 'list' ? (
            <div className="flex-1 overflow-auto">
              {/* table-fixed is what makes a width mean anything: under the
                  default auto layout the browser sizes columns to their content
                  and treats any width you set as a hint. The trade is that a
                  cell no longer grows to fit, so every one of them below
                  truncates. */}
              {/* The floor is the sum of the visible columns' own minimums rather
                  than a fixed number, so switching a column on widens the table by
                  exactly that column's floor. Unlike Payments or Expenses this
                  table has no stacked-card fallback, so without a floor
                  table-fixed would squeeze seven columns into six characters each
                  on a phone. */}
              <table
                ref={tableRef}
                style={{ minWidth: minTableWidth }}
                className="w-full table-fixed mp-table-fixed divide-y divide-gray-200"
              >
                <ColGroup widths={widths} />
                <thead className="bg-[#f8fafc] sticky top-0 z-10">
                  <tr>
                    {columns.map((col, i) => (
                      <th
                        key={col.key}
                        className={`relative px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        <span className="block truncate">{col.label}</span>
                        {/* No handle past the last column: there is nothing on
                            the far side to take the width from. */}
                        {i < columns.length - 1 && (
                          <ResizeHandle
                            onPointerDown={(e) => startResize(i, e)}
                            onDoubleClick={resetColumns}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-6 py-8">
                        <EmptyState
                          image={medicalCare}
                          title="No patients yet"
                          subtitle="Add your first patient, or adjust your search to find someone."
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((patient) => (
                      <tr
                        key={patient.id}
                        className={`cursor-pointer transition-colors duration-150 group ${
                          isRecentlyAdded(patient)
                            ? 'bg-[#00ba7c]/[0.07] hover:bg-[#00ba7c]/[0.12]'
                            : 'hover:bg-indigo-50/30'
                        }`}
                        onClick={() => navigate(`/patient-profile/${patient.id}`)}
                      >
                        {/* Cells come from the visible column list rather than a
                            fixed run of <td>s, which is what lets a column be
                            hidden or added without the row and the header
                            drifting out of step. */}
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-6 overflow-hidden ${col.key === 'details' ? 'py-5' : 'py-4'} ${
                              col.align === 'right' ? 'text-right' : ''
                            }`}
                          >
                            {renderPatientCell(col.key, patient)}
                          </td>
                        ))}
                      </tr>
                    ))
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
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded ${b.days_until === 0 ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>{label}</span>
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

      {/* Create Drawer. Editing an existing patient is a modal (mounted below);
          a drawer is for entering someone new, which is a flow you stay in. */}
      {editDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setEditDrawerOpen(false)} />
          {/* max-w-2xl, not max-w-md. At 448px this form was ten stacked rows and a
                scroll; at 672px it pairs up and fits on one screen, which for a
                form filled dozens of times a day is the whole difference. */}
          {/* Cmd/Ctrl+Enter saves from any field. A plain Enter cannot: this form
              has a textarea, and hijacking Enter there would stop anyone writing
              a second line of notes. */}
          <div
            className="fixed inset-y-0 right-0 max-w-2xl w-full bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-300"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !editLoading) {
                e.preventDefault();
                handleSavePatient(false);
              }
            }}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Create New Patient
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter patient information
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
              <form
                id="edit-patient-form"
                onSubmit={(e) => { e.preventDefault(); handleSavePatient(); }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pb-2"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  {/* The cursor lands here on open. This form is filled dozens
                      of times a day and it always starts with a name. */}
                  <input
                    type="text"
                    autoFocus
                    ref={nameInputRef}
                    value={editFormData.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className={fieldClass("name")}
                  />
                  <FieldError name="name" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={editFormData.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      onBlur={(e) => checkForDuplicates(e.target.value)}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Village, town or area"
                    value={editFormData.village}
                    onChange={(e) => setField("village", e.target.value)}
                    className={fieldClass("village")}
                  />
                  <FieldError name="village" />
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Type</label>
                  {/* Suggestions come from what this clinic has actually typed
                      before, which is a better answer to "what goes here" than
                      any list we could ship. Free text still wins. */}
                  <input
                    type="text"
                    list="treatment-type-options"
                    placeholder="General"
                    value={editFormData.treatment_type}
                    onChange={(e) => setField("treatment_type", e.target.value)}
                    className={fieldClass("treatment_type")}
                  />
                  <datalist id="treatment-type-options">
                    {uniqueTreatmentTypes.map((t) => <option key={t} value={t} />)}
                  </datalist>
                  <p className="mt-1 text-xs text-gray-400">
                    Not sure yet? Leave it and we record General. The case paper is where it gets decided.
                  </p>
                  <FieldError name="treatment_type" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referred By</label>
                  <input
                    type="text"
                    placeholder="Self"
                    value={editFormData.referred_by}
                    onChange={(e) => setField("referred_by", e.target.value)}
                    className={fieldClass("referred_by")}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Leave blank if they came on their own.
                  </p>
                  <FieldError name="referred_by" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                  <select
                    value={editFormData.blood_group}
                    onChange={(e) => setField("blood_group", e.target.value)}
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
                  {/* The one field on this form that can hurt somebody, so it
                      says so rather than sitting in the medical history blob
                      where nothing can be styled as a warning. */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Latex"
                    value={editFormData.allergies}
                    onChange={(e) => setField("allergies", e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medical History</label>
                  <input
                    type="text"
                    placeholder="e.g. Diabetics, Hypertension"
                    value={editFormData.patient_history}
                    onChange={(e) => setField("patient_history", e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows="2"
                    value={editFormData.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all resize-none"
                  />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 mt-auto">
              {saveError && <InlineFeedback tone="error" className="mb-3">{saveError}</InlineFeedback>}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditDrawerOpen(false)}
                  className="px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                {/* Creation comes in runs on a camp day or a Monday morning.
                    This one saves and re-opens the form on the next patient
                    instead of sending you back out to the list. */}
                <button
                  type="button"
                  onClick={() => handleSavePatient(true)}
                  disabled={editLoading}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save &amp; add another
                </button>
                <button
                  type="submit"
                  form="edit-patient-form"
                  disabled={editLoading}
                  title="Cmd/Ctrl + Enter"
                  className="flex-1 px-4 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {editLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                  Create Patient
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

      <PatientMatchModal
        open={dupOpen}
        matches={dupMatches}
        onPick={(patient) => { setDupOpen(false); setEditDrawerOpen(false); navigate(`/patient-profile/${patient.id}`); }}
        onCreateNew={() => setDupOpen(false)}
        onClose={() => setDupOpen(false)}
      />

      <ColumnsModal
        open={columnPicker}
        columns={PATIENT_COLUMNS}
        hidden={hidden}
        available={tableWidth}
        onApply={setHidden}
        onReset={() => { resetColumns(); setColumnPicker(false); }}
        onClose={() => setColumnPicker(false)}
      />

      <ImportPatientsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={fetchPatients}
      />

      <PatientEditModal
        open={editModalOpen}
        patient={editingPatient}
        onClose={() => setEditModalOpen(false)}
        onSaved={fetchPatients}
      />

      {/* Delete patient — gated on the clinic's master password. */}
      <MasterPasswordModal
        open={!!deleteTarget}
        title="Delete this patient?"
        message={
          <>
            <span className="font-semibold text-gray-700">{deleteTarget?.name}</span> and everything on
            their file goes with them: case papers, x-rays, prescriptions, bills and any payments already
            recorded. This <span className="font-semibold">cannot be undone</span>.
          </>
        }
        confirmLabel="Delete patient"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePatient}
      />
    </div>
  );
};

export default Patients;