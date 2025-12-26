import React, { useState, useEffect } from 'react';
import { checkServerStatus } from '../tauri';
import betterClinicLogo from '../assets/betterclinic-logo.png';

const StartupScreen = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState([
    { id: 'database', label: 'Connecting to database', status: 'pending' },
    { id: 'api', label: 'Starting API server', status: 'pending' },
    { id: 'sync', label: 'Syncing data', status: 'pending' },
    { id: 'ready', label: 'Preparing workspace', status: 'pending' },
  ]);
  const [error, setError] = useState(null);

  useEffect(() => {
    runStartupChecks();
  }, []);

  const updateStepStatus = (stepId, status) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const runStartupChecks = async () => {
    try {
      // Step 1: Check Database
      updateStepStatus('database', 'running');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const status = await checkServerStatus();
      
      if (!status.postgres_running) {
        // Wait for PostgreSQL to start (it starts automatically)
        let retries = 0;
        while (retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const newStatus = await checkServerStatus();
          if (newStatus.postgres_running) break;
          retries++;
        }
        
        const finalStatus = await checkServerStatus();
        if (!finalStatus.postgres_running) {
          throw new Error('Database failed to start. Please restart the application.');
        }
      }
      updateStepStatus('database', 'complete');
      setCurrentStep(1);

      // Step 2: Check API Server
      updateStepStatus('api', 'running');
      await new Promise(resolve => setTimeout(resolve, 600));
      
      if (!status.backend_running) {
        let retries = 0;
        while (retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const newStatus = await checkServerStatus();
          if (newStatus.backend_running) break;
          retries++;
        }
        
        const finalStatus = await checkServerStatus();
        if (!finalStatus.backend_running) {
          throw new Error('API server failed to start. Please restart the application.');
        }
      }
      updateStepStatus('api', 'complete');
      setCurrentStep(2);

      // Step 3: Sync Data (check for cloud sync if enabled)
      updateStepStatus('sync', 'running');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if cloud sync is enabled and sync if needed
      const cloudEnabled = localStorage.getItem('cloud_sync_enabled') === 'true';
      if (cloudEnabled && navigator.onLine) {
        // Perform cloud sync
        try {
          await syncFromCloud();
          localStorage.setItem('last_sync_time', Date.now().toString());
        } catch (syncError) {
          console.warn('Cloud sync failed, continuing with local data:', syncError);
        }
      }
      updateStepStatus('sync', 'complete');
      setCurrentStep(3);

      // Step 4: Prepare Workspace
      updateStepStatus('ready', 'running');
      await new Promise(resolve => setTimeout(resolve, 400));
      updateStepStatus('ready', 'complete');

      // All done - wait a moment then proceed
      await new Promise(resolve => setTimeout(resolve, 500));
      onComplete();

    } catch (err) {
      console.error('Startup error:', err);
      setError(err.message);
      
      // Mark current step as failed
      const currentStepId = steps[currentStep]?.id;
      if (currentStepId) {
        updateStepStatus(currentStepId, 'error');
      }
    }
  };

  const syncFromCloud = async () => {
    // Placeholder for cloud sync logic
    // This would call your cloud API to get latest data
    return new Promise(resolve => setTimeout(resolve, 1000));
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'complete':
        return (
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'running':
        return (
          <div className="w-6 h-6 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
        );
      case 'error':
        return (
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src={betterClinicLogo} 
            alt="BDent" 
            className="h-16 w-auto"
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Starting BDent
        </h1>
        <p className="text-gray-500 text-center mb-8">
          Please wait while we prepare your workspace
        </p>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`flex items-center space-x-4 p-3 rounded-lg transition-colors ${
                step.status === 'running' ? 'bg-green-50' : 
                step.status === 'error' ? 'bg-red-50' : ''
              }`}
            >
              {getStepIcon(step.status)}
              <span className={`flex-1 ${
                step.status === 'complete' ? 'text-gray-600' :
                step.status === 'running' ? 'text-green-700 font-medium' :
                step.status === 'error' ? 'text-red-700' :
                'text-gray-400'
              }`}>
                {step.label}
              </span>
              {step.status === 'complete' && (
                <span className="text-xs text-gray-400">Done</span>
              )}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + (steps[currentStep]?.status === 'running' ? 0.5 : 0)) / steps.length) * 100}%` }}
          />
        </div>

        {/* Version */}
        <p className="text-center text-xs text-gray-400 mt-6">
          BDent v1.0.0
        </p>
      </div>
    </div>
  );
};

export default StartupScreen;
