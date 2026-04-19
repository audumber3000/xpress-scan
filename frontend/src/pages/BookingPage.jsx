import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Calendar, Clock, User, Phone, Mail, MapPin, CheckCircle, Info, MessageCircle, Stethoscope
} from "lucide-react";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const [clinicInfo, setClinicInfo] = useState(null);
  const [clinicLoading, setClinicLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [clinicTimings, setClinicTimings] = useState({
    monday:    { open: '08:00', close: '20:00', closed: false },
    tuesday:   { open: '08:00', close: '20:00', closed: false },
    wednesday: { open: '08:00', close: '20:00', closed: false },
    thursday:  { open: '08:00', close: '20:00', closed: false },
    friday:    { open: '08:00', close: '20:00', closed: false },
    saturday:  { open: '09:00', close: '17:00', closed: false },
    sunday:    { open: '00:00', close: '00:00', closed: true },
  });
  const [existingAppointments, setExistingAppointments] = useState([]);
  const [nextAvailableSlot, setNextAvailableSlot] = useState(null);
  const [loadingNextSlot, setLoadingNextSlot] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [formData, setFormData] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    age: '',
    gender: '',
    village: '',
    time: '',
    duration: '1',
    date: new Date().toISOString().split('T')[0],
    clinicId: '',
  });

  const clinicId = searchParams.get('clinic');

  // Fetch clinic info from API
  useEffect(() => {
    if (!clinicId) { setClinicLoading(false); return; }
    setClinicLoading(true);
    fetch(`${BASE_URL}/appointments/public/clinic-info?clinic_id=${clinicId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setClinicInfo(data);
          if (data.timings && typeof data.timings === 'object') {
            setClinicTimings(prev => ({ ...prev, ...data.timings }));
          }
        }
        setClinicLoading(false);
      })
      .catch(() => setClinicLoading(false));

    setFormData(prev => ({ ...prev, clinicId }));
  }, [clinicId]);

  useEffect(() => {
    if (formData.date && clinicId) {
      fetchExistingAppointments(formData.date);
      fetchNextAvailableSlot(formData.date, parseFloat(formData.duration));
    }
  }, [formData.date, formData.duration]);

  const fetchExistingAppointments = async (date) => {
    if (!clinicId || !date) return;
    try {
      const res = await fetch(`${BASE_URL}/appointments/public?date_from=${date}&date_to=${date}&clinic_id=${clinicId}`);
      if (res.ok) setExistingAppointments(await res.json());
    } catch { setExistingAppointments([]); }
  };

  const getNextAvailableSlot = async (date, durationHours = 1) => {
    if (!clinicId || !date) return null;
    try {
      const res = await fetch(`${BASE_URL}/appointments/public/next-slot?clinic_id=${clinicId}&date=${date}&duration=${durationHours * 60}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.next_slot || null;
    } catch { return null; }
  };

  const fetchNextAvailableSlot = async (date, duration) => {
    setLoadingNextSlot(true);
    setNextAvailableSlot(await getNextAvailableSlot(date, duration));
    setLoadingNextSlot(false);
  };

  const isTimeWithinOperatingHours = (date, time) => {
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const day = clinicTimings[dayName];
    if (!day || day.closed) return { valid: false, message: `Clinic is closed on ${dayName}.` };
    const sel = time.split(':').map(Number);
    const selMin = sel[0] * 60 + sel[1];
    const openMin = day.open.split(':').map(Number).reduce((h, m) => h * 60 + m);
    const closeMin = day.close.split(':').map(Number).reduce((h, m) => h * 60 + m);
    if (selMin < openMin) return { valid: false, message: `Clinic opens at ${day.open}.` };
    if (selMin >= closeMin) return { valid: false, message: `Clinic closes at ${day.close}.` };
    return { valid: true };
  };

  const checkTimeConflict = (date, startTime, endTime) => {
    const targetDate = new Date(date).toISOString().split('T')[0];
    return existingAppointments.find(apt => {
      if (new Date(apt.appointment_date).toISOString().split('T')[0] !== targetDate) return false;
      return (startTime >= apt.start_time && startTime < apt.end_time) ||
             (endTime > apt.start_time && endTime <= apt.end_time) ||
             (startTime <= apt.start_time && endTime >= apt.end_time);
    });
  };

  const getTimeSlots = (date) => {
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const day = clinicTimings[dayName];
    if (!day || day.closed) return [];
    const slots = [];
    const openMin = day.open.split(':').map(Number).reduce((h, m) => h * 60 + m);
    const closeMin = day.close.split(':').map(Number).reduce((h, m) => h * 60 + m);
    const durMin = parseFloat(formData.duration) * 60;
    for (let t = openMin; t < closeMin; t += 30) {
      const ts = `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
      const endMin = t + durMin;
      const es = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
      if (!checkTimeConflict(date, ts, es)) slots.push(ts);
    }
    return slots;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'patientPhone') {
      const digits = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, patientPhone: digits }));
      setPhoneError(digits.length > 0 && digits.length < 10 ? 'Enter a valid 10-digit number' : '');
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.patientPhone.length !== 10) {
      setPhoneError('Enter a valid 10-digit WhatsApp number');
      return;
    }
    const { valid, message } = isTimeWithinOperatingHours(formData.date, formData.time);
    if (!valid) { alert(`⚠️ ${message}`); return; }

    const durMin = parseFloat(formData.duration) * 60;
    const [sh, sm] = formData.time.split(':').map(Number);
    const endMin = sh * 60 + sm + durMin;
    const endTime = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;

    try {
      const res = await fetch(`${BASE_URL}/appointments/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: formData.patientName,
          patient_email: formData.patientEmail,
          patient_phone: formData.patientPhone,
          appointment_date: formData.date,
          start_time: formData.time,
          end_time: endTime,
          duration: parseInt(durMin),
          status: 'confirmed',
          clinic_id: parseInt(formData.clinicId),
          patient_age: formData.age ? parseInt(formData.age) : null,
          notes: formData.village ? `Address: ${formData.village}` : null,
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || res.statusText);
      }
      setCurrentStep(3);
    } catch (err) {
      alert(`Failed to book: ${err.message}`);
    }
  };

  const durationOptions = [
    { value: '0.5', label: '30 min' },
    { value: '1',   label: '1 hr' },
    { value: '1.5', label: '1.5 hr' },
    { value: '2',   label: '2 hr' },
  ];

  const clinicInitials = clinicInfo?.name
    ? clinicInfo.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  // ── Success screen ────────────────────────────────────────────
  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2a276e]/5 to-indigo-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Thank you, <strong>{formData.patientName}</strong>. Your appointment at <strong>{clinicInfo?.name}</strong> is confirmed.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-1 text-sm text-gray-600">
            <p><span className="font-medium text-gray-800">Date:</span> {new Date(formData.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p><span className="font-medium text-gray-800">Time:</span> {formData.time}</p>
            <p><span className="font-medium text-gray-800">Duration:</span> {durationOptions.find(o => o.value === formData.duration)?.label}</p>
          </div>
          {clinicInfo?.phone && (
            <a href={`tel:${clinicInfo.phone}`} className="flex items-center justify-center gap-2 w-full border border-[#2a276e] text-[#2a276e] py-2.5 rounded-lg text-sm font-medium mb-3 hover:bg-[#2a276e]/5 transition-colors">
              <Phone className="w-4 h-4" /> Call Clinic to Confirm
            </a>
          )}
          <button onClick={() => { setCurrentStep(1); setFormData(prev => ({ ...prev, patientName:'', patientEmail:'', patientPhone:'', age:'', gender:'', village:'', time:'' })); }}
            className="w-full bg-[#2a276e] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a1548] transition-colors">
            Book Another Appointment
          </button>
        </div>
      </div>
    );
  }

  // ── Main page ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a276e]/5 to-indigo-50">

      {/* ── Header ── */}
      <div className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-5">
          {clinicLoading ? (
            <div className="h-16 flex items-center gap-3 animate-pulse">
              <div className="w-16 h-16 rounded-xl bg-gray-200" />
              <div className="space-y-2"><div className="h-5 w-48 bg-gray-200 rounded" /><div className="h-3 w-32 bg-gray-200 rounded" /></div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              {/* Logo */}
              <div className="flex-shrink-0">
                {clinicInfo?.logo_url ? (
                  <img src={clinicInfo.logo_url} alt={clinicInfo.name} className="w-16 h-16 rounded-xl object-cover shadow-sm border border-gray-100" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#2a276e] flex items-center justify-center text-white font-bold text-xl shadow-sm">
                    {clinicInitials}
                  </div>
                )}
              </div>

              {/* Clinic name + specialization */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {clinicInfo?.name || 'Book Appointment'}
                </h1>
                {clinicInfo?.specialization && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Stethoscope className="w-3.5 h-3.5 text-[#2a276e]" />
                    <span className="text-sm text-[#2a276e] font-medium">{clinicInfo.specialization}</span>
                  </div>
                )}

                {/* Contact strip */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {clinicInfo?.phone && (
                    <a href={`tel:${clinicInfo.phone}`} className="flex items-center gap-1 text-sm text-gray-600 hover:text-[#2a276e]">
                      <Phone className="w-3.5 h-3.5" />{clinicInfo.phone}
                    </a>
                  )}
                  {clinicInfo?.address && (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />{clinicInfo.address}
                    </span>
                  )}
                  {clinicInfo?.email && (
                    <a href={`mailto:${clinicInfo.email}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#2a276e]">
                      <Mail className="w-3.5 h-3.5" />{clinicInfo.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Highlighted contact banner */}
        {clinicInfo?.phone && (
          <div className="border-t border-gray-100 bg-[#2a276e]/5">
            <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs text-gray-500">Need help? Call the clinic directly</span>
              <a href={`tel:${clinicInfo.phone}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#2a276e] hover:underline">
                <Phone className="w-4 h-4" />{clinicInfo.phone}
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Form ── */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#2a276e]" /> Book an Appointment
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Personal Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <User className="w-4 h-4" /> Personal Information
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <input type="text" name="patientName" value={formData.patientName} onChange={handleInputChange} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                  placeholder="Enter your full name" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-green-600" /> WhatsApp Number *</span>
                  </label>
                  <input type="tel" name="patientPhone" value={formData.patientPhone} onChange={handleInputChange} required
                    maxLength={10} inputMode="numeric"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm ${phoneError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    placeholder="10-digit number" />
                  {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                  {!phoneError && formData.patientPhone.length === 10 && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Valid number</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</span>
                  </label>
                  <input type="email" name="patientEmail" value={formData.patientEmail} onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                    placeholder="your@email.com" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Age *</label>
                  <input type="number" name="age" value={formData.age} onChange={handleInputChange} required min="0" max="150"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                    placeholder="Age" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Address *</label>
                  <input type="text" name="village" value={formData.village} onChange={handleInputChange} required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm"
                    placeholder="Your address" />
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Appointment Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Appointment Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred Date *</label>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration *</label>
                <div className="grid grid-cols-4 gap-2">
                  {durationOptions.map(o => (
                    <button key={o.value} type="button" onClick={() => setFormData(p => ({ ...p, duration: o.value }))}
                      className={`py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${formData.duration === o.value ? 'bg-[#2a276e] text-white border-[#2a276e]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#2a276e]/40'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Available Time *</span>
                </label>
                <select name="time" value={formData.time} onChange={handleInputChange} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm">
                  <option value="">Select a time slot</option>
                  {getTimeSlots(formData.date).map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {!formData.time && formData.date && (
                  <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-xs font-medium text-indigo-700 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Next Available Slot</p>
                    {loadingNextSlot ? (
                      <p className="text-xs text-gray-500">Checking...</p>
                    ) : nextAvailableSlot ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-indigo-800 font-semibold">{nextAvailableSlot}</span>
                        <button type="button" onClick={() => setFormData(p => ({ ...p, time: nextAvailableSlot }))}
                          className="text-xs px-2 py-0.5 bg-[#2a276e] text-white rounded hover:bg-[#1a1548]">Use this</button>
                      </div>
                    ) : (
                      <p className="text-xs text-red-600">No slots available for this date.</p>
                    )}
                  </div>
                )}

                {formData.time && formData.date && (() => {
                  const { valid, message } = isTimeWithinOperatingHours(formData.date, formData.time);
                  return valid
                    ? <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Time is within clinic hours</p>
                    : <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info className="w-3 h-3" /> {message}</p>;
                })()}
              </div>
            </div>

            {/* Note */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">For confirmation, please call the clinic after booking.</p>
            </div>

            <button type="submit"
              className="w-full bg-[#2a276e] text-white py-3.5 rounded-xl font-semibold text-base hover:bg-[#1a1548] transition-colors shadow-md">
              Confirm Appointment
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Powered by MolarPlus</p>
      </div>
    </div>
  );
};

export default BookingPage;
