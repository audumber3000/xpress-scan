import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientIntake from "./pages/PatientIntake";
import Sidebar from "./components/Sidebar";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VoiceReporting from "./pages/VoiceReporting";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function AppContent() {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Check if current route is auth page
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  if (loading) return <div>Loading...</div>;

  // For auth pages, render without sidebar
  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
