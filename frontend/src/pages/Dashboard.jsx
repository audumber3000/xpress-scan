import React, { useState, useEffect } from "react";
import Card from "../components/Card";
import GearLoader from "../components/GearLoader";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, PieChart, Pie, Cell, CartesianGrid, ReferenceLine, Label, LineChart, Line, Area, AreaChart, RadialBarChart, RadialBar } from "recharts";


// Format number to k notation (e.g., 10000 -> 10k, 10200 -> 10.2k)
const formatToK = (value) => {
  if (value >= 1000) {
    const kValue = value / 1000;
    return kValue % 1 === 0 ? `${kValue}k` : `${kValue.toFixed(1)}k`;
  }
  return value.toString();
};




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
  const step = getNiceStep(domainMin, domainMax);
  const niceMin = Math.floor(domainMin / step) * step;
  // Reduce the floor to 2 steps for very small data to make it look "bigger"
  const minSteps = domainMax > 10 ? 5 : 2;
  const niceMax = Math.max(Math.ceil(domainMax / step) * step, domainMin + step * minSteps);

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

  const finalStep = bestStep * magnitude;
  // For dashboard metrics (counts/currency), avoid fractional steps unless very small
  return finalStep < 1 && range > 1 ? 1 : (finalStep || 1);
};
const CalendarCheckIcon = () => <i className="las la-calendar-check text-2xl"></i>;
const ChairIcon = () => <i className="las la-procedures text-2xl"></i>;
const TreatmentIcon = () => <i className="las la-syringe text-2xl"></i>;
const QualityIcon = () => <i className="las la-star text-2xl"></i>;
const ClockIcon = () => <i className="las la-clock text-2xl"></i>;
const ActivityIcon = () => <i className="las la-heartbeat text-2xl"></i>;
const RevenueIcon = () => <i className="las la-money-bill-wave text-2xl opacity-80"></i>;

