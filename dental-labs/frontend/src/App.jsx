import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { HeaderProvider } from "./contexts/HeaderContext";
import { Toaster } from "react-hot-toast";

import AppShell from "./components/AppShell";
import LoadingSpinner from "./components/LoadingSpinner";

import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import OnboardingPage from "./pages/auth/OnboardingPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import ClientsPage from "./pages/clients/ClientsPage";
import ClientDetailPage from "./pages/clients/ClientDetailPage";
import CatalogPage from "./pages/catalog/CatalogPage";
import CasesPage from "./pages/cases/CasesPage";
import CaseDetailPage from "./pages/cases/CaseDetailPage";
import BillingPage from "./pages/billing/BillingPage";
import SettingsPage from "./pages/settings/SettingsPage";

// Mock empty pages for M0 to satisfy the router
const EmptyPage = ({ title }) => (
  <div className="animate-fadeIn">
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
    </div>
    <div className="card empty-state">
      <p>Coming in M2/M3...</p>
    </div>
  </div>
);

// Route guards
function PrivateRoute({ children, requireOnboarded = true }) {
  const { isAuthenticated, isOnboarded, loading } = useAuth();
  
  if (loading) return <LoadingSpinner size={48} />;
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (requireOnboarded && !isOnboarded) return <Navigate to="/onboarding" replace />;
  
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, isOnboarded, loading } = useAuth();
  
  if (loading) return <LoadingSpinner size={48} />;
  
  if (isAuthenticated) {
    return <Navigate to={isOnboarded ? "/" : "/onboarding"} replace />;
  }
  
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HeaderProvider>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
          
          <Routes>
          {/* Public / Auth */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          
          {/* Onboarding (needs auth, but NO lab setup yet) */}
          <Route 
            path="/onboarding" 
            element={
              <PrivateRoute requireOnboarded={false}>
                <OnboardingPage />
              </PrivateRoute>
            } 
          />
          
          {/* Private App Shell */}
          <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
            <Route index element={<DashboardPage />} />
            
            {/* Placholders for next milestones */}
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/:id" element={<CaseDetailPage />} />
            
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<ClientDetailPage />} />
            
            <Route path="catalog" element={<CatalogPage />} />
            
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </HeaderProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
