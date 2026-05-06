import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Phone,
  Mail,
  ExternalLink,
  X,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import CalendarToolbar from "./appointments/components/CalendarToolbar";
import TeamMembersPanel from "./appointments/components/TeamMembersPanel";
import AppointmentCard from "./appointments/components/AppointmentCard";
import MiniCalendar from "./appointments/components/MiniCalendar";
import MonthGrid from "./appointments/components/MonthGrid";
import DayGrid from "./appointments/components/DayGrid";
import { getAppointmentColor } from "./appointments/utils/doctorColors";
import { computeDayLayout } from "./appointments/utils/layout";
import { getCurrencySymbol } from "../utils/currency";

const Calendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [clinicData, setClinicData] = useState(null);
  const [clinicTimings, setClinicTimings] = useState({
    monday: { open: '08:00', close: '20:00', closed: false },
    tuesday: { open: '08:00', close: '20:00', closed: false },
    wednesday: { open: '08:00', close: '20:00', closed: false },
    thursday: { open: '08:00', close: '20:00', closed: false },
    friday: { open: '08:00', close: '20:00', closed: false },
    saturday: { open: '08:00', close: '20:00', closed: false },
    sunday: { open: '08:00', close: '20:00', closed: true }
  });
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicatePatients, setDuplicatePatients] = useState([]);
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'today'
  const [patientFormData, setPatientFormData] = useState({
    name: '',
    age: '',
    gender: '',
    village: '',
    phone: '',
    referred_by: 'Walk-in',
    treatment_type: '',
    notes: '',
    payment_type: 'Cash'
  });
  const [treatmentTypes, setTreatmentTypes] = useState([]);
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    patientAge: '',
    chair_number: '1',
    time: '',
    duration: '1',
    date: new Date().toISOString().split('T')[0], // Today's date as default
    status: 'confirmed',
    doctor_id: '' // optional — empty means unassigned (public bookings default here)
  });
  const [doctors, setDoctors] = useState([]);
  // Reject confirmation dialog state — replaces the native confirm() + prompt() flow.
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  // Phase 1 filter state: which doctors are visible, and whether to show unassigned (public) bookings
  const [selectedDoctorIds, setSelectedDoctorIds] = useState(() => new Set());
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkingInAppointment, setCheckingInAppointment] = useState(null);
  const [checkInFormData, setCheckInFormData] = useState({
    doctor_id: '',
    chair_number: '',
    notes: '',
    patient_age: '',
    patient_gender: 'Male',
    patient_village: '',
    patient_referred_by: 'Direct'
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // Fetch appointments from API
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      // Get date range for current month
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const dateFrom = firstDay.toISOString().split('T')[0];
      const dateTo = lastDay.toISOString().split('T')[0];
      
      const response = await api.get('/appointments', {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      
      // Transform API response to match calendar format
      const transformedAppointments = response.map(apt => {
        return {
          id: apt.id,
          patientId: apt.patient_id || null,
          patientName: apt.patient_name,
          patientEmail: apt.patient_email || '',
          patientPhone: apt.patient_phone || '',
          patientAvatar: apt.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          treatment: apt.treatment,
          doctor_id: apt.doctor_id || null, // preserved for per-doctor coloring + filtering
          doctor: apt.doctor_name || 'Unassigned',
          startTime: apt.start_time,
          endTime: apt.end_time,
          date: apt.appointment_date,
          status: apt.status,
          notes: apt.notes || '',
          chair_number: apt.chair_number || '',
          patientAge: apt.patient_age || '',
          patientGender: apt.patient_gender || '',
          patientVillage: apt.patient_village || '',
          patientReferredBy: apt.patient_referred_by || '',
          visitNumber: apt.visit_number || null
        };
      });
      
      console.log('✅ Fetched appointments from API:', response.length);
      console.log('📊 Transformed appointments:', transformedAppointments);
      setAppointments(transformedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/clinic-users');
      // Filter for roles that can treat patients
      const filteredDoctors = response.filter(u =>
        u.role === 'doctor' || u.role === 'clinic_owner'
      );
      setDoctors(filteredDoctors);
      // Default the visibility filter to "all doctors on" the first time we learn about them.
      // Only initialize if the set is empty so we don't override user toggles on refetch.
      setSelectedDoctorIds(prev => {
        if (prev.size > 0) return prev;
        return new Set(filteredDoctors.map(d => d.id));
      });
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  // Keep the selected-doctors set in sync when new doctors appear (add them selected by default).
  useEffect(() => {
    setSelectedDoctorIds(prev => {
      const next = new Set(prev);
      let changed = false;
      doctors.forEach(d => {
        if (!next.has(d.id) && prev.size === 0) { next.add(d.id); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [doctors]);

  const toggleDoctorFilter = (doctorId) => {
    setSelectedDoctorIds(prev => {
      const next = new Set(prev);
      if (next.has(doctorId)) next.delete(doctorId); else next.add(doctorId);
      return next;
    });
  };

  // Drag-and-drop reassign — used by the Today/Day grid. Updates doctor and/or
  // start time. Optimistic local update + PUT, with revert on failure.
  const handleReassign = async (appointmentId, newDoctorId, newStartTime) => {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return;

    // Compute new end time by preserving the original duration.
    const toMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const fromMinutes = (mins) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const durationMins = toMinutes(apt.endTime) - toMinutes(apt.startTime);
    const newEndTime = fromMinutes(toMinutes(newStartTime) + durationMins);

    const dateStr = new Date(apt.date).toISOString().split('T')[0];
    const targetDoctorId = newDoctorId ? Number(newDoctorId) : null;

    // No-op detection (same doctor, same time) — avoid a wasted PUT.
    if (targetDoctorId === (apt.doctor_id || null) && newStartTime === apt.startTime) {
      return;
    }

    // Per-doctor conflict check on the destination.
    const conflict = checkTimeConflict(dateStr, newStartTime, newEndTime, targetDoctorId, appointmentId);
    if (conflict.hasConflict) {
      const c = conflict.conflictingAppointment;
      toast.error(
        <div>
          <div className="font-semibold">Cannot move here</div>
          <div className="text-sm mt-1">
            Overlaps with {c.patientName} ({c.doctor}) at {c.startTime}–{c.endTime}.
          </div>
        </div>
      );
      return;
    }

    // Optimistic update so the UI feels instant.
    const targetDoctor = doctors.find(d => d.id === targetDoctorId);
    const previous = apt;
    const updated = {
      ...apt,
      doctor_id: targetDoctorId,
      doctor: targetDoctor?.name || apt.doctor,
      startTime: newStartTime,
      endTime: newEndTime,
    };
    setAppointments(prev => prev.map(a => (a.id === appointmentId ? updated : a)));

    try {
      const payload = {
        doctor_id: targetDoctorId,
        appointment_date: dateStr,
        start_time: newStartTime,
        end_time: newEndTime,
        duration: durationMins,
      };
      const response = await api.put(`/appointments/${appointmentId}`, payload);
      // Reconcile with the server's authoritative response (doctor name, etc.).
      setAppointments(prev => prev.map(a => (a.id === appointmentId ? {
        ...a,
        doctor_id: response.doctor_id || null,
        doctor: response.doctor_name || 'Unassigned',
        startTime: response.start_time,
        endTime: response.end_time,
        date: response.appointment_date,
      } : a)));
    } catch (error) {
      console.error('Failed to reassign appointment:', error);
      const msg = error.response?.data?.detail || error.message || 'Unknown error';
      toast.error(`Failed to update appointment: ${msg}`);
      // Revert the optimistic change.
      setAppointments(prev => prev.map(a => (a.id === appointmentId ? previous : a)));
    }
  };

  // Shared click handler — fetches fresh appointment data then opens the detail drawer.
  const openAppointmentDetails = async (apt) => {
    try {
      const fullAppointment = await api.get(`/appointments/${apt.id}`);
      setSelectedAppointment({
        id: fullAppointment.id,
        patientId: fullAppointment.patient_id || null,
        patientName: fullAppointment.patient_name,
        patientEmail: fullAppointment.patient_email || '',
        patientPhone: fullAppointment.patient_phone || '',
        patientAvatar: fullAppointment.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        treatment: fullAppointment.treatment,
        doctor_id: fullAppointment.doctor_id || null,
        doctor: fullAppointment.doctor_name || 'Unassigned',
        startTime: fullAppointment.start_time,
        endTime: fullAppointment.end_time,
        date: fullAppointment.appointment_date,
        status: fullAppointment.status,
        notes: fullAppointment.notes || '',
        chair_number: fullAppointment.chair_number || '',
        patientAge: fullAppointment.patient_age || '',
        patientGender: fullAppointment.patient_gender || '',
        patientVillage: fullAppointment.patient_village || '',
        patientReferredBy: fullAppointment.patient_referred_by || '',
        visitNumber: fullAppointment.visit_number || null,
      });
    } catch (error) {
      console.error('Error fetching appointment details:', error);
      setSelectedAppointment(apt);
    }
  };

  const toggleShowAll = () => {
    const allOn = showUnassigned && doctors.every(d => selectedDoctorIds.has(d.id));
    if (allOn) {
      setSelectedDoctorIds(new Set());
      setShowUnassigned(false);
    } else {
      setSelectedDoctorIds(new Set(doctors.map(d => d.id)));
      setShowUnassigned(true);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchClinicData();
    fetchTreatmentTypes();
    fetchDoctors();
  }, [currentDate]);

  // Filtered appointments based on team-member panel selection.
  const visibleAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (a.doctor_id) return selectedDoctorIds.has(a.doctor_id);
      return showUnassigned;
    });
  }, [appointments, selectedDoctorIds, showUnassigned]);

  // Counts used by the team-members panel (all appointments in current month window).
  const { countsByDoctorId, unassignedCount } = useMemo(() => {
    const counts = {};
    let unassigned = 0;
    appointments.forEach(a => {
      if (a.doctor_id) counts[a.doctor_id] = (counts[a.doctor_id] || 0) + 1;
      else unassigned += 1;
    });
    return { countsByDoctorId: counts, unassignedCount: unassigned };
  }, [appointments]);

  // Set of yyyy-mm-dd strings for dates that have any visible appointment — used
  // by the mini calendar to draw activity dots.
  const appointmentDates = useMemo(() => {
    const set = new Set();
    visibleAppointments.forEach(a => {
      if (a.date) set.add(new Date(a.date).toISOString().split('T')[0]);
    });
    return set;
  }, [visibleAppointments]);

  // Scroll-into-view on week mount: when the user opens the week (or switches
  // to it), bring the current hour roughly into the middle of the viewport.
  const weekScrollRef = useRef(null);
  useEffect(() => {
    if (viewMode !== 'week' || !weekScrollRef.current) return;
    const HOUR_PX = 80;
    const OPEN_HOUR = 8; // matches getWeekViewTimeSlots
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const y = Math.max(0, ((minutes - OPEN_HOUR * 60) * HOUR_PX) / 60 - 200);
    weekScrollRef.current.scrollTop = y;
  }, [viewMode]);

  // Format the current week as a human-friendly range, handling cross-month
  // and cross-year cases ("Apr 28 – May 4, 2026" / "Dec 29, 2025 – Jan 4, 2026").
  const formatWeekRange = (dates) => {
    if (!dates || dates.length === 0) return '';
    const start = dates[0];
    const end = dates[dates.length - 1];
    const sm = start.toLocaleDateString('en-US', { month: 'short' });
    const em = end.toLocaleDateString('en-US', { month: 'short' });
    const sy = start.getFullYear();
    const ey = end.getFullYear();
    if (sy !== ey) return `${sm} ${start.getDate()}, ${sy} – ${em} ${end.getDate()}, ${ey}`;
    if (sm === em) return `${sm} ${start.getDate()} – ${end.getDate()}, ${sy}`;
    return `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${sy}`;
  };

  // Per-date counts for the week-view day-header badges.
  const visibleCountsByDate = useMemo(() => {
    const map = {};
    visibleAppointments.forEach(a => {
      if (!a.date) return;
      const k = new Date(a.date).toISOString().split('T')[0];
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [visibleAppointments]);

  // Get relative date label (Today, Yesterday, Tomorrow)
  const getRelativeDateLabel = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    
    // If not within the 3-day range, return formatted date
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Navigation functions
  const goToPrevious = () => {
    if (viewMode === 'today') {
      // In today's view, only allow navigating to yesterday
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const current = new Date(currentDate);
      current.setHours(0, 0, 0, 0);
      const diffDays = Math.round((current - today) / (1000 * 60 * 60 * 24));

      if (diffDays > -1) {
        // Can go back to yesterday
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 1);
        setCurrentDate(newDate);
      }
    } else if (viewMode === 'month') {
      // Month view: go back 1 month
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setCurrentDate(newDate);
    } else {
      // Week view: go back 7 days
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    }
  };

  const goToNext = () => {
    if (viewMode === 'today') {
      // In today's view, only allow navigating to tomorrow
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const current = new Date(currentDate);
      current.setHours(0, 0, 0, 0);
      const diffDays = Math.round((current - today) / (1000 * 60 * 60 * 24));

      if (diffDays < 1) {
        // Can go forward to tomorrow
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 1);
        setCurrentDate(newDate);
      }
    } else if (viewMode === 'month') {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setCurrentDate(newDate);
    } else {
      // Week view: go forward 7 days
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setViewMode('today'); // Switch to today's view
  };

  // Get week dates
  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  // Get time slots based on day and clinic timings
  const getTimeSlots = (date = new Date()) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayTimings = clinicTimings[dayName];
    
    // If clinic is closed on this day, return empty array
    if (!dayTimings || dayTimings.closed) {
      return [];
    }
    
    // Parse open and close times
    const [openHour, openMinute] = dayTimings.open.split(':').map(Number);
    const [closeHour, closeMinute] = dayTimings.close.split(':').map(Number);
    
    const slots = [];
    let currentHour = openHour;
    
    // Generate slots from open to close time
    while (currentHour <= closeHour) {
      // Don't add slot if it's the closing hour and we're at or past closing time
      if (currentHour === closeHour && openMinute >= closeMinute) {
        break;
      }
      
      const time = `${currentHour.toString().padStart(2, '0')}:00`;
      const displayTime = currentHour === 12 ? '12:00 PM' : 
                        currentHour > 12 ? `${currentHour - 12}:00 PM` : 
                        `${currentHour}:00 AM`;
      slots.push({ time, displayTime, hour: currentHour });
      currentHour++;
    }
    
    return slots;
  };

  // Get appointments for a specific date — respects the team-member panel filter.
  const getAppointmentsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return visibleAppointments.filter(apt => {
      const aptDate = apt.date ? new Date(apt.date).toISOString().split('T')[0] : apt.date;
      return aptDate === dateStr;
    });
  };

  // Calculate appointment position and height
  const getAppointmentStyle = (appointment) => {
    const startHour = parseInt(appointment.startTime.split(':')[0]);
    const startMinute = parseInt(appointment.startTime.split(':')[1]);
    const endHour = parseInt(appointment.endTime.split(':')[0]);
    const endMinute = parseInt(appointment.endTime.split(':')[1]);
    
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;
    const duration = endTimeInMinutes - startTimeInMinutes;
    
    // Position from top (8 AM = 0 minutes) - each hour is 80px
    // Since overlay has top: 60px, we need to account for that offset
    const topPosition = (startTimeInMinutes - 8 * 60) * (80 / 60); // 80px per hour = 1.33px per minute
    const height = duration * (80 / 60); // 80px per hour = 1.33px per minute

    return {
      top: `${topPosition}px`,
      height: `${height}px`,
      width: '12%',
      left: '7.5%',
      minHeight: '20px',
      zIndex: 10
    };
  };

  // Format time for display
  const formatTime = (timeString) => {
    const [hour, minute] = timeString.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  // Get current time for indicator
  const getCurrentTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Position from top (8 AM = 0 minutes) - each hour is 80px
    const topPosition = (currentTimeInMinutes - 8 * 60) * (80 / 60); // 80px per hour = 1.33px per minute
    
    return {
      top: `${topPosition}px`,
      time: now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: false 
      })
    };
  };

  // Get client's timezone
  const getClientTimezone = () => {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = now.getTimezoneOffset();
    const offsetHours = Math.abs(offset) / 60;
    const offsetMinutes = Math.abs(offset) % 60;
    const sign = offset <= 0 ? '+' : '-';
    
    return {
      timezone,
      offset: `${sign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`
    };
  };

  // Fetch clinic data
  const fetchClinicData = async () => {
    try {
      const response = await api.get('/clinics/me');
      setClinicData(response);
      if (response.timings) {
        setClinicTimings(response.timings);
      }
    } catch (error) {
      console.error('Error fetching clinic data:', error);
    }
  };

  const fetchTreatmentTypes = async () => {
    try {
      const response = await api.get('/treatment-types/');
      setTreatmentTypes(response);
    } catch (error) {
      console.error('Error fetching treatment types:', error);
      setTreatmentTypes([]);
    }
  };

  // Fetch full appointment details when selectedAppointment changes to ensure we have latest patient_id
  useEffect(() => {
    const fetchFullAppointmentDetails = async () => {
      if (!selectedAppointment || !selectedAppointment.id) return;
      
      try {
        const fullAppointment = await api.get(`/appointments/${selectedAppointment.id}`);
        const newPatientId = fullAppointment.patient_id || null;
        const newStatus = fullAppointment.status;
        
        // Only update if patient_id or status has changed to avoid unnecessary re-renders
        if (selectedAppointment.patientId !== newPatientId || selectedAppointment.status !== newStatus) {
          const transformedAppointment = {
            id: fullAppointment.id,
            patientId: newPatientId,
            patientName: fullAppointment.patient_name,
            patientEmail: fullAppointment.patient_email || '',
            patientPhone: fullAppointment.patient_phone || '',
            patientAvatar: fullAppointment.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
            treatment: fullAppointment.treatment,
            doctor: fullAppointment.doctor_name || 'Unassigned',
            startTime: fullAppointment.start_time,
            endTime: fullAppointment.end_time,
            date: fullAppointment.appointment_date,
            status: newStatus,
            doctor_id: fullAppointment.doctor_id || null,
            notes: fullAppointment.notes || ''
          };
          console.log('🔄 Updated appointment details:', transformedAppointment);
          console.log('🆔 Patient ID:', transformedAppointment.patientId);
          setSelectedAppointment(transformedAppointment);
        }
      } catch (error) {
        console.error('Error fetching full appointment details:', error);
        // Don't update if there's an error - keep existing selectedAppointment
      }
    };

    fetchFullAppointmentDetails();
  }, [selectedAppointment?.id]); // Only fetch when the appointment ID changes

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAppointment(prev => ({
      ...prev,
      [name]: value
    }));

    // Check for operating hours validation when time is changed
    if (name === 'time' && value && newAppointment.date) {
      const timeValidation = isTimeWithinOperatingHours(newAppointment.date, value);
      if (!timeValidation.valid) {
        toast.warning(`Outside clinic hours — ${timeValidation.message}`);
        return;
      }

      // Check for conflicts when time is valid (per-doctor, matching create flow)
      const durationMinutes = parseFloat(newAppointment.duration) * 60;
      const [startHour, startMinute] = value.split(':').map(Number);
      const endTimeInMinutes = (startHour * 60 + startMinute) + durationMinutes;
      const endHour = Math.floor(endTimeInMinutes / 60);
      const endMinute = endTimeInMinutes % 60;

      const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      const conflict = checkTimeConflict(newAppointment.date, startTime, endTime, newAppointment.doctor_id || null);
      if (conflict.hasConflict) {
        const c = conflict.conflictingAppointment;
        toast.warning(
          <div>
            <div className="font-semibold">Time conflict</div>
            <div className="text-sm mt-1">{c.patientName} is booked {c.startTime}–{c.endTime}.</div>
          </div>
        );
      }
    }
  };

  // Check if time slot overlaps with existing appointments for the SAME doctor.
  // Two appointments with different assigned doctors don't conflict. An unassigned
  // booking only conflicts with other unassigned bookings — the receptionist will
  // assign a doctor on check-in, at which point the chair/doctor check kicks in.
  const checkTimeConflict = (date, startTime, endTime, doctorId = null, excludeId = null) => {
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    const dateStr = date;
    const dayAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.date).toISOString().split('T')[0];
      return aptDate === dateStr && apt.id !== excludeId;
    });

    const targetDoctor = doctorId ? Number(doctorId) : null;

    for (const apt of dayAppointments) {
      // Only count as conflict if both refer to the same resource:
      // - same doctor id, OR
      // - both unassigned (both null)
      const aptDoctor = apt.doctor_id ? Number(apt.doctor_id) : null;
      if (aptDoctor !== targetDoctor) continue;

      const aptStart = timeToMinutes(apt.startTime);
      const aptEnd = timeToMinutes(apt.endTime);

      if (
        (newStart >= aptStart && newStart < aptEnd) ||
        (newEnd > aptStart && newEnd <= aptEnd) ||
        (newStart <= aptStart && newEnd >= aptEnd)
      ) {
        return {
          hasConflict: true,
          conflictingAppointment: apt
        };
      }
    }

    return { hasConflict: false };
  };

  // Find next available time slot
  const findNextAvailableSlot = (date, durationHours = 1) => {
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const minutesToTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };
    
    // Get day name and check if clinic is open
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayTimings = clinicTimings[dayName];
    
    // If clinic is closed on this day, return null
    if (!dayTimings || dayTimings.closed) {
      return null;
    }

    // Get appointments for the same date
    const dateStr = date;
    const dayAppointments = appointments
      .filter(apt => {
        const aptDate = new Date(apt.date).toISOString().split('T')[0];
        return aptDate === dateStr;
      })
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    // Use clinic hours from settings (default to 8 AM - 8 PM if not set)
    const [openHour, openMinute] = (dayTimings.open || '08:00').split(':').map(Number);
    const [closeHour, closeMinute] = (dayTimings.close || '20:00').split(':').map(Number);
    const clinicStart = openHour * 60 + openMinute;
    const clinicEnd = closeHour * 60 + closeMinute;
    const durationMinutes = durationHours * 60;

    // If no appointments, start at clinic opening
    if (dayAppointments.length === 0) {
      // Check if it's today and we're past clinic start time
      const today = new Date().toISOString().split('T')[0];
      if (date === today) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        // Round up to next 30-minute interval
        const nextSlot = Math.ceil(currentMinutes / 30) * 30;
        if (nextSlot >= clinicStart && nextSlot + durationMinutes <= clinicEnd) {
          return minutesToTime(nextSlot);
        }
      }
      return minutesToTime(clinicStart);
    }

    // Check for gaps between appointments
    let checkTime = clinicStart;

    // If it's today, start from current time
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      checkTime = Math.max(checkTime, Math.ceil(currentMinutes / 30) * 30);
    }

    for (const apt of dayAppointments) {
      const aptStart = timeToMinutes(apt.startTime);
      const aptEnd = timeToMinutes(apt.endTime);

      // Check if there's a gap before this appointment
      if (checkTime + durationMinutes <= aptStart) {
        return minutesToTime(checkTime);
      }

      // Move check time to after this appointment
      checkTime = Math.max(checkTime, aptEnd);
    }

    // Check if there's time after last appointment
    if (checkTime + durationMinutes <= clinicEnd) {
      return minutesToTime(checkTime);
    }

    // No slot available today
    return null;
  };

  // Check if selected time is within clinic operating hours
  const isTimeWithinOperatingHours = (date, time) => {
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayTimings = clinicTimings[dayName];

    // If clinic is closed on this day
    if (!dayTimings || dayTimings.closed) {
      return { valid: false, message: `Clinic is closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}.` };
    }

    const [selectedHour, selectedMinute] = time.split(':').map(Number);
    const selectedTimeInMinutes = selectedHour * 60 + selectedMinute;

    const [openHour, openMinute] = dayTimings.open.split(':').map(Number);
    const [closeHour, closeMinute] = dayTimings.close.split(':').map(Number);
    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    if (selectedTimeInMinutes < openTimeInMinutes) {
      return {
        valid: false,
        message: `Clinic opens at ${dayTimings.open}. Selected time ${time} is too early.`
      };
    }

    if (selectedTimeInMinutes >= closeTimeInMinutes) {
      return {
        valid: false,
        message: `Clinic closes at ${dayTimings.close}. Selected time ${time} is too late.`
      };
    }

    return { valid: true };
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Auto-assign time if not provided
    let appointmentTime = newAppointment.time;
    if (!appointmentTime) {
    const durationHours = parseFloat(newAppointment.duration);
      appointmentTime = findNextAvailableSlot(newAppointment.date, durationHours);

      if (!appointmentTime) {
        toast.error('No available time slots for this date. Please choose another date.');
        return;
      }
      // Auto-assigning silently — user knows what they asked for; surface the chosen slot via info toast.
      toast.info(`Auto-assigned to next available slot: ${appointmentTime}`);
    } else {
      // Validate selected time is within operating hours
      const timeValidation = isTimeWithinOperatingHours(newAppointment.date, appointmentTime);
      if (!timeValidation.valid) {
        toast.error(`Invalid time — ${timeValidation.message}`);
        return;
      }
    }
    
    try {
    // Calculate start and end times from time and duration
    const [startHour, startMinute] = appointmentTime.split(':').map(Number);
      const durationMinutes = parseFloat(newAppointment.duration) * 60;
      const endTimeInMinutes = (startHour * 60 + startMinute) + durationMinutes;
    const endHour = Math.floor(endTimeInMinutes / 60);
    const endMinute = endTimeInMinutes % 60;
    
    const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    
      // Check for time conflicts (per-doctor; unassigned only conflicts with unassigned)
      const conflict = checkTimeConflict(newAppointment.date, startTime, endTime, newAppointment.doctor_id || null);
      if (conflict.hasConflict) {
        const c = conflict.conflictingAppointment;
        toast.error(
          <div>
            <div className="font-semibold">Time slot conflict</div>
            <div className="text-sm mt-1">
              Overlaps with {c.patientName} ({c.doctor}) at {c.startTime}–{c.endTime}. Pick another time or doctor.
            </div>
          </div>
        );
        return;
      }
    
      // Get clinic_id from clinicData or user
      const clinicId = clinicData?.id || user?.clinic_id;
      
      if (!clinicId) {
        toast.error('Clinic info not available. Please refresh and try again.');
        return;
      }
      
      // Create appointment via API
      const appointmentData = {
        patient_name: newAppointment.patientName,
        patient_email: newAppointment.patientEmail,
        patient_phone: newAppointment.patientPhone,
        patient_age: newAppointment.patientAge ? parseInt(newAppointment.patientAge) : null,
        chair_number: newAppointment.chair_number,
        appointment_date: newAppointment.date,
        start_time: startTime,
        end_time: endTime,
        duration: parseInt(durationMinutes),
        status: newAppointment.status,
        doctor_id: newAppointment.doctor_id ? parseInt(newAppointment.doctor_id) : null,
        clinic_id: clinicId // Required by backend schema (even though it uses current_user.clinic_id internally)
      };

      const response = await api.post('/appointments', appointmentData);

      // Add to local state with transformed format (color is derived at render time via getAppointmentColor)
      const newApt = {
        id: response.id,
        patientId: response.patient_id || null,
        patientName: response.patient_name,
        patientEmail: response.patient_email || '',
        patientPhone: response.patient_phone || '',
        patientAvatar: response.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        treatment: response.treatment,
        doctor_id: response.doctor_id || null,
        doctor: response.doctor_name || 'Unassigned',
        startTime: response.start_time,
        endTime: response.end_time,
        date: response.appointment_date,
        status: response.status,
        notes: response.notes || ''
      };

      setAppointments(prev => [...prev, newApt]);

      // Reset form and close drawer
      setNewAppointment({
        patientName: '',
        patientEmail: '',
        patientPhone: '',
        patientAge: '',
        chair_number: '1',
        time: '',
        duration: '1',
        date: new Date().toISOString().split('T')[0],
        status: 'confirmed',
        doctor_id: ''
      });
    setShowAddForm(false);
    
    toast.success('Appointment created');
  } catch (error) {
    console.error('Error creating appointment:', error);
    const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
    toast.error(`Failed to create appointment: ${errorMessage}`);
  }
};

  const handleCheckIn = () => {
    // Pre-fill check-in form with current appointment data
    setCheckInFormData({
      doctor_id: selectedAppointment.doctor_id || '',
      chair_number: selectedAppointment.chair_number || '',
      notes: selectedAppointment.notes || '',
      patient_age: selectedAppointment.patientAge || '',
      patient_gender: selectedAppointment.patientGender || 'Male',
      patient_village: selectedAppointment.patientVillage || '',
      patient_referred_by: selectedAppointment.patientReferredBy || 'Direct'
    });
    setPatientSearch(selectedAppointment.patientName || '');
    setPatientResults([]);
    setSelectedMatch(null);
    setCheckingInAppointment(selectedAppointment);
    setShowCheckInModal(true);
  };

  const searchPatients = async (query) => {
    if (!query || query.length < 2) {
      setPatientResults([]);
      return;
    }
    setSearchingPatient(true);
    try {
      const response = await api.get('/appointments/search-patients', {
        params: { q: query }
      });
      setPatientResults(response);
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setSearchingPatient(false);
    }
  };

  const handleSelectPatientMatch = (patient) => {
    setSelectedMatch(patient);
    setPatientSearch(patient.name);
    setPatientResults([]);
    setCheckInFormData(prev => ({
      ...prev,
      patient_age: patient.age || prev.patient_age,
      patient_gender: patient.gender || prev.patient_gender,
      patient_village: patient.village || prev.patient_village
    }));
  };

  const handleConfirmCheckIn = async () => {
    try {
      setIsCheckingDuplicates(true);
      console.log('🔍 Checking for potential duplicates...');
      
      // Check for duplicates before finalizing
      const duplicates = await api.get('/patients/check-duplicates', {
        params: {
          name: checkingInAppointment.patientName,
          phone: checkingInAppointment.patientPhone,
          email: checkingInAppointment.patientEmail
        }
      });

      if (duplicates && duplicates.length > 0) {
        setDuplicateMatches(duplicates);
        setShowDuplicateModal(true);
        setIsCheckingDuplicates(false);
        return; // Wait for user choice
      }

      // If no duplicates, proceed with finalize
      await handleFinalizeCheckIn();
    } catch (error) {
      console.error('❌ Error during duplicate check:', error);
      toast.error('Failed to verify patient records. Please try again.');
      setIsCheckingDuplicates(false);
    }
  };

  const handleFinalizeCheckIn = async (existingPatientId = null) => {
    try {
      console.log('📋 Finalizing check-in for appointment:', checkingInAppointment.id);
      setIsCheckingDuplicates(true);
      
      // Sanitize integer fields to avoid validation errors with empty strings
      const sanitizedData = {
        ...checkInFormData,
        doctor_id: checkInFormData.doctor_id ? parseInt(checkInFormData.doctor_id) : null,
        patient_age: checkInFormData.patient_age ? parseInt(checkInFormData.patient_age) : null,
        patient_id: existingPatientId || checkingInAppointment.patientId || null,
        status: 'checking'
      };

      const response = await api.put(`/appointments/${checkingInAppointment.id}`, {
        ...sanitizedData,
        patient_name: checkingInAppointment.patientName,
        patient_phone: checkingInAppointment.patientPhone,
        patient_email: checkingInAppointment.patientEmail
      });
      
      console.log('✅ Check-in response:', response);
      
      // Update local state
      const updatedApt = { 
        ...checkingInAppointment, 
        ...checkInFormData,
        patientAge: checkInFormData.patient_age,
        patientGender: checkInFormData.patient_gender,
        patientVillage: checkInFormData.patient_village,
        patientReferredBy: checkInFormData.patient_referred_by,
        status: 'checking',
        doctor_id: response.doctor_id,
        doctor: response.doctor_name || 'Unassigned',
        patientId: response.patient_id || checkingInAppointment.patientId 
      };
      
      // Update appointments list
      setAppointments(prev => prev.map(apt => 
        apt.id === checkingInAppointment.id ? updatedApt : apt
      ));
      
      // Update selected appointment if it's the one we just checked in
      if (selectedAppointment && selectedAppointment.id === checkingInAppointment.id) {
        setSelectedAppointment(updatedApt);
      }
      
      setShowCheckInModal(false);
      setShowDuplicateModal(false);
      setCheckingInAppointment(null);
      toast.success(existingPatientId ? 'Patient linked and checked in' : 'Checked in — new patient file created');
      
    } catch (error) {
      console.error('❌ Error during check-in:', error);
      toast.error(`Failed to check in: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Handle appointment acceptance (NO auto-create patient file)
  const handleAcceptAppointment = async () => {
    try {
      const response = await api.put(`/appointments/${selectedAppointment.id}`, {
        status: 'accepted'
      });
      
      // Update local state
      setAppointments(prev => prev.map(apt => 
        apt.id === selectedAppointment.id 
          ? { ...apt, status: 'accepted' }
          : apt
      ));
      
      // Update selected appointment - patient_id stays null until file created manually
      setSelectedAppointment({ 
        ...selectedAppointment, 
        status: 'accepted',
        patientId: null  // No auto-create patient file
      });
      
      toast.success('Appointment accepted — you can now create a patient file from the details panel.');
    } catch (error) {
      console.error('Error accepting appointment:', error);
      toast.error('Failed to accept appointment. Please try again.');
    }
  };

  // Handle appointment rejection
  // Open the in-page reject dialog (replaces the native confirm + prompt flow).
  const handleRejectAppointment = () => {
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  // Actually submit the rejection. Called by the dialog's Reject button.
  const submitRejection = async () => {
    if (!selectedAppointment) return;
    setRejectSubmitting(true);
    try {
      await api.put(`/appointments/${selectedAppointment.id}`, {
        status: 'rejected',
        rejection_reason: rejectReason.trim() || null,
      });
      setAppointments(prev => prev.map(apt =>
        apt.id === selectedAppointment.id ? { ...apt, status: 'rejected' } : apt
      ));
      setSelectedAppointment({ ...selectedAppointment, status: 'rejected' });
      setRejectDialogOpen(false);
      toast.success('Appointment rejected');
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      toast.error('Failed to reject appointment. Please try again.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  // Handle creating patient file - check for duplicates first
  const handleCreatePatientFile = async () => {
    try {
      console.log('🔍 Checking for duplicates with data:', {
        name: selectedAppointment.patientName,
        phone: selectedAppointment.patientPhone,
        email: selectedAppointment.patientEmail
      });
      
      // Check for duplicate patients
      const duplicateCheck = await api.post('/patients/check-duplicates', {
        name: selectedAppointment.patientName,
        phone: selectedAppointment.patientPhone,
        email: selectedAppointment.patientEmail
      });
      
      console.log('✅ Duplicate check response:', duplicateCheck);
      
      if (duplicateCheck && duplicateCheck.length > 0) {
        // Found duplicates - show warning modal
        console.log(`⚠️ Found ${duplicateCheck.length} duplicate(s)`);
        setDuplicatePatients(duplicateCheck);
        setShowDuplicateWarning(true);
      }
    } catch (error) {
      console.error('❌ Error checking duplicates:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      toast.error(`Failed to check for duplicate patients: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Handle patient registration after accepting appointment
  const handlePatientRegistration = async (e) => {
    e.preventDefault();
    
    try {
      // Prepare patient data with defaults for optional fields
      const patientDataToSend = {
        name: patientFormData.name,
        age: parseInt(patientFormData.age), // Convert to integer
        gender: patientFormData.gender,
        village: patientFormData.village,
        phone: patientFormData.phone,
        referred_by: patientFormData.referred_by || 'Walk-in', // Default if empty
        treatment_type: patientFormData.treatment_type,
        notes: patientFormData.notes || '',
        payment_type: patientFormData.payment_type
      };
      
      console.log('📤 Sending patient data:', patientDataToSend);
      
      // Create patient
      const patientResponse = await api.post('/patients/', patientDataToSend);
      
      console.log('✅ Patient created:', patientResponse);
      
      // Link patient to appointment
      await api.put(`/appointments/${selectedAppointment.id}`, {
        patient_id: patientResponse.id
      });
      
      // Update selected appointment with patient_id and refresh appointments list
      const updatedAppointment = { 
        ...selectedAppointment, 
        patientId: patientResponse.id,
        status: 'accepted'
      };
      
      // Refresh appointments list to get updated data
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const dateFrom = firstDay.toISOString().split('T')[0];
      const dateTo = lastDay.toISOString().split('T')[0];
      const appointmentsResponse = await api.get('/appointments', {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      
      const transformedAppointments = appointmentsResponse.map(apt => {
        const colors = [
          "bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#2a276e]",
          "bg-purple-100 border-purple-200 text-purple-800",
          "bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#2a276e]",
          "bg-pink-100 border-pink-200 text-pink-800",
          "bg-yellow-100 border-yellow-200 text-yellow-800"
        ];
        const colorIndex = apt.id % colors.length;
        
        return {
          id: apt.id,
          patientId: apt.patient_id || null,
          patientName: apt.patient_name,
          patientEmail: apt.patient_email || '',
          patientPhone: apt.patient_phone || '',
          patientAvatar: apt.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          treatment: apt.treatment,
          doctor: apt.doctor_name || 'Unassigned',
          startTime: apt.start_time,
          endTime: apt.end_time,
          date: apt.appointment_date,
          status: apt.status,
          color: colors[colorIndex],
          notes: apt.notes || ''
        };
      });
      
      setAppointments(transformedAppointments);
      
      // Fetch the full appointment details to ensure we have the latest patient_id
      try {
        const fullAppointment = await api.get(`/appointments/${selectedAppointment.id}`);
        const transformedAppointment = {
          id: fullAppointment.id,
          patientId: fullAppointment.patient_id || null,
          patientName: fullAppointment.patient_name,
          patientEmail: fullAppointment.patient_email || '',
          patientPhone: fullAppointment.patient_phone || '',
          patientAvatar: fullAppointment.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          treatment: fullAppointment.treatment,
          doctor: fullAppointment.doctor_name || 'Unassigned',
          startTime: fullAppointment.start_time,
          endTime: fullAppointment.end_time,
          date: fullAppointment.appointment_date,
          status: fullAppointment.status,
          doctor_id: fullAppointment.doctor_id || null,
          notes: fullAppointment.notes || ''
        };
        console.log('✅ Patient registration complete - Updated appointment:', transformedAppointment);
        console.log('🆔 Patient ID after registration:', transformedAppointment.patientId);
        setSelectedAppointment(transformedAppointment);
      } catch (error) {
        console.error('Error fetching updated appointment:', error);
        // Fallback to updated appointment from refresh
        const refreshedAppointment = transformedAppointments.find(apt => apt.id === selectedAppointment.id);
        if (refreshedAppointment) {
          setSelectedAppointment(refreshedAppointment);
        } else {
          setSelectedAppointment(updatedAppointment);
        }
      }
      
      // Show success message
      toast.success('Patient registered successfully');
      
      // Close the patient registration form
      setShowPatientForm(false);
      
      // Reset form data
      setPatientFormData({
        name: '',
        age: '',
        gender: '',
        village: '',
        phone: '',
        referred_by: 'Walk-in',
        treatment_type: '',
        notes: '',
        payment_type: 'Cash'
      });
      
    } catch (error) {
      console.error('❌ Error registering patient:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Full error object:', error);
      
      // Show more detailed error message
      const errorMessage = error.message || 'Unknown error';
      toast.error(`Failed to register patient: ${errorMessage}`);
    }
  };

  // Handle creating new patient with suffix
  const handleCreateNewPatientWithSuffix = async () => {
    try {
      // Find highest suffix number for this name
      const baseName = selectedAppointment.patientName;
      const existingWithSuffix = duplicatePatients.filter(p => p.name.startsWith(baseName));
      let suffix = 2;
      
      existingWithSuffix.forEach(p => {
        const match = p.name.match(/\((\d+)\)$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num >= suffix) suffix = num + 1;
        }
      });
      
      const newName = `${baseName} (${suffix})`;
      
      // Pre-fill form with new name
      setPatientFormData({
        name: newName,
        age: '',
        gender: '',
        village: '',
        phone: selectedAppointment.patientPhone || '',
        referred_by: 'Walk-in',
        treatment_type: '',
        notes: selectedAppointment.notes || '',
        payment_type: 'Cash'
      });
      
      setShowDuplicateWarning(false);
      setShowPatientForm(true);
    } catch (error) {
      console.error('Error creating new patient:', error);
      toast.error('Failed to create new patient. Please try again.');
    }
  };

  // Handle linking to existing patient
  const handleLinkToExistingPatient = async (patientId) => {
    try {
      // Link appointment to existing patient
      await api.put(`/appointments/${selectedAppointment.id}`, {
        patient_id: patientId
      });
      
      // Update local state
      setAppointments(prev => prev.map(apt => 
        apt.id === selectedAppointment.id 
          ? { ...apt, patientId: patientId }
          : apt
      ));
      
      setSelectedAppointment({ 
        ...selectedAppointment, 
        patientId: patientId
      });
      
      setShowDuplicateWarning(false);
      toast.success('Appointment linked to existing patient');
    } catch (error) {
      console.error('Error linking to existing patient:', error);
      toast.error('Failed to link appointment. Please try again.');
    }
  };

  // Generate clinic-based booking URL
  const getBookingUrl = () => {
    const clinicId = clinicData?.id || "1";
    return `/booking?clinic=${clinicId}`;
  };

  const weekDates = getWeekDates();
  // For week view calendar structure, use hardcoded 8 AM to 8 PM (same as desktop app)
  // This ensures time slots are always visible in the grid
  const getWeekViewTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      const displayTime = hour === 12 ? '12:00 PM' : 
                        hour > 12 ? `${hour - 12}:00 PM` : 
                        `${hour}:00 AM`;
      slots.push({ time, displayTime, hour });
    }
    return slots;
  };
  const timeSlots = getWeekViewTimeSlots();
  const currentTimeIndicator = getCurrentTime();
  const clientTimezone = getClientTimezone();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
        {/* Top toolbar — Today / arrows / date / view toggle / booking link / New */}
        <CalendarToolbar
          title={viewMode === 'today'
            ? getRelativeDateLabel(currentDate)
            : viewMode === 'week'
              ? formatWeekRange(weekDates)
              : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          viewMode={viewMode}
          onPrev={goToPrevious}
          onNext={goToNext}
          onToday={goToToday}
          onSetViewMode={(mode) => {
            if (mode === 'today') setCurrentDate(new Date());
            setViewMode(mode);
          }}
          onOpenCreate={() => setShowAddForm(true)}
          publicBookingUrl={getBookingUrl()}
          prevDisabled={viewMode === 'today' && (() => {
            const today = new Date(); today.setHours(0,0,0,0);
            const current = new Date(currentDate); current.setHours(0,0,0,0);
            return Math.round((current - today) / (1000 * 60 * 60 * 24)) <= -1;
          })()}
          nextDisabled={viewMode === 'today' && (() => {
            const today = new Date(); today.setHours(0,0,0,0);
            const current = new Date(currentDate); current.setHours(0,0,0,0);
            return Math.round((current - today) / (1000 * 60 * 60 * 24)) >= 1;
          })()}
        />

        {/* Two-column layout: team members rail + calendar content */}
        <div className="flex gap-4 min-h-[700px]">
          <TeamMembersPanel
            doctors={doctors}
            countsByDoctorId={countsByDoctorId}
            unassignedCount={unassignedCount}
            selectedDoctorIds={selectedDoctorIds}
            showUnassigned={showUnassigned}
            onToggleDoctor={toggleDoctorFilter}
            onToggleUnassigned={() => setShowUnassigned(v => !v)}
            onToggleAll={toggleShowAll}
            header={
              <MiniCalendar
                currentDate={currentDate}
                appointmentDates={appointmentDates}
                onSelectDate={(d) => {
                  setCurrentDate(d);
                  // Clicking a specific date from the mini calendar is best paired
                  // with the single-day view; keep week view if currently there.
                  if (viewMode === 'month') setViewMode('week');
                }}
              />
            }
          />

          <div className="flex-1 min-w-0">
        {/* Calendar Content */}
        {loading ? (
          <div className="text-center py-12">
            <GearLoader size="w-12 h-12" className="mx-auto" />
            <p className="mt-4 text-gray-600">Loading appointments...</p>
          </div>
        ) : viewMode === 'month' ? (
          /* Month View — full month grid with doctor-colored chips */
          <MonthGrid
            currentDate={currentDate}
            appointments={visibleAppointments}
            onSelectDate={(d) => { setCurrentDate(d); setViewMode('today'); }}
            onSelectAppointment={openAppointmentDetails}
          />
        ) : viewMode === 'today' ? (
          /* Today's View — multi-resource day grid (one column per visible doctor) */
          <div>
            <DayGrid
              date={currentDate}
              appointments={visibleAppointments}
              doctors={doctors}
              selectedDoctorIds={selectedDoctorIds}
              showUnassigned={showUnassigned}
              unassignedCount={unassignedCount}
              clinicTimings={clinicTimings}
              onAppointmentClick={openAppointmentDetails}
              onReassign={handleReassign}
            />
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Calendar Grid Container with Scroll */}
            <div ref={weekScrollRef} className="max-h-[640px] overflow-y-auto relative">
              <div className="grid grid-cols-8 min-h-[800px] relative">
                {/* Time column header */}
                <div className="p-3 text-center font-semibold text-gray-700 bg-gray-50 sticky top-0 z-20">
                  {clientTimezone.offset}
                </div>

                {/* Day headers — weekday, date, and appointment count */}
                {weekDates.map((date, index) => {
                  const iso = date.toISOString().split('T')[0];
                  const count = visibleCountsByDate[iso] || 0;
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div key={index} className="p-3 text-center bg-gray-50 border-l border-gray-100 sticky top-0 z-20">
                      <div className="text-sm font-medium text-gray-600">
                        {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                      </div>
                      <div className={`text-lg font-bold ${
                        isToday
                          ? 'text-white bg-[#2a276e] rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                          : 'text-gray-900'
                      }`}>
                        {date.getDate()}
                      </div>
                      {count > 0 && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {count} appt{count === 1 ? '' : 's'}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Time slots — empty cells with half-hour divider for easier reading */}
                {timeSlots.map((slot) => (
                  <React.Fragment key={slot.time}>
                    {/* Time label */}
                    <div className="p-3 text-sm font-medium text-gray-600 bg-white border-t border-gray-100">
                      {slot.displayTime}
                    </div>

                    {weekDates.map((date, dayIndex) => (
                      <div
                        key={`${slot.time}-${dayIndex}`}
                        className="min-h-[80px] bg-white border-t border-l border-gray-100 relative"
                      >
                        {/* Half-hour divider — faint dashed line at the 30-minute mark */}
                        <div className="absolute left-0 right-0 top-[40px] border-t border-dashed border-gray-100 pointer-events-none" />
                      </div>
                    ))}
                  </React.Fragment>
                ))}

                {/* Appointments Overlay - positioned relative to the grid */}
                <div className="absolute inset-0 pointer-events-none" style={{ top: '60px' }}>
                  {/* Single "current time" indicator — one line spanning all 7 day columns */}
                  {(() => {
                    const todayIdx = weekDates.findIndex(d => d.toDateString() === new Date().toDateString());
                    if (todayIdx === -1) return null;
                    return (
                      <div
                        className="absolute h-0.5 bg-red-500 z-30"
                        style={{ top: currentTimeIndicator.top, left: '12.5%', right: 0 }}
                      >
                        <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                        <div className="absolute -left-12 -top-2 text-[11px] font-semibold text-red-500">
                          {currentTimeIndicator.time}
                        </div>
                      </div>
                    );
                  })()}

                  {weekDates.map((date, dayIndex) => {
                    const dayAppointments = getAppointmentsForDate(date);
                    const dayLayout = computeDayLayout(dayAppointments);
                    // Grid has 8 equal columns: 1 time col + 7 day cols, so each day is 12.5% of the grid width.
                    // Inset a small margin inside the day column so cards don't touch the grid lines.
                    const DAY_WIDTH = 12.5;
                    const DAY_INSET = 0.5; // percent padding on each side
                    const usableDayWidth = DAY_WIDTH - 2 * DAY_INSET;

                    return dayAppointments.map((appointment) => {
                      const posStyle = getAppointmentStyle(appointment);
                      const { colIndex = 0, colCount = 1 } = dayLayout[appointment.id] || {};
                      const subWidth = usableDayWidth / colCount;
                      const leftPct = (dayIndex + 1) * DAY_WIDTH + DAY_INSET + colIndex * subWidth;

                      return (
                        <AppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                          variant="week"
                          style={{
                            left: `${leftPct}%`,
                            top: posStyle.top,
                            height: posStyle.height,
                            width: `${subWidth}%`,
                            minHeight: posStyle.minHeight,
                            zIndex: posStyle.zIndex,
                          }}
                          onClick={() => openAppointmentDetails(appointment)}
                        />
                      );
                    });
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>

      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setSelectedAppointment(null)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Appointment Details</h3>
              <button onClick={() => setSelectedAppointment(null)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-[#9B8CFF]/20 rounded-full flex items-center justify-center text-xl font-semibold text-[#2a276e] relative">
                  {selectedAppointment.patientAvatar}
                  {selectedAppointment.patientId && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center" title="Patient file exists">
                      <FileText className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {selectedAppointment.patientName}
                  </h4>
                  {selectedAppointment.patientId && (
                    <div className="text-xs text-green-600 font-medium mb-1">
                      ✓ Patient file exists
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selectedAppointment.patientPhone}
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {selectedAppointment.patientEmail}
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointment Details */}
              <div className="space-y-3 mb-6">
                <div>
                  <span className="text-sm font-medium text-gray-600">Doctor:</span>
                  <span className="ml-2 text-sm text-gray-900">{selectedAppointment.doctor}</span>
                </div>
                {selectedAppointment.chair_number && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Chair Number:</span>
                    <span className="ml-2 text-sm text-gray-900">{selectedAppointment.chair_number}</span>
                  </div>
                )}
                {selectedAppointment.patientAge && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Patient Age:</span>
                    <span className="ml-2 text-sm text-gray-900">{selectedAppointment.patientAge} years</span>
                  </div>
                )}
                {selectedAppointment.patientVillage && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Village:</span>
                    <span className="ml-2 text-sm text-gray-900">{selectedAppointment.patientVillage}</span>
                  </div>
                )}
                {selectedAppointment.visitNumber && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Visit Number:</span>
                    <span className="ml-2 inline-flex items-center justify-center px-3 py-1 rounded-lg bg-gradient-to-br from-[#2a276e] to-[#4c449c] text-white font-bold text-sm shadow-md">
                      Visit #{selectedAppointment.visitNumber}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <span className={`ml-2 text-sm font-semibold ${
                    selectedAppointment.status === 'accepted' ? 'text-[#2a276e]' :
                    selectedAppointment.status === 'rejected' ? 'text-red-600' :
                    selectedAppointment.status === 'checking' ? 'text-green-600' :
                    'text-yellow-600'
                  }`}>
                    {selectedAppointment.status === 'accepted' && '✓ Accepted'}
                    {selectedAppointment.status === 'rejected' && '✗ Rejected'}
                    {selectedAppointment.status === 'checking' && '📋 Checking'}
                    {selectedAppointment.status === 'confirmed' && '⏳ Pending Confirmation'}
                    {!['accepted', 'rejected', 'confirmed', 'checking'].includes(selectedAppointment.status) && selectedAppointment.status}
                  </span>
                </div>
              </div>

              {/* Status Message */}
              {selectedAppointment.status === 'accepted' && (
                <div className="mb-6 p-4 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                  <div className="flex items-center gap-2 text-[#2a276e]">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Appointment Accepted</span>
            </div>
                  <p className="text-sm text-[#2a276e] mt-1">Patient registration completed.</p>
                </div>
              )}

              {selectedAppointment.status === 'rejected' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Appointment Rejected</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">This appointment has been declined.</p>
                </div>
              )}

            </div>
            <div className="p-6 border-t border-gray-200 space-y-3">
              {/* Accept/Reject buttons - only show for confirmed/pending appointments */}
              {selectedAppointment.status === 'confirmed' && (
                <div className="flex gap-3 mb-3">
                  <button 
                    onClick={handleAcceptAppointment}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Accept Appointment</span>
                  </button>
                  <button 
                    onClick={handleRejectAppointment}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Reject</span>
                  </button>
                </div>
              )}
               {/* Patient File Actions - Show based on appointment status and patient_id */}
               <div className="mt-6">
                  {selectedAppointment.patientId ? (
                    // Has patient file - show View button
                    <div className="space-y-3">
                      <button 
                        onClick={() => {
                          navigate(`/patient-profile/${selectedAppointment.patientId}?tab=timeline`);
                          setSelectedAppointment(null);
                        }}
                        className="w-full bg-[#2a276e] text-white py-3 rounded-lg hover:bg-[#1a1548] transition-colors flex items-center justify-center gap-2 font-semibold shadow-lg"
                      >
                        <FileText className="w-4 h-4" />
                        <span>View Patient File</span>
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      
                      {/* NEW: Checked In Button - only show if status is accepted (not yet checking) */}
                      {selectedAppointment.status === 'accepted' && (
                        <button 
                          onClick={handleCheckIn}
                          className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow-lg"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Checked In</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    // No patient file - show "Checked In" button which will auto-create the file
                    // But ONLY if status is accepted
                    (selectedAppointment.status === 'accepted') && (
                      <button 
                        onClick={handleCheckIn}
                        className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow-lg"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Checked In (Auto-create File)</span>
                      </button>
                    )
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Registration Form Modal - Shown after accepting appointment */}
      {showPatientForm && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowPatientForm(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Complete Patient Registration</h3>
              <button onClick={() => setShowPatientForm(false)} className="hover:bg-gray-100 p-2 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="patient-registration-form" onSubmit={handlePatientRegistration} className="space-y-4">
                {/* Patient Name (pre-filled) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    value={patientFormData.name}
                    onChange={(e) => setPatientFormData({ ...patientFormData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent bg-gray-50"
                    readOnly
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age *
                  </label>
                  <input
                    type="number"
                    value={patientFormData.age}
                    onChange={(e) => setPatientFormData({ ...patientFormData, age: e.target.value })}
                    required
                    min="1"
                    max="150"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                    placeholder="Enter age"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender *
                  </label>
                  <select
                    value={patientFormData.gender}
                    onChange={(e) => setPatientFormData({ ...patientFormData, gender: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Village/City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Village/City *
                  </label>
                  <input
                    type="text"
                    value={patientFormData.village}
                    onChange={(e) => setPatientFormData({ ...patientFormData, village: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                    placeholder="Enter village or city"
                  />
                </div>

                {/* Phone (pre-filled) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={patientFormData.phone}
                    onChange={(e) => setPatientFormData({ ...patientFormData, phone: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                </div>

                {/* Referred By */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referred By
                  </label>
                  <input
                    type="text"
                    value={patientFormData.referred_by}
                    onChange={(e) => setPatientFormData({ ...patientFormData, referred_by: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                    placeholder="Enter referral source (optional)"
                  />
                </div>

                {/* Treatment Type (dropdown from clinic's treatment types) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Treatment Type *
                  </label>
                  <select
                    value={patientFormData.treatment_type}
                    onChange={(e) => setPatientFormData({ ...patientFormData, treatment_type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent bg-white"
                  >
                    <option value="">Select treatment type</option>
                    {treatmentTypes.map((type) => (
                      <option key={type.id} value={type.name}>
                        {type.name} - {getCurrencySymbol()}{type.price}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Type *
                  </label>
                  <select
                    value={patientFormData.payment_type}
                    onChange={(e) => setPatientFormData({ ...patientFormData, payment_type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={patientFormData.notes}
                    onChange={(e) => setPatientFormData({ ...patientFormData, notes: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                    placeholder="Additional notes (optional)"
                  />
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button 
                type="submit" 
                form="patient-registration-form"
                className="w-full bg-[#2a276e] text-white py-3 rounded-lg hover:bg-[#1a1548] transition-colors font-medium"
              >
                Complete Registration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Appointment Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowAddForm(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Add New Appointment</h3>
              <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <form id="add-appointment-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Patient Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Name *
                </label>
                <input
                  type="text"
                  name="patientName"
                  value={newAppointment.patientName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Enter patient name"
                />
              </div>

              {/* Patient Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Email *
                </label>
                <input
                  type="email"
                  name="patientEmail"
                  value={newAppointment.patientEmail}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Enter patient email"
                />
              </div>

              {/* Patient Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Phone *
                </label>
                <input
                  type="tel"
                  name="patientPhone"
                  value={newAppointment.patientPhone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Enter patient phone"
                />
              </div>

              {/* Patient Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Age
                </label>
                <input
                  type="number"
                  name="patientAge"
                  value={newAppointment.patientAge}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Enter patient age"
                />
              </div>



              {/* Doctor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Doctor <span className="text-gray-500 text-xs">(optional — leave unassigned for public-style bookings)</span>
                </label>
                <select
                  name="doctor_id"
                  value={newAppointment.doctor_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent bg-white"
                >
                  <option value="">Unassigned — assign at check-in</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.email || `Doctor #${d.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  value={newAppointment.date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time <span className="text-gray-500 text-xs">(optional - auto-assigns next available)</span>
                </label>
                <input
                  type="time"
                  name="time"
                  value={newAppointment.time}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                  placeholder="Leave empty to auto-assign"
                />
              </div>



              {/* Next Slot Info */}
              {newAppointment.date && (() => {
                const dateObj = new Date(newAppointment.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                const dayTimings = clinicTimings[dayName];
                const nextSlot = findNextAvailableSlot(newAppointment.date, parseFloat(newAppointment.duration));

                return (
                  <div className="mt-2 space-y-2">
                    {/* Operating Hours Info */}
                    <div className="p-2 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                      <p className="text-xs text-[#2a276e] flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <span>
                          {dayTimings && !dayTimings.closed ? (
                            `Operating hours: ${dayTimings.open} - ${dayTimings.close}`
                          ) : (
                            `Clinic closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`
                          )}
                        </span>
                      </p>
                    </div>

                    {/* Next Available Slot */}
                    <div className="p-2 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                      <p className="text-xs text-blue-700 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 000 16zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span>
                          Next available slot: <strong>{nextSlot || 'No slots available'}</strong>
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })()}

              <p className="text-xs text-gray-500 mt-1">
                💡 Leave empty to automatically assign the next available time slot
              </p>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Duration *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: '0.5', label: '30 min' },
                    { value: '1', label: '1 hour' },
                    { value: '1.5', label: '1.5 hours' },
                    { value: '2', label: '2 hours' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setNewAppointment(prev => ({ ...prev, duration: option.value }))}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        newAppointment.duration === option.value
                          ? 'bg-[#2a276e] text-white border-[#2a276e]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-appointment-form"
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium"
                >
                  Add Appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject appointment dialog — replaces native confirm + prompt */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => !rejectSubmitting && setRejectDialogOpen(false)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 pt-7 pb-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Reject this appointment?</h3>
              <p className="text-sm text-gray-500 mt-1">
                The patient will be notified by email. You can include an optional reason below.
              </p>
            </div>

            <div className="px-6 pb-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason (optional) — e.g. doctor unavailable, fully booked"
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2a276e] focus:border-transparent resize-none"
              />
            </div>

            <div className="px-6 py-5 mt-2 space-y-2">
              <button
                onClick={submitRejection}
                disabled={rejectSubmitting}
                className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {rejectSubmitting ? 'Rejecting…' : 'Reject appointment'}
              </button>
              <button
                onClick={() => setRejectDialogOpen(false)}
                disabled={rejectSubmitting}
                className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Patient Warning Modal — registration flow, same clean style */}
      {showDuplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowDuplicateWarning(false)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 pt-7 pb-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-[#9B8CFF]/15 flex items-center justify-center mb-4">
                <User className="w-7 h-7 text-[#2a276e]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Existing patient found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {duplicatePatients.length} record{duplicatePatients.length === 1 ? '' : 's'} matched these details. Link to an existing one or create a new file.
              </p>
            </div>

            <div className="px-6 pb-2 max-h-[50vh] overflow-y-auto space-y-2">
              {duplicatePatients.map((patient) => (
                <div key={patient.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{patient.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {patient.phone && <span>{patient.phone}</span>}
                        {patient.email && <span> · {patient.email}</span>}
                        {patient.age && <span> · Age {patient.age}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`/patient-profile/${patient.id}`, '_blank')}
                      className="text-xs font-semibold text-[#2a276e] hover:underline shrink-0"
                    >
                      View
                    </button>
                  </div>
                  <button
                    onClick={() => handleLinkToExistingPatient(patient.id)}
                    className="mt-3 w-full py-2 bg-white border border-[#2a276e]/20 text-[#2a276e] rounded-lg text-sm font-semibold hover:bg-[#9B8CFF]/10 transition-colors"
                  >
                    Link to this patient
                  </button>
                </div>
              ))}
            </div>

            <div className="px-6 py-5 mt-2 space-y-2">
              <button
                onClick={handleCreateNewPatientWithSuffix}
                className="w-full py-3 bg-[#2a276e] text-white rounded-xl font-semibold hover:bg-[#1a1548] transition-colors"
              >
                Create new patient file
              </button>
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Check-in Details Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => setShowCheckInModal(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-[#2a276e] text-white">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle className="w-6 h-6" />
                Patient Check-in
              </h3>
              <button 
                onClick={() => setShowCheckInModal(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                id="close-checkin-modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Patient Basic Info (Editable for Check-in) */}
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-[#2a276e]" />
                  <span className="text-xs font-bold text-[#2a276e] uppercase tracking-wider">Draft Patient File</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Full Name</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-[#2a276e] outline-none text-sm font-semibold"
                      value={checkingInAppointment?.patientName}
                      onChange={(e) => setCheckingInAppointment({...checkingInAppointment, patientName: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Phone Number</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-[#2a276e] outline-none text-sm font-semibold"
                        value={checkingInAppointment?.patientPhone}
                        onChange={(e) => setCheckingInAppointment({...checkingInAppointment, patientPhone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Email (Optional)</label>
                      <input 
                        type="email"
                        className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-[#2a276e] outline-none text-sm font-semibold"
                        value={checkingInAppointment?.patientEmail}
                        onChange={(e) => setCheckingInAppointment({...checkingInAppointment, patientEmail: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Indicator for ALREADY Linked Patients */}
              {checkingInAppointment?.patientId && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">Linked to existing file</div>
                    <div className="text-xs text-green-600 font-medium tracking-wide uppercase">
                      Patient ID: {checkingInAppointment.patientId}
                    </div>
                  </div>
                </div>
              )}

              <hr className="border-gray-100" />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Assign Doctor</label>
                <select 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none transition-all"
                  value={checkInFormData.doctor_id}
                  onChange={(e) => setCheckInFormData({...checkInFormData, doctor_id: e.target.value})}
                  id="checkin-doctor"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Chair Number</label>
                  <select 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none transition-all"
                    value={checkInFormData.chair_number}
                    onChange={(e) => setCheckInFormData({...checkInFormData, chair_number: e.target.value})}
                    id="checkin-chair"
                  >
                    <option value="">Select Chair</option>
                    {[...Array(clinicData?.number_of_chairs || 1)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        Chair {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Patient Age</label>
                  <input 
                    type="number"
                    placeholder="Years"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none transition-all"
                    value={checkInFormData.patient_age}
                    onChange={(e) => setCheckInFormData({...checkInFormData, patient_age: e.target.value})}
                    id="checkin-age"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
                  <select 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none transition-all"
                    value={checkInFormData.patient_gender}
                    onChange={(e) => setCheckInFormData({...checkInFormData, patient_gender: e.target.value})}
                    id="checkin-gender"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Village/Area</label>
                  <input 
                    type="text"
                    placeholder="Village name"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none transition-all"
                    value={checkInFormData.patient_village}
                    onChange={(e) => setCheckInFormData({...checkInFormData, patient_village: e.target.value})}
                    id="checkin-village"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Referred By</label>
                <input 
                  type="text"
                  placeholder="e.g. Dr. Sharma, Direct, Social Media"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none transition-all"
                  value={checkInFormData.patient_referred_by}
                  onChange={(e) => setCheckInFormData({...checkInFormData, patient_referred_by: e.target.value})}
                  id="checkin-referred"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Clinical Notes / Patient Concern</label>
                <textarea 
                  rows="2"
                  placeholder="Enter any specific notes or complaints..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2a276e] focus:border-transparent outline-none transition-all resize-none"
                  value={checkInFormData.notes}
                  onChange={(e) => setCheckInFormData({...checkInFormData, notes: e.target.value})}
                  id="checkin-notes"
                ></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowCheckInModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-100 transition-all font-inter"
                id="checkin-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCheckIn}
                className="flex-[2] px-4 py-3 bg-[#2a276e] text-white rounded-xl font-bold hover:bg-[#1a1548] shadow-lg shadow-[#2a276e]/20 transition-all flex items-center justify-center gap-2 font-inter"
                id="confirm-checkin-btn"
              >
                <CheckCircle className="w-5 h-5" />
                Finish Check-in
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Duplicate Patient Modal — clean, minimal, matching booking-confirm aesthetic */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowDuplicateModal(false)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 pt-7 pb-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-[#9B8CFF]/15 flex items-center justify-center mb-4">
                <User className="w-7 h-7 text-[#2a276e]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Existing patient found</h3>
              <p className="text-sm text-gray-500 mt-1">
                We found {duplicateMatches.length} record{duplicateMatches.length === 1 ? '' : 's'} that may be the same patient. Use an existing record or create a new one.
              </p>
            </div>

            <div className="px-6 pb-2 max-h-[50vh] overflow-y-auto space-y-2">
              {duplicateMatches.map(patient => (
                <button
                  key={patient.id}
                  onClick={() => handleFinalizeCheckIn(patient.id)}
                  className="w-full text-left bg-gray-50 hover:bg-[#9B8CFF]/10 border border-gray-200 hover:border-[#2a276e]/30 rounded-xl px-4 py-3 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{patient.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {patient.phone}
                      {patient.village && <span> · {patient.village}</span>}
                      <span> · ID #{patient.id}</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#2a276e] shrink-0">Use this →</span>
                </button>
              ))}
            </div>

            <div className="px-6 py-5 mt-2 space-y-2">
              <button
                onClick={() => handleFinalizeCheckIn(null)}
                className="w-full py-3 bg-[#2a276e] text-white rounded-xl font-semibold hover:bg-[#1a1548] transition-colors"
              >
                Create new patient instead
              </button>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;