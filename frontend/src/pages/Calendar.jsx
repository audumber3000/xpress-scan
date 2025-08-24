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
        const response = await api.get('/payments/calendar-data', {
          params: {
            year: currentYear,
            month: activeView === "month" ? currentMonth + 1 : undefined,
            view: activeView
          }
        });
        setRevenueData(response || {});
      } catch (error) {
        console.error('Error fetching revenue data:', error);
        // Use mock data for now
        setRevenueData(generateMockRevenueData());
      } finally {
        setLoading(false);
      }
    };

    fetchRevenueData();
  }, [currentDate, activeView, currentYear, currentMonth]);

  // Generate mock data for development
  const generateMockRevenueData = () => {
    const mockData = {};
    const today = new Date();
    
    if (activeView === "month") {
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        mockData[dateKey] = Math.floor(Math.random() * 5000) + 1000; // Random revenue between 1000-6000
      }
    } else if (activeView === "year") {
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${currentYear}-${String(month).padStart(2, '0')}`;
        mockData[monthKey] = Math.floor(Math.random() * 150000) + 50000; // Random monthly revenue
      }
    }
    
    return mockData;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-8 gap-1 mb-2">
            <div className="p-2"></div> {/* Time column header */}
            {weekDates.map((date, index) => (
              <div key={index} className="p-2 text-center">
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

          {/* All-day row */}
          <div className="grid grid-cols-8 gap-1 mb-2">
            <div className="p-2 text-sm font-medium text-gray-600">All-day</div>
            {weekDates.map((date, index) => {
              const dateKey = date.toISOString().split('T')[0];
              const revenue = revenueData[dateKey] || 0;
              return (
                <div key={index} className="p-2 border border-gray-200 rounded min-h-[60px]">
                  {revenue > 0 && (
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(revenue)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hourly slots */}
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 gap-1 border-b border-gray-100">
              <div className="p-2 text-sm text-gray-500 text-right">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {weekDates.map((date, index) => (
                <div key={index} className="p-2 border-r border-gray-100 min-h-[60px]">
                  {/* Hourly content can be added here */}
                </div>
              ))}
            </div>
          ))}
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
