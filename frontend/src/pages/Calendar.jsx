import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { SkeletonBox } from "../components/Skeleton";
import { api } from "../utils/api";
import { notify } from "../utils/notify";
import { AlertCircle, ChevronLeft } from "lucide-react";
import CalendarToolbar from "./appointments/components/CalendarToolbar";
import TeamMembersPanel from "./appointments/components/TeamMembersPanel";
import MiniCalendar from "./appointments/components/MiniCalendar";
import MonthGrid from "./appointments/components/MonthGrid";
import DayGrid from "./appointments/components/DayGrid";
import { registerDoctors } from "./appointments/utils/doctorColors";
import { useHeader } from "../contexts/HeaderContext";
import BookingModal from "./appointments/components/BookingModal";
import PatientRegistrationModal from "./appointments/components/PatientRegistrationModal";
import DuplicatePatientWarning from "./appointments/components/DuplicatePatientWarning";
import AppointmentPopover from "./appointments/components/AppointmentPopover";
import CalendarBanners from "./appointments/components/CalendarBanners";
import CancelReasonDialog from "./appointments/components/CancelReasonDialog";
import DayAgenda from "./appointments/components/DayAgenda";
import WeekDayStrip from "./appointments/components/WeekDayStrip";
import TodayRail from "./appointments/components/TodayRail";
import useCalendarNavigation, { formatWeekRange, getRelativeDateLabel, dateKey } from "./appointments/hooks/useCalendarNavigation";
import useClinicSchedule from "./appointments/hooks/useClinicSchedule";
import useAppointments from "./appointments/hooks/useAppointments.jsx";
import { toCalendarShape } from "./appointments/utils/appointmentShape";
import { track, EVENTS } from '../analytics/track';

