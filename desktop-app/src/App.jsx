import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ApiProvider } from "./contexts/ApiContext";
import { HeaderProvider } from "./contexts/HeaderContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientIntake from "./pages/PatientIntake";
import Xray from "./pages/Xray";
import Payments from "./pages/Payments";
import DoctorProfile from "./pages/DoctorProfile";
import Settings from "./pages/Settings";
import ClinicOnboarding from "./pages/ClinicOnboarding";
import AuthCallback from "./pages/AuthCallback";
import LoadingTest from "./pages/LoadingTest";
import Calendar from "./pages/Calendar";
import BookingPage from "./pages/BookingPage";
import PatientFiles from "./pages/PatientFiles";
import PatientProfile from "./pages/PatientProfile";
import Attendance from "./pages/Attendance";
import About from "./pages/About";
import Features from "./pages/Features";
import SetupWizard from "./pages/SetupWizard";
import Reports from "./pages/Reports";

// Components
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ServerStatus from "./components/ServerStatus";
import StartupScreen from "./components/StartupScreen";
import SyncIndicator from "./components/SyncIndicator";

// Tauri utilities
import { isFirstRun, isTauri } from "./tauri";

// License utilities
import { startTrial, getAppStatus } from "./utils/license";
import TrialBanner from "./components/TrialBanner";
import LicenseActivation from "./components/LicenseActivation";

// Sync utilities
import { initializeSync, performFullSync } from "./utils/sync";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showStartupScreen, setShowStartupScreen] = useState(false);
  const [checkingFirstRun, setCheckingFirstRun] = useState(true);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);

  // Check if this is first run (Tauri only)
  useEffect(() => {
    const checkFirstRun = async () => {
      if (isTauri()) {
        try {
          const firstRun = await isFirstRun();
          if (firstRun) {
            setShowSetupWizard(true);
          } else {
            // Not first run - show startup screen
            setShowStartupScreen(true);
          }
        } catch (err) {
          console.error('Failed to check first run:', err);
        }
      }
      setCheckingFirstRun(false);
    };
    checkFirstRun();
    
    // Initialize background sync
    initializeSync();
  }, []);

  // Perform startup sync after authentication
  useEffect(() => {
    const performStartupSync = async () => {
      // Only sync if user is authenticated and not in setup/setup wizard
      if (user && !loading && !checkingFirstRun && !showSetupWizard && !showStartupScreen && !syncComplete) {
        setSyncing(true);
        try {
          const result = await performFullSync();
          if (result.success || result.skip) {
            setSyncComplete(true);
          }
          // Continue even if sync fails (work with local data)
        } catch (error) {
          console.error('Startup sync error:', error);
          // Continue even if sync fails
          setSyncComplete(true);
        } finally {
          setSyncing(false);
        }
      }
    };

    performStartupSync();
  }, [user, loading, checkingFirstRun, showSetupWizard, showStartupScreen, syncComplete]);

  // Check license status and start trial if needed
  useEffect(() => {
    if (!checkingFirstRun && !showSetupWizard) {
      // Start trial on first use
      startTrial();
      // Get current license status
      setLicenseStatus(getAppStatus());
    }
  }, [checkingFirstRun, showSetupWizard]);

  const handleLicenseActivated = () => {
    setShowLicenseModal(false);
    setLicenseStatus(getAppStatus());
  };

  // Show setup wizard for first-time Tauri users
  if (checkingFirstRun) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  if (showSetupWizard) {
    return <SetupWizard onComplete={() => {
      setShowSetupWizard(false);
      // After setup, show startup screen
      if (isTauri()) {
        setShowStartupScreen(true);
      }
    }} />;
  }

  // Show startup screen for Tauri app (system checks)
  if (showStartupScreen && isTauri()) {
    return <StartupScreen onComplete={() => setShowStartupScreen(false)} />;
  }

  // Check if current route is auth page, landing page, or booking page
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/onboarding' || location.pathname === '/auth/callback';
  const isLandingPage = false; // Landing page removed - redirect to login
  const isBookingPage = location.pathname === '/booking';
  const isPublicPage = location.pathname === '/about' || location.pathname === '/features';

  if (loading || (user && syncing && !syncComplete)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Syncing data...</p>
        </div>
      </div>
    );
  }

  // For auth pages, landing page, and booking page, render without sidebar
  if (isAuthPage || isLandingPage || isBookingPage || isPublicPage) {
    return (
      <>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<ClinicOnboarding />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
        </Routes>
        <ToastContainer
          position="top-right"
          autoClose={8000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
        <ServerStatus />
      </>
    );
  }

  // For authenticated pages, render with sidebar
  return (
    <div className="flex w-full h-screen">
      {/* Trial Banner */}
      {licenseStatus && licenseStatus.status !== 'licensed' && (
        <TrialBanner 
          onActivate={() => setShowLicenseModal(true)}
        />
      )}
      
      {/* License Activation Modal */}
      {showLicenseModal && (
        <LicenseActivation 
          onSuccess={handleLicenseActivated}
          onClose={() => setShowLicenseModal(false)}
        />
      )}
      
      {/* Trial Expired Overlay */}
      {licenseStatus && licenseStatus.status === 'expired' && !showLicenseModal && (
        <TrialBanner 
          onActivate={() => setShowLicenseModal(true)}
        />
      )}
      
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen} 
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onCollapseChange={setIsSidebarCollapsed}
      />
      <main className={`flex-1 w-full h-full relative transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-0' : ''} ${licenseStatus && licenseStatus.status === 'trial' ? 'pt-10' : ''} flex flex-col`}>
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden fixed top-4 left-4 z-30 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {/* Header */}
        <Header />
        
        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
            <Route path="/patient-files" element={<ProtectedRoute><PatientFiles /></ProtectedRoute>} />
            <Route path="/patient-profile/:patientId" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
            <Route path="/patient-intake" element={<ProtectedRoute><PatientIntake /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/xray" element={<ProtectedRoute><Xray /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/user-management" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/doctor-profile" element={<ProtectedRoute><DoctorProfile /></ProtectedRoute>} />
            <Route path="/loading-test" element={<LoadingTest />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
      <ToastContainer
        position="top-right"
        autoClose={8000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <ServerStatus />
    </div>
  );
}

function App() {
  return (
    <Router>
      <ApiProvider>
        <AuthProvider>
          <HeaderProvider>
            <AppContent />
          </HeaderProvider>
        </AuthProvider>
      </ApiProvider>
    </Router>
  );
}

export default App;
