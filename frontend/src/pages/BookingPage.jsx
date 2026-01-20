import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  ArrowLeft,
  Info
} from "lucide-react";

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [doctorInfo, setDoctorInfo] = useState({
    name: 'Dr. User',
    clinicName: 'Medical Center',
    address: '123 Medical Street, Health City',
    phone: '+1 (555) 123-4567',
    hours: 'Mon-Fri: 8:00 AM - 8:00 PM, Sat: 9:00 AM - 5:00 PM, Sun: Closed'
  });

  // Clinic timings for validation
  const [clinicTimings, setClinicTimings] = useState({
    monday: { open: '08:00', close: '20:00', closed: false },
    tuesday: { open: '08:00', close: '20:00', closed: false },
    wednesday: { open: '08:00', close: '20:00', closed: false },
    thursday: { open: '08:00', close: '20:00', closed: false },
    friday: { open: '08:00', close: '20:00', closed: false },
    saturday: { open: '09:00', close: '17:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true }
  });

  // Existing appointments for conflict checking
  const [existingAppointments, setExistingAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [nextAvailableSlot, setNextAvailableSlot] = useState(null);
  const [loadingNextSlot, setLoadingNextSlot] = useState(false);
  const [formData, setFormData] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    age: '',
    gender: '',
    village: '',
    treatment: '',
    time: '',
    duration: '1',
    date: new Date().toISOString().split('T')[0],
    doctorId: '',
    doctorName: ''
  });

  // Parse clinic hours string into structured format
  const parseClinicHours = (hoursString) => {
    const timings = {
      monday: { open: '08:00', close: '20:00', closed: false },
      tuesday: { open: '08:00', close: '20:00', closed: false },
      wednesday: { open: '08:00', close: '20:00', closed: false },
      thursday: { open: '08:00', close: '20:00', closed: false },
      friday: { open: '08:00', close: '20:00', closed: false },
      saturday: { open: '09:00', close: '17:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true }
    };

    if (!hoursString) return timings;

    // Parse hours string like "Mon-Fri: 8:00 AM - 8:00 PM, Sat: 9:00 AM - 5:00 PM, Sun: Closed"
    const parts = hoursString.split(',').map(p => p.trim());

    for (const part of parts) {
      if (part.includes('Closed') || part.includes('closed')) {
        // Handle closed days
        if (part.includes('Sun')) {
          timings.sunday.closed = true;
        } else if (part.includes('Sat')) {
          timings.saturday.closed = true;
        }
      } else {
        // Parse time ranges
        const [days, timeRange] = part.split(':').map(p => p.trim());
        if (timeRange && timeRange.includes('-')) {
          const [open, close] = timeRange.split('-').map(t => t.trim());

          // Convert to 24-hour format
          const convertTo24Hour = (timeStr) => {
            const clean = timeStr.replace(/AM|PM/gi, '').trim();
            const [hours, minutes] = clean.split(':').map(Number);
            const isPM = timeStr.toUpperCase().includes('PM');

            let hour24 = hours;
            if (isPM && hours !== 12) hour24 += 12;
            if (!isPM && hours === 12) hour24 = 0;

            return `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0') || '00'}`;
          };

          const open24 = convertTo24Hour(open);
          const close24 = convertTo24Hour(close);

          if (days.includes('Mon-Fri')) {
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
              timings[day].open = open24;
              timings[day].close = close24;
            });
          } else if (days.includes('Sat')) {
            timings.saturday.open = open24;
            timings.saturday.close = close24;
          }
        }
      }
    }

    return timings;
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

  // Get next available slot from backend API
  const getNextAvailableSlot = async (date, durationHours = 1) => {
    const clinicId = searchParams.get('clinic');
    if (!clinicId || !date) return null;

    try {
      console.log(`🎯 Getting next available slot for ${date}, duration: ${durationHours} hours, clinic: ${clinicId}`);
      const response = await fetch(
        `http://localhost:8000/appointments/public/next-slot?clinic_id=${clinicId}&date=${date}&duration=${durationHours * 60}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.ok) {
        console.error('Failed to get next slot:', response.statusText);
        return null;
      }

      const result = await response.json();
      console.log('✅ Next slot result:', result);

      if (result.next_slot) {
        return result.next_slot;
      } else {
        console.log(`❌ No available slots: ${result.message}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting next slot:', error);
      return null;
    }
  };

  useEffect(() => {
    // Get clinic information from URL parameters
    const clinicId = searchParams.get('clinic');
    const clinicName = searchParams.get('name');
    const clinicAddress = searchParams.get('address');
    const clinicPhone = searchParams.get('phone');
    const clinicHours = searchParams.get('hours');

    console.log("BookingPage URL Parameters:");
    console.log("clinicId:", clinicId);
    console.log("clinicName:", clinicName);
    console.log("clinicAddress:", clinicAddress);
    console.log("clinicPhone:", clinicPhone);
    console.log("clinicHours:", clinicHours);

    if (clinicId && clinicName) {
      setDoctorInfo(prev => ({
        ...prev,
        name: 'Clinic Staff', // Default since we're booking by clinic
        clinicName: clinicName,
        address: clinicAddress || prev.address,
        phone: clinicPhone || prev.phone,
        hours: clinicHours || prev.hours
      }));

      // Parse clinic hours into structured format
      if (clinicHours) {
        const parsedTimings = parseClinicHours(clinicHours);
        setClinicTimings(parsedTimings);
        console.log("Parsed clinic timings:", parsedTimings);
      }

      setFormData(prev => ({
        ...prev,
        clinicId: clinicId,
        doctorId: '', // No specific doctor for clinic booking
        doctorName: 'Clinic Staff'
      }));
    }
  }, [searchParams]);

  // Fetch appointments and next slot when date changes
  useEffect(() => {
    const clinicId = searchParams.get('clinic');
    if (formData.date && clinicId) {
      fetchExistingAppointments(formData.date);
      fetchNextAvailableSlot(formData.date, parseFloat(formData.duration));
    }
  }, [formData.date, formData.duration, searchParams]);

  // Function to fetch next available slot
  const fetchNextAvailableSlot = async (date, duration) => {
    setLoadingNextSlot(true);
    const slot = await getNextAvailableSlot(date, duration);
    setNextAvailableSlot(slot);
    setLoadingNextSlot(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedDate = formData.date;
    const selectedTime = formData.time;
    const durationMinutes = parseFloat(formData.duration) * 60;

    // 1. Validate against clinic operating hours
    const { valid: clinicHoursValid, message: clinicHoursMessage } = isTimeWithinOperatingHours(selectedDate, selectedTime);
    if (!clinicHoursValid) {
      alert(`⚠️ INVALID TIME: ${clinicHoursMessage}`);
      return;
    }

    let finalStartTime = selectedTime;

    if (!finalStartTime) {
      // Auto-assign next available slot if time is not provided
      const nextSlot = await getNextAvailableSlot(selectedDate, parseFloat(formData.duration));
      if (nextSlot) {
        const confirmAuto = window.confirm(`No time selected. Auto-assigning next available slot: ${nextSlot}. Continue?`);
        if (!confirmAuto) return;
        finalStartTime = nextSlot;
        setFormData(prev => ({ ...prev, time: finalStartTime })); // Update the form
      } else {
        alert('No available time slots for the selected date and duration within clinic hours.');
        return;
      }
    }

    // Calculate end time based on finalStartTime and duration
    const [startHour, startMinute] = finalStartTime.split(':').map(Number);
    const endTimeInMinutes = (startHour * 60 + startMinute) + durationMinutes;
    const endHour = Math.floor(endTimeInMinutes / 60);
    const endMinute = endTimeInMinutes % 60;
    const finalEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

    // Create appointment via public API
    try {
      const appointmentData = {
        patient_name: formData.patientName,
        patient_email: formData.patientEmail,
        patient_phone: formData.patientPhone,
        treatment: formData.treatment,
        appointment_date: selectedDate,
        start_time: finalStartTime,
        end_time: finalEndTime,
        duration: parseInt(durationMinutes),
        status: 'confirmed',
        clinic_id: parseInt(formData.clinicId)
      };

      console.log('📤 Creating appointment:', appointmentData);

      const response = await fetch('http://localhost:8000/appointments/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `Failed to create appointment: ${response.statusText}`);
      }

      const createdAppointment = await response.json();
      console.log('✅ Appointment created:', createdAppointment);

      alert('🎉 Appointment booked successfully!');
      setCurrentStep(3); // Show success page
    } catch (error) {
      console.error('❌ Error creating appointment:', error);
      alert(`Failed to book appointment: ${error.message}`);
    }
  };

  const durationOptions = [
    { value: '0.5', label: '30 min' },
    { value: '1', label: '1 hour' },
    { value: '1.5', label: '1.5 hours' },
    { value: '2', label: '2 hours' }
  ];

  const treatmentOptions = [
    'Root Canal',
    'Implants',
    'Whitening',
    'Dentures',
    'Checkup',
    'Cleaning',
    'Filling',
    'Extraction',
    'Consultation',
    'Follow-up'
  ];

  // Fetch existing appointments for the clinic and date (public endpoint)
  const fetchExistingAppointments = async (date) => {
    const clinicId = searchParams.get('clinic');
    if (!clinicId || !date) {
      console.log('Missing clinicId or date:', { clinicId, date });
      return;
    }

    try {
      setLoadingAppointments(true);
      console.log('🔄 Fetching appointments for date:', date, 'clinic:', clinicId);

      // Use public endpoint (no authentication required) - now by clinic instead of doctor
      const response = await fetch(`http://localhost:8000/appointments/public?date_from=${date}&date_to=${date}&clinic_id=${clinicId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch appointments:', response.status, response.statusText);
        setExistingAppointments([]);
        return;
      }

      const appointments = await response.json();
      console.log('✅ Fetched appointments:', appointments);
      console.log('📊 Total appointments for this clinic/date:', appointments.length);
      setExistingAppointments(appointments || []);
    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
      setExistingAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Check if a time slot conflicts with existing appointments
  const checkTimeConflict = (date, startTime, endTime, excludeAppointmentId = null) => {
    const targetDate = new Date(date).toISOString().split('T')[0];
    console.log(`🔍 Checking conflicts for ${targetDate} ${startTime}-${endTime}`);
    console.log(`📅 Existing appointments:`, existingAppointments.length);

    const conflict = existingAppointments.find(apt => {
      // Skip the appointment being edited
      if (excludeAppointmentId && apt.id === excludeAppointmentId) return false;

      // Only check appointments on the same date
      const aptDate = new Date(apt.appointment_date).toISOString().split('T')[0];
      if (aptDate !== targetDate) {
        console.log(`📅 Skipping appointment ${apt.id}: different date (${aptDate} vs ${targetDate})`);
        return false;
      }

      const aptStart = apt.start_time;
      const aptEnd = apt.end_time;

      console.log(`🔍 Checking appointment ${apt.id}: ${aptStart}-${aptEnd} vs ${startTime}-${endTime}`);

      // Check for overlap
      const hasOverlap = (
        (startTime >= aptStart && startTime < aptEnd) ||
        (endTime > aptStart && endTime <= aptEnd) ||
        (startTime <= aptStart && endTime >= aptEnd)
      );

      if (hasOverlap) {
        console.log(`⚠️ CONFLICT FOUND with appointment ${apt.id}: ${aptStart}-${aptEnd}`);
      }

      return hasOverlap;
    });

    console.log(`✅ Conflict result:`, conflict ? `Yes (appointment ${conflict.id})` : 'No');
    return conflict;
  };

  // Generate available time slots based on clinic hours and existing appointments
  const getTimeSlots = (date) => {
    const slots = [];
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayTimings = clinicTimings[dayName];

    if (!dayTimings || dayTimings.closed) {
      return [];
    }

    const [openHour, openMinute] = dayTimings.open.split(':').map(Number);
    const [closeHour, closeMinute] = dayTimings.close.split(':').map(Number);
    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    // Generate 30-minute intervals
    for (let time = openTimeInMinutes; time < closeTimeInMinutes; time += 30) {
      const hour = Math.floor(time / 60);
      const minute = time % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // Check if this slot conflicts with existing appointments
      const durationMinutes = parseFloat(formData.duration) * 60;
      const endTimeInMinutes = time + durationMinutes;
      const endHour = Math.floor(endTimeInMinutes / 60);
      const endMinute = endTimeInMinutes % 60;
      const endTimeString = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      const conflict = checkTimeConflict(date, timeString, endTimeString);
      if (!conflict) {
        slots.push({
          value: timeString,
          label: timeString
        });
      }
    }

    return slots;
  };

  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#9B8CFF]/10 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-[#9B8CFF]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-[#2a276e]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Appointment Booked!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for booking with {doctorInfo.name} at {doctorInfo.clinicName}. We'll send you a confirmation email shortly.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Appointment Details</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Patient:</strong> {formData.patientName} ({formData.age} years, {formData.gender})</p>
              <p><strong>Address:</strong> {formData.village}</p>
              <p><strong>Date:</strong> {new Date(formData.date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> {formData.time}</p>
              <p><strong>Duration:</strong> {durationOptions.find(opt => opt.value === formData.duration)?.label}</p>
              <p><strong>Treatment:</strong> {formData.treatment}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setCurrentStep(1);
              setFormData({
                patientName: '',
                patientEmail: '',
                patientPhone: '',
                age: '',
                gender: '',
                village: '',
                treatment: '',
                time: '',
                duration: '1',
                date: new Date().toISOString().split('T')[0],
                doctorId: formData.doctorId,
                doctorName: formData.doctorName
              });
            }}
            className="w-full bg-[#2a276e] text-white py-3 rounded-lg hover:bg-[#1a1548] transition-colors"
          >
            Book Another Appointment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#9B8CFF]/10 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#2a276e] rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Book Appointment</h1>
                <p className="text-gray-600">with {doctorInfo.name}</p>
                <p className="text-sm text-gray-500">{doctorInfo.clinicName}</p>
              </div>
            </div>
            <div className="flex flex-col space-y-1 text-sm text-gray-500">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="break-words">{doctorInfo.address}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span className="break-words">{doctorInfo.phone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center space-x-4 mb-8">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep >= 1 ? 'bg-[#2a276e] text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep >= 2 ? 'bg-[#2a276e] text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
            <div className="text-sm text-gray-600">Personal Details → Appointment Details</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <User className="w-5 h-5 mr-2 text-[#2a276e]" />
                Personal Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="patientEmail"
                    value={formData.patientEmail}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="patientPhone"
                    value={formData.patientPhone}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age *
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    required
                    min="0"
                    max="150"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                    placeholder="Enter age"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender *
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <input
                    type="text"
                    name="village"
                    value={formData.village}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                    placeholder="Enter your address"
                  />
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-[#2a276e]" />
                Appointment Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Treatment Type *
                </label>
                <select
                  name="treatment"
                  value={formData.treatment}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                >
                  <option value="">Select treatment type</option>
                  {treatmentOptions.map((treatment) => (
                    <option key={treatment} value={treatment}>
                      {treatment}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Date *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Appointment Duration *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {durationOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, duration: option.value }))}
                      className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all ${
                        formData.duration === option.value
                          ? 'bg-[#2a276e] text-white border-[#2a276e] shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-[#9B8CFF] hover:bg-[#9B8CFF]/10'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Available Time Slots
                </label>
                <select
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent transition-colors"
                >
                  <option value="">Select preferred time</option>
                  {formData.date && getTimeSlots(formData.date).map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Only available times within clinic hours are shown</p>

                {/* Simple Clinic Hours Line */}
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Clinic Hours:</span> {doctorInfo.hours}
                </div>

                {/* Next Available Slot Suggestion */}
                {!formData.time && formData.date && (
                  <div className="mt-2 p-3 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                    <div className="flex items-center text-sm text-[#2a276e] mb-1">
                      <Clock className="w-4 h-4 mr-1" />
                      <span className="font-medium">Next Available Slot</span>
                    </div>
                    {loadingNextSlot ? (
                      <div className="text-xs text-gray-600">Checking availability...</div>
                    ) : nextAvailableSlot ? (
                      <div className="text-xs text-[#2a276e]">
                        <p>Suggested time: <span className="font-semibold">{nextAvailableSlot}</span></p>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, time: nextAvailableSlot }))}
                          className="mt-1 px-2 py-1 bg-[#2a276e] text-white text-xs rounded hover:bg-[#1a1548] transition-colors"
                        >
                          Use this time
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-red-700">No available slots for the selected date and duration.</p>
                    )}
                  </div>
                )}

                {/* Time Validation Feedback */}
                {formData.time && formData.date && (() => {
                  const { valid, message } = isTimeWithinOperatingHours(formData.date, formData.time);
                  return !valid ? (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center text-sm text-red-800">
                        <Info className="w-4 h-4 mr-1" />
                        <span className="font-medium">Time Warning</span>
                      </div>
                      <p className="text-xs text-red-700 mt-1">{message}</p>
                    </div>
                  ) : (
                    <div className="mt-2 p-3 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
                      <div className="flex items-center text-sm text-[#2a276e]">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        <span className="font-medium">Time Available</span>
                      </div>
                      <p className="text-xs text-[#2a276e] mt-1">Selected time is within clinic operating hours.</p>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Confirmation Note */}
            <div className="mt-6 p-4 bg-[#9B8CFF]/10 border border-[#9B8CFF] rounded-lg">
              <div className="flex items-center text-sm text-[#2a276e]">
                <Info className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="font-medium">For confirmation, it's always good to call the clinic.</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#2a276e] text-white py-4 rounded-lg hover:bg-[#1a1548] transition-colors font-semibold text-lg shadow-lg hover:shadow-xl"
            >
              Book Appointment
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
