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
  
  // Drawer states
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [drawerData, setDrawerData] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  
  // Dashboard customization states
  const [isEditMode, setIsEditMode] = useState(false);
  const [showCustomizeDrawer, setShowCustomizeDrawer] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState({
    patientStats: true,
    demographics: true,
    revenue: true,
    appointments: true,
    dentalChairs: true,
    chairUtilization: true,
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
  
  // Fetch revenue data
  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        const data = await api.get("/dashboard/revenue?period=week");
        setRevenueDataState(data);
      } catch (error) {
        console.error("Error fetching revenue:", error);
      }
    };
    
    fetchRevenue();
  }, []);
  
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
            <button 
              onClick={() => setShowCustomizeDrawer(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <i className="fi fi-sr-settings text-lg"></i>
              <span className="text-sm font-medium text-gray-700">Customize Dashboard</span>
            </button>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{getTodayString()}</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
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
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[500px]">
          <div className="flex items-center justify-between mb-2">
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
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={[0, 'dataMax + 2000']} />
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
          <div className="flex items-center justify-between w-full mb-2">
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
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-800">Revenue Analytics</span>
            <button className="flex items-center gap-1 text-xs border rounded px-2 py-1">
              This Week
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueDataState}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={[0, 'dataMax + 10000']} />
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
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px]">
          <div className="flex items-center justify-between mb-2">
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
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={[0, 'dataMax + 5']} />
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
          <div className="flex items-center justify-between w-full mb-4">
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
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px]">
          <div className="flex items-center justify-between mb-4">
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
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col flex-1 min-w-[300px]">
          <div className="flex items-center gap-2 mb-4">
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
    </div>
  );
};

export default Dashboard; 