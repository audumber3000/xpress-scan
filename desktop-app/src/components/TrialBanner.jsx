import React from 'react';
import { AlertTriangle, Clock, CheckCircle, X } from 'lucide-react';
import { getAppStatus, getTrialDaysRemaining } from '../utils/license';

const TrialBanner = ({ onActivate, onDismiss }) => {
  const appStatus = getAppStatus();
  
  // Don't show banner for licensed users
  if (appStatus.status === 'licensed') {
    return null;
  }
  
  // Trial active
  if (appStatus.status === 'trial') {
    const daysRemaining = appStatus.daysRemaining;
    const isUrgent = daysRemaining <= 3;
    
    return (
      <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between ${
        isUrgent ? 'bg-red-500' : 'bg-amber-500'
      } text-white text-sm`}>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4" />
          <span>
            <strong>Trial:</strong> {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onActivate}
            className={`px-3 py-1 rounded text-sm font-medium ${
              isUrgent 
                ? 'bg-white text-red-600 hover:bg-red-50' 
                : 'bg-white text-amber-600 hover:bg-amber-50'
            }`}
          >
            Activate License
          </button>
          {onDismiss && (
            <button onClick={onDismiss} className="hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Trial expired
  if (appStatus.status === 'expired') {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Trial Expired</h2>
          <p className="text-gray-600 mb-6">
            Your 14-day free trial has ended. Please purchase a license to continue using BDent.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={onActivate}
              className="w-full py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Activate License
            </button>
            <a
              href="https://clinohealth.app/bdent/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-6 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Pricing
            </a>
          </div>
          
          <p className="mt-6 text-sm text-gray-500">
            Already purchased? Enter your license key above.
          </p>
        </div>
      </div>
    );
  }
  
  return null;
};

export default TrialBanner;
