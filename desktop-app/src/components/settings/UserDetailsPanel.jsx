import React from 'react';
import GearLoader from '../GearLoader';
import EditUserTab from './EditUserTab';
import PermissionsTab from './PermissionsTab';

const UserDetailsPanel = ({
  selectedUser,
  userPanelTab,
  setUserPanelTab,
  onClose,
  userDevices,
  loadingUserDevices,
  getUserInitials,
  formatDate,
  formatLastSeen,
  getDeviceIcon,
  hasPermission,
  user,
  onSetPassword,
  onEditUser,
  onManagePermissions,
  onDeleteUser,
  formData,
  setFormData,
  availableRoles,
  handleInputChange,
  handleSaveEditUser,
  availablePermissions,
  defaultPermissions,
  handleSavePermissions,
  savingEditUser,
  savingPermissions
}) => {
  if (!selectedUser) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div 
        className="absolute inset-0 backdrop-blur-sm bg-black/20" 
        onClick={onClose}
      ></div>
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
        {/* Panel Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2a276e] to-[#9B8CFF] flex items-center justify-center text-white font-semibold text-lg">
              {getUserInitials(selectedUser.name)}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedUser.name}</h3>
              <p className="text-sm text-gray-500">{selectedUser.email}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setUserPanelTab("accounts")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                userPanelTab === "accounts"
                  ? "border-[#2a276e] text-[#2a276e]"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Accounts
            </button>
            <button
              onClick={() => setUserPanelTab("devices")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                userPanelTab === "devices"
                  ? "border-[#2a276e] text-[#2a276e]"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Device Management
            </button>
            <button
              onClick={() => setUserPanelTab("activity")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                userPanelTab === "activity"
                  ? "border-[#2a276e] text-[#2a276e]"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Activity
            </button>
            {hasPermission("users:edit") && (
              <>
                <button
                  onClick={() => onEditUser(selectedUser)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    userPanelTab === "edit"
                      ? "border-[#2a276e] text-[#2a276e]"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Edit User
                </button>
                <button
                  onClick={() => onManagePermissions(selectedUser)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    userPanelTab === "permissions"
                      ? "border-[#2a276e] text-[#2a276e]"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Permissions
                </button>
              </>
            )}
          </div>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Accounts Tab */}
          {userPanelTab === "accounts" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">Account Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Name</span>
                    <span className="text-sm font-medium text-gray-900">{selectedUser.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Email</span>
                    <span className="text-sm font-medium text-gray-900">{selectedUser.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Role</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">{selectedUser.role}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Date Added</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(selectedUser.created_at)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">Desktop Login Credentials</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Username (Email)</label>
                    <div className="p-2 bg-white border border-gray-300 rounded font-mono text-sm text-gray-900">
                      {selectedUser.email}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Password Status</label>
                    <div className="flex items-center justify-between">
                      {selectedUser.has_password ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Password Set
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ✗ Password Not Set
                        </span>
                      )}
                      {hasPermission("users:edit") && (
                        <button
                          onClick={() => onSetPassword(selectedUser)}
                          className="text-sm text-[#2a276e] hover:text-[#1a1548] font-medium"
                        >
                          {selectedUser.has_password ? "Reset Password" : "Set Password"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {hasPermission("users:edit") && (
                <div className="flex gap-3">
                  <button
                    onClick={() => onEditUser(selectedUser)}
                    className="flex-1 px-4 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium"
                  >
                    Edit User
                  </button>
                  <button
                    onClick={() => onManagePermissions(selectedUser)}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                  >
                    Manage Permissions
                  </button>
                  {hasPermission("users:delete") && selectedUser.id !== user?.id && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete ${selectedUser.name}?`)) {
                          onDeleteUser(selectedUser.id);
                          onClose();
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Device Management Tab */}
          {userPanelTab === "devices" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">User Devices</h4>
                {loadingUserDevices[selectedUser.id] ? (
                  <div className="text-center py-8">
                    <GearLoader size="w-8 h-8" className="mx-auto" />
                    <p className="mt-2 text-sm text-gray-600">Loading devices...</p>
                  </div>
                ) : (userDevices[selectedUser.id] || []).length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500">No devices found.</p>
                    <p className="text-xs text-gray-400 mt-1">Devices will appear here when this user logs in.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(userDevices[selectedUser.id] || []).map((device) => (
                      <div key={device.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-3xl">{getDeviceIcon(device.device_type, device.device_platform)}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-900">{device.device_name}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  device.is_online 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  <span className={`w-1.5 h-1.5 mr-1 rounded-full ${
                                    device.is_online ? 'bg-green-400' : 'bg-gray-400'
                                  }`}></span>
                                  {device.is_online ? 'Online' : 'Offline'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div><span className="font-medium">Platform:</span> {device.device_platform} {device.device_os}</div>
                                {device.device_serial && (
                                  <div><span className="font-medium">Serial:</span> <span className="font-mono">{device.device_serial}</span></div>
                                )}
                                <div><span className="font-medium">Type:</span> {device.device_type === 'desktop' && '🖥️ Desktop'} {device.device_type === 'mobile' && '📱 Mobile'} {device.device_type === 'web' && '🌐 Web'}</div>
                                <div><span className="font-medium">Last seen:</span> {formatLastSeen(device.last_seen)}</div>
                                {device.location && (
                                  <div><span className="font-medium">Location:</span> {device.location}</div>
                                )}
                                {device.ip_address && (
                                  <div><span className="font-medium">IP Address:</span> {device.ip_address}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {userPanelTab === "activity" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">User Activity</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Account Created</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(selectedUser.created_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Last Active</span>
                    <span className="text-sm font-medium text-gray-900">
                      {(() => {
                        const devices = userDevices[selectedUser.id] || [];
                        const lastActive = devices.length > 0 
                          ? devices.sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0))[0]
                          : null;
                        return lastActive ? formatDate(lastActive.last_seen) : "Never";
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Devices</span>
                    <span className="text-sm font-medium text-gray-900">{(userDevices[selectedUser.id] || []).length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Active Devices</span>
                    <span className="text-sm font-medium text-gray-900">
                      {(userDevices[selectedUser.id] || []).filter(d => d.is_online).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit User Tab */}
          {userPanelTab === "edit" && (
            <EditUserTab
              selectedUser={selectedUser}
              formData={formData}
              setFormData={setFormData}
              availableRoles={availableRoles}
              handleInputChange={handleInputChange}
              onSave={handleSaveEditUser}
              onCancel={() => setUserPanelTab("accounts")}
              saving={savingEditUser}
            />
          )}

          {/* Permissions Tab */}
          {userPanelTab === "permissions" && (
            <PermissionsTab
              selectedUser={selectedUser}
              availablePermissions={availablePermissions}
              defaultPermissions={defaultPermissions}
              onSave={handleSavePermissions}
              onCancel={() => setUserPanelTab("accounts")}
              saving={savingPermissions}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailsPanel;

