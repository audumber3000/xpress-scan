import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { InboxProvider } from "./contexts/InboxContext";
import { HeaderProvider } from "./contexts/HeaderContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientIntake from "./pages/PatientIntake";
import Payments from "./pages/Payments";
import DoctorProfile from "./pages/DoctorProfile";
import Settings from "./pages/Settings";
import ClinicOnboarding from "./pages/ClinicOnboarding";
import AuthCallback from "./pages/AuthCallback";
import LoadingTest from "./pages/LoadingTest";
import Inbox from "./pages/Inbox";
import Mail from "./pages/Mail";
import MailCallback from "./pages/MailCallback";
import Attendance from "./pages/Attendance";
import Calendar from "./pages/Calendar";
import BookingPage from "./pages/BookingPage";
import PatientFiles from "./pages/PatientFiles";
import PatientProfile from "./pages/PatientProfile";
import DentalChartDemo from "./pages/DentalChartDemo";
import WhatsAppTest from "./pages/WhatsAppTest";
import Subscription from "./pages/Subscription";
import AdminHub from "./pages/AdminHub";
import StaffManagement from "./pages/StaffManagement";
import TreatmentsPricing from "./pages/TreatmentsPricing";
import PermissionsManagement from "./pages/PermissionsManagement";
import ClinicInfo from "./pages/ClinicInfo";
import MessageTemplates from "./pages/MessageTemplates";
import ReferringDoctors from "./pages/ReferringDoctors";

// Components
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import PWAInstall from "./components/PWAInstall";
import ErrorBoundary from "./components/ErrorBoundary";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  console.log('🛡️ [PROTECTED ROUTE] Checking access...', {
    loading,
    hasUser: !!user,
    userId: user?.id,
    path: window.location.pathname
  });
  
  if (loading) {
    console.log('🛡️ [PROTECTED ROUTE] Still loading, showing loading screen');
    return <div>Loading...</div>;
  }
  
  if (!user) {
    console.log('🛡️ [PROTECTED ROUTE] ❌ No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  
  console.log('🛡️ [PROTECTED ROUTE] ✅ User authenticated, allowing access');
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
    console.log('🔄 [APP] Location changed:', {
      pathname: location.pathname,
      loading,
      hasUser: !!user,
      userId: user?.id
    });
    
    if (location.pathname === '/login' && !loading && user) {
      console.log('🔄 [APP] User already logged in, redirecting to /dashboard');
      // User is already logged in, redirect to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, loading, user, navigate]);

  // Check if current route is auth page, booking page, or public page
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/onboarding' || location.pathname === '/auth/callback';
  const isBookingPage = location.pathname === '/booking';
  const isPublicPage = location.pathname === '/dental-demo';

  // Don't block rendering while loading - let ProtectedRoute handle it
  // if (loading) return <div>Loading...</div>;

  // Render layout based on route type
  const renderContent = () => {
    // For auth pages, booking page, and public pages - render without sidebar
    if (isAuthPage || isBookingPage || isPublicPage) {
      return (
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<ClinicOnboarding />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/dental-demo" element={<DentalChartDemo />} />
        </Routes>
      );
    }

    // For authenticated pages - render with sidebar and header
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
              <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
              <Route path="/mail" element={<ProtectedRoute><Mail /></ProtectedRoute>} />
              <Route path="/mail/callback" element={<ProtectedRoute><MailCallback /></ProtectedRoute>} />
              <Route path="/whatsapp-test" element={<ProtectedRoute><WhatsAppTest /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminHub /></ProtectedRoute>} />
              <Route path="/admin/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
              <Route path="/admin/staff" element={<ProtectedRoute><StaffManagement /></ProtectedRoute>} />
              <Route path="/admin/treatments" element={<ProtectedRoute><TreatmentsPricing /></ProtectedRoute>} />
              <Route path="/admin/permissions" element={<ProtectedRoute><PermissionsManagement /></ProtectedRoute>} />
              <Route path="/admin/clinic" element={<ProtectedRoute><ClinicInfo /></ProtectedRoute>} />
              <Route path="/admin/templates" element={<ProtectedRoute><MessageTemplates /></ProtectedRoute>} />
              <Route path="/admin/doctors" element={<ProtectedRoute><ReferringDoctors /></ProtectedRoute>} />
              <Route path="/user-management" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/doctor-profile" element={<ProtectedRoute><DoctorProfile /></ProtectedRoute>} />
              <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
              <Route path="/loading-test" element={<LoadingTest />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
        <PWAInstall />
      </div>
    );
  };

  return (
    <>
      {renderContent()}
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

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <HeaderProvider>
            <InboxProvider>
              <AppContent />
            </InboxProvider>
          </HeaderProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
