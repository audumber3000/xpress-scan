import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";
import { toast } from 'react-toastify';

const DoctorProfile = () => {
  // All state and hooks at the top
  const { user } = useAuth();
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.email?.split("@")[0] ||
    "User";
  const userEmail = user?.email || "";
  
  // User and clinic data state (use user.clinic from context when present, e.g. after login)
  const [userData, setUserData] = useState(null);
  const [clinicData, setClinicData] = useState(user?.clinic ?? null);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [userDataError, setUserDataError] = useState("");

  // Signature state
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const signatureInputRef = useRef(null);

  // Fetch user and clinic data
  const fetchUserAndClinicData = async () => {
    try {
      setLoadingUserData(true);
      const response = await api.get("/auth/me");
      setUserData(response);
      setClinicData(response.clinic);
      if (response.signature_url) setSignaturePreview(response.signature_url);
    } catch (error) {
      console.error("Error fetching user and clinic data:", error);
      setUserDataError("Failed to load profile data");
    } finally {
      setLoadingUserData(false);
    }
  };

  useEffect(() => {
    fetchUserAndClinicData();
  }, []);

  const handleSignatureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Only PNG or JPG images are allowed');
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error('Signature image must be under 512KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setSignaturePreview(base64);
      setSignatureUploading(true);
      try {
        await api.patch('/auth/me/signature', { signature_url: base64 });
        toast.success('Signature saved successfully');
      } catch {
        toast.error('Failed to save signature');
      } finally {
        setSignatureUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = async () => {
    setSignatureUploading(true);
    try {
      await api.patch('/auth/me/signature', { signature_url: null });
      setSignaturePreview(null);
      toast.success('Signature removed');
    } catch {
      toast.error('Failed to remove signature');
    } finally {
      setSignatureUploading(false);
    }
  };

  // Handle clinic deletion
  const handleDeleteClinic = async () => {
    // Multiple confirmation steps for safety
    const firstConfirm = window.confirm(
      "⚠️ WARNING: You are about to permanently delete the entire clinic and all associated data.\n\n" +
      "This will delete:\n" +
      "• All patients and their records\n" +
      "• All reports and medical documents\n" +
      "• All users (doctors, receptionists, clinic owners)\n" +
      "• All scan types and pricing\n" +
      "• All referring doctors\n" +
      "• The clinic account itself\n\n" +
      "This action CANNOT be undone. Are you absolutely sure?"
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "FINAL WARNING: This is your last chance to cancel.\n\n" +
      "You are about to permanently delete everything associated with this clinic.\n" +
      "This action cannot be undone.\n\n" +
      "Type 'DELETE' to confirm:"
    );

    if (!secondConfirm) return;

    const userInput = window.prompt(
      "To confirm deletion, please type 'DELETE' (case sensitive):"
    );

    if (userInput !== "DELETE") {
      toast.error("Deletion cancelled. Clinic was not deleted.");
      return;
    }

    try {
      toast.info("Deleting clinic and all associated data...");
      
      // Call the backend to delete the clinic and all associated data
      await api.delete(`/clinics/${clinicData.id}/delete-all`);
      
      toast.success("Clinic and all associated data have been permanently deleted.");
      
      // Redirect to login page since the user account will also be deleted
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
      
    } catch (error) {
      console.error("Error deleting clinic:", error);
      toast.error(error.message || "Failed to delete clinic. Please try again.");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
      <h1 className="text-3xl font-bold mb-6">Doctor Profile</h1>
      
      {/* Personal Information Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
        {loadingUserData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-center py-8">
              <GearLoader size="w-8 h-8" />
              <span className="ml-3 text-gray-600">Loading profile data...</span>
            </div>
          </div>
        ) : userDataError ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-red-600 text-center py-4">{userDataError}</div>
          </div>
        ) : userData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                <p className="text-gray-900 font-medium">{userName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                <p className="text-gray-900 font-medium truncate" title={userEmail}>{userEmail}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">User ID</label>
                <p className="text-gray-900 font-medium">{userData?.id || 'N/A'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-4">
              <p className="text-gray-500">No user information available</p>
            </div>
          </div>
        )}
      </div>

      {/* Signature Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Signature</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-4">Your signature will appear on prescriptions and official documents generated by the system.</p>
          <div className="flex items-start gap-6 flex-wrap">
            {/* Current signature preview */}
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Current Signature</label>
              <div className="h-28 w-full max-w-sm border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50">
                {signaturePreview ? (
                  <img src={signaturePreview} alt="Signature" className="max-h-24 max-w-full object-contain p-2" />
                ) : (
                  <p className="text-xs text-gray-400 text-center px-4">No signature uploaded yet</p>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="flex flex-col gap-3 justify-center pt-6">
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleSignatureChange}
              />
              <button
                onClick={() => signatureInputRef.current?.click()}
                disabled={signatureUploading}
                className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#1f6b72] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                {signatureUploading ? 'Saving...' : signaturePreview ? 'Change Signature' : 'Upload Signature'}
              </button>
              {signaturePreview && (
                <button
                  onClick={handleRemoveSignature}
                  disabled={signatureUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  Remove
                </button>
              )}
              <p className="text-[11px] text-gray-400">PNG or JPG, max 512KB</p>
            </div>
          </div>
        </div>
      </div>

      {/* Clinic Information Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Clinic Information</h2>
        {loadingUserData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-center py-8">
              <GearLoader size="w-8 h-8" />
              <span className="ml-3 text-gray-600">Loading clinic data...</span>
            </div>
          </div>
        ) : userDataError ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-red-600 text-center py-4">{userDataError}</div>
          </div>
        ) : clinicData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Clinic Name</label>
                <p className="text-gray-900 font-medium">{clinicData.name || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
                <p className="text-gray-900 font-medium">{clinicData.address || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                <p className="text-gray-900 font-medium">{clinicData.phone || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                <p className="text-gray-900 font-medium truncate" title={clinicData.email || 'N/A'}>{clinicData.email || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Specialization</label>
                <p className="text-gray-900 font-medium">{clinicData.specialization || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Plan</label>
                <p className="text-gray-900 font-medium">{clinicData.subscription_plan || 'N/A'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-4">
              <p className="text-gray-500">No clinic information available</p>
              <p className="text-sm text-gray-400 mt-1">Complete onboarding to set up clinic details</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Clinic Section */}
      {clinicData && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Delete Clinic</h3>
                <p className="text-red-700 mb-4">
                  This action will permanently delete the entire clinic and all associated data including:
                </p>
                <ul className="text-red-700 text-sm mb-4 list-disc list-inside space-y-1">
                  <li>All patients and their records</li>
                  <li>All reports and medical documents</li>
                  <li>All users (doctors, receptionists, clinic owners)</li>
                  <li>All scan types and pricing</li>
                  <li>All referring doctors</li>
                  <li>The clinic account itself</li>
                </ul>
                <p className="text-red-700 font-medium">
                  ⚠️ This action cannot be undone. Please be absolutely certain before proceeding.
                </p>
                </div>
            </div>
            <div className="mt-6">
              <button
                onClick={handleDeleteClinic}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete Clinic
              </button>
            </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default DoctorProfile; 