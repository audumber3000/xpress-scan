import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { api } from '../utils/api';

const ClinicOnboarding = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    clinic_name: "",
    clinic_address: "",
    clinic_phone: "",
    clinic_email: "",
    specialization: "radiologist",
    subscription_plan: "free",
    scan_types: [
      { name: "X-Ray Chest", price: 500 },
      { name: "X-Ray Spine", price: 600 },
      { name: "Ultrasound Abdomen", price: 1200 },
      { name: "CT Scan Head", price: 2500 },
      { name: "MRI Brain", price: 5000 }
    ]
  });

  useEffect(() => {
    // Get current user from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      const userObj = JSON.parse(userData);
      setUser(userObj);
      
      // Pre-fill clinic email with user's email
      setFormData(prev => ({
        ...prev,
        clinic_email: userObj.email
      }));
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'specialization') {
      // Update treatment types based on specialization
      const treatmentTypes = getDefaultTreatmentTypes(value);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        scan_types: treatmentTypes
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const getDefaultTreatmentTypes = (specialization) => {
    const treatmentTypes = {
      'dentist': [
        { name: 'Dental Cleaning', price: 1500 },
        { name: 'Tooth Extraction', price: 2000 },
        { name: 'Root Canal Treatment', price: 8000 },
        { name: 'Dental Crown', price: 12000 },
        { name: 'Teeth Whitening', price: 5000 }
      ],
      'physiotherapist': [
        { name: 'Physiotherapy Session', price: 800 },
        { name: 'Massage Therapy', price: 1000 },
        { name: 'Exercise Therapy', price: 600 },
        { name: 'Electrotherapy', price: 500 },
        { name: 'Manual Therapy', price: 1200 }
      ],
      'radiologist': [
        { name: 'X-Ray Chest', price: 500 },
        { name: 'X-Ray Spine', price: 600 },
        { name: 'Ultrasound Abdomen', price: 1200 },
        { name: 'CT Scan Head', price: 2500 },
        { name: 'MRI Brain', price: 5000 }
      ]
    };
    return treatmentTypes[specialization] || treatmentTypes['radiologist'];
  };

  const handleScanTypeChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      scan_types: prev.scan_types.map((scan, i) => 
        i === index ? { ...scan, [field]: value } : scan
      )
    }));
  };

  const addScanType = () => {
    setFormData(prev => ({
      ...prev,
      scan_types: [...prev.scan_types, { name: "", price: 0 }]
    }));
  };

  const removeScanType = (index) => {
    setFormData(prev => ({
      ...prev,
      scan_types: prev.scan_types.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await api.post('/auth/onboarding', formData);
      
      // Update user data in localStorage
      localStorage.setItem('user', JSON.stringify(result.user));
      
      toast.success("Clinic setup completed successfully!");
      navigate("/dashboard");
      
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error(error.message || "Failed to setup clinic. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome, {user.name}!</h2>
          <p className="mt-2 text-gray-600">Let's set up your radiology clinic</p>
        </div>

        <div className="bg-white shadow rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info Section */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-green-900 mb-2">Your Information</h3>
              <p className="text-green-700">
                <strong>Name:</strong> {user.name}<br/>
                <strong>Email:</strong> {user.email}
              </p>
            </div>

            {/* Clinic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Clinic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Clinic Name *</label>
                <input
                  type="text"
                  name="clinic_name"
                  value={formData.clinic_name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Sharma's Medical Clinic"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Keep it to 3 words maximum (e.g., "Sharma's Medical Clinic")
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  name="clinic_address"
                  value={formData.clinic_address}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    name="clinic_phone"
                    value={formData.clinic_phone}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="clinic_email"
                    value={formData.clinic_email}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Specialization</label>
                  <select
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="radiologist">Radiologist</option>
                    <option value="dentist">Dentist</option>
                    <option value="physiotherapist">Physiotherapist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subscription Plan</label>
                  <select
                    name="subscription_plan"
                    value={formData.subscription_plan}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="free">Free Plan (50 patients/month)</option>
                    <option value="professional">Professional ($29/month)</option>
                    <option value="enterprise">Enterprise ($99/month)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Treatment Types */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Default Treatment Types</h3>
              <p className="text-sm text-gray-600">Set up your default treatment types and pricing</p>
              
              <div className="space-y-3">
                {formData.scan_types.map((scan, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      value={scan.name}
                      onChange={(e) => handleScanTypeChange(index, 'name', e.target.value)}
                      placeholder="Treatment name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                    <input
                      type="number"
                      value={scan.price}
                      onChange={(e) => handleScanTypeChange(index, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="Price"
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeScanType(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              <button
                type="button"
                onClick={addScanType}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-green-500 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                + Add Treatment Type
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Setting up your clinic..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClinicOnboarding; 