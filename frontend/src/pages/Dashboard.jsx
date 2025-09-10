import React, { useState, useEffect } from "react";
import Card from "../components/Card";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, ReferenceLine, Label } from "recharts";

const COLORS = ["#1d8a99", "#6ee7b7", "#d1fae5"];

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

// Metric Card Component with week-wise bars
const MetricCard = ({ title, value, change, changeType, sub, weekData }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
          {title}
          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </span>
        <button className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 hover:bg-gray-50">
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
  
  const metrics = [
    { title: "Total Patients", value: 9459, change: "+16.8%", changeType: "up", sub: "vs last week", weekData },
    { title: "Total Reports", value: 8847, change: "-12.5%", changeType: "down", sub: "vs last week", weekData },
    { title: "Pending Reports", value: 4368, change: "+18.6%", changeType: "up", sub: "vs last week", weekData },
  ];

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

  let patientStatsData = patientStatsDataByMonth;
  let xKey = "month";
  if (timeRange === "week") {
    patientStatsData = patientStatsDataByWeek;
    xKey = "day";
  } else if (timeRange === "currentWeek") {
    patientStatsData = patientStatsDataCurrentWeek;
    xKey = "day";
  }
  // Calculate average
  const avg = Math.round(
    patientStatsData.reduce((sum, d) => sum + d.patient + (d.inpatient || 0), 0) /
      patientStatsData.length
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
        <div className="border-b border-gray-200 mt-4"></div>
      </div>
      {/* 3-metric cards in a single row, simple border, no shadow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {metrics.map((m) => (
          <MetricCard key={m.title} {...m} />
        ))}
      </div>
      {/* Two charts below metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Patient Statistics Bar Chart (2/3 width) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:col-span-2">
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
        {/* Venue Visitor Semi-Donut Chart (1/3 width) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center relative md:col-span-1">
          <div className="flex items-center justify-between w-full mb-2">
            <span className="font-semibold text-gray-800">Venue Visitor</span>
            <button className="flex items-center gap-1 text-xs border rounded px-2 py-1">
              Monthly
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
                  data={venueVisitorData}
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
                  {venueVisitorData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ zIndex: 1 }}>
              <div className="text-xs text-gray-400">Total Visitors</div>
              <div className="text-2xl font-bold text-gray-900">{totalVisitors.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            {venueVisitorData.map((item, idx) => (
              <span key={item.name} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: item.color }}></span>
                <span className="text-gray-700 font-medium">{item.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 