import React, { useState, useEffect } from 'react';
import { Monitor, Server, Wifi, CheckCircle, AlertCircle, Loader2, Shield, Database, FileText, ChevronRight } from 'lucide-react';
import { completeSetup, getLocalIp, isTauri, startServerServices } from '../tauri';

const SetupWizard = ({ onComplete }) => {
  const [step, setStep] = useState(0); // Start at 0 for welcome screen
  const [mode, setMode] = useState(null);
  const [serverIp, setServerIp] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatus, setInstallStatus] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const fetchLocalIp = async () => {
      try {
        const ip = await getLocalIp();
        setLocalIp(ip);
      } catch (err) {
        console.error('Failed to get local IP:', err);
      }
    };
    fetchLocalIp();
  }, []);

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    if (selectedMode === 'server') {
      setStep(3); // Go to installation progress for server
    } else {
      setStep(4); // Go to client config
    }
  };

  const handleAcceptTerms = () => {
    if (termsAccepted) {
      setStep(2); // Go to mode selection
    }
  };

  // Simulate installation progress for server mode
  const runServerInstallation = async () => {
    setIsInstalling(true);
    setInstallProgress(0);
    
    const steps = [
      { progress: 10, status: 'Checking system requirements...' },
      { progress: 20, status: 'Preparing database directory...' },
      { progress: 40, status: 'Initializing PostgreSQL database...' },
      { progress: 60, status: 'Starting PostgreSQL server...' },
      { progress: 80, status: 'Starting backend services...' },
      { progress: 90, status: 'Verifying services...' },
      { progress: 100, status: 'Installation complete!' },
    ];

    try {
      // Start actual services
      for (let i = 0; i < steps.length - 1; i++) {
        setInstallProgress(steps[i].progress);
        setInstallStatus(steps[i].status);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Actually start services
      await startServerServices();
      
      setInstallProgress(100);
      setInstallStatus('Installation complete!');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setStep(5); // Go to completion screen
    } catch (err) {
      setError(err.message || 'Installation failed');
      setIsInstalling(false);
    }
  };

  useEffect(() => {
    if (step === 3 && mode === 'server' && !isInstalling) {
      runServerInstallation();
    }
  }, [step, mode]);

  const testConnection = async () => {
    if (!serverIp) {
      setError('Please enter the server IP address');
      return;
    }

    setTestingConnection(true);
    setError(null);
    setConnectionSuccess(false);

    try {
      const response = await fetch(`http://${serverIp}:8000/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        setConnectionSuccess(true);
        setError(null);
      } else {
        setError('Server responded but health check failed');
      }
    } catch (err) {
      setError('Cannot connect to server. Make sure the server is running and the IP is correct.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      await completeSetup(mode, mode === 'client' ? serverIp : null);
      onComplete();
    } catch (err) {
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        
        {/* Step 0: Welcome Screen */}
        {step === 0 && (
          <div className="text-center">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Database className="w-12 h-12 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Welcome to BDent
            </h1>
            <p className="text-gray-600 mb-8">
              Professional dental practice management software by Better Clinic
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-gray-50 rounded-xl">
                <Shield className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Secure & Private</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <Database className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Offline First</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <Wifi className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Multi-Computer</p>
              </div>
            </div>
            
            <button
              onClick={() => setStep(1)}
              className="w-full py-4 px-6 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center text-lg font-semibold"
            >
              Get Started
              <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        )}

        {/* Step 1: Terms and Conditions */}
        {step === 1 && (
          <div>
            <div className="text-center mb-6">
              <FileText className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Terms & Conditions</h2>
              <p className="text-gray-600 mt-2">Please read and accept our terms to continue</p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 h-64 overflow-y-auto mb-6 text-sm text-gray-700">
              <h3 className="font-bold mb-2">End User License Agreement</h3>
              <p className="mb-4">
                By installing and using BDent by Better Clinic ("the Software"), 
                you agree to the following terms and conditions:
              </p>
              
              <h4 className="font-semibold mb-1">1. License Grant</h4>
              <p className="mb-3">
                We grant you a non-exclusive, non-transferable license to use the Software 
                for your dental clinic operations.
              </p>
              
              <h4 className="font-semibold mb-1">2. Data Privacy</h4>
              <p className="mb-3">
                All patient data is stored locally on your computer/server. We do not collect, 
                transmit, or have access to any patient information. You are responsible for 
                maintaining appropriate backups and security measures.
              </p>
              
              <h4 className="font-semibold mb-1">3. Medical Disclaimer</h4>
              <p className="mb-3">
                This software is a management tool and does not provide medical advice. 
                All medical decisions should be made by qualified healthcare professionals.
              </p>
              
              <h4 className="font-semibold mb-1">4. Data Backup</h4>
              <p className="mb-3">
                You are responsible for regularly backing up your data. We recommend daily 
                backups to prevent data loss.
              </p>
              
              <h4 className="font-semibold mb-1">5. Limitation of Liability</h4>
              <p className="mb-3">
                The software is provided "as is" without warranty of any kind. We shall not 
                be liable for any damages arising from the use of this software.
              </p>
            </div>
            
            <label className="flex items-center space-x-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-gray-700">
                I have read and agree to the Terms & Conditions
              </span>
            </label>
            
            <div className="flex space-x-4">
              <button
                onClick={() => setStep(0)}
                className="flex-1 py-3 px-6 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleAcceptTerms}
                disabled={!termsAccepted}
                className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept & Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Mode Selection */}
        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">Choose Setup Mode</h2>
              <p className="text-gray-600 mt-2">How will this computer be used?</p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => handleModeSelect('server')}
                className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <Server className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Server (Main Computer)
                    </h3>
                    <p className="text-gray-600 mt-1">
                      This is the main computer where all data will be stored. 
                      Usually the doctor's or admin's computer.
                    </p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
                </div>
              </button>

              <button
                onClick={() => handleModeSelect('client')}
                className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <Monitor className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Client (Other Computers)
                    </h3>
                    <p className="text-gray-600 mt-1">
                      This computer will connect to the main server. 
                      For receptionists, nurses, or other staff.
                    </p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-green-600" />
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setStep(1)}
              className="mt-6 w-full py-3 px-6 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 3: Installation Progress (Server Mode) */}
        {step === 3 && mode === 'server' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Database className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Setting Up Server</h2>
            <p className="text-gray-600 mb-8">Please wait while we configure your system...</p>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
              <div 
                className="bg-indigo-600 h-4 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${installProgress}%` }}
              />
            </div>
            
            <div className="flex justify-between text-sm text-gray-600 mb-4">
              <span>{installStatus}</span>
              <span>{installProgress}%</span>
            </div>
            
            {/* Installation Steps */}
            <div className="text-left bg-gray-50 rounded-xl p-4 mt-6">
              <div className="space-y-3">
                <div className={`flex items-center space-x-3 ${installProgress >= 10 ? 'text-green-600' : 'text-gray-400'}`}>
                  {installProgress >= 20 ? <CheckCircle className="w-5 h-5" /> : <Loader2 className={`w-5 h-5 ${installProgress >= 10 && installProgress < 20 ? 'animate-spin' : ''}`} />}
                  <span>System requirements check</span>
                </div>
                <div className={`flex items-center space-x-3 ${installProgress >= 40 ? 'text-green-600' : 'text-gray-400'}`}>
                  {installProgress >= 40 ? <CheckCircle className="w-5 h-5" /> : <Loader2 className={`w-5 h-5 ${installProgress >= 20 && installProgress < 40 ? 'animate-spin' : ''}`} />}
                  <span>Initialize PostgreSQL database</span>
                </div>
                <div className={`flex items-center space-x-3 ${installProgress >= 60 ? 'text-green-600' : 'text-gray-400'}`}>
                  {installProgress >= 60 ? <CheckCircle className="w-5 h-5" /> : <Loader2 className={`w-5 h-5 ${installProgress >= 40 && installProgress < 60 ? 'animate-spin' : ''}`} />}
                  <span>Start PostgreSQL server</span>
                </div>
                <div className={`flex items-center space-x-3 ${installProgress >= 80 ? 'text-green-600' : 'text-gray-400'}`}>
                  {installProgress >= 80 ? <CheckCircle className="w-5 h-5" /> : <Loader2 className={`w-5 h-5 ${installProgress >= 60 && installProgress < 80 ? 'animate-spin' : ''}`} />}
                  <span>Start backend services</span>
                </div>
                <div className={`flex items-center space-x-3 ${installProgress >= 100 ? 'text-green-600' : 'text-gray-400'}`}>
                  {installProgress >= 100 ? <CheckCircle className="w-5 h-5" /> : <Loader2 className={`w-5 h-5 ${installProgress >= 80 && installProgress < 100 ? 'animate-spin' : ''}`} />}
                  <span>Verify installation</span>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Client Configuration */}
        {step === 4 && mode === 'client' && (
          <div>
            <div className="text-center mb-6">
              <Monitor className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Connect to Server</h2>
              <p className="text-gray-600 mt-2">Enter the server's IP address to connect</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-start space-x-4">
                <Wifi className="w-6 h-6 text-blue-600 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-800">Server IP Address</h3>
                  <p className="text-blue-700 mt-1 text-sm">
                    Ask the administrator for the server's IP address.
                  </p>
                  <input
                    type="text"
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    placeholder="e.g., 192.168.1.100"
                    className="mt-3 w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}

            {connectionSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-700">Successfully connected to server!</p>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={() => setStep(2)}
                className="py-3 px-6 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={testConnection}
                disabled={testingConnection || !serverIp}
                className="py-3 px-6 border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 flex items-center"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
              <button
                onClick={async () => {
                  await completeSetup('client', serverIp);
                  onComplete();
                }}
                disabled={loading || !connectionSuccess}
                className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Server Setup Complete */}
        {step === 5 && mode === 'server' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Setup Complete!</h2>
            <p className="text-gray-600 mb-6">Your server is ready to use</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-start space-x-4">
                <Wifi className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-blue-800">Your Server IP Address</h3>
                  <p className="text-3xl font-mono font-bold text-blue-900 mt-2">
                    {localIp || 'Detecting...'}
                  </p>
                  <p className="text-blue-700 mt-2 text-sm">
                    Share this IP with other computers to connect to this server.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-700">PostgreSQL Running</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-700">Backend API Running</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={async () => {
                await completeSetup('server', null);
                onComplete();
              }}
              className="w-full py-4 px-6 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center text-lg font-semibold"
            >
              Start Using BDent
              <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SetupWizard;
