import React, { useState, useEffect } from 'react';
import GearLoader from '../GearLoader';

const PermissionsTab = ({
  selectedUser,
  availablePermissions,
  defaultPermissions,
  onSave,
  onCancel,
  saving
}) => {
  const [permissions, setPermissions] = useState(selectedUser?.permissions || {});
  const [selectedRole, setSelectedRole] = useState("");
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    if (selectedUser) {
      setPermissions(selectedUser.permissions || {});
      setSelectedRole(selectedUser.role || "receptionist");
    }
  }, [selectedUser]);

  const handleCheckbox = (section, permission) => {
    setPermissions(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [permission]: !prev[section]?.[permission]
      }
    }));
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setPermissions(defaultPermissions[role] || {});
    setCustomMode(false);
  };

  const handlePresetChange = (preset) => {
    switch (preset) {
      case "receptionist":
        setPermissions(defaultPermissions.receptionist);
        setSelectedRole("receptionist");
        break;
      case "doctor":
        setPermissions(defaultPermissions.doctor);
        setSelectedRole("doctor");
        break;
      case "clinic_owner":
        setPermissions(defaultPermissions.clinic_owner);
        setSelectedRole("clinic_owner");
        break;
      case "custom":
        setCustomMode(true);
        break;
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave(selectedUser.id, { role: selectedRole, permissions });
  };

  // Get all unique permissions across all sections
  const allPermissions = availablePermissions.reduce((acc, section) => {
    section.permissions.forEach(perm => {
      if (!acc.includes(perm)) acc.push(perm);
    });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-4">Manage Permissions</h4>
        <p className="text-sm text-gray-600 mb-4">
          Configure what actions this user can perform in the system.
        </p>

        {/* Role Presets */}
        <div className="mb-6">
          <h5 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h5>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handlePresetChange("receptionist")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedRole === "receptionist" && !customMode
                  ? "bg-[#6C4CF3] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Receptionist
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("doctor")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedRole === "doctor" && !customMode
                  ? "bg-[#6C4CF3] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Doctor
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("clinic_owner")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedRole === "clinic_owner" && !customMode
                  ? "bg-[#6C4CF3] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Clinic Owner
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("custom")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                customMode
                  ? "bg-[#6C4CF3] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Permissions Matrix Table */}
        <div className="mb-6">
          <h5 className="text-md font-medium mb-3 text-gray-900">Permissions Matrix</h5>
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Section
                  </th>
                  {allPermissions.map(permission => (
                    <th key={permission} className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                      {permission.charAt(0).toUpperCase() + permission.slice(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {availablePermissions.map(section => (
                  <tr key={section.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                      {section.label}
                    </td>
                    {allPermissions.map(permission => {
                      const hasPermission = section.permissions.includes(permission);
                      const isChecked = !!permissions[section.key]?.[permission];
                      return (
                        <td key={permission} className="px-4 py-3 whitespace-nowrap text-center">
                          {hasPermission ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckbox(section.key, permission)}
                              className="accent-[#6C4CF3] w-5 h-5 cursor-pointer"
                              disabled={!customMode && selectedRole !== "clinic_owner" && selectedUser?.role !== "clinic_owner"}
                            />
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Permission Descriptions */}
        <div className="mb-6 text-sm text-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h6 className="font-medium text-gray-900 mb-2">Permission Types:</h6>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>View:</strong> Can see and access the section</li>
            <li><strong>Edit:</strong> Can modify and update records</li>
            <li><strong>Delete:</strong> Can remove records (where applicable)</li>
          </ul>
        </div>

        <form id="permissions-form" onSubmit={handleSave}></form>
      </div>
      
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="permissions-form"
          disabled={saving}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <GearLoader size="w-4 h-4" className="text-white" />
              <span>Saving...</span>
            </>
          ) : (
            "Save Permissions"
          )}
        </button>
      </div>
    </div>
  );
};

export default PermissionsTab;

