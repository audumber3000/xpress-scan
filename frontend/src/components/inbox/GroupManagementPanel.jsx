import React, { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";
import GearLoader from "../GearLoader";

const GroupManagementPanel = ({ onClose }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Create group form
  const [groupName, setGroupName] = useState("");
  const [participants, setParticipants] = useState([""]);
  const [creating, setCreating] = useState(false);

  // Invite form
  const [invitePhone, setInvitePhone] = useState("");

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      console.log("Fetching groups...");
      const response = await api.get("/whatsapp/groups/list");
      console.log("Groups response:", response);
      console.log("Groups response data:", response.data);
      
      // Backend now always returns { groups: [], total: 0 } structure
      if (response.data) {
        if (Array.isArray(response.data.groups)) {
          console.log(`Found ${response.data.groups.length} groups`);
          setGroups(response.data.groups);
          
          // Show warning if there's an error message
          if (response.data.error && response.data.groups.length === 0) {
            console.warn("Groups fetch warning:", response.data.error);
            toast.warning(response.data.error || "No groups found");
          } else if (response.data.groups.length === 0) {
            console.log("No groups found (this is normal if you don't have any groups)");
          }
        } else {
          console.warn("Response data.groups is not an array:", response.data);
          setGroups([]);
          if (response.data.error) {
            toast.error(response.data.error);
          }
        }
      } else {
        console.warn("No response data:", response);
        setGroups([]);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      console.error("Error response:", error.response);
      setGroups([]);
      
      // Show error message
      const errorMsg = error.response?.data?.detail || 
                      error.response?.data?.error || 
                      error.message || 
                      "Failed to fetch groups";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId) => {
    setLoadingDetails(true);
    try {
      const response = await api.get(`/whatsapp/groups/${groupId}`);
      setGroupDetails(response.data);
    } catch (error) {
      toast.error("Failed to fetch group details");
      console.error(error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || participants.filter(p => p.trim()).length === 0) {
      toast.error("Please provide group name and at least one participant");
      return;
    }

    setCreating(true);
    try {
      const cleanParticipants = participants.filter(p => p.trim());
      const response = await api.post("/whatsapp/groups/create", {
        name: groupName,
        participants: cleanParticipants
      });

      // Check if response is successful (status 200-299)
      if (response.status >= 200 && response.status < 300) {
        if (response.data && response.data.success) {
          toast.success("Group created successfully!");
          setShowCreateModal(false);
          setGroupName("");
          setParticipants([""]);
          // Refresh groups list after a short delay
          setTimeout(() => {
            fetchGroups();
          }, 500);
        } else if (response.data && response.data.error) {
          toast.error(response.data.error);
        } else {
          // Response is OK but no success flag - assume it worked
          toast.success("Group created successfully!");
          setShowCreateModal(false);
          setGroupName("");
          setParticipants([""]);
          setTimeout(() => {
            fetchGroups();
          }, 500);
        }
      } else {
        toast.error(response.data?.error || response.data?.detail || "Failed to create group");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      // Only show error if it's not a success response
      if (error.response?.status >= 400) {
        toast.error(error.response?.data?.detail || error.response?.data?.error || "Failed to create group");
      } else if (error.response?.data?.success) {
        // Sometimes errors still have success=true
        toast.success("Group created successfully!");
        setShowCreateModal(false);
        setGroupName("");
        setParticipants([""]);
        setTimeout(() => {
          fetchGroups();
        }, 500);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!invitePhone.trim()) {
      toast.error("Please provide a phone number");
      return;
    }

    try {
      const response = await api.post(`/whatsapp/groups/${selectedGroup}/invite`, {
        participant: invitePhone
      });

      if (response.data.success) {
        toast.success("User invited successfully!");
        setShowInviteModal(false);
        setInvitePhone("");
        fetchGroupDetails(selectedGroup);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to invite user");
      console.error(error);
    }
  };

  const handleMakeAdmin = async (participant) => {
    try {
      const response = await api.post(`/whatsapp/groups/${selectedGroup}/make-admin`, {
        participant: participant
      });

      if (response.data.success) {
        toast.success("User promoted to admin");
        fetchGroupDetails(selectedGroup);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to make user admin");
      console.error(error);
    }
  };

  const handleDemoteAdmin = async (participant) => {
    try {
      const response = await api.post(`/whatsapp/groups/${selectedGroup}/demote-admin`, {
        participant: participant
      });

      if (response.data.success) {
        toast.success("Admin demoted");
        fetchGroupDetails(selectedGroup);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to demote admin");
      console.error(error);
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm("Are you sure you want to leave this group?")) {
      return;
    }

    try {
      const response = await api.post(`/whatsapp/groups/${groupId}/leave`);

      if (response.data.success) {
        toast.success("Left group successfully");
        fetchGroups();
        if (selectedGroup === groupId) {
          setSelectedGroup(null);
          setGroupDetails(null);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to leave group");
      console.error(error);
    }
  };

  const addParticipantField = () => {
    setParticipants([...participants, ""]);
  };

  const removeParticipantField = (index) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const updateParticipant = (index, value) => {
    const newParticipants = [...participants];
    newParticipants[index] = value;
    setParticipants(newParticipants);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Group Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Groups List */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition"
              >
                + Create Group
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center p-8">
                <GearLoader />
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => {
                      setSelectedGroup(group.id);
                      fetchGroupDetails(group.id);
                    }}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                      selectedGroup === group.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <p className="font-semibold text-gray-900">{group.name}</p>
                    <p className="text-sm text-gray-600">{group.participantCount} members</p>
                  </div>
                ))}
                {groups.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No groups found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group Details */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedGroup ? (
              loadingDetails ? (
                <div className="flex justify-center p-8">
                  <GearLoader />
                </div>
              ) : groupDetails ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{groupDetails.name}</h3>
                      {groupDetails.description && (
                        <p className="text-sm text-gray-600 mt-1">{groupDetails.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleLeaveGroup(selectedGroup)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
                    >
                      Leave Group
                    </button>
                  </div>

                  <div className="mb-4">
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition text-sm"
                    >
                      + Invite User
                    </button>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Participants ({groupDetails.participants?.length || 0})</h4>
                    <div className="space-y-2">
                      {groupDetails.participants?.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{participant.name}</p>
                            {participant.isAdmin && (
                              <span className="text-xs text-blue-600">Admin</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {!participant.isAdmin && (
                              <button
                                onClick={() => handleMakeAdmin(participant.id)}
                                className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition"
                              >
                                Make Admin
                              </button>
                            )}
                            {participant.isAdmin && (
                              <button
                                onClick={() => handleDemoteAdmin(participant.id)}
                                className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition"
                              >
                                Demote
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 p-8">
                  Select a group to view details
                </div>
              )
            ) : (
              <div className="text-center text-gray-500 p-8">
                Select a group to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Create Group</h3>
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Participants (Phone Numbers)
                </label>
                {participants.map((participant, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={participant}
                      onChange={(e) => updateParticipant(index, e.target.value)}
                      placeholder="Phone number with country code"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                    />
                    {participants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeParticipantField(index)}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addParticipantField}
                  className="text-sm text-[#25D366] hover:underline"
                >
                  + Add Participant
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Invite User to Group</h3>
            <form onSubmit={handleInviteUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number (with country code)
                </label>
                <input
                  type="text"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="e.g., 919876543210"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition"
                >
                  Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagementPanel;

