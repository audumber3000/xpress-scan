import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
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
import Mail from "./pages/Mail";
import MailCallback from "./pages/MailCallback";
import LabHub from "./pages/lab/LabHub";
import Attendance from "./pages/Attendance";
import Calendar from "./pages/Calendar";
import BookingPage from "./pages/BookingPage";
import PatientProfile from "./pages/PatientProfile";
import DentalChartDemo from "./pages/DentalChartDemo";
import Subscription from "./pages/Subscription";
import AdminHub from "./pages/AdminHub";
import StaffManagement from "./pages/StaffManagement";
import TreatmentsPricing from "./pages/TreatmentsPricing";
import PermissionsManagement from "./pages/PermissionsManagement";
import ClinicInfo from "./pages/ClinicInfo";
import MessageTemplates from "./pages/MessageTemplates";
import ReferringDoctors from "./pages/ReferringDoctors";
import Notifications from "./pages/admin/Notifications";
import PracticeSettings from "./pages/admin/PracticeSettings";
import Vendors from "./pages/Vendors";
import ConsentForms from "./pages/ConsentForms";
import Reports from "./pages/Reports";
import AddClinic from "./pages/AddClinic";
import ConsentSign from "./pages/ConsentSign";
import SelectClinic from "./pages/SelectClinic";
import GoogleReviews from "./pages/marketing/GoogleReviews";
import MarketingPosters from "./pages/marketing/MarketingPosters";
import SupportTickets from "./pages/SupportTickets";
import TemplatesManager from "./pages/TemplatesManager";
import Checkout from "./pages/Checkout";

// Components
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import PWAInstall from "./components/PWAInstall";
import ErrorBoundary from "./components/ErrorBoundary";
import ConnectivityBanner from "./components/ConnectivityBanner";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#2a276e] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding if clinic_owner hasn't completed it
  if (user.role === 'clinic_owner' && !user.clinic_id && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
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
    console.log('🔄 [APP] Location changed:', {
      pathname: location.pathname,
      loading,
      hasUser: !!user,
      userId: user?.id
    });
    
    // Automatically collapse main sidebar on Settings/Admin pages
    if (location.pathname === '/user-management' || location.pathname.startsWith('/admin')) {
      setIsSidebarCollapsed(true);
    }

    if (location.pathname === '/login' && !loading && user) {

      if (user.role === 'clinic_owner' && !user.clinic_id) {
        console.log('🔄 [APP] User authenticated but not onboarded, redirecting to /onboarding');
        navigate('/onboarding', { replace: true });
      } else {
        console.log('🔄 [APP] User already logged in, redirecting to /dashboard');
        navigate('/dashboard', { replace: true });
      }
    }
  }, [location.pathname, loading, user, navigate]);

  // Check if current route is auth page, booking page, or public page
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/onboarding' || location.pathname === '/auth/callback';
  const isBookingPage = location.pathname === '/booking';
  const isPublicPage = location.pathname === '/dental-demo' || location.pathname.startsWith('/consent/sign/') || location.pathname === '/checkout';

  // While auth is initializing, show a global loading screen to prevent false redirects
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#2a276e] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

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
          <Route path="/consent/sign/:token" element={<ConsentSign />} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/select-clinic" element={<ProtectedRoute><SelectClinic /></ProtectedRoute>} />
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
          <main className="flex-1 w-full overflow-auto">
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
              <Route path="/lab" element={<ProtectedRoute><LabHub /></ProtectedRoute>} />
              <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
              <Route path="/patient-files" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
              <Route path="/patient-profile/:patientId" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
              <Route path="/patient-intake" element={<ProtectedRoute><PatientIntake /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
              <Route path="/mail" element={<ProtectedRoute><Mail /></ProtectedRoute>} />
              <Route path="/mail/callback" element={<ProtectedRoute><MailCallback /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/marketing/reviews" element={<ProtectedRoute><GoogleReviews /></ProtectedRoute>} />
              <Route path="/marketing/posters" element={<ProtectedRoute><MarketingPosters /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminHub /></ProtectedRoute>}>
                <Route index element={<Navigate to="attendance" replace />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="staff" element={<StaffManagement />} />
                <Route path="treatments" element={<TreatmentsPricing />} />
                <Route path="permissions" element={<PermissionsManagement />} />
                <Route path="clinic" element={<ClinicInfo />} />
                <Route path="templates" element={<MessageTemplates />} />
                <Route path="doctors" element={<ReferringDoctors />} />
                <Route path="templates-manager" element={<TemplatesManager />} />
                <Route path="practice-settings/:category" element={<PracticeSettings />} />
                <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="subscription" element={<Subscription />} />
              </Route>
              <Route path="/subscription" element={<Navigate to="/admin/subscription" replace />} />
              <Route path="/support-tickets" element={<ProtectedRoute><SupportTickets /></ProtectedRoute>} />
              <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
              <Route path="/consent-forms" element={<ProtectedRoute><ConsentForms /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/add-clinic" element={<ProtectedRoute><AddClinic /></ProtectedRoute>} />
              <Route path="/user-management" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/doctor-profile" element={<ProtectedRoute><DoctorProfile /></ProtectedRoute>} />
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
      <ConnectivityBanner />
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
            <AppContent />
          </HeaderProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
