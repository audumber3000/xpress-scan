import React, { useState, useEffect } from "react";
import Card from "../components/Card";
import { api } from "../utils/api";

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeView, setActiveView] = useState("month");
  const [revenueData, setRevenueData] = useState({});
  const [loading, setLoading] = useState(true);
  


  const views = [
    { id: "week", label: "Week", icon: "📅" },
    { id: "month", label: "Month", icon: "📆" },
    { id: "year", label: "Year", icon: "📊" }
  ];

  // Get current date info
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  // Navigation functions
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (activeView === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else if (activeView === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (activeView === "year") {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (activeView === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else if (activeView === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (activeView === "year") {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Fetch revenue data
  useEffect(() => {
    const fetchRevenueData = async () => {
      try {
        setLoading(true);
        // Fetch payments data for the current period
        const params = {
          year: currentYear,
          view: activeView
        };
        
        // Only add month parameter for month view
        if (activeView === "month") {
          params.month = currentMonth + 1;
        }
        
        const response = await api.post('/payments/calendar-data', params);
        setRevenueData(response || {});
      } catch (error) {
        console.error('Error fetching revenue data:', error);
        // Don't use mock data - show empty state
        setRevenueData({});
      } finally {
        setLoading(false);
      }
    };

    fetchRevenueData();
  }, [currentDate, activeView, currentYear, currentMonth]);



  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format time for display
  const formatTime = (timeString) => {
    const [hour, minute] = timeString.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
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

  // Get month dates
  const getMonthDates = () => {
    const dates = [];
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Render Week View
  const renderWeekView = () => {
    const weekDates = getWeekDates();
    
    // Debug: Log the overall revenue data structure
    console.log('🔍 Week View Debug:');
    console.log('  Revenue Data:', revenueData);
    console.log('  Week Dates:', weekDates.map(d => d.toISOString().split('T')[0]));
    console.log('  Revenue Data Keys:', Object.keys(revenueData));

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-8 gap-1 mb-2 bg-gray-50 rounded-t-lg">
            <div className="p-3 text-center font-semibold text-gray-700">Time</div>
            {weekDates.map((date, index) => (
              <div key={index} className="p-3 text-center border-l border-gray-200">
                <div className="text-sm font-medium text-gray-600">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-bold ${
                  date.toDateString() === new Date().toDateString() 
                    ? 'text-red-600' 
                    : 'text-gray-900'
                }`}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* All-day row - Revenue Summary */}
          <div className="grid grid-cols-8 gap-1 mb-2 bg-green-50 border-b-2 border-green-200">
            <div className="p-3 text-sm font-semibold text-green-700 bg-green-100 rounded-l">Revenue</div>
            {weekDates.map((date, index) => {
              // Use UTC date to match backend
              const dateKey = date.toISOString().split('T')[0];
              const dayData = revenueData[dateKey];
              
              // Handle both new format (with revenue/patients) and old format (just amount)
              let revenue = 0;
              if (dayData) {
                if (typeof dayData === 'object' && dayData.revenue !== undefined) {
                  // New format: {revenue: 3000, patients: [...]}
                  revenue = dayData.revenue;
                } else if (typeof dayData === 'number') {
                  // Old format: just the amount
                  revenue = dayData;
                }
              }
              
              return (
                <div key={index} className="p-3 border-l border-green-200 min-h-[60px] flex items-center justify-center">
                  {revenue > 0 ? (
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-700">
                        {formatCurrency(revenue)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">-</div>
                  )}
                </div>
              );
            })}
          </div>
          

          


                    {/* Simple patient dots display */}
          <div className="grid grid-cols-8 gap-1 border-b border-gray-100 bg-gray-50">
            <div className="p-3 text-sm font-semibold text-gray-700 text-center">Patients</div>
            {weekDates.map((date, index) => {
              const dateKey = date.toISOString().split('T')[0];
              const dayData = revenueData[dateKey];
              const patients = dayData?.patients || [];
              
              return (
                <div key={index} className="p-3 border-l border-gray-200 min-h-[60px] flex flex-wrap items-start justify-center gap-1">
                  {patients.map((patient, patientIndex) => (
                    <div 
                      key={patientIndex}
                      className="w-3 h-3 bg-blue-500 rounded-full cursor-pointer hover:bg-blue-600 transition-colors shadow-sm"
                      title={`${patient.name} - ${patient.scan_type} - ${formatCurrency(patient.amount)} - ${patient.time}`}
                    />
                  ))}
                  
                  {/* Show patient count if no dots */}
                  {patients.length === 0 && (
                    <div className="text-gray-400 text-sm">-</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render Month View
  const renderMonthView = () => {
    const monthDates = getMonthDates();
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });

    return (
      <div>
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-3 text-center font-medium text-gray-600 bg-gray-50">
              {day}
            </div>
          ))}

          {/* Date grid */}
          {monthDates.map((date, index) => {
            const isCurrentMonth = date.getMonth() === currentMonth;
            const isToday = date.toDateString() === new Date().toDateString();
            const dateKey = date.toISOString().split('T')[0];
            const revenue = revenueData[dateKey] || 0;

            return (
              <div
                key={index}
                className={`p-3 border border-gray-200 min-h-[100px] ${
                  !isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <div className={`text-sm ${
                  !isCurrentMonth ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {date.getDate()}
                </div>
                {revenue > 0 && (
                  <div className="mt-2 text-center">
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(revenue)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Year View
  const renderYearView = () => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
      <div className="grid grid-cols-4 gap-6">
        {months.map((month, index) => {
          const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
          const revenue = revenueData[monthKey] || 0;
          const isCurrentMonth = index === new Date().getMonth() && currentYear === new Date().getFullYear();

          return (
            <div key={month} className="text-center">
              <div className={`text-lg font-semibold mb-2 ${
                isCurrentMonth ? 'text-red-600' : 'text-gray-700'
              }`}>
                {month}
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(revenue)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar</h1>
        <p className="text-gray-600">View revenue calendar and patient appointments</p>
      </div>

      {/* View Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
              activeView === view.id
                ? "bg-white text-green-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span className="text-lg">{view.icon}</span>
            <span className="font-medium">{view.label}</span>
          </button>
        ))}
      </div>

      {/* Navigation Bar */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="text-2xl font-bold text-gray-900">
              {activeView === "week" && `Week of ${getWeekDates()[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
               || activeView === "month" && `${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
               || activeView === "year" && currentYear}
            </div>
            
            <button
              onClick={goToNext}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button
            onClick={goToToday}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Today
          </button>
          

        </div>

        {/* Calendar Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading calendar data...</p>
          </div>
        ) : (
          <div>
            {activeView === "week" && renderWeekView()}
            {activeView === "month" && renderMonthView()}
            {activeView === "year" && renderYearView()}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Calendar;
