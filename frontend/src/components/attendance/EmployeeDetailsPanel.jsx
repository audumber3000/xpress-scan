import React from "react";

const EmployeeDetailsPanel = ({ employee, onClose }) => {
  if (!employee) return null;

  const defaultAvatar = (name) => {
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=E5E7EB&color=374151&size=120&rounded=true&bold=true`;
  };

  const calculateStatistics = () => {
    if (!employee.attendance) return { onTime: 0, late: 0, absent: 0, total: 0 };

    const stats = { onTime: 0, late: 0, absent: 0, total: 0 };
    Object.values(employee.attendance).forEach((record) => {
      stats.total++;
      if (record.status === 'on_time') stats.onTime++;
      else if (record.status === 'late') stats.late++;
      else if (record.status === 'absent') stats.absent++;
    });

    return stats;
  };

  const stats = calculateStatistics();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      ></div>

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Employee Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Employee Profile */}
          <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-200">
            <img
              src={employee.avatar || defaultAvatar(employee.name)}
              alt={employee.name}
              className="w-24 h-24 rounded-full object-cover mb-4"
            />
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{employee.name}</h3>
            {employee.designation && (
              <p className="text-gray-600 mb-2">{employee.designation}</p>
            )}
            {employee.email && (
              <p className="text-sm text-gray-500">{employee.email}</p>
            )}
            {employee.phone && (
              <p className="text-sm text-gray-500">{employee.phone}</p>
            )}
          </div>

          {/* Statistics */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Attendance Statistics</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#9B8CFF]/10 rounded-lg p-4 text-center border border-[#9B8CFF]/20">
                <div className="text-2xl font-bold text-[#6C4CF3]">{stats.onTime}</div>
                <div className="text-xs text-gray-600 mt-1">On Time</div>
              </div>
              <div className="bg-yellow-100 rounded-lg p-4 text-center border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
                <div className="text-xs text-gray-600 mt-1">Late</div>
              </div>
              <div className="bg-red-100 rounded-lg p-4 text-center border border-red-200">
                <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                <div className="text-xs text-gray-600 mt-1">Absent</div>
              </div>
            </div>
            {stats.total > 0 && (
              <div className="mt-4 text-center">
                <div className="text-sm text-gray-600">
                  Total Records: <span className="font-semibold">{stats.total}</span>
                </div>
              </div>
            )}
          </div>

          {/* Recent Attendance History */}
          {employee.attendance && Object.keys(employee.attendance).length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Attendance</h4>
              <div className="space-y-2">
                {Object.entries(employee.attendance)
                  .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                  .slice(0, 10)
                  .map(([date, record]) => {
                    const dateObj = new Date(date);
                    const formattedDate = dateObj.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    const getStatusBadge = () => {
                      switch (record.status) {
                        case 'on_time':
                          return <span className="px-2 py-1 bg-[#9B8CFF]/20 text-[#6C4CF3] rounded text-xs font-medium">On Time</span>;
                        case 'late':
                          return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Late</span>;
                        case 'absent':
                          return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Absent</span>;
                        default:
                          return null;
                      }
                    };

                    return (
                      <div key={date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{formattedDate}</div>
                          {record.reason && (
                            <div className="text-xs text-gray-500 mt-1">{record.reason}</div>
                          )}
                        </div>
                        {getStatusBadge()}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsPanel;



