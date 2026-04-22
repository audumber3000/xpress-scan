import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Overview from './pages/Overview';
import Clinics from './pages/Clinics';
import ClinicDetail from './pages/ClinicDetail';
import OwnerDetail from './pages/OwnerDetail';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import Financials from './pages/Financials';
import Subscriptions from './pages/Subscriptions';
import ActivityPage from './pages/Activity';
import NotificationsData from './pages/NotificationsData';
import Growth from './pages/Growth';
import MarketingPromos from './pages/MarketingPromos';
import MarketingReferrals from './pages/MarketingReferrals';
import MarketingCampaigns from './pages/MarketingCampaigns';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="clinics" element={<Clinics />} />
        <Route path="clinics/:id" element={<ClinicDetail />} />
        <Route path="owners/:id" element={<OwnerDetail />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="financials" element={<Financials />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="notifications-data" element={<NotificationsData />} />
        <Route path="growth" element={<Growth />} />
        <Route path="marketing/promos" element={<MarketingPromos />} />
        <Route path="marketing/referrals" element={<MarketingReferrals />} />
        <Route path="marketing/campaigns" element={<MarketingCampaigns />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <ToastContainer position="top-right" autoClose={4000} />
      </Router>
    </AuthProvider>
  );
}
