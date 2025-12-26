import React, { useState, useEffect } from "react";
import Card from "../components/Card";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, ReferenceLine, Label, LineChart, Line, Area, AreaChart, RadialBarChart, RadialBar } from "recharts";

const COLORS = ["#1d8a99", "#6ee7b7", "#d1fae5", "#f59e0b", "#ef4444", "#8b5cf6"];

// Week-wise data for metrics cards
const weekData = [
  { week: "4 weeks ago", value: 6000 },
  { week: "3 weeks ago", value: 7000 },
  { week: "2 weeks ago", value: 9000 },
  { week: "1 week ago", value: 8000 },
  { week: "Current", value: 10000 },
];

const patientStatsDataByMonth = [
  { month: "Dec", patient: 6000, inpatient: 0 },
  { month: "Jan", patient: 11000, inpatient: 0 },
  { month: "Feb", patient: 7000, inpatient: 0 },
  { month: "Mar", patient: 4000, inpatient: 0 },
  { month: "Apr", patient: 12000, inpatient: 0 },
  { month: "May", patient: 10000, inpatient: 7000 },
  { month: "Jun", patient: 9000, inpatient: 0 },
  { month: "Jul", patient: 8000, inpatient: 0 },
  { month: "Aug", patient: 9500, inpatient: 0 },
  { month: "Sep", patient: 10500, inpatient: 0 },
  { month: "Oct", patient: 11500, inpatient: 0 },
  { month: "Nov", patient: 7000, inpatient: 0 },
];
const patientStatsDataByWeek = [
  { day: "Sun", patient: 1200, inpatient: 0 },
  { day: "Mon", patient: 1500, inpatient: 0 },
  { day: "Tue", patient: 1800, inpatient: 0 },
  { day: "Wed", patient: 1700, inpatient: 0 },
  { day: "Thu", patient: 1600, inpatient: 0 },
  { day: "Fri", patient: 1400, inpatient: 0 },
  { day: "Sat", patient: 1300, inpatient: 0 },
];
const patientStatsDataCurrentWeek = [
  { day: "Mon", patient: 900, inpatient: 0 },
  { day: "Tue", patient: 1100, inpatient: 0 },
  { day: "Wed", patient: 1200, inpatient: 0 },
  { day: "Thu", patient: 1000, inpatient: 0 },
  { day: "Fri", patient: 950, inpatient: 0 },
  { day: "Sat", patient: 1050, inpatient: 0 },
  { day: "Sun", patient: 1150, inpatient: 0 },
];

// Hypothetical data for Venue Visitor
const venueVisitorData = [
  { name: "Male", value: 32000, color: COLORS[0] },
  { name: "Female", value: 41000, color: COLORS[1] },
  { name: "Others", value: 10943, color: COLORS[2] },
];
const totalVisitors = venueVisitorData.reduce((sum, d) => sum + d.value, 0);

// Revenue Analytics Data
const revenueData = [
  { day: "Mon", revenue: 45000, target: 50000 },
  { day: "Tue", revenue: 52000, target: 50000 },
  { day: "Wed", revenue: 48000, target: 50000 },
  { day: "Thu", revenue: 61000, target: 50000 },
  { day: "Fri", revenue: 58000, target: 50000 },
  { day: "Sat", revenue: 42000, target: 40000 },
  { day: "Sun", revenue: 35000, target: 35000 },
];

// Appointment Booking Trends Data
const appointmentData = [
  { time: "9 AM", bookings: 12, capacity: 15 },
  { time: "10 AM", bookings: 18, capacity: 20 },
  { time: "11 AM", bookings: 15, capacity: 18 },
  { time: "12 PM", bookings: 8, capacity: 12 },
  { time: "2 PM", bookings: 20, capacity: 22 },
  { time: "3 PM", bookings: 16, capacity: 18 },
  { time: "4 PM", bookings: 14, capacity: 16 },
  { time: "5 PM", bookings: 10, capacity: 15 },
];

// Clinic Capacity Utilization Data
const capacityData = [
  { name: "Utilization", value: 78, fill: "#1d8a99" }
];

function getTodayString() {
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return today.toLocaleDateString('en-US', options);
}

const patientStatsOptions = [
  { label: "Last 12 Months", value: "months" },
  { label: "This Week", value: "currentWeek" },
  { label: "Week Days", value: "week" },
];

// Icons8 Line Awesome Icons for Dental Dashboard
const ToothIcon = () => <i className="las la-tooth text-2xl"></i>;

// Dynamic Y-axis domain calculator
const calculateYAxisDomain = (data, dataKeys, paddingPercent = 0.15) => {
  if (!data || data.length === 0) return [0, 100];

  // Handle both single key and multiple keys
  const keys = Array.isArray(dataKeys) ? dataKeys : [dataKeys];

  // Find min and max values across all specified keys
  let minValue = Infinity;
  let maxValue = -Infinity;

  data.forEach(item => {
    keys.forEach(key => {
      const value = item[key];
      if (value !== null && value !== undefined && !isNaN(value)) {
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }
    });
  });

  // If no valid data, return default
  if (minValue === Infinity || maxValue === -Infinity) return [0, 100];

  // Calculate padding
  const range = maxValue - minValue;
  const padding = range * paddingPercent;

  // Apply padding
  let domainMin = Math.max(0, minValue - padding); // Don't go below 0
  let domainMax = maxValue + padding;

  // Round to nice numbers
  const niceMin = Math.floor(domainMin / getNiceStep(domainMin, domainMax)) * getNiceStep(domainMin, domainMax);
  const niceMax = Math.ceil(domainMax / getNiceStep(domainMin, domainMax)) * getNiceStep(domainMin, domainMax);

  return [niceMin, niceMax];
};

