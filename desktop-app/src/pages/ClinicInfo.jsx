import React, { useState, useEffect } from 'react';
import { useHeader } from '../contexts/HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { toast } from 'react-toastify';
import GearLoader from '../components/GearLoader';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const ClinicInfo = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clinicData, setClinicData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    timings: {
      monday: { open: '08:00', close: '20:00', closed: false },
      tuesday: { open: '08:00', close: '20:00', closed: false },
      wednesday: { open: '08:00', close: '20:00', closed: false },
      thursday: { open: '08:00', close: '20:00', closed: false },
      friday: { open: '08:00', close: '20:00', closed: false },
      saturday: { open: '08:00', close: '20:00', closed: false },
      sunday: { open: '08:00', close: '20:00', closed: true }
    }
  });
  const [loadingClinicData, setLoadingClinicData] = useState(false);
  const [savingClinicData, setSavingClinicData] = useState(false);

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Admin Hub</span>
        </button>
      </div>
    );
    fetchClinicData();
  }, [setTitle, navigate]);

  const fetchClinicData = async () => {
    try {
      setLoadingClinicData(true);
      const data = await api.get('/clinics/me');
      setClinicData({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        gst_number: data.gst_number || '',
        timings: data.timings || clinicData.timings
      });
    } catch (error) {
      console.error('Error fetching clinic data:', error);
      toast.error('Failed to load clinic data');
    } finally {
      setLoadingClinicData(false);
    }
  };

  const handleSaveClinicData = async () => {
    try {
      setSavingClinicData(true);
      await api.put('/clinics/me', clinicData);
      toast.success('Clinic information updated successfully');
    } catch (error) {
      console.error('Error saving clinic data:', error);
      toast.error('Failed to save clinic data');
    } finally {
      setSavingClinicData(false);
    }
  };

  if (loadingClinicData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <GearLoader />
      </div>
    );
  }

  if (!user?.clinic_id) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-yellow-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-yellow-800 mb-2">Clinic Access Required</h3>
          <p className="text-yellow-700">You are not associated with any clinic. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header with teal theme */}
        <div className="bg-gradient-to-r from-[#2D9596] to-[#1F6B72] rounded-lg p-6 mb-6 text-white">
          <h2 className="text-2xl font-bold mb-2">Clinic Information</h2>
          <p className="text-white/90">Manage your clinic's basic information and operating hours</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h5 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Basic Information</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Clinic Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Clinic Name *</label>
                  <input
                    type="text"
                    value={clinicData.name}
                    onChange={(e) => setClinicData({ ...clinicData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent"
                    placeholder="Enter clinic name"
                  />
                </div>

                {/* GST Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                  <input
                    type="text"
                    value={clinicData.gst_number}
                    onChange={(e) => setClinicData({ ...clinicData, gst_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent"
                    placeholder="Enter GST number (optional)"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                  <input
                    type="text"
                    value={clinicData.address}
                    onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent"
                    placeholder="Enter clinic address"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={clinicData.phone}
                    onChange={(e) => setClinicData({ ...clinicData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={clinicData.email}
                    onChange={(e) => setClinicData({ ...clinicData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent"
                    placeholder="Enter clinic email"
                  />
                </div>
              </div>
            </div>

            {/* Operating Hours */}
            <div>
              <h5 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Operating Hours</h5>
              <p className="text-sm text-gray-500 mb-4">Set your clinic's working hours for each day</p>
              <div className="space-y-3">
                {Object.entries(clinicData.timings).map(([day, timing]) => (
                  <div key={day} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                    <div className="w-28">
                      <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={timing.open}
                        onChange={(e) => setClinicData({
                          ...clinicData,
                          timings: {
                            ...clinicData.timings,
                            [day]: { ...timing, open: e.target.value }
                          }
                        })}
                        disabled={timing.closed}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent disabled:bg-gray-200 disabled:text-gray-500"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={timing.close}
                        onChange={(e) => setClinicData({
                          ...clinicData,
                          timings: {
                            ...clinicData.timings,
                            [day]: { ...timing, close: e.target.value }
                          }
                        })}
                        disabled={timing.closed}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9596] focus:border-transparent disabled:bg-gray-200 disabled:text-gray-500"
                      />
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={timing.closed}
                        onChange={(e) => setClinicData({
                          ...clinicData,
                          timings: {
                            ...clinicData.timings,
                            [day]: { ...timing, closed: e.target.checked }
                          }
                        })}
                        className="w-4 h-4 text-[#2D9596] border-gray-300 rounded focus:ring-[#2D9596]"
                      />
                      <span className="text-sm text-gray-600">Closed</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                onClick={handleSaveClinicData}
                disabled={savingClinicData}
                className="px-6 py-3 bg-[#2D9596] text-white rounded-lg hover:bg-[#1F6B72] disabled:opacity-50 font-medium transition-colors"
              >
                {savingClinicData ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicInfo;
