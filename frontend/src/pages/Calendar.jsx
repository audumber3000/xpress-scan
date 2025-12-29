import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  ExternalLink,
  X
} from "lucide-react";

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
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    treatment: '',
    time: '',
    duration: '1',
    date: new Date().toISOString().split('T')[0], // Today's date as default
    status: 'confirmed'
  });

  // Fetch appointments from API
  useEffect(() => {
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
          // Generate color based on status or treatment
          const colors = [
            "bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#6C4CF3]",
            "bg-purple-100 border-purple-200 text-purple-800",
            "bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#6C4CF3]",
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

    fetchAppointments();
  }, [currentDate]);

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

  // Get appointments for a specific date
  const getAppointmentsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const filtered = appointments.filter(apt => {
      const aptDate = apt.date ? new Date(apt.date).toISOString().split('T')[0] : apt.date;
      return aptDate === dateStr;
    });
    console.log(`📅 Looking for appointments on ${dateStr}:`, filtered.length, 'found');
    return filtered;
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
    
    console.log(`Appointment ${appointment.patientName}:`, {
      startTime: appointment.startTime,
      startTimeInMinutes,
      topPosition,
      height,
      calculation: `(${startTimeInMinutes} - ${8 * 60}) * (80/60) = ${topPosition}`
    });
    
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
  useEffect(() => {
    const fetchClinicData = async () => {
      try {
        const response = await api.get("/auth/me");
        console.log("API Response:", response);
        console.log("Clinic Data:", response.clinic);
        setClinicData(response.clinic);
        
        // Set clinic timings if available
        if (response.clinic && response.clinic.timings) {
          setClinicTimings(response.clinic.timings);
        }
      } catch (error) {
        console.error("Error fetching clinic data:", error);
      }
    };
    
    if (user) {
      fetchClinicData();
    }
  }, [user]);

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
            color: selectedAppointment.color, // Keep the color from the existing appointment
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
        setTimeout(() => {
          alert(`⚠️ CLINIC HOURS WARNING:\n\n${timeValidation.message}\n\nPlease select a time within clinic operating hours or leave empty for auto-assignment.`);
        }, 100);
        return;
      }

      // Check for conflicts when time is valid
      const durationMinutes = parseFloat(newAppointment.duration) * 60;
      const [startHour, startMinute] = value.split(':').map(Number);
      const endTimeInMinutes = (startHour * 60 + startMinute) + durationMinutes;
      const endHour = Math.floor(endTimeInMinutes / 60);
      const endMinute = endTimeInMinutes % 60;

      const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      const conflict = checkTimeConflict(newAppointment.date, startTime, endTime);
      if (conflict.hasConflict) {
        const conflictApt = conflict.conflictingAppointment;
        setTimeout(() => {
          alert(
            `⚠️ WARNING: Time Conflict Detected!\n\n` +
            `Selected time overlaps with:\n` +
            `Patient: ${conflictApt.patientName}\n` +
            `Time: ${conflictApt.startTime} - ${conflictApt.endTime}\n` +
            `Treatment: ${conflictApt.treatment}\n\n` +
            `Please choose a different time or leave empty for auto-assignment.`
          );
        }, 100);
      }
    }
  };

  // Check if time slot overlaps with existing appointments
  const checkTimeConflict = (date, startTime, endTime, excludeId = null) => {
    // Convert time strings to minutes for easier comparison
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    // Get appointments for the same date
    const dateStr = date;
    const dayAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.date).toISOString().split('T')[0];
      return aptDate === dateStr && apt.id !== excludeId;
    });

    // Check for conflicts
    for (const apt of dayAppointments) {
      const aptStart = timeToMinutes(apt.startTime);
      const aptEnd = timeToMinutes(apt.endTime);

      // Check if times overlap
      // Overlap conditions:
      // 1. New appointment starts during existing appointment
      // 2. New appointment ends during existing appointment
      // 3. New appointment completely contains existing appointment
      if (
        (newStart >= aptStart && newStart < aptEnd) || // New starts during existing
        (newEnd > aptStart && newEnd <= aptEnd) ||     // New ends during existing
        (newStart <= aptStart && newEnd >= aptEnd)     // New contains existing
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
        alert('No available time slots for the selected date. Please choose another date.');
        return;
      }

      // Show user the auto-assigned time
      const confirmMessage = `No time selected. Auto-assigning next available slot: ${appointmentTime}. Continue?`;
      if (!confirm(confirmMessage)) {
        return;
      }
    } else {
      // Validate selected time is within operating hours
      const timeValidation = isTimeWithinOperatingHours(newAppointment.date, appointmentTime);
      if (!timeValidation.valid) {
        alert(`⚠️ INVALID TIME: ${timeValidation.message}\n\nPlease select a time within clinic operating hours.`);
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
    
      // Check for time conflicts
      const conflict = checkTimeConflict(newAppointment.date, startTime, endTime);
      if (conflict.hasConflict) {
        const conflictApt = conflict.conflictingAppointment;
        alert(
          `⚠️ TIME SLOT CONFLICT!\n\n` +
          `This time overlaps with:\n` +
          `Patient: ${conflictApt.patientName}\n` +
          `Time: ${conflictApt.startTime} - ${conflictApt.endTime}\n` +
          `Treatment: ${conflictApt.treatment}\n\n` +
          `Please choose a different time.`
        );
        return;
      }
    
      // Get clinic_id from clinicData or user
      const clinicId = clinicData?.id || user?.clinic_id;
      
      if (!clinicId) {
        alert('Clinic information not available. Please refresh the page and try again.');
        return;
      }
      
      // Create appointment via API
      const appointmentData = {
        patient_name: newAppointment.patientName,
        patient_email: newAppointment.patientEmail,
        patient_phone: newAppointment.patientPhone,
        treatment: newAppointment.treatment,
        appointment_date: newAppointment.date,
        start_time: startTime,
        end_time: endTime,
        duration: parseInt(durationMinutes),
        status: newAppointment.status,
        clinic_id: clinicId // Required by backend schema (even though it uses current_user.clinic_id internally)
      };
      
      const response = await api.post('/appointments', appointmentData);
      
      // Generate color for display
    const colors = [
      'bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#6C4CF3]',
      'bg-purple-100 border-purple-200 text-purple-800',
      'bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#6C4CF3]',
      'bg-yellow-100 border-yellow-200 text-yellow-800',
      'bg-pink-100 border-pink-200 text-pink-800',
      'bg-indigo-100 border-indigo-200 text-indigo-800'
    ];
      const colorIndex = response.id % colors.length;
      
      // Add to local state with transformed format
      const newApt = {
        id: response.id,
        patientId: response.patient_id || null,
        patientName: response.patient_name,
        patientEmail: response.patient_email || '',
        patientPhone: response.patient_phone || '',
        patientAvatar: response.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        treatment: response.treatment,
        doctor: response.doctor_name || 'Unassigned',
        startTime: response.start_time,
        endTime: response.end_time,
        date: response.appointment_date,
        status: response.status,
        color: colors[colorIndex],
        notes: response.notes || ''
      };
      
      setAppointments(prev => [...prev, newApt]);
      
      // Reset form and close drawer
    setNewAppointment({
      patientName: '',
      patientEmail: '',
      patientPhone: '',
      treatment: '',
      time: '',
      duration: '1',
        date: new Date().toISOString().split('T')[0],
      status: 'confirmed'
    });
    setShowAddForm(false);
    
    alert('✅ Appointment created successfully!');
    } catch (error) {
      console.error('Error creating appointment:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Failed to create appointment: ${errorMessage}`);
    }
  };

  // Handle appointment acceptance
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
      
      // Update selected appointment with new status and patient_id if available
      setSelectedAppointment({ 
        ...selectedAppointment, 
        status: 'accepted',
        patientId: response.patient_id || selectedAppointment.patientId || null
      });
      
      // Prefill patient form with appointment data
      setPatientFormData({
        name: selectedAppointment.patientName,
        age: '',
        gender: '',
        village: '',
        phone: selectedAppointment.patientPhone || '',
        referred_by: 'Walk-in',
        treatment_type: selectedAppointment.treatment,
        notes: selectedAppointment.notes || '',
        payment_type: 'Cash'
      });
      
      // Show patient registration form
      setShowPatientForm(true);
    } catch (error) {
      console.error('Error accepting appointment:', error);
      alert('Failed to accept appointment. Please try again.');
    }
  };

  // Handle appointment rejection
  const handleRejectAppointment = async () => {
    if (!confirm('Are you sure you want to reject this appointment?')) {
      return;
    }
    
    // Prompt for rejection reason (optional custom message for email)
    const rejectionReason = prompt('Please provide a reason for rejection (optional - this will be included in the email to the patient):') || null;
    
    try {
      const response = await api.put(`/appointments/${selectedAppointment.id}`, {
        status: 'rejected',
        rejection_reason: rejectionReason
      });
      
      // Update local state
      setAppointments(prev => prev.map(apt => 
        apt.id === selectedAppointment.id 
          ? { ...apt, status: 'rejected' }
          : apt
      ));
      
      setSelectedAppointment({ ...selectedAppointment, status: 'rejected' });
      alert('Appointment rejected successfully.');
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      alert('Failed to reject appointment. Please try again.');
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
          "bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#6C4CF3]",
          "bg-purple-100 border-purple-200 text-purple-800",
          "bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#6C4CF3]",
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
          color: selectedAppointment.color, // Keep the color from the existing appointment
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
      alert('Patient registered successfully!');
      
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
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Full error:', JSON.stringify(error.response, null, 2));
      
      // Show more detailed error message
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Failed to register patient.\n\nError: ${errorMessage}\n\nPlease check the console for more details.`);
    }
  };

  // Generate clinic-based booking URL
  const getBookingUrl = () => {
    const clinicId = clinicData?.id || "1";
    const clinicName = clinicData?.name || user?.user_metadata?.clinic_name || "Medical Center";
    const clinicAddress = clinicData?.address || "123 Medical Street, Health City";
    const clinicPhone = clinicData?.phone || "+1 (555) 123-4567";
    const clinicHours = clinicData?.hours || "Mon-Fri: 8:00 AM - 8:00 PM, Sat: 9:00 AM - 5:00 PM, Sun: Closed";
    
    console.log("Generating booking URL with:");
    console.log("clinicData:", clinicData);
    console.log("clinicId:", clinicId);
    console.log("clinicName:", clinicName);
    console.log("clinicAddress:", clinicAddress);
    console.log("clinicPhone:", clinicPhone);
    
    const params = new URLSearchParams({
      clinic: clinicId,
      name: clinicName,
      address: clinicAddress,
      phone: clinicPhone,
      hours: clinicHours
    });
    
    const url = `/booking?${params.toString()}`;
    console.log("Generated URL:", url);
    return url;
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

      {/* Calendar Container */}
      <Card>
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={viewMode === 'today' && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const current = new Date(currentDate);
                current.setHours(0, 0, 0, 0);
                const diffDays = Math.round((current - today) / (1000 * 60 * 60 * 24));
                return diffDays <= -1; // Disable if already at yesterday
              })()}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="text-2xl font-bold text-gray-900">
              {viewMode === 'today' ? getRelativeDateLabel(currentDate) : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            
            <button
              onClick={goToNext}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={viewMode === 'today' && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const current = new Date(currentDate);
                current.setHours(0, 0, 0, 0);
                const diffDays = Math.round((current - today) / (1000 * 60 * 60 * 24));
                return diffDays >= 1; // Disable if already at tomorrow
              })()}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={getBookingUrl()}
              target="_blank"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Public Booking
            </Link>
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-[#6C4CF3] text-white px-4 py-2 rounded-lg hover:bg-[#5b3dd9] transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add new Appointment
            </button>
            {/* View Toggle Button */}
            <button
              onClick={() => {
                if (viewMode === 'week') {
                  setCurrentDate(new Date());
                  setViewMode('today');
                } else {
                  setViewMode('week');
                }
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              {viewMode === 'week' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Today
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Week View
                </>
              )}
            </button>
          </div>
        </div>

        {/* Calendar Content */}
        {loading ? (
          <div className="text-center py-12">
            <GearLoader size="w-12 h-12" className="mx-auto" />
            <p className="mt-4 text-gray-600">Loading appointments...</p>
          </div>
        ) : viewMode === 'today' ? (
          /* Today's View - List of appointments */
          <div className="space-y-4">
            {/* Header */}
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {(() => {
                  const label = getRelativeDateLabel(currentDate);
                  const possessive = label === "Today" ? "Today's" : label === "Yesterday" ? "Yesterday's" : "Tomorrow's";
                  return `${possessive} Appointments - ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
                })()}
              </h2>
            </div>

            {(() => {
              const targetDateStr = currentDate.toISOString().split('T')[0];
              const todaysAppointments = appointments.filter(apt => {
                const aptDate = apt.date ? new Date(apt.date).toISOString().split('T')[0] : apt.date;
                return aptDate === targetDateStr;
              }).sort((a, b) => {
                const timeA = a.startTime.split(':').map(Number);
                const timeB = b.startTime.split(':').map(Number);
                return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
              });

              if (todaysAppointments.length === 0) {
                return (
                  <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Appointments Today</h3>
                    <p className="text-gray-500">You have a clear schedule for today!</p>
                  </div>
                );
              }

              return (
                <div className="grid gap-4">
                  {todaysAppointments.map((apt, index) => (
                    <div
                      key={apt.id}
                      onClick={async () => {
                        console.log('Selected appointment from today view:', apt);
                        console.log('Patient ID:', apt.patientId);
                        // Fetch full appointment data to ensure we have latest patient_id
                        try {
                          const fullAppointment = await api.get(`/appointments/${apt.id}`);
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
                            color: apt.color, // Keep the color from the list
                            notes: fullAppointment.notes || ''
                          };
                          console.log('Fetched full appointment:', transformedAppointment);
                          setSelectedAppointment(transformedAppointment);
                        } catch (error) {
                          console.error('Error fetching appointment details:', error);
                          // Fallback to using the appointment from the list
                          setSelectedAppointment(apt);
                        }
                      }}
                      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer border-l-4 ${apt.color} p-6`}
                    >
                      <div className="flex items-center justify-between">
                        {/* Left: Time & Patient Info */}
                        <div className="flex items-center gap-6 flex-1">
                          {/* Time Badge */}
                          <div className="flex flex-col items-center bg-gray-50 rounded-lg px-4 py-3 min-w-[100px]">
                            <div className="text-2xl font-bold text-gray-900">{formatTime(apt.startTime)}</div>
                            <div className="text-xs text-gray-500">to</div>
                            <div className="text-sm font-medium text-gray-600">{formatTime(apt.endTime)}</div>
                          </div>

                          {/* Patient Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-12 h-12 bg-[#9B8CFF]/20 rounded-full flex items-center justify-center text-lg font-semibold text-[#6C4CF3]">
                                {apt.patientAvatar}
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-gray-900">{apt.patientName}</h3>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {apt.patientPhone}
                                  </div>
                                  {apt.patientEmail && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                      {apt.patientEmail}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 ml-15">
                              <span className="text-sm text-gray-700">
                                <strong>Treatment:</strong> {apt.treatment}
                              </span>
                              <span className="text-sm text-gray-700">
                                <strong>Doctor:</strong> {apt.doctor}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Status Badge */}
                        <div className="flex flex-col items-end gap-2">
                          {apt.status === 'accepted' && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#9B8CFF]/20 text-[#6C4CF3] rounded-full">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-semibold">Accepted</span>
                            </div>
                          )}
                          {apt.status === 'rejected' && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-800 rounded-full">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-semibold">Rejected</span>
                            </div>
                          )}
                          {apt.status === 'confirmed' && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-full">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-semibold">Pending</span>
                            </div>
                          )}
                          <button className="text-[#9B8CFF] hover:text-[#6C4CF3] text-sm font-medium flex items-center gap-1">
                            View Details
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Calendar Grid Container with Scroll */}
            <div className="max-h-[600px] overflow-y-auto relative">
              <div className="grid grid-cols-8 min-h-[800px] relative">
                {/* Time column header */}
                <div className="p-3 text-center font-semibold text-gray-700 bg-gray-50 sticky top-0 z-20">
                  {clientTimezone.offset}
                </div>
                
                {/* Day headers */}
                {weekDates.map((date, index) => (
                  <div key={index} className="p-3 text-center bg-gray-50 border-l border-gray-100 sticky top-0 z-20">
                    <div className="text-sm font-medium text-gray-600">
                      {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </div>
                    <div className={`text-lg font-bold ${
                      date.toDateString() === new Date().toDateString() 
                        ? 'text-white bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center mx-auto' 
                        : 'text-gray-900'
                    }`}>
                      {date.getDate()}
                    </div>
                  </div>
                ))}

                {/* Time slots and appointments */}
                {timeSlots.map((slot, slotIndex) => (
                  <React.Fragment key={slot.time}>
                    {/* Time label */}
                    <div className="p-3 text-sm font-medium text-gray-600 bg-white border-t border-gray-100">
                      {slot.displayTime}
                    </div>
                    
                    {/* Appointment slots for each day */}
                    {weekDates.map((date, dayIndex) => {
                      const dayAppointments = getAppointmentsForDate(date);
                      const isCurrentTime = new Date().getHours() === slot.hour;
                      
                      return (
                        <div 
                          key={`${slot.time}-${dayIndex}`} 
                          className="min-h-[80px] bg-white border-t border-l border-gray-100 relative"
                        >
                          {/* Current time indicator */}
                          {isCurrentTime && (
                            <div 
                              className="absolute left-0 right-0 h-0.5 bg-[#9B8CFF]/100 z-10"
                              style={{ top: currentTimeIndicator.top }}
                            >
                              <div className="absolute left-0 top-0 w-2 h-2 bg-[#9B8CFF]/100 rounded-full -translate-y-1"></div>
                              <div className="absolute left-0 -top-6 text-xs text-[#9B8CFF] font-medium">
                                {currentTimeIndicator.time}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}

                {/* Appointments Overlay - positioned relative to the grid */}
                <div className="absolute inset-0 pointer-events-none" style={{ top: '60px' }}>
                  {weekDates.map((date, dayIndex) => {
                    const dayAppointments = getAppointmentsForDate(date);
                    console.log(`Day ${dayIndex} (${date.toISOString().split('T')[0]}):`, dayAppointments);
                    return dayAppointments.map((appointment) => {
                      const style = getAppointmentStyle(appointment);
                      return (
                        <div
                          key={appointment.id}
                          className={`absolute pointer-events-auto cursor-pointer hover:shadow-md transition-shadow rounded border-l-4 ${appointment.color}`}
                          style={{
                            left: `${(dayIndex + 1) * 12.5}%`, // Position in day column
                            top: style.top,
                            height: style.height,
                            width: style.width,
                            minHeight: style.minHeight,
                            zIndex: style.zIndex
                          }}
                          onClick={async () => {
                            console.log('Selected appointment:', appointment);
                            console.log('Patient ID:', appointment.patientId);
                            // Fetch full appointment data to ensure we have latest patient_id
                            try {
                              const fullAppointment = await api.get(`/appointments/${appointment.id}`);
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
                                color: appointment.color, // Keep the color from the list
                                notes: fullAppointment.notes || ''
                              };
                              console.log('Fetched full appointment:', transformedAppointment);
                              setSelectedAppointment(transformedAppointment);
                            } catch (error) {
                              console.error('Error fetching appointment details:', error);
                              // Fallback to using the appointment from the list
                              setSelectedAppointment(appointment);
                            }
                          }}
                        >
                          <div className="p-2 h-full flex flex-col justify-center relative">
                            {/* Status indicator badge */}
                            {appointment.status === 'accepted' && (
                              <div className="absolute top-1 right-1 w-5 h-5 bg-[#6C4CF3] rounded-full flex items-center justify-center z-10">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                            {appointment.status === 'rejected' && (
                              <div className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-10">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                            <div className="text-sm font-medium truncate">
                              {appointment.patientName}
                            </div>
                            <div className="text-xs opacity-75 truncate">
                              {appointment.treatment}
                            </div>
                            <div className="text-xs opacity-75">
                              {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

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
                <div className="w-16 h-16 bg-[#9B8CFF]/20 rounded-full flex items-center justify-center text-xl font-semibold text-[#6C4CF3]">
                  {selectedAppointment.patientAvatar}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {selectedAppointment.patientName}
                  </h4>
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
                  <span className="text-sm font-medium text-gray-600">Type Treatments:</span>
                  <span className="ml-2 text-sm text-gray-900">{selectedAppointment.treatment}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Doctor:</span>
                  <span className="ml-2 text-sm text-gray-900">{selectedAppointment.doctor}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <span className={`ml-2 text-sm font-semibold ${
                    selectedAppointment.status === 'accepted' ? 'text-[#6C4CF3]' :
                    selectedAppointment.status === 'rejected' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {selectedAppointment.status === 'accepted' && '✓ Accepted'}
                    {selectedAppointment.status === 'rejected' && '✗ Rejected'}
                    {selectedAppointment.status === 'confirmed' && '⏳ Pending Confirmation'}
                    {!['accepted', 'rejected', 'confirmed'].includes(selectedAppointment.status) && selectedAppointment.status}
                  </span>
                </div>
              </div>

              {/* Status Message */}
              {selectedAppointment.status === 'accepted' && (
                <div className="mb-6 p-4 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                  <div className="flex items-center gap-2 text-[#6C4CF3]">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Appointment Accepted</span>
            </div>
                  <p className="text-sm text-[#6C4CF3] mt-1">Patient registration completed.</p>
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
              
              {/* See Patient Details button - only show for accepted appointments with patient_id */}
              {(() => {
                const isAccepted = selectedAppointment.status === 'accepted';
                const hasPatientId = selectedAppointment.patientId !== null && selectedAppointment.patientId !== undefined;
                console.log('🔍 Button visibility check:', {
                  isAccepted,
                  hasPatientId,
                  patientId: selectedAppointment.patientId,
                  status: selectedAppointment.status
                });
                return isAccepted && hasPatientId;
              })() && (
                <button 
                  onClick={() => {
                    navigate(`/patient-profile/${selectedAppointment.patientId}`);
                    setSelectedAppointment(null); // Close modal
                  }}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>See Patient Details</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent bg-gray-50"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                    placeholder="Enter referral source (optional)"
                  />
                </div>

                {/* Treatment Type (pre-filled from appointment) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Treatment Type *
                  </label>
                  <input
                    type="text"
                    value={patientFormData.treatment_type}
                    onChange={(e) => setPatientFormData({ ...patientFormData, treatment_type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent bg-gray-50"
                    placeholder="Treatment type"
                  />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Other">Other</option>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                    placeholder="Additional notes (optional)"
                  />
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button 
                type="submit" 
                form="patient-registration-form"
                className="w-full bg-[#6C4CF3] text-white py-3 rounded-lg hover:bg-[#5b3dd9] transition-colors font-medium"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                  placeholder="Enter patient phone"
                />
              </div>

              {/* Treatment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Treatment *
                </label>
                <select
                  name="treatment"
                  value={newAppointment.treatment}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                >
                  <option value="">Select treatment</option>
                  <option value="Root Canal">Root Canal</option>
                  <option value="Implants">Implants</option>
                  <option value="Whitening">Whitening</option>
                  <option value="Dentures">Dentures</option>
                  <option value="Checkup">Checkup</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Filling">Filling</option>
                  <option value="Extraction">Extraction</option>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6C4CF3] focus:border-transparent"
                  placeholder="Leave empty to auto-assign"
                />
                {newAppointment.date && (() => {
                  const dateObj = new Date(newAppointment.date);
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                  const dayTimings = clinicTimings[dayName];
                  const nextSlot = findNextAvailableSlot(newAppointment.date, parseFloat(newAppointment.duration));

                  return (
                    <div className="mt-2 space-y-2">
                      {/* Operating Hours Info */}
                      <div className="p-2 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                        <p className="text-xs text-[#6C4CF3] flex items-center gap-2">
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
              </div>

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
                          ? 'bg-[#6C4CF3] text-white border-[#6C4CF3]'
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
                  className="px-6 py-2 bg-[#6C4CF3] text-white rounded-lg hover:bg-[#5b3dd9] transition font-medium"
                >
                  Add Appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;