// Purple AI Sparkle Icon Component (two four-pointed stars)
const AISparkleIcon = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Larger star */}
    <path 
      d="M12 2L13.5 6.5L18 8L13.5 9.5L12 14L10.5 9.5L6 8L10.5 6.5L12 2Z" 
      fill="url(#purpleGradient1)" 
      stroke="#2a276e" 
      strokeWidth="1.5"
    />
    {/* Smaller star */}
    <path 
      d="M18 16L18.75 18.25L21 19L18.75 19.75L18 22L17.25 19.75L15 19L17.25 18.25L18 16Z" 
      fill="url(#purpleGradient2)" 
      stroke="#2a276e" 
      strokeWidth="1.5"
    />
    <defs>
      <linearGradient id="purpleGradient1" x1="12" y1="2" x2="12" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#9B8CFF" />
        <stop offset="100%" stopColor="#2a276e" />
      </linearGradient>
      <linearGradient id="purpleGradient2" x1="18" y1="16" x2="18" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#9B8CFF" />
        <stop offset="100%" stopColor="#2a276e" />
      </linearGradient>
    </defs>
  </svg>
);
// Standardized Chart Card Component for Dashboard Widgets
const ChartCard = ({ 
  title, 
  icon, 
  children, 
  loading, 
  isEmpty, 
  onAISparkle, 
  minWidth = "md:min-w-[300px]",
  flexClass = "flex-1"
}) => {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-6 flex flex-col ${flexClass} min-w-0 ${minWidth} relative shadow-sm hover:shadow-md transition-all duration-300`}>
      {/* AI Sparkle Icon Button */}
      {onAISparkle && (
        <button
          onClick={onAISparkle}
          className="absolute top-5 right-5 p-2 bg-white border border-[#2a276e]/10 rounded-full hover:bg-[#201d5a] hover:text-white text-[#2a276e] transition-all duration-200 transform hover:scale-110 shadow-sm z-10"
          title="Ask AI Assistant"
        >
          <AISparkleIcon className="w-3.5 h-3.5" />
        </button>
      )}
      
      {/* Standardized Header */}
      <div className="flex items-center justify-between mb-6 pr-12">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#f0f0fd] rounded-xl text-[#2a276e] border border-[#c5c2f0]/30 shadow-sm">
            {icon}
          </div>
          <h3 className="font-bold text-gray-900 tracking-tight text-lg">{title}</h3>
        </div>
        
        {/* Removed Sync Status Badge */}
      </div>

      {/* Content Area */}
      <div className="flex-1 relative min-h-[220px]">
        {loading || isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <GearLoader size="w-10 h-10" />
          </div>
        ) : children}
      </div>
    </div>
  );
};

// Metric Card Component with dental icons
const MetricCard = ({ title, value, change, changeType, onClick, icon }) => {
  const getIcon = () => {
    if (icon === 'tooth') return <ToothIcon />;
    if (icon === 'calendar') return <CalendarCheckIcon />;
    if (icon === 'chair') return <ChairIcon />;
    if (icon === 'revenue') return <RevenueIcon />;
    return <ToothIcon />;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 min-w-0 hover:shadow-md transition cursor-pointer" onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#9B8CFF]/10 rounded-lg text-[#2a276e]">
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
      <div className="text-2xl font-bold text-gray-900 leading-tight">
        {icon === 'revenue' ? '₹' : ''}{value.toLocaleString()}
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className={changeType === "up" ? "text-green-600" : "text-red-500"}>
          {changeType === "up" ? "▲" : "▼"} {Math.abs(change)}% vs last prev.
        </span>
      </div>
    </div>
  );
};


const Dashboard = () => {
  useAuth();

  const [globalPeriod, setGlobalPeriod] = useState("month"); // today, yesterday, 7days, month
  const [clinicData, setClinicData] = useState(null);
  
  // Real metrics data from API - Dental specific
  const [metrics, setMetrics] = useState([
    { title: "Total Patients", value: 0, change: 0, changeType: "up", icon: "tooth" },
    { title: "Appointments", value: 0, change: 0, changeType: "up", icon: "calendar" },
    { title: "Checking", value: 0, change: 0, changeType: "up", icon: "chair" },
    { title: "Revenue", value: 0, change: 0, changeType: "up", icon: "revenue" },
  ]);
  const [patientStatsData, setPatientStatsData] = useState([]);
  const [venueVisitorDataState, setVenueVisitorDataState] = useState([]);
  const [revenueDataState, setRevenueDataState] = useState([]);
  const [appointmentDataState, setAppointmentDataState] = useState([]);
  
  // Loading states for each graph
  const [loadingPatientStats, setLoadingPatientStats] = useState(true);
  const [loadingDemographics, setLoadingDemographics] = useState(true);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);


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

  const [showCustomizeDrawer, setShowCustomizeDrawer] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState({
    patientStats: true,
    demographics: true,
    revenue: true,
    appointments: true
  });

  // Fetch dashboard metrics
  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      try {
        const metricsData = await api.get(`/dashboard/metrics?period=${globalPeriod}`);
        
        setMetrics([
          { 
            title: "Total Patients", 
            value: metricsData.total_patients.value, 
            change: metricsData.total_patients.change, 
            changeType: metricsData.total_patients.change_type, 
            icon: "tooth"
          },
          { 
            title: "Appointments", 
            value: metricsData.appointments.value, 
            change: metricsData.appointments.change, 
            changeType: metricsData.appointments.change_type, 
            icon: "calendar"
          },
          { 
            title: "Checking", 
            value: metricsData.checking.value, 
            change: metricsData.checking.change, 
            changeType: metricsData.checking.change_type, 
            icon: "chair"
          },
          { 
            title: "Revenue", 
            value: metricsData.revenue.value, 
            change: metricsData.revenue.change, 
            changeType: metricsData.revenue.change_type, 
            icon: "revenue"
          },
        ]);
      } catch (error) {
        console.error("Error fetching dashboard metrics:", error);
      }
    };
    
    fetchDashboardMetrics();
  }, [globalPeriod]);
  
  // Fetch clinic and user data
  useEffect(() => {
    const fetchClinicData = async () => {
      try {
        const response = await api.get("/auth/me");
        setClinicData(response.clinic);
      } catch (error) {
        console.error("Error fetching clinic data:", error);
      }
    };
    
    fetchClinicData();
  }, []);
  
  // Fetch patient statistics when globalPeriod changes
  useEffect(() => {
    const fetchPatientStats = async () => {
      setLoadingPatientStats(true);
      try {
        const data = await api.get(`/dashboard/patient-stats?period=${globalPeriod}`);
        setPatientStatsData(data);
      } catch (error) {
        console.error("Error fetching patient stats:", error);
        setPatientStatsData([]);
      } finally {
        setLoadingPatientStats(false);
      }
    };
    
    fetchPatientStats();
  }, [globalPeriod]);
  
  // Fetch demographics when globalPeriod changes
  useEffect(() => {
    const fetchDemographics = async () => {
      setLoadingDemographics(true);
      try {
        const data = await api.get(`/dashboard/demographics?period=${globalPeriod}`);
        setVenueVisitorDataState(data);
      } catch (error) {
        console.error("Error fetching demographics:", error);
        setVenueVisitorDataState([]);
      } finally {
        setLoadingDemographics(false);
      }
    };
    
    fetchDemographics();
  }, [globalPeriod]);

  // Removed clinic performance and location sync as they are no longer needed

  // Fetch revenue data when globalPeriod changes
  useEffect(() => {
    const fetchRevenue = async () => {
      setLoadingRevenue(true);
      try {
        const data = await api.get(`/dashboard/revenue?period=${globalPeriod}`);
        setRevenueDataState(data);
      } catch (error) {
        console.error("Error fetching revenue:", error);
        setRevenueDataState([]);
      } finally {
        setLoadingRevenue(false);
      }
    };
    
    fetchRevenue();
  }, [globalPeriod]);


  

  
  // Fetch appointment trends when globalPeriod changes
  useEffect(() => {
    const fetchAppointmentTrends = async () => {
      setLoadingAppointments(true);
      try {
        // Reuse the patient stats endpoint logic or similar for trends if needed, 
        // but for now we follow the global period
        const data = await api.get(`/dashboard/appointments/trends?period=${globalPeriod}`);
        if (data && Array.isArray(data)) {
          setAppointmentDataState(data);
        } else {
          setAppointmentDataState([]);
        }
      } catch (error) {
        console.error("Error fetching appointment trends:", error);
        setAppointmentDataState([]);
      } finally {
        setLoadingAppointments(false);
      }
    };
    
    fetchAppointmentTrends();
  }, [globalPeriod]);
  
  // Removed treatments, quality and chair details fetch as they are no longer needed
  
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


  // Get clinic type description based on specialization
  const getClinicTypeDescription = (specialization) => {
    const descriptions = {
      'radiologist': 'radiology clinic',
      'dentist': 'dental clinic',
      'physiotherapist': 'physiotherapy clinic'
    };
    return descriptions[specialization] || 'medical clinic';
  };

  // Use label as the consistent X-axis key from backend
  const xKey = "label";
  


  return (
    <div className="w-full h-full min-h-screen bg-gray-50 p-4 md:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {/* Heading and date */}
      <div className="mb-6 md:mb-8 mt-12 md:mt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2a276e] tracking-tight">
              Dashboard
            </h1>
            <div className="text-sm md:text-base text-gray-500 font-medium mt-1">
              Welcome back to your {getClinicTypeDescription(clinicData?.specialization || 'medical clinic')}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Global Time Filter */}
            <div className="relative group">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-[#9B8CFF]/50">
                <i className="las la-calendar text-[#9B8CFF] text-lg"></i>
                <select 
                  value={globalPeriod} 
                  onChange={(e) => setGlobalPeriod(e.target.value)}
                  className="text-sm font-bold text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer pr-8"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>

            {/* Customize Dashboard Button */}
            <button 
              onClick={() => setShowCustomizeDrawer(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#f0f0fd] text-[#2a276e] font-bold text-sm border border-[#c5c2f0] rounded-xl hover:bg-[#e4e3f9] transition-all duration-200 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit Layout</span>
            </button>
          </div>
        </div>
      </div>
      {/* 4-metric cards in a single row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {metrics.map((m) => (
          <MetricCard key={m.title} {...m} onClick={() => handleMetricClick(m)} />
        ))}
      </div>
      {/* First row of charts */}
      <div className="flex flex-wrap gap-6 mb-6">
        {/* Patient Statistics Bar Chart (2/3 width) */}
        {visibleWidgets.patientStats && (
          <ChartCard
            title="Patient Statistics"
            minWidth="md:min-w-[500px]"
            flexClass="flex-[2]"
            onAISparkle={() => setShowChatPanel(true)}
            loading={loadingPatientStats}
            isEmpty={patientStatsData.length === 0}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={patientStatsData} barGap={8} margin={{ left: -20 }}>
                <defs>
                  <linearGradient id="patientGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2a276e" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#9B8CFF" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="inpatientGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2a276e" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#9B8CFF" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500, fill: '#9ca3af' }} domain={calculateYAxisDomain(patientStatsData, 'patient')} tickFormatter={formatToK} />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', background: '#111', color: '#fff', fontSize: 12, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                  cursor={{ fill: '#f3f4f6', radius: 8 }} 
                  formatter={(value, name) => [formatToK(value), name === 'patient' ? 'Patient' : 'Inpatient']} 
                />
                <Bar dataKey="patient" stackId="a" fill="url(#patientGradient)" radius={[6, 6, 0, 0]} barSize={32} />
                <Bar dataKey="inpatient" stackId="a" fill="url(#inpatientGradient)" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Patient Demographics Pie Chart (1/3 width) */}
        {visibleWidgets.demographics && (
          <ChartCard
            title="Patient Demographics"
            onAISparkle={() => setShowChatPanel(true)}
            loading={loadingDemographics}
            isEmpty={venueVisitorDataState.length === 0}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            }
          >
            <div className="flex flex-col items-center">
              <div className="relative flex items-center justify-center mb-4" style={{ width: 140, height: 140 }}>
                {/* Dotted ring background */}
                <svg width="140" height="140" className="absolute" style={{ zIndex: 0 }}>
                  <circle cx="70" cy="70" r="56" fill="none" stroke="#f3f4f6" strokeWidth="6" strokeDasharray="2,6" />
                </svg>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={venueVisitorDataState}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={65}
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
                <div className="absolute flex flex-col items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Total</span>
                  <span className="text-xl font-black text-[#2a276e]">{venueVisitorDataState.reduce((sum, d) => sum + d.value, 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                {venueVisitorDataState.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shadow-sm" style={{ background: item.color }}></div>
                    <span className="text-xs font-bold text-gray-600 tracking-tight">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}
      </div>

      {/* Second row of charts */}
      <div className="flex flex-wrap gap-6 mb-6">
        {/* Revenue Analytics Line Chart */}
        {visibleWidgets.revenue && (
          <ChartCard
            title="Revenue Analytics"
            onAISparkle={() => setShowChatPanel(true)}
            loading={loadingRevenue}
            isEmpty={revenueDataState.length === 0}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueDataState} margin={{ left: -20, right: 0, top: 20, bottom: 0 }}>
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }} 
                  interval="preserveStartEnd"
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
                  tickFormatter={(val) => `₹${formatToK(val)}`}
                  domain={calculateYAxisDomain(revenueDataState, ['revenue'], 0.15)} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', background: '#111', color: '#fff', fontSize: 12, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                  formatter={(value) => [`₹${formatToK(value)}`, 'Revenue']} 
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#2a276e" 
                  radius={[6, 6, 0, 0]}
                  barSize={30}
                  animationDuration={1500}
                >
                  <LabelList 
                    dataKey="revenue" 
                    position="top" 
                    formatter={(val) => val > 0 ? `₹${formatToK(val)}` : ''}
                    style={{ fontSize: 10, fontWeight: 700, fill: '#2a276e' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Appointment Booking Trends Bar Chart */}
        {visibleWidgets.appointments && (
          <ChartCard
            title="Appointment Trends"
            onAISparkle={() => setShowChatPanel(true)}
            loading={loadingAppointments}
            isEmpty={appointmentDataState.length === 0}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={appointmentDataState} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }} 
                  interval="preserveStartEnd"
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  hide={true}
                  domain={calculateYAxisDomain(appointmentDataState, 'bookings', 0.05)} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', background: '#111', color: '#fff', fontSize: 12, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                  formatter={(value) => [value, 'Appointments']} 
                />
                <Area 
                  type="monotone" 
                  dataKey="bookings" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorBookings)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>


      <div className="h-10"></div>

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
                  <GearLoader size="w-12 h-12" />
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
              ) : (selectedMetric.title === "Appointments Today" || selectedMetric.title === "Appointments" || selectedMetric.title === "Checking") ? (
                <div className="space-y-3">
                  {drawerData.map((item, idx) => (
                    <div key={item.id || idx} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-[#9B8CFF]/10 rounded-lg text-[#2a276e]">
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
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <p className="text-lg font-medium">No detail view available</p>
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
                    <i className="fi fi-sr-chart-histogram text-xl text-[#9B8CFF]"></i>
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
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#9B8CFF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2a276e]"></div>
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
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#9B8CFF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2a276e]"></div>
                  </label>
                </div>

                {/* Revenue Analytics Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <i className="fi fi-sr-chart-line-up text-xl text-[#2a276e]"></i>
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
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#9B8CFF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2a276e]"></div>
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
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#9B8CFF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2a276e]"></div>
                  </label>
                </div>

                <div className="text-center text-gray-500 py-8">
                  No other customization options available
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <button 
                onClick={() => setShowCustomizeDrawer(false)} 
                className="w-full px-6 py-3 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium"
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
        className="fixed bottom-6 right-6 bg-gradient-to-r from-[#2a276e] to-[#9B8CFF] hover:from-[#1a1548] hover:to-[#9B8CFF] text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 z-40 group"
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
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-[#9B8CFF]/10 to-blue-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-[#2a276e] to-[#9B8CFF] rounded-full flex items-center justify-center">
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
                        ? 'bg-gradient-to-r from-[#2a276e] to-[#9B8CFF] text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.type === 'user' ? 'text-white' : 'text-gray-500'
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-[#2a276e] to-[#9B8CFF] text-white rounded-full hover:from-[#1a1548] hover:to-[#9B8CFF] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
