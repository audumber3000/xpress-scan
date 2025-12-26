import React, { useState } from 'react';
import { Key, CheckCircle, AlertCircle, Loader2, X, Building2 } from 'lucide-react';
import { activateLicense, validateLicenseKeyFormat } from '../utils/license';

const LicenseActivation = ({ onSuccess, onClose }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const formatLicenseKey = (value) => {
    // Remove all non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Add BDENT prefix if not present
    let formatted = cleaned;
    if (!cleaned.startsWith('BDENT')) {
      formatted = cleaned;
    }
    
    // Format as BDENT-XXXX-XXXX-XXXX
    const parts = [];
    if (formatted.startsWith('BDENT')) {
      parts.push('BDENT');
      formatted = formatted.slice(5);
    }
    
    for (let i = 0; i < formatted.length && parts.length < 4; i += 4) {
      parts.push(formatted.slice(i, i + 4));
    }
    
    return parts.join('-');
  };

  const handleKeyChange = (e) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseKey(formatted);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!clinicName.trim()) {
      setError('Please enter your clinic name');
      return;
    }
    
    if (!validateLicenseKeyFormat(licenseKey)) {
      setError('Invalid license key format. Expected: BDENT-XXXX-XXXX-XXXX');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await activateLicense(licenseKey, clinicName.trim());
      setSuccess(true);
      setTimeout(() => {
        onSuccess && onSuccess();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to activate license');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">License Activated!</h2>
          <p className="text-gray-600">
            Thank you for purchasing BDent. Your software is now fully activated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Activate License</h2>
            <p className="text-gray-600 mt-1">Enter your license key to activate BDent</p>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clinic Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Your Dental Clinic"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              License Key
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={licenseKey}
                onChange={handleKeyChange}
                placeholder="BDENT-XXXX-XXXX-XXXX"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono uppercase"
                maxLength={19}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Activating...
              </>
            ) : (
              'Activate License'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600 mb-2">Don't have a license?</p>
          <a
            href="https://betterclinic.app/bdent/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
          >
            Purchase BDent →
          </a>
        </div>
      </div>
    </div>
  );
};

export default LicenseActivation;
