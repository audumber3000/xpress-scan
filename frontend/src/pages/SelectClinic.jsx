import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import GearLoader from "../components/GearLoader";

const SelectClinic = () => {
  const { user, switchClinic } = useAuth();
  const navigate = useNavigate();
  const [isSwitching, setIsSwitching] = useState(false);

  // If user has no clinics or just one, they shouldn't be here (ideally)
  const clinics = user?.clinics || [];

  const handleClinicSelect = async (clinicId) => {
    setIsSwitching(true);
    try {
      await switchClinic(clinicId);
      toast.success("Clinic selected successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to switch clinic:", error);
      toast.error("Failed to select clinic. Please try again.");
    } finally {
      setIsSwitching(false);
    }
  };

  if (isSwitching) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <GearLoader size="w-16 h-16" />
        <p className="mt-4 text-gray-600 font-medium">Entering clinic dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-[#2a276e] mb-3">Welcome back, {user?.first_name || 'Doctor'}</h1>
          <p className="text-gray-500 text-lg">Please select a clinic to continue to your dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clinics.map((clinic) => (
            <button
              key={clinic.id}
              onClick={() => handleClinicSelect(clinic.id)}
              className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-[#2a276e]/30 flex flex-col items-center text-center overflow-hidden"
            >
              {/* Decorative background element */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#2a276e]/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>

              <div className="w-20 h-20 rounded-2xl overflow-hidden mb-6 shadow-md group-hover:scale-110 transition-transform duration-300">
                <img
                  src={clinic.logo_url || "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=200&h=200&fit=crop&auto=format"}
                  alt={clinic.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=200&h=200&fit=crop&auto=format"; }}
                />
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2 truncate w-full group-hover:text-[#2a276e]">
                {clinic.name}
              </h2>
              <p className="text-sm text-gray-500 mb-6 line-clamp-2 min-h-[40px]">
                {clinic.address || "No address provided"}
              </p>

              <div className="mt-auto w-full py-3 px-4 rounded-xl bg-gray-50 text-[#2a276e] font-bold text-sm group-hover:bg-[#2a276e] group-hover:text-white transition-colors duration-300">
                Select Clinic
              </div>
            </button>
          ))}

          {/* Add New Clinic Option */}
          <button
            onClick={() => navigate("/onboarding")}
            className="group bg-white rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all border-2 border-dashed border-gray-200 hover:border-[#2a276e]/50 flex flex-col items-center justify-center text-center py-12"
          >
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-[#2a276e]/10 transition-colors">
              <svg className="w-8 h-8 text-gray-400 group-hover:text-[#2a276e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-600 group-hover:text-[#2a276e]">Add New Clinic</span>
          </button>
        </div>

        <div className="mt-12 text-center">
            <button 
                onClick={() => navigate("/login")}
                className="text-gray-400 hover:text-gray-600 font-medium text-sm transition-colors"
            >
                Not you? Log out and sign in again
            </button>
        </div>
      </div>
    </div>
  );
};

export default SelectClinic;
