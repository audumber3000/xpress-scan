import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientIntake from "./pages/PatientIntake";
import Reports from "./pages/Reports";
import VoiceReporting from "./pages/VoiceReporting";
import DoctorProfile from "./pages/DoctorProfile";
import Settings from "./pages/Settings";
import ClinicOnboarding from "./pages/ClinicOnboarding";
import AuthCallback from "./pages/AuthCallback";

// Components
import Sidebar from "./components/Sidebar";

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

  // Check if current route is auth page
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/onboarding' || location.pathname === '/auth/callback';

  if (loading) return <div>Loading...</div>;

  // For auth pages, render without sidebar
  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<ClinicOnboarding />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    );
  }

  // For authenticated pages, render with sidebar
  return (
    <div className="flex w-full h-screen">
      <Sidebar />
      <main className="flex-1 w-full h-full">
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
          <Route path="/patient-intake" element={<ProtectedRoute><PatientIntake /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/voice-reporting" element={<ProtectedRoute><VoiceReporting /></ProtectedRoute>} />
          <Route path="/user-management" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/doctor-profile" element={<ProtectedRoute><DoctorProfile /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
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
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
