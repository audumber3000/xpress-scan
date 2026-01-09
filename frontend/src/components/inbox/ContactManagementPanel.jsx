import React, { useState } from "react";
import { api } from "../../utils/api";
import { toast } from "react-toastify";

const ContactManagementPanel = ({ onClose }) => {
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [isRegistered, setIsRegistered] = useState(null);

  const handleCheckRegistration = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    // Clean phone number (remove + and spaces, keep only digits)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid phone number with country code");
      return;
    }

    console.log("Original phone:", phone);
    console.log("Cleaned phone:", cleanPhone);

    setChecking(true);
    try {
      // Use cleaned phone number
      const data = await api.get(`/whatsapp/contacts/check/${cleanPhone}`);
      console.log("Check registration response data:", data);
      console.log("isRegistered type:", typeof data?.isRegistered);
      console.log("isRegistered value:", data?.isRegistered);
      
      // api.get() returns the data directly, not wrapped in response.data
      if (data && typeof data === 'object') {
        // Check if isRegistered exists and is a boolean
        if ('isRegistered' in data && typeof data.isRegistered === 'boolean') {
          setIsRegistered(data.isRegistered);
          // Show warning if there's an error message but still show result
          if (data.error) {
            console.warn("Warning from server:", data.error);
            // Only show warning toast if it's not a session error
            if (!data.error.includes('session not ready')) {
              toast.warning(data.error);
            }
          }
        } else if (data.error) {
          // If there's an error but no isRegistered, show error
          console.error("Error in response:", data.error);
          setIsRegistered(false);
          toast.error(data.error);
        } else {
          // Unknown response structure
          console.error("Unexpected response structure - missing isRegistered:", data);
          console.error("Available keys:", Object.keys(data));
          setIsRegistered(false);
          toast.error("Invalid response structure from server - missing isRegistered field");
        }
      } else {
        console.error("No data or invalid data in response:", data);
        setIsRegistered(false);
        toast.error("No valid data received from server");
      }
    } catch (error) {
      console.error("Check registration error:", error);
      console.error("Error response:", error.response);
      setIsRegistered(false);
      
      // Try to extract error message from different possible locations
      // Note: api.get() throws errors, so error.response might not exist
      const errorMsg = error.message || 
                      error.response?.data?.detail || 
                      error.response?.data?.error || 
                      error.response?.data?.message ||
                      "Failed to check registration";
      toast.error(errorMsg);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Check WhatsApp Registration</h2>
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
        <div className="p-6">
          {/* Check Registration */}
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Enter a phone number to check if it's registered on WhatsApp
            </p>
            <form onSubmit={handleCheckRegistration}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number (with country code)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 919876543210"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={checking}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
              >
                {checking ? "Checking..." : "Check Registration"}
              </button>
            </form>

            {isRegistered !== null && (
              <div className={`mt-4 p-4 rounded-lg ${
                isRegistered ? "bg-green-50" : "bg-red-50"
              }`}>
                <p className={`font-medium ${
                  isRegistered ? "text-green-800" : "text-red-800"
                }`}>
                  {isRegistered
                    ? "✓ This number is registered on WhatsApp"
                    : "✗ This number is not registered on WhatsApp"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactManagementPanel;

