import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [clinicData, setClinicData] = useState(null);
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

  // Get current week dates for mock data
  const getCurrentWeekDates = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }
    return weekDates;
  };

  // Mock appointment data - replace with real API calls
  const mockAppointments = [
    // Sunday appointments
    {
      id: 1,
      patientName: "Courtney Henry",
      patientEmail: "courtney@email.com",
      patientPhone: "+1234567890",
      patientAvatar: "CH",
      treatment: "Root Canal",
      doctor: "Dr. Sarah Wilson",
      startTime: "09:00",
      endTime: "10:30",
      date: getCurrentWeekDates()[0], // Sunday
      status: "confirmed",
      color: "bg-blue-100 border-blue-200 text-blue-800"
    },
    {
      id: 2,
      patientName: "Jerome Bell",
      patientEmail: "jerome@email.com",
      patientPhone: "+1234567891",
      patientAvatar: "JB",
      treatment: "Implants",
      doctor: "Dr. Wade Warren",
      startTime: "14:00",
      endTime: "15:30",
      date: getCurrentWeekDates()[0], // Sunday
      status: "confirmed",
      color: "bg-purple-100 border-purple-200 text-purple-800"
    },
    // Monday appointments
    {
      id: 3,
      patientName: "Jenny Wilson",
      patientEmail: "jenny@email.com",
      patientPhone: "+1234567892",
      patientAvatar: "JW",
      treatment: "Whitening",
      doctor: "Dr. Sarah Wilson",
      startTime: "10:00",
      endTime: "12:00",
      date: getCurrentWeekDates()[1], // Monday
      status: "confirmed",
      color: "bg-green-100 border-green-200 text-green-800"
    },
    {
      id: 4,
      patientName: "Leslie Alexander",
      patientEmail: "leslie@email.com",
      patientPhone: "+1234567893",
      patientAvatar: "LA",
      treatment: "Dentures",
      doctor: "Dr. Wade Warren",
      startTime: "11:00",
      endTime: "12:30",
      date: getCurrentWeekDates()[1], // Monday
      status: "confirmed",
      color: "bg-yellow-100 border-yellow-200 text-yellow-800"
    },
    // Tuesday appointments
    {
      id: 5,
      patientName: "Marvin McKinney",
      patientEmail: "marvin@email.com",
      patientPhone: "+1234567894",
      patientAvatar: "MM",
      treatment: "Checkup",
      doctor: "Dr. Sarah Wilson",
      startTime: "09:30",
      endTime: "10:30",
      date: getCurrentWeekDates()[2], // Tuesday
      status: "confirmed",
      color: "bg-pink-100 border-pink-200 text-pink-800"
    },
    {
      id: 6,
      patientName: "Guy Hawkins",
      patientEmail: "guy@email.com",
      patientPhone: "+1234567895",
      patientAvatar: "GH",
      treatment: "Cleaning",
      doctor: "Dr. Wade Warren",
      startTime: "14:30",
      endTime: "16:00",
      date: getCurrentWeekDates()[2], // Tuesday
      status: "confirmed",
      color: "bg-indigo-100 border-indigo-200 text-indigo-800"
    },
    // Wednesday appointments
    {
      id: 7,
      patientName: "Alice Johnson",
      patientEmail: "alice@email.com",
      patientPhone: "+1234567896",
      patientAvatar: "AJ",
      treatment: "Filling",
      doctor: "Dr. Sarah Wilson",
      startTime: "10:30",
      endTime: "11:30",
      date: getCurrentWeekDates()[3], // Wednesday
      status: "confirmed",
      color: "bg-orange-100 border-orange-200 text-orange-800"
    },
    // Thursday appointments
    {
      id: 8,
      patientName: "Bob Smith",
      patientEmail: "bob@email.com",
      patientPhone: "+1234567897",
      patientAvatar: "BS",
      treatment: "Extraction",
      doctor: "Dr. Wade Warren",
      startTime: "15:00",
      endTime: "16:00",
      date: getCurrentWeekDates()[4], // Thursday
      status: "confirmed",
      color: "bg-red-100 border-red-200 text-red-800"
    },
    // Friday appointments
    {
      id: 9,
      patientName: "Carol Davis",
      patientEmail: "carol@email.com",
      patientPhone: "+1234567898",
      patientAvatar: "CD",
      treatment: "Consultation",
      doctor: "Dr. Sarah Wilson",
      startTime: "11:00",
      endTime: "12:00",
      date: getCurrentWeekDates()[5], // Friday
      status: "confirmed",
      color: "bg-teal-100 border-teal-200 text-teal-800"
    },
    // Saturday appointments
    {
      id: 10,
      patientName: "David Brown",
      patientEmail: "david@email.com",
      patientPhone: "+1234567899",
      patientAvatar: "DB",
      treatment: "Follow-up",
      doctor: "Dr. Wade Warren",
      startTime: "13:00",
      endTime: "14:00",
      date: getCurrentWeekDates()[6], // Saturday
      status: "confirmed",
      color: "bg-cyan-100 border-cyan-200 text-cyan-800"
    }
  ];

  // Navigation functions
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
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

  // Get time slots (8 AM to 8 PM)
  const getTimeSlots = () => {
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

  // Get appointments for a specific date
  const getAppointmentsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter(apt => apt.date === dateStr);
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
      } catch (error) {
        console.error("Error fetching clinic data:", error);
      }
    };
    
    if (user) {
      fetchClinicData();
    }
  }, [user]);

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      setAppointments(mockAppointments);
      setLoading(false);
    }, 1000);
  }, [currentDate]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAppointment(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Calculate start and end times from time and duration
    const [startHour, startMinute] = newAppointment.time.split(':').map(Number);
    const durationHours = parseFloat(newAppointment.duration);
    const endTimeInMinutes = (startHour * 60 + startMinute) + (durationHours * 60);
    const endHour = Math.floor(endTimeInMinutes / 60);
    const endMinute = endTimeInMinutes % 60;
    
    const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    
    // Generate patient avatar from name
    const nameParts = newAppointment.patientName.split(' ');
    const avatar = nameParts.map(part => part.charAt(0)).join('').toUpperCase();
    
    // Generate random color for appointment
    const colors = [
      'bg-blue-100 border-blue-200 text-blue-800',
      'bg-purple-100 border-purple-200 text-purple-800',
      'bg-green-100 border-green-200 text-green-800',
      'bg-yellow-100 border-yellow-200 text-yellow-800',
      'bg-pink-100 border-pink-200 text-pink-800',
      'bg-indigo-100 border-indigo-200 text-indigo-800'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Create new appointment
    const appointment = {
      id: Date.now(),
      patientName: newAppointment.patientName,
      patientEmail: newAppointment.patientEmail,
      patientPhone: newAppointment.patientPhone,
      patientAvatar: avatar,
      treatment: newAppointment.treatment,
      doctor: 'Dr. Sarah Wilson', // Default doctor since field is removed
      startTime: startTime,
      endTime: endTime,
      date: newAppointment.date,
      status: newAppointment.status,
      color: randomColor
    };
    
    // Add to appointments list
    setAppointments(prev => [...prev, appointment]);
    
    // Reset form
    setNewAppointment({
      patientName: '',
      patientEmail: '',
      patientPhone: '',
      treatment: '',
      time: '',
      duration: '1',
      date: new Date().toISOString().split('T')[0], // Reset to today's date
      status: 'confirmed'
    });
    
    // Close form
    setShowAddForm(false);
  };

  // Generate doctor-specific booking URL
  const getBookingUrl = () => {
    const userName = user?.user_metadata?.full_name || 
                    user?.user_metadata?.name || 
                    user?.name || 
                    user?.email?.split("@")[0] || 
                    "Dr. User";
    const userId = user?.id || "default";
    const clinicName = clinicData?.name || user?.user_metadata?.clinic_name || "Medical Center";
    const clinicAddress = clinicData?.address || "123 Medical Street, Health City";
    const clinicPhone = clinicData?.phone || "+1 (555) 123-4567";
    const clinicHours = clinicData?.hours || "Mon-Fri: 8:00 AM - 8:00 PM, Sat: 9:00 AM - 5:00 PM, Sun: Closed";
    
    console.log("Generating booking URL with:");
    console.log("clinicData:", clinicData);
    console.log("clinicName:", clinicName);
    console.log("clinicAddress:", clinicAddress);
    console.log("clinicPhone:", clinicPhone);
    
    const params = new URLSearchParams({
      doctor: userId,
      name: userName,
      clinic: clinicName,
      address: clinicAddress,
      phone: clinicPhone,
      hours: clinicHours
    });
    
    const url = `/booking?${params.toString()}`;
    console.log("Generated URL:", url);
    return url;
  };

  const weekDates = getWeekDates();
  const timeSlots = getTimeSlots();
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
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="text-2xl font-bold text-gray-900">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            
            <button
              onClick={goToNext}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
              onClick={goToToday}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Today
            </button>
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add new Appointment
            </button>
          </div>
        </div>

        {/* Calendar Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading appointments...</p>
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
                              className="absolute left-0 right-0 h-0.5 bg-blue-500 z-10"
                              style={{ top: currentTimeIndicator.top }}
                            >
                              <div className="absolute left-0 top-0 w-2 h-2 bg-blue-500 rounded-full -translate-y-1"></div>
                              <div className="absolute left-0 -top-6 text-xs text-blue-600 font-medium">
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
                          onClick={() => setSelectedAppointment(appointment)}
                        >
                          <div className="p-2 h-full flex flex-col justify-center">
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
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-xl font-semibold text-green-800">
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
              </div>

            </div>
            <div className="p-6 border-t border-gray-200">
              <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <span>See Patient Details</span>
                <ExternalLink className="w-4 h-4" />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time *
                </label>
                <input
                  type="time"
                  name="time"
                  value={newAppointment.time}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
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
                          ? 'bg-green-600 text-white border-green-600'
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
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
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