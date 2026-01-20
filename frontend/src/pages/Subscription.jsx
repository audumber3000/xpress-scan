import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { useHeader } from '../contexts/HeaderContext';
import { Award, CreditCard, Download, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import GearLoader from '../components/GearLoader';

const Subscription = () => {
  const { setTitle } = useHeader();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [billingHistory, setBillingHistory] = useState([
    { id: 1, date: 'Sep 12, 2023', invoice: 'INV-0042', amount: 99.00, status: 'PAID' },
    { id: 2, date: 'Aug 12, 2023', invoice: 'INV-0039', amount: 99.00, status: 'PAID' },
    { id: 3, date: 'Jul 12, 2023', invoice: 'INV-0035', amount: 99.00, status: 'PAID' },
  ]);

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Admin Hub</span>
        </button>
      </div>
    );
    fetchSubscription();
    fetchPlans();
  }, [setTitle, navigate]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const data = await api.get('/subscriptions/');
      setSubscription(data || {
        plan_name: 'Professional Plan',
        status: 'active',
        current_start: new Date().toISOString(),
        current_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        patient_count: 850,
        patient_limit: 1000,
        storage_used: 15,
        storage_limit: 50
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription({
        plan_name: 'Professional Plan',
        status: 'active',
        current_start: new Date().toISOString(),
        current_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        patient_count: 850,
        patient_limit: 1000,
        storage_used: 15,
        storage_limit: 50
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const data = await api.get('/subscriptions/plans');
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handleCreateSubscription = async (plan) => {
    if (plan.name === 'free') {
      toast.error('You are already on the free plan');
      return;
    }

    if (!plan.razorpay_plan_id) {
      toast.error('This plan is not available for subscription. Please configure Razorpay plan ID.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/subscriptions/create', {
        plan_name: plan.name,
        razorpay_plan_id: plan.razorpay_plan_id
      });
      
      // After creating subscription, user will need to complete payment via Razorpay
      // For now, we'll just refresh the subscription data
      toast.success('Subscription created! Please complete the payment process.');
      await fetchSubscription();
    } catch (error) {
      toast.error(error.message || 'Failed to create subscription');
      console.error('Error creating subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!window.confirm('Are you sure you want to pause your subscription?')) {
      return;
    }

    setLoading(true);
    try {
      await api.post('/subscriptions/pause');
      toast.success('Subscription paused successfully');
      await fetchSubscription();
    } catch (error) {
      toast.error(error.message || 'Failed to pause subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      await api.post('/subscriptions/resume');
      toast.success('Subscription resumed successfully');
      await fetchSubscription();
    } catch (error) {
      toast.error(error.message || 'Failed to resume subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of the billing cycle.')) {
      return;
    }

    setLoading(true);
    try {
      await api.post('/subscriptions/cancel?cancel_at_cycle_end=true');
      toast.success('Subscription cancelled. You will retain access until the end of the billing period.');
      await fetchSubscription();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/subscriptions/sync');
      toast.success('Subscription synced successfully');
      await fetchSubscription();
    } catch (error) {
      toast.error(error.message || 'Failed to sync subscription');
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || colors.active;
  };

  const currentPlan = plans.find(p => p.name === subscription?.plan_name) || plans[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <GearLoader />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">

        {/* Current Plan Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CURRENT PLAN</h3>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              Active
            </span>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[#E0F2F2] flex items-center justify-center mr-4">
                <Award className="w-7 h-7 text-[#2D9596]" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-gray-900">{subscription?.plan_name || 'Professional Plan'}</h4>
                <p className="text-sm text-gray-600">$99 / month • Renews {formatDate(subscription?.current_end)}</p>
              </div>
            </div>

            {/* Patient Count Usage */}
            <div className="mb-5">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">Patient Count</span>
                <span className="text-sm font-semibold text-gray-600">
                  {subscription?.patient_count || 850} / {subscription?.patient_limit || 1000}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#2D9596] rounded-full" 
                  style={{ width: `${((subscription?.patient_count || 850) / (subscription?.patient_limit || 1000)) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(((subscription?.patient_count || 850) / (subscription?.patient_limit || 1000)) * 100)}% of monthly limit reached
              </p>
            </div>

            {/* Cloud Storage Usage */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">Cloud Storage</span>
                <span className="text-sm font-semibold text-gray-600">
                  {subscription?.storage_used || 15}GB / {subscription?.storage_limit || 50}GB
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#2D9596] rounded-full" 
                  style={{ width: `${((subscription?.storage_used || 15) / (subscription?.storage_limit || 50)) * 100}%` }}
                />
              </div>
            </div>

            {/* Manage Button */}
            <button className="w-full flex items-center justify-center gap-2 bg-[#2D9596] text-white py-3 rounded-xl font-semibold hover:bg-[#1F6B72] transition">
              <CreditCard className="w-5 h-5" />
              Manage Plan & Billing
            </button>
          </div>
        </div>

        {/* Billing History Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">BILLING HISTORY</h3>
            <button className="text-sm font-semibold text-[#2D9596] hover:text-[#1F6B72]">View All</button>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {billingHistory.map((invoice, index) => (
              <div key={invoice.id}>
                <div className="flex items-center p-4">
                  <div className="w-11 h-11 rounded-full bg-[#E0F2F2] flex items-center justify-center mr-3">
                    <CreditCard className="w-5 h-5 text-[#2D9596]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{invoice.date}</p>
                    <p className="text-xs text-gray-600">{invoice.invoice} • ${invoice.amount.toFixed(2)}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg mr-3">
                    {invoice.status}
                  </span>
                  <button className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition">
                    <Download className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {index < billingHistory.length - 1 && (
                  <div className="h-px bg-gray-100 ml-16" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade Prompt */}
        <div className="bg-[#E0F2F2] rounded-2xl p-5 flex items-center">
          <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center mr-3">
            <HelpCircle className="w-6 h-6 text-[#2D9596]" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Need to upgrade your plan?</h4>
            <p className="text-xs text-gray-600">Chat with our team for custom clinic solutions.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

export default Subscription;







