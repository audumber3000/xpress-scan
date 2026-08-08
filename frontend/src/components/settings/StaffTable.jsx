import React from 'react';
import { Pencil } from 'lucide-react';
import { resolveUserAvatar } from '../../utils/avatar';
import { accessSummary } from '../../constants/permissions';
import { formatDate, formatRelative } from '../../utils/datetime';

const StaffTable = ({
  users,
  userDevices = {},
  loadingUserDevices = false,
  onUserClick,
  onEditUser,
  onToggleActive,
  currentUserId,
  getUserInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??',
  getDeviceIcon = () => null
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-[#f8fafc]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                User name
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Access
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Last active
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Date added
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {users.map((u) => {
              // Most recently seen device wins; `sort` mutates, so copy first.
              const devices = userDevices[u.id] || [];
              const lastActiveDevice = [...devices]
                .sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0))[0] || null;
              const lastActive = lastActiveDevice?.last_seen ? formatRelative(lastActiveDevice.last_seen) : null;
              const isOnline = devices.some((d) => d.is_online);
              
              const access = accessSummary(u);
              
              const isOwner = u.role === 'clinic_owner';
              const isInactive = u.is_active === false;
              return (
                <tr 
                  key={u.id} 
                  onClick={() => onUserClick(u)}
                  className={`hover:bg-indigo-50/30 cursor-pointer transition-colors duration-150 ${isInactive ? 'opacity-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 relative">
                        <img 
                          src={resolveUserAvatar(u)} 
                          alt={u.name}
                          className="h-10 w-10 rounded-full object-cover bg-gray-100"
                        />
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
                    <div className="flex justify-center">
                      <span
                        title={`Can open ${access.readCount} of ${access.total} modules`}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          access.level === 'all'
                            ? 'bg-[#E0F2F2] text-[#1F6B72]'
                            : access.level === 'partial'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {access.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {loadingUserDevices ? (
                      <span className="inline-block h-3 w-16 rounded bg-gray-100 animate-pulse" />
                    ) : lastActive ? (
                      <div className="flex items-center justify-end gap-2" title={lastActive.exact}>
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                        <span>{isOnline ? 'Online now' : lastActive.relative}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Never signed in</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {u.created_at ? formatDate(u.created_at) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {onToggleActive && (
                        <div className="flex items-center gap-2" title={isOwner ? 'Cannot deactivate clinic owner' : ''}>
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
                                  : 'bg-[#29828a] cursor-pointer'
                            }`}
                          >
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${isInactive ? 'translate-x-0' : 'translate-x-4'}`} />
                          </button>
                        </div>
                      )}
                      {/* The row itself opens permissions, so editing name/role
                          needs its own affordance. */}
                      {onEditUser && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditUser(u); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#29828a] hover:bg-gray-100 transition-colors"
                          title="Edit staff details"
                          aria-label={`Edit ${u.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                    </div>
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





