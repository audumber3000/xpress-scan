import React, { useState } from "react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";
import GearLoader from "../GearLoader";

const ProfileStatusPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState("status"); // "status" or "profile"
  const [loading, setLoading] = useState(false);

  // Status form
  const [status, setStatus] = useState("");
  const [settingStatus, setSettingStatus] = useState(false);
  const [checkPhone, setCheckPhone] = useState("");
  const [userStatus, setUserStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Profile picture form
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [checkProfilePhone, setCheckProfilePhone] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  const handleSetStatus = async (e) => {
    e.preventDefault();
    if (!status.trim()) {
      toast.error("Please enter a status");
      return;
    }

    setSettingStatus(true);
    try {
      const response = await api.post("/whatsapp/profile/status/set", {
        status: status
      });

      if (response.data && response.data.success) {
        toast.success("Status updated successfully!");
        setStatus("");
      } else {
        toast.error(response.data?.error || response.data?.detail || "Failed to set status");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || "Failed to set status");
      console.error(error);
    } finally {
      setSettingStatus(false);
    }
  };

  const handleCheckUserStatus = async (e) => {
    e.preventDefault();
    if (!checkPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setCheckingStatus(true);
    try {
      const response = await api.get(`/whatsapp/profile/status/user/${checkPhone}`);
      setUserStatus(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to check user status");
      console.error(error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }

      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfilePicture = async (e) => {
    e.preventDefault();
    if (!profileImage) {
      toast.error("Please select an image");
      return;
    }

    setUpdatingProfile(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = reader.result.split(",")[1];
        const imageType = profileImage.type || "image/jpeg";

        try {
          const response = await api.post("/whatsapp/profile/picture/update", {
            image: base64String,
            imageType: imageType
          });

          if (response.data.success) {
            toast.success("Profile picture updated successfully!");
            setProfileImage(null);
            setProfileImagePreview(null);
          }
        } catch (error) {
          toast.error(error.response?.data?.detail || "Failed to update profile picture");
          console.error(error);
        } finally {
          setUpdatingProfile(false);
        }
      };
      reader.readAsDataURL(profileImage);
    } catch (error) {
      toast.error("Failed to process image");
      console.error(error);
      setUpdatingProfile(false);
    }
  };

  const handleCheckProfilePicture = async (e) => {
    e.preventDefault();
    if (!checkProfilePhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setCheckingProfile(true);
    try {
      const response = await api.get(`/whatsapp/profile/picture/${checkProfilePhone}`);
      setProfilePicUrl(response.data.profilePicUrl);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to get profile picture");
      console.error(error);
    } finally {
      setCheckingProfile(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Profile & Status</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("status")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === "status"
                ? "text-[#25D366] border-b-2 border-[#25D366]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Status
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === "profile"
                ? "text-[#25D366] border-b-2 border-[#25D366]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Profile Picture
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "status" ? (
            <div className="space-y-6">
              {/* Set Status */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Set Your Status</h3>
                <form onSubmit={handleSetStatus}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status Message
                    </label>
                    <textarea
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      placeholder="What's on your mind?"
                      rows={3}
                      maxLength={139}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">{status.length}/139 characters</p>
                  </div>
                  <button
                    type="submit"
                    disabled={settingStatus}
                    className="px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition disabled:opacity-50"
                  >
                    {settingStatus ? "Setting..." : "Set Status"}
                  </button>
                </form>
              </div>

              {/* Check User Status */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Check User Status</h3>
                <form onSubmit={handleCheckUserStatus}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={checkPhone}
                      onChange={(e) => setCheckPhone(e.target.value)}
                      placeholder="e.g., 919876543210"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={checkingStatus}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                  >
                    {checkingStatus ? "Checking..." : "Check Status"}
                  </button>
                </form>

                {userStatus && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Status:</p>
                    <p className="text-gray-900 font-medium">{userStatus.status || "No status set"}</p>
                    {userStatus.statusTimestamp && (
                      <p className="text-xs text-gray-500 mt-1">
                        Updated: {new Date(userStatus.statusTimestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Update Profile Picture */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Your Profile Picture</h3>
                <form onSubmit={handleUpdateProfilePicture}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Picture
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                    />
                    {profileImagePreview && (
                      <div className="mt-4">
                        <img
                          src={profileImagePreview}
                          alt="Preview"
                          className="w-32 h-32 rounded-full object-cover border-2 border-gray-300"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={updatingProfile || !profileImage}
                    className="px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition disabled:opacity-50"
                  >
                    {updatingProfile ? "Updating..." : "Update Profile Picture"}
                  </button>
                </form>
              </div>

              {/* Check Profile Picture */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Check User Profile Picture</h3>
                <form onSubmit={handleCheckProfilePicture}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={checkProfilePhone}
                      onChange={(e) => setCheckProfilePhone(e.target.value)}
                      placeholder="e.g., 919876543210"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={checkingProfile}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                  >
                    {checkingProfile ? "Checking..." : "Check Profile Picture"}
                  </button>
                </form>

                {profilePicUrl && (
                  <div className="mt-4">
                    <img
                      src={profilePicUrl}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover border-2 border-gray-300"
                      onError={() => {
                        setProfilePicUrl(null);
                        toast.error("Failed to load profile picture");
                      }}
                    />
                  </div>
                )}
                {profilePicUrl === null && checkingProfile === false && userStatus !== null && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">No profile picture available</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileStatusPanel;