// Helper function to get nice step size
const getNiceStep = (min, max) => {
  const range = max - min;
  const roughStep = range / 5; // Aim for about 5 ticks

  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalizedStep = roughStep / magnitude;

  // Choose nice step sizes
  const niceSteps = [1, 2, 5, 10];
  let bestStep = 1;

  for (const step of niceSteps) {
    if (step >= normalizedStep) {
      bestStep = step;
      break;
    }
  }

  return bestStep * magnitude;
};
const CalendarCheckIcon = () => <i className="las la-calendar-check text-2xl"></i>;
const ChairIcon = () => <i className="las la-procedures text-2xl"></i>;
const TreatmentIcon = () => <i className="las la-syringe text-2xl"></i>;
const QualityIcon = () => <i className="las la-star text-2xl"></i>;
const ClockIcon = () => <i className="las la-clock text-2xl"></i>;
const ActivityIcon = () => <i className="las la-heartbeat text-2xl"></i>;

// Metric Card Component with dental icons
const MetricCard = ({ title, value, change, changeType, sub, weekData, onClick, icon }) => {
  const getIcon = () => {
    if (icon === 'tooth') return <ToothIcon />;
    if (icon === 'calendar') return <CalendarCheckIcon />;
    if (icon === 'chair') return <ChairIcon />;
    return <ToothIcon />;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 min-w-0 hover:shadow-md transition cursor-pointer" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-green-50 rounded-lg text-green-600">
            {getIcon()}
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {title}
          </span>
        </div>
        <button className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          See Details
        </button>
      </div>
      <div className="text-2xl font-bold text-gray-900 leading-tight">{value.toLocaleString()}</div>
      <div className="flex items-center gap-1 text-xs">
        <span className={changeType === "up" ? "text-green-500" : "text-red-500"}>{changeType === "up" ? "▲" : "▼"} {change}</span>
        <span className="text-gray-400">{sub}</span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("months");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clinicData, setClinicData] = useState(null);
  const [userData, setUserData] = useState(null);
  
  // Real metrics data from API - Dental specific
  const [metrics, setMetrics] = useState([
    { title: "Total Patients", value: 0, change: "0%", changeType: "up", sub: "vs last week", weekData, icon: "tooth" },
    { title: "Appointments Today", value: 0, change: "0%", changeType: "up", sub: "vs yesterday", weekData, icon: "calendar" },
    { title: "Chair Capacity", value: 0, change: "0%", changeType: "up", sub: "utilization", weekData, icon: "chair" },
  ]);
  const [patientStatsData, setPatientStatsData] = useState(patientStatsDataByMonth);
  const [venueVisitorDataState, setVenueVisitorDataState] = useState(venueVisitorData);
  const [revenueDataState, setRevenueDataState] = useState(revenueData);
  const [capacityDataState, setCapacityDataState] = useState(capacityData);
  const [treatmentStatsData, setTreatmentStatsData] = useState([]);
  const [appointmentQualityData, setAppointmentQualityData] = useState(null);
  const [chairDetailsData, setChairDetailsData] = useState(null);
  const [clinicPerformanceData, setClinicPerformanceData] = useState(null);
  const [patientMapData, setPatientMapData] = useState([]);
  const [compareClinicIds, setCompareClinicIds] = useState('');
  const [revenuePeriod, setRevenuePeriod] = useState('week');
  const [showRevenueDropdown, setShowRevenueDropdown] = useState(false);

  // Chat panel states
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: 'Hi! I\'m your AI dental assistant. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Drawer states
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [drawerData, setDrawerData] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  
  // Dashboard customization states
  const [isEditMode, setIsEditMode] = useState(false);
  const [showCustomizeDrawer, setShowCustomizeDrawer] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState({
    patientStats: true,
    demographics: true,
    revenue: true,
    appointments: true,
    dentalChairs: true,
    chairUtilization: true,
    clinicPerformance: true,
    patientMap: true,
    treatments: true,
    quality: true
  });

  // Fetch dashboard metrics
  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      try {
        const metricsData = await api.get("/dashboard/metrics");
        
        setMetrics([
          { 
            title: "Total Patients", 
            value: metricsData.total_patients.value, 
            change: `${metricsData.total_patients.change >= 0 ? '+' : ''}${metricsData.total_patients.change}%`, 
            changeType: metricsData.total_patients.change_type, 
            sub: "vs last week", 
            weekData,
            icon: "tooth",
            apiData: metricsData.total_patients
          },
          { 
            title: "Appointments Today", 
            value: metricsData.appointments_today?.value || 0, 
            change: `${metricsData.appointments_today?.change >= 0 ? '+' : ''}${metricsData.appointments_today?.change || 0}%`, 
            changeType: metricsData.appointments_today?.change_type || "up", 
            sub: "vs yesterday", 
            weekData,
            icon: "calendar",
            apiData: metricsData.appointments_today
          },
          { 
            title: "Chair Capacity", 
            value: `${metricsData.chair_capacity?.utilization || 0}%`, 
            change: `${metricsData.chair_capacity?.chairs_occupied || 0}/${metricsData.chair_capacity?.total_chairs || 0}`, 
            changeType: "up", 
            sub: "chairs occupied", 
            weekData,
            icon: "chair",
            apiData: metricsData.chair_capacity
          },
        ]);
      } catch (error) {
        console.error("Error fetching dashboard metrics:", error);
      }
    };
    
    fetchDashboardMetrics();
  }, []);
  
  // Fetch clinic and user data
  useEffect(() => {
    const fetchClinicData = async () => {
      try {
        const response = await api.get("/auth/me");
        setUserData(response);
        setClinicData(response.clinic);
      } catch (error) {
        console.error("Error fetching clinic data:", error);
      }
    };
    
    fetchClinicData();
  }, []);
  
  // Fetch patient statistics when timeRange changes
  useEffect(() => {
    const fetchPatientStats = async () => {
      try {
        const data = await api.get(`/dashboard/patient-stats?period=${timeRange}`);
        setPatientStatsData(data);
      } catch (error) {
        console.error("Error fetching patient stats:", error);
      }
    };
    
    fetchPatientStats();
  }, [timeRange]);
  
  // Fetch demographics
  useEffect(() => {
    const fetchDemographics = async () => {
      try {
        const data = await api.get("/dashboard/demographics");
        setVenueVisitorDataState(data);
      } catch (error) {
        console.error("Error fetching demographics:", error);
      }
    };
    
    fetchDemographics();
  }, []);

  // Fetch clinic performance data
  useEffect(() => {
    const fetchClinicPerformance = async () => {
      try {
        const data = await api.get("/dashboard/clinic-performance", {
          params: compareClinicIds ? { compare_clinic_ids: compareClinicIds } : {}
        });
        setClinicPerformanceData(data);
      } catch (error) {
        console.error("Error fetching clinic performance:", error);
      }
    };

    fetchClinicPerformance();
  }, [compareClinicIds]);

  // Fetch patient map data
  useEffect(() => {
    const fetchPatientLocations = async () => {
      try {
        const data = await api.get("/dashboard/patient-locations");
        setPatientMapData(data);
      } catch (error) {
        console.error("Error fetching patient locations:", error);
      }
    };

    fetchPatientLocations();
  }, []);

  // Fetch revenue data
  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        const data = await api.get(`/dashboard/revenue?period=${revenuePeriod}`);
        setRevenueDataState(data);
      } catch (error) {
        console.error("Error fetching revenue:", error);
        // Fallback to static data if API fails
        setRevenueDataState(revenueData);
      }
    };

    fetchRevenue();
  }, [revenuePeriod]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showRevenueDropdown && !event.target.closest('.revenue-dropdown')) {
        setShowRevenueDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRevenueDropdown]);
  
  // Fetch capacity
  useEffect(() => {
    const fetchCapacity = async () => {
      try {
        const data = await api.get("/dashboard/capacity");
        setCapacityDataState([{ name: "Utilization", value: data.utilization, fill: "#1d8a99" }]);
      } catch (error) {
        console.error("Error fetching capacity:", error);
      }
    };
    
    fetchCapacity();
  }, []);
  
  // Fetch treatment statistics
  useEffect(() => {
    const fetchTreatments = async () => {
      try {
        const data = await api.get("/dashboard/treatments/stats?period=week");
        setTreatmentStatsData(data.treatments || []);
      } catch (error) {
        console.error("Error fetching treatments:", error);
      }
    };
    
    fetchTreatments();
  }, []);
  
  // Fetch appointment quality
  useEffect(() => {
    const fetchQuality = async () => {
      try {
        const data = await api.get("/dashboard/appointments/quality");
        setAppointmentQualityData(data);
      } catch (error) {
        console.error("Error fetching appointment quality:", error);
      }
    };
    
    fetchQuality();
  }, []);
  
  // Fetch detailed chair data
  useEffect(() => {
    const fetchChairDetails = async () => {
      try {
        const data = await api.get("/dashboard/chairs/status");
        setChairDetailsData(data);
      } catch (error) {
        console.error("Error fetching chair details:", error);
      }
    };
    
    fetchChairDetails();
  }, []);
  
  // Handle metric card click to open drawer
  const handleMetricClick = async (metric) => {
    setSelectedMetric(metric);
    setDrawerLoading(true);
    
    try {
      let data = [];
      
      if (metric.title === "Total Patients") {
        data = await api.get("/dashboard/patients/details?period=month");
      } else if (metric.title === "Appointments Today") {
        data = await api.get("/dashboard/appointments/today");
      } else if (metric.title === "Chair Capacity") {
        data = await api.get("/dashboard/chairs/status");
      }
      
      setDrawerData(data);
    } catch (error) {
      console.error("Error fetching drawer data:", error);
      setDrawerData([]);
    } finally {
      setDrawerLoading(false);
    }
  };
  
  const closeDrawer = () => {
    setSelectedMetric(null);
    setDrawerData([]);
  };
  
  // Load dashboard preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await api.get("/dashboard/preferences");
        if (prefs && prefs.visible_widgets) {
          setVisibleWidgets(prefs.visible_widgets);
        }
      } catch (error) {
        console.error("Error loading dashboard preferences:", error);
      }
    };
    
    loadPreferences();
  }, []);
  
  // Save dashboard preferences
  const savePreferences = async (newWidgets) => {
    try {
      await api.post("/dashboard/preferences", {
        visible_widgets: newWidgets
      });
      setVisibleWidgets(newWidgets);
    } catch (error) {
      console.error("Error saving dashboard preferences:", error);
    }
  };

  // Chat functions
  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsTyping(true);

    // Simulate AI response (will be replaced with OpenAI integration later)
    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'I\'m still learning! OpenAI integration with LangChain will be added soon. For now, I can help with basic dental queries.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  const toggleWidget = (widgetKey) => {
    const newWidgets = { ...visibleWidgets, [widgetKey]: !visibleWidgets[widgetKey] };
    savePreferences(newWidgets);
  };

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Get user's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Using OpenWeatherMap API (free tier)
            const API_KEY = 'YOUR_API_KEY'; // You'll need to get a free API key from openweathermap.org
            const response = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=imperial`
            );
            
            if (response.ok) {
              const data = await response.json();
              setWeather({
                temp: Math.round(data.main.temp),
                condition: data.weather[0].main,
                icon: data.weather[0].icon
              });
            } else {
              // Fallback to default weather if API fails
              setWeather({ temp: 72, condition: 'Sunny', icon: '01d' });
            }
            setLoading(false);
          }, () => {
            // Fallback if geolocation fails
            setWeather({ temp: 72, condition: 'Sunny', icon: '01d' });
            setLoading(false);
          });
        } else {
          // Fallback if geolocation not supported
          setWeather({ temp: 72, condition: 'Sunny', icon: '01d' });
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
        setWeather({ temp: 72, condition: 'Sunny', icon: '01d' });
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  // Weather icon mapping
  const getWeatherIcon = (iconCode) => {
    const iconMap = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '❄️', '13n': '❄️',
      '50d': '🌫️', '50n': '🌫️'
    };
    return iconMap[iconCode] || '☀️';
  };

  // Get clinic type description based on specialization
  const getClinicTypeDescription = (specialization) => {
    const descriptions = {
      'radiologist': 'radiology clinic',
      'dentist': 'dental clinic',
      'physiotherapist': 'physiotherapy clinic'
    };
    return descriptions[specialization] || 'medical clinic';
  };

  // Determine xKey based on data structure
  let xKey = "month";
  if (patientStatsData.length > 0 && patientStatsData[0].day) {
    xKey = "day";
  }
  
  // Calculate average
  const avg = Math.round(
    patientStatsData.reduce((sum, d) => sum + d.patient + (d.inpatient || 0), 0) /
      (patientStatsData.length || 1)
  );

  return (
    <div className="w-full h-full min-h-screen bg-gray-50 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {/* Heading and date */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {clinicData?.name ? `${clinicData.name} Dashboard` : 'Dashboard'}
            </h1>
            <div className="text-sm text-gray-600 mt-1">
              Overview and analytics of your {getClinicTypeDescription(clinicData?.specialization)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{getTodayString()}</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 justify-end">
                {loading ? (
                  <div className="animate-pulse">Loading weather...</div>
                ) : weather ? (
                  <>
                    <span className="text-lg">{getWeatherIcon(weather.icon)}</span>
                    <span>{weather.condition}, {weather.temp}°F</span>
                  </>
                ) : (
                  <span>Weather unavailable</span>
                )}
              </div>
            </div>
            
            {/* Customize Dashboard Icon Button */}
            <button 
              onClick={() => setShowCustomizeDrawer(true)}
              className="p-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Customize Dashboard"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="border-b border-gray-200 mt-4"></div>
      </div>
      {/* 3-metric cards in a single row, simple border, no shadow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {metrics.map((m) => (
          <MetricCard key={m.title} {...m} onClick={() => handleMetricClick(m)} />
        ))}
      </div>
      {/* First row of charts */}
      <div className="flex flex-wrap gap-6 mb-6">
        {/* Patient Statistics Bar Chart (2/3 width) */}
        {visibleWidgets.patientStats && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[500px] relative">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-3 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center justify-between mb-2 pr-10">
            <span className="font-semibold text-gray-800">Patient Statistics</span>
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="border rounded px-2 py-1 text-xs">
              {patientStatsOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={patientStatsData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" vertical={false} />
              <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={calculateYAxisDomain(patientStatsData, 'patient')} />
              <Tooltip contentStyle={{ borderRadius: 8, background: '#222', color: '#fff', fontSize: 13 }} cursor={{ fill: '#f3f4f6' }} formatter={(value, name) => name === 'patient' ? [`$${(value/1000).toFixed(1)}K`, 'Patient'] : [`$${(value/1000).toFixed(1)}K`, 'Inpatient']} />
              <ReferenceLine y={avg} stroke="#111" strokeDasharray="6 3" label={{ position: 'left', value: 'Avg', fill: '#fff', fontSize: 12, fontWeight: 600, background: '#111', padding: 4 }} />
              <Bar dataKey="patient" stackId="a" fill="#1d8a99" radius={0} />
              <Bar dataKey="inpatient" stackId="a" fill="#6ee7b7" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
        {/* Venue Visitor Semi-Donut Chart (1/3 width) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center relative flex-1 min-w-[300px]">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-3 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center justify-between w-full mb-2 pr-10">
            <span className="font-semibold text-gray-800">Patient Demographics</span>
            <button className="flex items-center gap-1 text-xs border rounded px-2 py-1">
              All Time
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <div className="relative flex items-center justify-center" style={{ width: 180, height: 140 }}>
            {/* Dotted ring background */}
            <svg width="140" height="140" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 0 }}>
              <circle cx="70" cy="70" r="56" fill="none" stroke="#e5e7eb" strokeWidth="6" strokeDasharray="2,6" />
            </svg>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={venueVisitorDataState}
                  dataKey="value"
                  startAngle={180}
                  endAngle={-180}
                  innerRadius={48}
                  outerRadius={65}
                  cx="50%"
                  cy="50%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {venueVisitorDataState.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ zIndex: 1 }}>
              <div className="text-xs text-gray-400">Total Patients</div>
              <div className="text-2xl font-bold text-gray-900">{venueVisitorDataState.reduce((sum, d) => sum + d.value, 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            {venueVisitorDataState.map((item, idx) => (
              <span key={item.name} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: item.color }}></span>
                <span className="text-gray-700 font-medium">{item.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Second row of charts */}
      <div className="flex flex-wrap gap-6 mb-6">
        {/* Revenue Analytics Line Chart */}
        {visibleWidgets.revenue && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px] relative">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-3 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center justify-between mb-2 pr-10">
            <span className="font-semibold text-gray-800">Revenue Analytics</span>
            <div className="relative revenue-dropdown">
              <button
                onClick={() => setShowRevenueDropdown(!showRevenueDropdown)}
                className="flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-gray-50 transition-colors"
              >
                {revenuePeriod === 'week' ? 'This Week' :
                 revenuePeriod === 'month' ? 'This Month' : 'This Year'}
                <svg className={`w-4 h-4 ml-1 transition-transform ${showRevenueDropdown ? 'rotate-180' : ''}`}
                     fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showRevenueDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[100px]">
                  <button
                    onClick={() => {
                      setRevenuePeriod('week');
                      setShowRevenueDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => {
                      setRevenuePeriod('month');
                      setShowRevenueDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => {
                      setRevenuePeriod('year');
                      setShowRevenueDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                  >
                    This Year
                  </button>
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueDataState}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={calculateYAxisDomain(revenueDataState, 'revenue')} />
              <Tooltip 
                contentStyle={{ borderRadius: 8, background: '#222', color: '#fff', fontSize: 13 }} 
                formatter={(value, name) => [
                  `₹${(value/1000).toFixed(1)}K`, 
                  name === 'revenue' ? 'Revenue' : 'Target'
                ]} 
              />
              <Line 
                type="monotone" 
                dataKey="target" 
                stroke="#e5e7eb" 
                strokeWidth={2} 
                strokeDasharray="5 5"
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#1d8a99" 
                strokeWidth={3} 
                dot={{ fill: '#1d8a99', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#1d8a99', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Appointment Booking Trends Bar Chart */}
        {visibleWidgets.appointments && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px] relative">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-3 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center justify-between mb-2 pr-10">
            <span className="font-semibold text-gray-800">Appointment Trends</span>
            <button className="flex items-center gap-1 text-xs border rounded px-2 py-1">
              Today
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={appointmentData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" vertical={false} />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={calculateYAxisDomain(appointmentData, ['bookings', 'capacity'])} />
              <Tooltip 
                contentStyle={{ borderRadius: 8, background: '#222', color: '#fff', fontSize: 13 }} 
                formatter={(value, name) => [
                  value, 
                  name === 'bookings' ? 'Bookings' : 'Capacity'
                ]} 
              />
              <Bar dataKey="capacity" fill="#e5e7eb" radius={2} />
              <Bar dataKey="bookings" fill="#6ee7b7" radius={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Dental Chair Status Visualization */}
        {visibleWidgets.dentalChairs && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center relative flex-1 min-w-[300px]">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-3 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center justify-between w-full mb-4 pr-10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 rounded-lg text-green-600">
                <ChairIcon />
              </div>
              <span className="font-semibold text-gray-800">Dental Chairs</span>
            </div>
            <button className="flex items-center gap-1 text-xs border rounded px-2 py-1">
              Live
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </button>
          </div>
          
          {/* Chair Grid Visualization */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[1, 2, 3, 4, 5].map((chairNum) => {
              const isOccupied = chairNum <= (capacityDataState[0]?.value || 0) / 20; // Rough calculation
              return (
                <div key={chairNum} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition ${
                    isOccupied ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 11V13H17V11H19V13C19 14.1 18.1 15 17 15V19H15V15H9V19H7V15C5.9 15 5 14.1 5 13V11H7M7 7C7 5.9 7.9 5 9 5H15C16.1 5 17 5.9 17 7V9H7V7Z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-600">#{chairNum}</span>
                </div>
              );
            })}
          </div>
          
          {/* Status Summary */}
          <div className="w-full bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-green-600"></span>
                <span className="text-gray-700">Occupied</span>
              </div>
              <span className="font-semibold text-gray-900">{Math.floor((capacityDataState[0]?.value || 0) / 20)}/5</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-gray-100"></span>
                <span className="text-gray-700">Available</span>
              </div>
              <span className="font-semibold text-gray-900">{5 - Math.floor((capacityDataState[0]?.value || 0) / 20)}/5</span>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Third row - New widgets for Chair Utilization, Treatments, and Quality */}
      <div className="flex flex-wrap gap-6 mb-6">
        {/* Chair Utilization Details */}
        {visibleWidgets.chairUtilization && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px]">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <ActivityIcon />
            </div>
            <span className="font-semibold text-gray-800">Chair Utilization</span>
          </div>
          
          {chairDetailsData && (
            <div className="space-y-3">
              {/* Utilization Percentage */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Active</span>
                  <span className="text-2xl font-bold text-green-600">{chairDetailsData.utilization_percent}%</span>
                </div>
                <div className="w-full bg-white rounded-full h-2 mt-2">
                  <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${chairDetailsData.utilization_percent}%` }}></div>
                </div>
              </div>
              
              {/* Idle Percentage */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Idle</span>
                  <span className="text-2xl font-bold text-gray-600">{chairDetailsData.idle_percent}%</span>
                </div>
                <div className="w-full bg-white rounded-full h-2 mt-2">
                  <div className="bg-gray-400 h-2 rounded-full transition-all" style={{ width: `${chairDetailsData.idle_percent}%` }}></div>
                </div>
              </div>
              
              {/* Time Breakdown */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <ClockIcon />
                  </div>
                  <div className="text-lg font-bold text-green-600">{chairDetailsData.active_hours}h</div>
                  <div className="text-xs text-gray-600">Active Time</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <ClockIcon />
                  </div>
                  <div className="text-lg font-bold text-gray-600">{chairDetailsData.idle_hours}h</div>
                  <div className="text-xs text-gray-600">Idle Time</div>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Treatment Statistics */}
        {visibleWidgets.treatments && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px] relative">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-3 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center justify-between mb-4 pr-10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <TreatmentIcon />
              </div>
              <span className="font-semibold text-gray-800">Treatments</span>
            </div>
            <button className="flex items-center gap-1 text-xs border rounded px-2 py-1">
              This Week
            </button>
          </div>
          
          <div className="space-y-2 flex-1">
            {treatmentStatsData.slice(0, 5).map((treatment, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: treatment.color }}></div>
                  <span className="text-sm text-gray-700 truncate">{treatment.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{treatment.percentage}%</span>
                  <span className="text-sm font-semibold text-gray-900">{treatment.count}</span>
                </div>
              </div>
            ))}
            {treatmentStatsData.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                No treatment data available
              </div>
            )}
          </div>
        </div>
        )}

        {/* Appointment Quality */}
        {visibleWidgets.quality && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px] relative">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-3 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 mb-4 pr-10">
            <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
              <QualityIcon />
            </div>
            <span className="font-semibold text-gray-800">Appointment Quality</span>
          </div>
          
          {appointmentQualityData && (
            <div className="space-y-3">
              {/* Overall Quality Score */}
              <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-3 text-center">
                <div className="text-3xl font-bold text-yellow-600">{appointmentQualityData.quality_score}</div>
                <div className="text-xs text-gray-600 mt-1">Overall Quality Score</div>
              </div>
              
              {/* Quality Metrics */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Completion Rate</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${appointmentQualityData.completion_rate}%` }}></div>
                    </div>
                    <span className="font-semibold text-gray-900 w-10 text-right">{appointmentQualityData.completion_rate}%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">On-Time Rate</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${appointmentQualityData.on_time_rate}%` }}></div>
                    </div>
                    <span className="font-semibold text-gray-900 w-10 text-right">{appointmentQualityData.on_time_rate}%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Satisfaction</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-yellow-600 h-1.5 rounded-full" style={{ width: `${appointmentQualityData.satisfaction_rate}%` }}></div>
                    </div>
                    <span className="font-semibold text-gray-900 w-10 text-right">{appointmentQualityData.satisfaction_rate}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Clinic Performance Comparison */}
        {visibleWidgets.clinicPerformance && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px] relative">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-10 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center justify-between mb-4 pr-16">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <i className="las la-trophy text-2xl"></i>
              </div>
              <span className="font-semibold text-gray-800">Clinic Performance</span>
            </div>
            <button
              onClick={() => {/* Open settings for clinic comparison */}}
              className="p-1 hover:bg-gray-100 rounded"
              title="Compare with other clinics"
            >
              <i className="las la-cog text-gray-400"></i>
            </button>
          </div>

          {clinicPerformanceData ? (
            <div className="space-y-4">
              {/* Current Clinic */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">Current Clinic</span>
                  <span className="text-xs text-gray-500">{clinicPerformanceData.current_clinic.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-green-600">{clinicPerformanceData.current_clinic.metrics.appointments_count}</div>
                    <div className="text-gray-500">Appointments</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">₹{clinicPerformanceData.current_clinic.metrics.revenue.toLocaleString()}</div>
                    <div className="text-gray-500">Revenue</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-yellow-600">{clinicPerformanceData.current_clinic.metrics.satisfaction_score}%</div>
                    <div className="text-gray-500">Satisfaction</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-purple-600">{clinicPerformanceData.current_clinic.metrics.chair_utilization}%</div>
                    <div className="text-gray-500">Utilization</div>
                  </div>
                </div>
              </div>

              {/* Comparison Clinics */}
              {clinicPerformanceData.comparisons.map((clinic, index) => (
                <div key={clinic.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Clinic {index + 1}</span>
                    <span className="text-xs text-gray-500">{clinic.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{clinic.metrics.appointments_count}</div>
                      <div className="text-gray-500">Appointments</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">₹{clinic.metrics.revenue.toLocaleString()}</div>
                      <div className="text-gray-500">Revenue</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <div className="text-center">
                <i className="las la-chart-line text-2xl mb-2"></i>
                <div className="text-sm">Loading performance data...</div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Patient Location Map */}
        {visibleWidgets.patientMap && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px] relative">
          {/* AI Star Icon */}
          <button
            onClick={() => setShowChatPanel(true)}
            className="absolute top-3 right-3 p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md z-10"
            title="Ask AI Assistant"
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 mb-4 pr-10">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <i className="las la-map-marked-alt text-2xl"></i>
            </div>
            <span className="font-semibold text-gray-800">Patient Locations</span>
          </div>

          {patientMapData && patientMapData.length > 0 ? (
            <div className="space-y-3">
              {/* Simple map representation */}
              <div className="bg-gray-100 rounded-lg h-32 flex items-center justify-center text-gray-500 mb-4">
                <div className="text-center">
                  <i className="las la-map text-3xl mb-1"></i>
                  <div className="text-xs">Patient Distribution Map</div>
                </div>
              </div>

              {/* Location list */}
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {patientMapData.slice(0, 5).map((location, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-gray-700">{location.location}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{location.count} patients</span>
                  </div>
                ))}
                {patientMapData.length > 5 && (
                  <div className="text-xs text-gray-500 text-center pt-1">
                    +{patientMapData.length - 5} more locations
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <div className="text-center">
                <i className="las la-map-marker text-2xl mb-2"></i>
                <div className="text-sm">Loading location data...</div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Metric Details Drawer */}
      {selectedMetric && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={closeDrawer}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedMetric.title} Details</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedMetric.apiData?.this_week || 0} this week, {selectedMetric.apiData?.last_week || 0} last week
                </p>
              </div>
              <button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {drawerLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                </div>
              ) : drawerData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-lg font-medium">No data available</p>
                  <p className="text-sm mt-1">Start adding {selectedMetric.title.toLowerCase()} to see them here</p>
                </div>
              ) : selectedMetric.title === "Total Patients" ? (
                <div className="space-y-3">
                  {drawerData.map((item, idx) => (
                    <div key={item.id || idx} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{item.name || `Patient #${item.id}`}</h4>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                            {item.age && <div><span className="font-medium">Age:</span> {item.age}</div>}
                            {item.gender && <div><span className="font-medium">Gender:</span> {item.gender}</div>}
                            {item.phone && <div><span className="font-medium">Phone:</span> {item.phone}</div>}
                            {item.village && <div><span className="font-medium">Location:</span> {item.village}</div>}
                            {item.treatment_type && <div className="col-span-2"><span className="font-medium">Treatment:</span> {item.treatment_type}</div>}
                          </div>
                          {item.created_at && (
                            <div className="text-xs text-gray-500 mt-2">
                              Added: {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedMetric.title === "Appointments Today" ? (
                <div className="space-y-3">
                  {drawerData.map((item, idx) => (
                    <div key={item.id || idx} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-green-50 rounded-lg text-green-600">
                              <CalendarCheckIcon />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{item.name}</h4>
                              {item.time && <p className="text-xs text-gray-500">{item.time}</p>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-gray-600">
                            {item.age && <div><span className="font-medium">Age:</span> {item.age}</div>}
                            {item.gender && <div><span className="font-medium">Gender:</span> {item.gender}</div>}
                            {item.phone && <div><span className="font-medium">Phone:</span> {item.phone}</div>}
                            {item.treatment_type && <div><span className="font-medium">Treatment:</span> {item.treatment_type}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedMetric.title === "Chair Capacity" && drawerData.chairs ? (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-green-600">{drawerData.chairs_occupied}</div>
                      <div className="text-sm text-gray-600 mt-1">Occupied Chairs</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-gray-600">{drawerData.chairs_available}</div>
                      <div className="text-sm text-gray-600 mt-1">Available Chairs</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {drawerData.chairs.map((chair) => (
                      <div key={chair.chair_number} className={`rounded-lg p-4 flex items-center justify-between ${
                        chair.status === 'occupied' ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${chair.status === 'occupied' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            <ChairIcon />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">Chair #{chair.chair_number}</div>
                            {chair.patient_name && <div className="text-sm text-gray-600">{chair.patient_name}</div>}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          chair.status === 'occupied' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {chair.status === 'occupied' ? 'Occupied' : 'Available'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {drawerData.map((item, idx) => (
                    <div key={item.id || idx} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">Report #{item.id}</h4>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                            <div><span className="font-medium">Patient ID:</span> {item.patient_id}</div>
                            <div><span className="font-medium">Status:</span> <span className={`px-2 py-1 rounded text-xs ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : item.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{item.status}</span></div>
                          </div>
                          {item.created_at && (
                            <div className="text-xs text-gray-500 mt-2">
                              Created: {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Showing {drawerData.length} {drawerData.length === 1 ? 'item' : 'items'}
                </div>
                <button onClick={closeDrawer} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customize Dashboard Drawer */}
      {showCustomizeDrawer && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowCustomizeDrawer(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Customize Dashboard</h3>
                <p className="text-sm text-gray-600 mt-1">Choose which widgets to display</p>
              </div>
              <button onClick={() => setShowCustomizeDrawer(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Patient Statistics Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <i className="fi fi-sr-chart-histogram text-xl text-blue-600"></i>
                    <div>
                      <div className="font-semibold text-gray-900">Patient Statistics</div>
                      <div className="text-xs text-gray-600">Bar chart showing patient trends</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={visibleWidgets.patientStats}
                      onChange={() => toggleWidget('patientStats')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Demographics Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <i className="fi fi-sr-chart-pie text-xl text-purple-600"></i>
                    <div>
                      <div className="font-semibold text-gray-900">Patient Demographics</div>
                      <div className="text-xs text-gray-600">Gender distribution pie chart</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={visibleWidgets.demographics}
                      onChange={() => toggleWidget('demographics')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Revenue Analytics Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <i className="fi fi-sr-chart-line-up text-xl text-green-600"></i>
                    <div>
                      <div className="font-semibold text-gray-900">Revenue Analytics</div>
                      <div className="text-xs text-gray-600">Weekly revenue line chart</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={visibleWidgets.revenue}
                      onChange={() => toggleWidget('revenue')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Appointment Trends Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <i className="fi fi-sr-calendar-check text-xl text-orange-600"></i>
                    <div>
                      <div className="font-semibold text-gray-900">Appointment Trends</div>
                      <div className="text-xs text-gray-600">Daily appointment bookings</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={visibleWidgets.appointments}
                      onChange={() => toggleWidget('appointments')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Dental Chairs Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <ChairIcon />
                    <div>
                      <div className="font-semibold text-gray-900">Dental Chairs Grid</div>
                      <div className="text-xs text-gray-600">Live chair status visualization</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={visibleWidgets.dentalChairs}
                      onChange={() => toggleWidget('dentalChairs')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Chair Utilization Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <ActivityIcon />
                    <div>
                      <div className="font-semibold text-gray-900">Chair Utilization</div>
                      <div className="text-xs text-gray-600">Active vs idle time metrics</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={visibleWidgets.chairUtilization}
                      onChange={() => toggleWidget('chairUtilization')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Treatments Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <TreatmentIcon />
                    <div>
                      <div className="font-semibold text-gray-900">Treatment Statistics</div>
                      <div className="text-xs text-gray-600">Treatment type breakdown</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={visibleWidgets.treatments}
                      onChange={() => toggleWidget('treatments')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Quality Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <QualityIcon />
                    <div>
                      <div className="font-semibold text-gray-900">Appointment Quality</div>
                      <div className="text-xs text-gray-600">Quality metrics and scores</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleWidgets.quality}
                      onChange={() => toggleWidget('quality')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Clinic Performance Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <i className="las la-trophy text-2xl text-purple-600"></i>
                    <div>
                      <div className="font-semibold text-gray-900">Clinic Performance</div>
                      <div className="text-xs text-gray-600">Compare clinic metrics</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleWidgets.clinicPerformance}
                      onChange={() => toggleWidget('clinicPerformance')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* Patient Map Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <i className="las la-map-marked-alt text-2xl text-red-600"></i>
                    <div>
                      <div className="font-semibold text-gray-900">Patient Locations</div>
                      <div className="text-xs text-gray-600">Geographic patient distribution</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleWidgets.patientMap}
                      onChange={() => toggleWidget('patientMap')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <button 
                onClick={() => setShowCustomizeDrawer(false)} 
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Chat Button */}
      <button
        onClick={() => setShowChatPanel(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 z-40 group"
        title="AI Dental Assistant"
      >
        <div className="relative">
          {/* Teeth Icon */}
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C10.34 2 9 3.34 9 5C9 5.87 9.32 6.67 9.84 7.28C8.78 8.13 8 9.46 8 11C8 11.7 8.13 12.36 8.37 12.97C7.55 13.23 6.87 13.77 6.42 14.47C5.97 15.17 5.76 16 5.76 16.84C5.76 18.58 7.18 20 8.92 20C10.2 20 11.3 19.23 11.78 18.13C11.92 18.21 12.07 18.26 12.22 18.26C12.37 18.26 12.52 18.21 12.66 18.13C13.14 19.23 14.24 20 15.52 20C17.26 20 18.68 18.58 18.68 16.84C18.68 16 18.47 15.17 18.02 14.47C17.57 13.77 16.89 13.23 16.07 12.97C16.31 12.36 16.44 11.7 16.44 11C16.44 9.46 15.66 8.13 14.6 7.28C15.12 6.67 15.44 5.87 15.44 5C15.44 3.34 14.1 2 12.44 2H12Z"/>
          </svg>
          {/* AI Sparkle Effect */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse">
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping"></div>
          </div>
        </div>
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          AI Dental Assistant
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      </button>

      {/* AI Chat Panel */}
      {showChatPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            onClick={() => setShowChatPanel(false)}
          />

          {/* Chat Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C10.34 2 9 3.34 9 5C9 5.87 9.32 6.67 9.84 7.28C8.78 8.13 8 9.46 8 11C8 11.7 8.13 12.36 8.37 12.97C7.55 13.23 6.87 13.77 6.42 14.47C5.97 15.17 5.76 16 5.76 16.84C5.76 18.58 7.18 20 8.92 20C10.2 20 11.3 19.23 11.78 18.13C11.92 18.21 12.07 18.26 12.22 18.26C12.37 18.26 12.52 18.21 12.66 18.13C13.14 19.23 14.24 20 15.52 20C17.26 20 18.68 18.58 18.68 16.84C18.68 16 18.47 15.17 18.02 14.47C17.57 13.77 16.89 13.23 16.07 12.97C16.31 12.36 16.44 11.7 16.44 11C16.44 9.46 15.66 8.13 14.6 7.28C15.12 6.67 15.44 5.87 15.44 5C15.44 3.34 14.1 2 12.44 2H12Z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI Dental Assistant</h3>
                  <p className="text-xs text-gray-600">Powered by OpenAI & LangChain</p>
                </div>
              </div>
              <button
                onClick={() => setShowChatPanel(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.type === 'user' ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-2xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about dental care, treatments, or clinic data..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-full hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                AI integration with OpenAI & LangChain coming soon
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard; 