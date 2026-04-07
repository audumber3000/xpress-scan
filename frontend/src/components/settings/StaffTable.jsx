import React from 'react';

const StaffTable = ({ 
  users, 
  userDevices = {}, 
  loadingUserDevices = false,
  onUserClick,
  onToggleActive,
  currentUserId,
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
              
              const isOwner = u.role === 'clinic_owner';
              const isInactive = u.is_active === false;
              return (
                <tr 
                  key={u.id} 
                  onClick={() => onUserClick(u)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${isInactive ? 'opacity-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#2a276e] to-[#9B8CFF] flex items-center justify-center text-white font-semibold text-sm">
                          {getUserInitials(u.name)}
                        </div>
                        {isInactive && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-400 border-2 border-white rounded-full" />
                        )}
                        {!isInactive && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{u.name}</span>
                          {isOwner && <span className="text-[10px] font-semibold bg-[#E0F2F2] text-[#1F6B72] px-1.5 py-0.5 rounded-full">Owner</span>}
                        </div>
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
                    {onToggleActive && (
                      <div className="flex items-center justify-end gap-2" title={isOwner ? 'Cannot deactivate clinic owner' : ''}>
                        <span className={`text-xs font-semibold ${isInactive ? 'text-gray-400' : 'text-emerald-600'}`}>
                          {isInactive ? 'Inactive' : 'Active'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isOwner) onToggleActive(u);
                          }}
                          disabled={isOwner}
                          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                            isOwner
                              ? 'cursor-not-allowed opacity-40 bg-gray-200'
                              : isInactive
                                ? 'bg-gray-200 cursor-pointer'
                                : 'bg-[#2D9596] cursor-pointer'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${isInactive ? 'translate-x-0' : 'translate-x-4'}`} />
                        </button>
                      </div>
                    )}
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





