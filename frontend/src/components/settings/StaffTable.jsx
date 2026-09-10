import React from 'react';
import { Pencil, Clock, Users } from 'lucide-react';
import { isClinical } from '../../constants/roles';
import { resolveUserAvatar } from '../../utils/avatar';
import { accessSummary } from '../../constants/permissions';
import { formatDate, formatRelative } from '../../utils/datetime';

/**
 * Nothing to show, and why.
 *
 * The table used to map straight over `users` with no fallback, so filtering to
 * Inactive in a clinic where nobody is inactive left a header row above blank
 * space — indistinguishable from a list that failed to load. Which of the three
 * it is matters: "nobody yet" wants the Add button, a search that matched
 * nothing wants different words typed, and a filter that matched nothing wants
 * clearing.
 */
const EmptyStaff = ({ hasAnyone, isSearching }) => {
  const [title, line] = !hasAnyone
    ? ["Nobody here yet", "Add your first staff member and they can sign in straight away."]
    : isSearching
      ? ["No staff match that search", "Try part of a name, an email address or a role."]
      : ["Nobody matches these filters", "Change the role or status above to see more people."];

  return (
    <div className="px-6 py-14 text-center">
      <Users size={22} className="mx-auto text-gray-300" />
      <p className="mt-3 text-sm font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{line}</p>
    </div>
  );
};

const StaffTable = ({
  users,
  userDevices = {},
  loadingUserDevices = false,
  onUserClick,
  onEditUser,
  onEditHours,
  onToggleActive,
  // Whether the clinic has any staff at all, as opposed to none matching right
  // now. The table only ever sees the filtered list, so it cannot tell.
  totalStaff = null,
  isSearching = false,
}) => {
  if (!users.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <EmptyStaff
          hasAnyone={totalStaff === null ? false : totalStaff > 0}
          isSearching={isSearching}
        />
      </div>
    );
  }

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
              // Green used to be painted on every active row, so it said
              // "their account is switched on" while looking like "they are
              // here". A dot that is always green is not a signal.
              const hasEverSignedIn = devices.length > 0;
              
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
                        {(isInactive || hasEverSignedIn) && (
                          <span
                            title={isInactive ? 'Deactivated' : isOnline ? 'Online now' : 'Signed in before'}
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${
                              isInactive ? 'bg-gray-400' : isOnline ? 'bg-emerald-400' : 'bg-gray-300'
                            }`}
                          />
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
                      {/* Working hours needs its own way in. Clicking the row
                          goes to permissions, which refuses both the owner and
                          you-yourself, so the owner could never reach their own
                          hours. Hours are not permissions. */}
                      {onEditHours && isClinical(u.role) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditHours(u); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#29828a] hover:bg-[#29828a]/10 transition-colors"
                          title="Working hours and time off"
                          aria-label={`Working hours for ${u.name}`}
                        >
                          <Clock size={15} />
                        </button>
                      )}
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