const Calendar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentDate, setCurrentDate,
    viewMode, setViewMode,
    weekDates, goToPrevious, goToNext, goToToday,
  } = useCalendarNavigation('week');
  const {
    clinicData, clinicTimings, treatmentTypes, doctors, doctorsError, dayShape,
    selectedDoctorIds, setSelectedDoctorIds,
  } = useClinicSchedule(currentDate);
  // Declared before useAppointments, which takes both setters: a dependency
  // passed into a hook call is evaluated during render, so a `const` declared
  // further down would still be in its temporal dead zone and throw.
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  // Which card the panel is pointing at. Null for a deep link, which has no
  // card on screen to anchor to.
  const [anchorId, setAnchorId] = useState(null);
  const [cancelPrompt, setCancelPrompt] = useState(null);
  const {
    appointments, setAppointments, loading,
    needsOutcome, loadNeedsOutcome, outcomeBusy,
    fetchAppointments, handleReassign, handleResize, applyOutcome, checkIn, setOpenStatus,
  } = useAppointments(currentDate, doctors, { setSelectedAppointment, setCancelPrompt });
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicatePatients, setDuplicatePatients] = useState([]);
  // Mobile only: show the mini-calendar + team filters rail (hidden by default so
  // the schedule grid gets the full width). Ignored on desktop (md+).
  const [showFilters, setShowFilters] = useState(false);
  // The day list beside the grid, and the grid's own density. Both persist:
  // they are a working preference, not a per-visit decision.
  const [showDayRail, setShowDayRail] = useState(
    () => localStorage.getItem('mp_calendar_day_rail') !== '0'
  );
  // The mini-calendar and team filters. Same treatment as the day list: a rail
  // you can fold away when the grid needs the width.
  // Which list the right rail is showing: the day, or the past appointments
  // nobody closed off.
  const [railTab, setRailTab] = useState('day');
  const [showSidePanel, setShowSidePanel] = useState(
    () => localStorage.getItem('mp_calendar_side_panel') !== '0'
  );
  // Filters the loaded list by name or phone, so finding someone on the day
  // does not mean leaving for global search.
  const [query, setQuery] = useState('');
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

  // ── The rebuild ───────────────────────────────────────────────────────────
  // Seed for the booking modal opened from a click on the grid. Null means the
  // modal is closed; the object carries the slot that was clicked.
  const [bookingSeed, setBookingSeed] = useState(null);
  // Columns by person or by room, day view only.
  const [axis, setAxis] = useState("doctor");
  // Doctor as a layout axis in week and month, where there are no columns.
  // Persisted so switching view keeps answering the same question.
  const [focusDoctorId, setFocusDoctorId] = useState(
    () => localStorage.getItem("mp_calendar_focus_doctor") || ""
  );
  // Below this the grid stops being readable, so the phone gets a list instead
  // of a squeezed grid. Matched in JS because it swaps the component, not just
  // the styling: a CSS-hidden grid would still mount and measure.
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = (e) => setIsPhone(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // A patient booked from the calendar starts as name + phone only. The desk is
  // the one moment someone is standing there to be asked the rest, so the panel
  // asks then rather than leaving a half-filled file nobody goes back to.
  const [details, setDetails] = useState(null);
  const [detailsSaving, setDetailsSaving] = useState(false);

  /**
   * Fold the nav away while an appointment is open.
   *
   * The grid gets 256px of width back at the moment the popover needs somewhere
   * to sit, so a card near the right edge has room beside it instead of being
   * flipped to the left. Restored only if this screen was what collapsed it: a
   * user who already works with a collapsed sidebar should not find it expanded
   * afterwards.
   *
   * The columns widen over the sidebar's 300ms transition, which moves the card
   * the popover points at. useAnchoredPosition watches the anchor with a
   * ResizeObserver for exactly this reason.
   */
  const { sidebarCollapsed, setSidebarCollapsed } = useHeader();
  const collapsedForPanel = useRef(false);
  const panelWasOpen = useRef(false);
  useEffect(() => {
    const open = !!selectedAppointment;
    // Keyed on the open/close transition, not on the current state. Reacting to
    // `sidebarCollapsed` as well would re-collapse the nav the instant a user
    // expanded it by hand while the drawer was still up, which is a fight the
    // user should win.
    if (open && !panelWasOpen.current) {
      if (!sidebarCollapsed) {
        collapsedForPanel.current = true;
        setSidebarCollapsed(true);
      }
    } else if (!open && panelWasOpen.current && collapsedForPanel.current) {
      collapsedForPanel.current = false;
      setSidebarCollapsed(false);
    }
    panelWasOpen.current = open;
    // sidebarCollapsed is read, never depended on, for the reason above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppointment, setSidebarCollapsed]);
  // Reject confirmation dialog state — replaces the native confirm() + prompt() flow.
  // Phase 1 filter state: which doctors are visible, and whether to show unassigned (public) bookings
  const [showUnassigned, setShowUnassigned] = useState(true);

  useEffect(() => {
    localStorage.setItem('mp_calendar_day_rail', showDayRail ? '1' : '0');
  }, [showDayRail]);
  useEffect(() => {
    localStorage.setItem('mp_calendar_side_panel', showSidePanel ? '1' : '0');
  }, [showSidePanel]);


  /**
   * A starting point for "New" when the click carried no slot with it.
   *
   * The toolbar button and the ?new=1 deep link used to open a second, older
   * booking form. That one asked for an email, had no treatment field, checked
   * nothing against the server and created no patient file, which is the exact
   * gap BookingModal was written to close. Both entry points now open the same
   * modal, so there is one set of booking rules instead of two.
   *
   * The time here is only a starting point; everything stays editable inside.
   * Built from local date parts rather than toISOString, which would resolve
   * the day in UTC and hand back yesterday for late-evening bookings.
   *
   * Declared above the deep-link effect on purpose: the effect lists it as a
   * dependency, and a dependency array is evaluated during render, so a `const`
   * defined further down would still be in its temporal dead zone and throw.
   */
  const seedForNewBooking = useCallback(() => {
    const now = new Date();
    const viewingToday = currentDate.toDateString() === now.toDateString();
    // Next half hour when the user is looking at today, otherwise mid-morning.
    // Clamped to the end of the day: rounding up from 23:45 lands on 1440,
    // which wrapped to "00:00" and seeded a time twenty-three hours in the past
    // on the same date.
    const startMinutes = viewingToday
      ? Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30, 23 * 60 + 30)
      : 10 * 60;
    const pad = (n) => String(n).padStart(2, '0');
    return {
      date: `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(currentDate.getDate())}`,
      startTime: `${pad(Math.floor(startMinutes / 60) % 24)}:${pad(startMinutes % 60)}`,
      duration: 30,
      doctorId: focusDoctorId || null,
      chairNumber: null,
      available: true,
    };
  }, [currentDate, focusDoctorId]);

  // Deep link: /calendar?new=1 opens the booking form — the entry point the
  // "Add appointment" shortcut uses. The param is stripped straight away so a
  // refresh or back-navigation doesn't reopen the form, which also means a
  // re-run from a changed seed is a no-op rather than a second modal.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') !== '1') return;
    setBookingSeed(seedForNewBooking());
    params.delete('new');
    navigate({ search: params.toString() }, { replace: true });
  }, [location.search, navigate, seedForNewBooking]);

  // Deep link: /calendar?appointment=<id> jumps to that appointment's day and
  // opens it. The dashboard's Today list uses this, so a row there is a way in
  // rather than a label. Waits for the list, since the id means nothing until
  // the appointments have loaded.
  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get('appointment');
    if (!wanted || !appointments.length) return;
    const appt = appointments.find((a) => String(a.id) === String(wanted));
    if (!appt) return;
    if (appt.date) {
      setCurrentDate(new Date(appt.date));
      setViewMode('today');
    }
    openAppointmentDetails(appt);
    const params = new URLSearchParams(location.search);
    params.delete('appointment');
    navigate({ search: params.toString() }, { replace: true });
    // The two setters come from useCalendarNavigation and are stable useState
    // setters, so listing them changes nothing at runtime; listed anyway so the
    // dependency array stays honest.
  }, [location.search, appointments, navigate, setCurrentDate, setViewMode]);

  // The effect that used to sit here defaulted every doctor to selected once
  // they loaded. useClinicSchedule does that inside fetchDoctors now, at the
  // one moment it can know the answer, so this was doing the work twice.

  const toggleDoctorFilter = (doctorId) => {
    setSelectedDoctorIds(prev => {
      const next = new Set(prev);
      if (next.has(doctorId)) next.delete(doctorId); else next.add(doctorId);
      return next;
    });
  };

  // Drag-and-drop reassign — used by the Today/Day grid. Updates doctor and/or
  // start time. Optimistic local update + PUT, with revert on failure.

  // Shared click handler — fetches fresh appointment data then opens the detail drawer.
  /**
   * Open the panel on an appointment, beside the card that was clicked.
   *
   * Shows the card's own data first and merges the fetched record when it
   * lands. It used to await the request before rendering anything, which for a
   * panel meant to feel attached to the click is the whole difference: the card
   * already carries everything above the fold.
   */
  const openAppointmentDetails = async (apt, clickedAnchorId = null) => {
    setAnchorId(clickedAnchorId);
    setSelectedAppointment(apt);
    try {
      const full = toCalendarShape(await api.get(`/appointments/${apt.id}`));
      // Guard against a slower response for an appointment the user has since
      // moved away from.
      setSelectedAppointment((prev) => (prev && prev.id === full.id ? full : prev));
    } catch (error) {
      // Keep what the card gave us rather than blanking the panel.
      console.error('Error fetching appointment details:', error);
    }
  };

  // Deep link from global search: /calendar?appointment=<id> opens that
  // appointment's drawer. openAppointmentDetails fetches by id, so the record
  // opens even when it falls outside the date currently on screen.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('appointment');
    if (!id) return;
    openAppointmentDetails({ id: Number(id) });
    params.delete('appointment');
    navigate({ search: params.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

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
  }, [fetchAppointments]);

  // Filtered appointments based on team-member panel selection.
  const q = query.trim().toLowerCase();
  const visibleAppointments = useMemo(() => {
    const focus = focusDoctorId ? Number(focusDoctorId) : null;
    return appointments.filter(a => {
      // Focusing one doctor is a stronger statement than the team checkboxes,
      // so it wins outright rather than intersecting with them.
      if (focus) { if (a.doctor_id !== focus) return false; }
      else if (a.doctor_id) { if (!selectedDoctorIds.has(a.doctor_id)) return false; }
      else if (!showUnassigned) return false;
      // Name or phone, over the list already loaded. Finding someone on the
      // day should not mean leaving the calendar for global search.
      if (!q) return true;
      return `${a.patientName || ''} ${a.patientPhone || ''}`.toLowerCase().includes(q);
    });
  }, [appointments, selectedDoctorIds, showUnassigned, focusDoctorId, q]);

  // Colour assignment is by position in this clinic's doctor list, so the list
  // has to be registered before anything renders a card.
  useEffect(() => { registerDoctors(doctors); }, [doctors]);

  const focusDoctor = useMemo(
    () => (focusDoctorId ? doctors.find(d => d.id === Number(focusDoctorId)) || null : null),
    [focusDoctorId, doctors]
  );

  // ── Appointments left open in the past ────────────────────────────────────

  useEffect(() => { loadNeedsOutcome(); }, [loadNeedsOutcome]);

  // Escape closes whatever is on top, innermost first. Every other drawer in
  // the app already did this; the appointment panel did not, which left the
  // keyboard with no way out of it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (cancelPrompt) { setCancelPrompt(null); return; }
      if (bookingSeed) { setBookingSeed(null); return; }
      if (selectedAppointment) setSelectedAppointment(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cancelPrompt, bookingSeed, selectedAppointment]);

  useEffect(() => {
    if (focusDoctorId) localStorage.setItem('mp_calendar_focus_doctor', focusDoctorId);
    else localStorage.removeItem('mp_calendar_focus_doctor');
  }, [focusDoctorId]);

  // A focus doctor that is not in this clinic's list empties the whole calendar
  // while the dropdown still reads "All doctors", because a <select> with no
  // matching <option> shows blank. The filter was on, invisibly, and every view
  // looked broken. Clear it once the real list is known.
  useEffect(() => {
    if (!focusDoctorId || !doctors.length) return;
    if (!doctors.some((d) => String(d.id) === String(focusDoctorId))) {
      setFocusDoctorId('');
    }
  }, [doctors, focusDoctorId]);

  // ── Resize: the card's bottom edge was dragged ────────────────────────────

  // ── A click or drag on empty grid ─────────────────────────────────────────
  const handleCreateFromGrid = (seed) => {
    if (seed.available === false) {
      notify.reverted('That doctor is not working then. Pick another time, or set their hours in Staff.');
      return;
    }
    setBookingSeed(seed);
  };

  const handleBookingSaved = async (result) => {
    // Follow the appointment if it moved off the days on screen.
    //
    // The fetch window is the visible month padded by a week, so an
    // appointment rescheduled into another month would simply stop being
    // drawn. Nothing had gone wrong, but it reads exactly like a delete, so
    // the calendar goes to where the appointment now is.
    const savedDate = result?.appointment?.appointment_date;
    if (savedDate) {
      const target = new Date(`${savedDate}T00:00:00`);
      if (!Number.isNaN(target.getTime()) && dateKey(target) !== dateKey(currentDate)) {
        setCurrentDate(target);
      }
    }
    await fetchAppointments();
    if (result?.kind === 'series') {
      const made = result.created?.length || 0;
      const missed = result.skipped || [];
      notify.done(`${made} visit${made === 1 ? '' : 's'} booked`);
      if (missed.length) {
        notify.problem(
          `${missed.length} skipped: ${missed.map(m => `${m.date} (${m.reason})`).join('; ')}`
        );
      }
    } else {
      // The booking itself lands on the calendar behind this. Only the extra
      // consequence — a new patient file — is worth saying, because that
      // happened somewhere the user is not looking.
      if (result?.createdPatient) notify.done('Booked, and a patient file was created');
    }
  };

  // ── Outcomes ──────────────────────────────────────────────────────────────

  /**
   * They walked in. Record it, in one tap.
   *
   * Check-in used to sit behind a modal that asked for age, gender and village
   * first, and that modal was gated on `status === 'accepted'` — a value the
   * status migration removed. So it never opened, and there was no working way
   * to mark anyone `arrived` short of "Start visit", which also creates a case
   * paper nobody asked for.
   *
   * Arrival is a fact, not a form. Record it immediately; the "ask them for
   * their details" block further up the drawer already collects the rest, at a
   * moment when the desk is not holding a queue.
   *
   * Goes through the general PUT because /outcome only accepts terminal states.
   */

  // Which of the useful-at-the-desk fields are still blank.
  const missingDetails = useCallback(async (patientId) => {
    if (!patientId) return null;
    try {
      const p = await api.get(`/patients/${patientId}`);
      const gaps = [];
      if (!p.age && !p.date_of_birth) gaps.push('age');
      if (!p.gender) gaps.push('gender');
      if (!p.village) gaps.push('city');
      return gaps.length ? { patient: p, gaps } : null;
    } catch {
      return null;
    }
  }, []);

  const saveDetails = async () => {
    if (!details) return;
    setDetailsSaving(true);
    try {
      await api.put(`/patients/${details.patient.id}`, {
        age: details.age ? Number(details.age) : undefined,
        gender: details.gender || undefined,
        village: details.village || undefined,
      });
      setDetails(null);
    } catch (e) {
      notify.problem(e, 'Could not save those details');
    } finally {
      setDetailsSaving(false);
    }
  };

  // ── Booking becomes a visit ───────────────────────────────────────────────
  // Look for gaps as soon as the panel opens, so the prompt is already there
  // when reception has the patient in front of them.
  useEffect(() => {
    if (!selectedAppointment?.patientId) { setDetails(null); return; }
    let cancelled = false;
    missingDetails(selectedAppointment.patientId).then((found) => {
      if (!cancelled) {
        setDetails(found ? { ...found, age: '', gender: '', village: '' } : null);
      }
    });
    return () => { cancelled = true; };
  }, [selectedAppointment?.patientId, missingDetails]);

  const handleStartVisit = async (appointment) => {
    try {
      const res = await api.post(`/appointments/${appointment.id}/start-visit`);
      setSelectedAppointment(null);
      navigate(`/patient-profile/${res.patient_id}?tab=case-papers&casePaper=${res.case_paper_id}`);
      if (!res.created) notify.done('That visit was already started, so this opens it');
    } catch (err) {
      notify.problem(err, 'Could not start the visit');
    }
  };

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


  // Format the current week as a human-friendly range, handling cross-month
  // and cross-year cases ("Apr 28 – May 4, 2026" / "Dec 29, 2025 – Jan 4, 2026").
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

  // Fetch clinic data
  // The second fetch that used to sit here was removed. openAppointmentDetails
  // already loads the full record, and this rebuilt it from a shorter field
  // list, so the drawer lost age, gender, city, chair and visit number moments
  // after showing them.


  // Check if time slot overlaps with existing appointments for the SAME doctor.
  // Two appointments with different assigned doctors don't conflict. An unassigned
  // booking only conflicts with other unassigned bookings — the receptionist will
  // assign a doctor on check-in, at which point the chair/doctor check kicks in.


  /**
   * The drawer's primary action when a booking has no patient file yet.
   *
   * This used to POST to /patients/check-duplicates, which is registered
   * GET-only, so every click 405'd into the catch and told the user the check
   * had failed. The file was never created, and because the button is the only
   * one shown for a booking without a file, there was no other way through.
   *
   * The second half was wrong too: it acted only `if (duplicates.length > 0)`.
   * Even had the call succeeded, the ordinary case — a genuinely new patient,
   * no duplicates — did nothing at all and gave no feedback. A duplicate check
   * is a step on the way to creating the file, not the purpose of the button.
   */
  const handleCreatePatientFile = async () => {
    try {
      const duplicateCheck = await api.get('/patients/check-duplicates', {
        params: {
          name: selectedAppointment.patientName || undefined,
          phone: selectedAppointment.patientPhone || undefined,
          email: selectedAppointment.patientEmail || undefined
        }
      });

      if (duplicateCheck && duplicateCheck.length > 0) {
        // Someone with this name or number is already on file. Let the user
        // decide whether it is the same person before a second record exists.
        setDuplicatePatients(duplicateCheck);
        setShowDuplicateWarning(true);
        return;
      }

      // Nobody matches, so this is a new patient. Carry over what the booking
      // already knows and ask for the rest while they are at the desk.
      setPatientFormData({
        name: selectedAppointment.patientName || '',
        age: selectedAppointment.patientAge || '',
        gender: selectedAppointment.patientGender || '',
        village: selectedAppointment.patientVillage || '',
        phone: selectedAppointment.patientPhone || '',
        referred_by: 'Walk-in',
        treatment_type: '',
        notes: selectedAppointment.notes || '',
        payment_type: 'Cash'
      });
      setShowPatientForm(true);
    } catch (error) {
      notify.problem(error, 'Could not check for an existing patient file');
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
      track(EVENTS.PATIENT_CREATED, { source: 'calendar' });

      console.log('✅ Patient created:', patientResponse);
      
      // Link patient to appointment
      await api.put(`/appointments/${selectedAppointment.id}`, {
        patient_id: patientResponse.id
      });
      
      // Update selected appointment with patient_id and refresh appointments list.
      // The status is deliberately left alone: the PUT above only sends
      // patient_id, so claiming a status change here would put the card out of
      // step with the server. It also used to claim 'accepted', a value the
      // status migration removed, which made the card lose its badge entirely.
      const updatedAppointment = {
        ...selectedAppointment,
        patientId: patientResponse.id
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
      notify.problem(`Failed to register patient: ${errorMessage}`);
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
      notify.problem('Failed to create new patient. Please try again.');
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
    } catch (error) {
      console.error('Error linking to existing patient:', error);
      notify.problem('Failed to link appointment. Please try again.');
    }
  };

  // Public booking URL keyed by the clinic's unguessable code (not its numeric
  // id, which could be enumerated). Returns null until the code is loaded, which
  // hides the Booking Link button rather than linking to a broken page.
  const getBookingUrl = () => {
    const code = clinicData?.clinic_code;
    return code ? `/booking?clinic=${code}` : null;
  };


  return (
    <div className="flex flex-col h-screen p-6 bg-gray-50 overflow-hidden">
        {/* Top toolbar — Today / arrows / date / view toggle / booking link / New */}
        <CalendarToolbar
          doctorsError={doctorsError}
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
          onOpenCreate={() => setBookingSeed(seedForNewBooking())}
          publicBookingUrl={getBookingUrl()}
          doctors={doctors}
          focusDoctorId={focusDoctorId}
          onSetFocusDoctor={setFocusDoctorId}
          axis={axis}
          onSetAxis={setAxis}
          chairCount={dayShape?.chairs || 1}
          showDayRail={showDayRail}
          onShowDayRail={() => setShowDayRail(true)}
          showSidePanel={showSidePanel}
          onShowSidePanel={() => setShowSidePanel(true)}
          attentionCount={needsOutcome.count}
          onShowAttention={() => { setShowDayRail(true); setRailTab('open'); }}
          query={query}
          onQueryChange={setQuery}
        />

      <CalendarBanners
        totalCount={appointments.length}
        visibleCount={visibleAppointments.length}
        onShowEveryone={() => {
          setFocusDoctorId('');
          setSelectedDoctorIds(new Set(doctors.map((d) => d.id)));
          setShowUnassigned(true);
        }}
      />


        {/* Mobile-only toggle: filters/mini-calendar vs the schedule grid */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className="lg:hidden w-full flex items-center justify-between mb-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700"
        >
          {showFilters ? '← Back to calendar' : 'Mini-calendar & team filters'}
          <svg className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Two-column layout: team members rail + calendar content */}
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          <div className={`${showFilters ? '' : 'hidden'} ${showSidePanel ? 'lg:block' : 'lg:hidden'} w-full lg:w-auto lg:shrink-0 relative`}>
          {/* Fold it away from its own edge, the way the day list closes from
              its own. A control that lives on the thing it hides is easier to
              find again than one parked in the toolbar. */}
          <button
            onClick={() => setShowSidePanel(false)}
            className="hidden lg:flex absolute -right-2 top-2 z-10 w-5 h-5 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
            aria-label="Hide the mini-calendar and team filters"
          >
            <ChevronLeft size={12} />
          </button>
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
                countsByDate={visibleCountsByDate}
                onSelectDate={(d) => {
                  setCurrentDate(d);
                  // Clicking a specific date from the mini calendar is best paired
                  // with the single-day view; keep week view if currently there.
                  if (viewMode === 'month') setViewMode('week');
                }}
              />
            }
          />
          </div>

          <div className={`${showFilters ? 'hidden' : ''} md:block flex-1 min-w-0 overflow-y-auto`}>
        {/* Calendar Content */}
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <SkeletonBox className="h-3 w-12 mt-2" />
                <SkeletonBox className="h-16 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        ) : viewMode === 'month' ? (
          /* Month View — full month grid with doctor-colored chips */
          <MonthGrid
            currentDate={currentDate}
            appointments={visibleAppointments}
            onSelectDate={(d) => { setCurrentDate(d); setViewMode('today'); }}
            onSelectAppointment={openAppointmentDetails}
            focusDoctor={focusDoctor}
          />
        ) : viewMode === 'today' ? (
          /* One column per doctor from sm up. On a phone that maths gives each
             doctor under 30px, so the same appointments are shown as a list. */
          <div>
            {isPhone ? (
              <DayAgenda
                date={currentDate}
                appointments={visibleAppointments}
                onAppointmentClick={openAppointmentDetails}
                onCreate={handleCreateFromGrid}
              />
            ) : (
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
              onResize={handleResize}
              onCreate={handleCreateFromGrid}
              dayShape={dayShape}
              axis={axis}
              chairCount={dayShape?.chairs || 1}
            />
            )}
          </div>
        ) : isPhone ? (
          /* The week on a phone. Seven columns in 350px is 50px each, which
             cannot hold a name, so the week stays visible as a strip of days
             and one of them is shown properly underneath. */
          <div>
            <WeekDayStrip
              dates={weekDates}
              selected={currentDate}
              countsByDate={visibleCountsByDate}
              onSelect={setCurrentDate}
            />
            <div className="mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
              {currentDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <DayAgenda
              date={currentDate}
              appointments={visibleAppointments}
              onAppointmentClick={openAppointmentDetails}
              onCreate={handleCreateFromGrid}
            />
          </div>
        ) : (
          /* The week, on the same grid as the day.
             It used to be a separate inline grid where cards could only be
             clicked: no hover, no drag, no resize, no click-to-book. Rather
             than build all of that a second time, DayGrid now accepts days as
             its column axis, so the week inherits every interaction and there
             is one grid to keep working instead of two. Dragging sideways here
             moves an appointment to another day. */
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
            onResize={handleResize}
            onCreate={handleCreateFromGrid}
            dayShape={dayShape}
            axis="day"
            days={weekDates}
          />
        )}
          </div>

          {/* The day as a worklist. Hidden on phones, where the grid already
              becomes a list and a second one would just repeat it. */}
          {showDayRail && !isPhone && (
            <TodayRail
              appointments={visibleAppointments}
              dayKey={dateKey(currentDate)}
              isToday={currentDate.toDateString() === new Date().toDateString()}
              onSelect={openAppointmentDetails}
              onRefresh={fetchAppointments}
              onCollapse={() => setShowDayRail(false)}
              loading={loading}
              needsOutcome={needsOutcome}
              tab={railTab}
              onSetTab={setRailTab}
              onApplyOutcome={applyOutcome}
              outcomeBusy={outcomeBusy}
            />
          )}
        </div>

      {/* Book from a click on the grid. The clicked slot is a starting
          point, not a decision: time and length stay editable inside. */}
      <BookingModal
        open={!!bookingSeed}
        initial={bookingSeed}
        onClose={() => setBookingSeed(null)}
        onSaved={handleBookingSaved}
        doctors={doctors}
        treatments={treatmentTypes}
        chairCount={dayShape?.chairs || 1}
      />

      <CancelReasonDialog
        prompt={cancelPrompt}
        onChange={setCancelPrompt}
        onConfirm={applyOutcome}
        onClose={() => setCancelPrompt(null)}
        busy={outcomeBusy}
      />

      {/* Everything about one appointment, without leaving the calendar.
          Lives in its own file: this page composes, it does not draw. */}
      <AppointmentPopover
        appointment={selectedAppointment}
        anchorId={anchorId}
        isPhone={isPhone}
        doctors={doctors}
        onClose={() => setSelectedAppointment(null)}
        onCheckIn={checkIn}
        onStartVisit={handleStartVisit}
        onCreatePatientFile={handleCreatePatientFile}
        onApplyOutcome={applyOutcome}
        onReopen={(id) => setOpenStatus(id, 'confirmed')}
        onConfirm={(id) => setOpenStatus(id, 'confirmed')}
        onBookAgain={(apt) => {
          // A follow-up, not a change to this one: no appointmentId, so the
          // modal creates rather than updates. Defaults to the same time a
          // week on, which is the usual gap between dental visits and is the
          // one field most likely to be right already.
          const next = apt.date ? new Date(apt.date) : new Date();
          next.setDate(next.getDate() + 7);
          setBookingSeed({
            patientId: apt.patientId,
            patientName: apt.patientName,
            patientPhone: apt.patientPhone,
            treatment: apt.treatment || '',
            date: dateKey(next),
            startTime: apt.startTime,
            duration: apt.duration || 30,
            doctorId: apt.doctor_id || '',
            chairNumber: apt.chair_number || '',
            available: true,
          });
          setSelectedAppointment(null);
        }}
        onRequestCancel={setCancelPrompt}
        onEdit={(apt) => {
          // Same modal as booking, seeded from the appointment instead of an
          // empty slot. Editing used to have no path at all: changing a doctor
          // or a treatment meant cancelling and rebooking.
          setBookingSeed({
            appointmentId: apt.id,
            patientId: apt.patientId,
            patientName: apt.patientName,
            patientPhone: apt.patientPhone,
            treatment: apt.treatment || '',
            date: apt.date ? dateKey(new Date(apt.date)) : undefined,
            startTime: apt.startTime,
            duration: apt.duration || 30,
            doctorId: apt.doctor_id || '',
            chairNumber: apt.chair_number || '',
            available: true,
          });
          setSelectedAppointment(null);
        }}
        outcomeBusy={outcomeBusy}
        details={details}
        setDetails={setDetails}
        saveDetails={saveDetails}
        detailsSaving={detailsSaving}
      />

      <PatientRegistrationModal
        open={showPatientForm}
        form={patientFormData}
        setForm={setPatientFormData}
        treatments={treatmentTypes}
        onSubmit={handlePatientRegistration}
        onClose={() => setShowPatientForm(false)}
      />

      <DuplicatePatientWarning
        open={showDuplicateWarning}
        matches={duplicatePatients}
        onLinkExisting={handleLinkToExistingPatient}
        onCreateNew={handleCreateNewPatientWithSuffix}
        onClose={() => setShowDuplicateWarning(false)}
      />
    </div>
  );
};

export default Calendar;