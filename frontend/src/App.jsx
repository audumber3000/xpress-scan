import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { InboxProvider } from "./contexts/InboxContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientIntake from "./pages/PatientIntake";
import Reports from "./pages/Reports";
import VoiceReporting from "./pages/VoiceReporting";
import Payments from "./pages/Payments";
import DoctorProfile from "./pages/DoctorProfile";
import Settings from "./pages/Settings";
import ClinicOnboarding from "./pages/ClinicOnboarding";
import AuthCallback from "./pages/AuthCallback";
import LoadingTest from "./pages/LoadingTest";
import Communication from "./pages/Communication";
import Inbox from "./pages/Inbox";
import Calendar from "./pages/Calendar";
import BookingPage from "./pages/BookingPage";
import PatientFiles from "./pages/PatientFiles";
import PatientProfile from "./pages/PatientProfile";
import About from "./pages/About";
import Features from "./pages/Features";
import DentalChartDemo from "./pages/DentalChartDemo";
import WhatsAppTest from "./pages/WhatsAppTest";

// Components
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import PWAInstall from "./components/PWAInstall";

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
  const { user, loading, setUser, setToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Redirect to dashboard if already authenticated and on login page
  useEffect(() => {
    if (location.pathname === '/login' && !loading && user) {
      // User is already logged in, redirect to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, loading, user, navigate]);

  // Check if current route is auth page, landing page, or booking page
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/onboarding' || location.pathname === '/auth/callback';
  const isLandingPage = location.pathname === '/';
  const isBookingPage = location.pathname === '/booking';
  const isPublicPage = location.pathname === '/about' || location.pathname === '/features';

  if (loading) return <div>Loading...</div>;

  // For auth pages, landing page, and booking page, render without sidebar
  if (isAuthPage || isLandingPage || isBookingPage || isPublicPage) {
    return (
      <>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<ClinicOnboarding />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/dental-demo" element={<DentalChartDemo />} />
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
      </>
    );
  }

  // For authenticated pages, render with sidebar and header
  return (
    <div className="flex w-full h-screen">
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen} 
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onCollapseChange={setIsSidebarCollapsed}
      />
      <div className="flex-1 flex flex-col w-full h-full relative transition-all duration-300 ease-in-out">
        {/* Header */}
        <Header />
        
        {/* Main content area */}
        <main className={`flex-1 w-full ${location.pathname === '/inbox' ? 'overflow-hidden' : 'overflow-auto'}`}>
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="md:hidden fixed top-20 left-4 z-30 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
          <Route path="/patient-files" element={<ProtectedRoute><PatientFiles /></ProtectedRoute>} />
          <Route path="/patient-profile/:patientId" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
          <Route path="/patient-intake" element={<ProtectedRoute><PatientIntake /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/voice-reporting" element={<ProtectedRoute><VoiceReporting /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
          <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
          <Route path="/whatsapp-test" element={<ProtectedRoute><WhatsAppTest /></ProtectedRoute>} />
          <Route path="/communication" element={<ProtectedRoute><Communication /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/user-management" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/doctor-profile" element={<ProtectedRoute><DoctorProfile /></ProtectedRoute>} />
            <Route path="/loading-test" element={<LoadingTest />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
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
      <PWAInstall />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <InboxProvider>
          <AppContent />
        </InboxProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
