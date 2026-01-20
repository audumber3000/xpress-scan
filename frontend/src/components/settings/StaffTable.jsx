import React from 'react';

const StaffTable = ({ 
  users, 
  userDevices = {}, 
  loadingUserDevices = false,
  onUserClick,
  getUserInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??',
  formatDate = (date) => date ? new Date(date).toLocaleDateString() : 'N/A',
  formatLastSeen = (date) => date ? new Date(date).toLocaleString() : 'Never',
  getDeviceIcon = () => null
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User name
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Access
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last active
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date added
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((u) => {
              const devices = userDevices[u.id] || [];
              const lastActiveDevice = devices.length > 0 
                ? devices.sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0))[0]
                : null;
              
              // Get permissions as tags
              const permissionTags = [];
              if (u.role === "clinic_owner") {
                permissionTags.push({ label: "Admin", color: "green" });
              }
              if (u.permissions?.patients?.view || u.role === "clinic_owner") {
                permissionTags.push({ label: "Patients", color: "blue" });
              }
              if (u.permissions?.reports?.view || u.role === "clinic_owner") {
                permissionTags.push({ label: "Reports", color: "purple" });
              }
              if (u.permissions?.billing?.view || u.role === "clinic_owner") {
                permissionTags.push({ label: "Billing", color: "indigo" });
              }
              
              return (
                <tr 
                  key={u.id} 
                  onClick={() => onUserClick(u)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#2a276e] to-[#9B8CFF] flex items-center justify-center text-white font-semibold text-sm">
                          {getUserInitials(u.name)}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{u.name}</div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {permissionTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            tag.color === "green"
                              ? "bg-green-100 text-green-800"
                              : tag.color === "blue"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : tag.color === "purple"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                          }`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {lastActiveDevice ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          lastActiveDevice.is_online ? 'bg-green-400' : 'bg-gray-400'
                        }`}></span>
                        <span>{formatLastSeen(lastActiveDevice.last_seen)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Could add dropdown menu here
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffTable;





