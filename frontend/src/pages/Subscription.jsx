import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { api } from '../utils/api';

const Subscription = () => {
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchPlans();
  }, []);

  const fetchSubscription = async () => {
    try {
      const data = await api.get('/subscriptions/');
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and billing</p>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Current Subscription</h2>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync Status'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Plan</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {currentPlan?.display_name || subscription.plan_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(subscription.status)}`}>
                {subscription.status.toUpperCase()}
              </span>
            </div>
            {subscription.current_start && (
              <div>
                <p className="text-sm text-gray-600">Current Period Start</p>
                <p className="text-lg text-gray-900">{formatDate(subscription.current_start)}</p>
              </div>
            )}
            {subscription.current_end && (
              <div>
                <p className="text-sm text-gray-600">Current Period End</p>
                <p className="text-lg text-gray-900">{formatDate(subscription.current_end)}</p>
              </div>
            )}
          </div>

          {/* Subscription Actions */}
          {subscription.status === 'active' && subscription.razorpay_subscription_id && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={handlePause}
                disabled={loading}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg disabled:opacity-50"
              >
                Pause Subscription
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            </div>
          )}

          {subscription.status === 'paused' && subscription.razorpay_subscription_id && (
            <div className="mt-4">
              <button
                onClick={handleResume}
                disabled={loading}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50"
              >
                Resume Subscription
              </button>
            </div>
          )}
        </div>
      )}

      {/* Available Plans */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan_name === plan.name;
            const isFree = plan.name === 'free';

            return (
              <div
                key={plan.name}
                className={`bg-white rounded-lg shadow-md p-6 ${
                  isCurrentPlan ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatCurrency(plan.price)}
                    </span>
                    {!isFree && (
                      <span className="text-gray-600">/{plan.interval}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full px-4 py-2 bg-gray-200 text-gray-600 rounded-lg cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleCreateSubscription(plan)}
                    disabled={loading || isFree}
                    className={`w-full px-4 py-2 rounded-lg font-medium ${
                      isFree
                        ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    } disabled:opacity-50`}
                  >
                    {isFree ? 'Current Plan' : loading ? 'Processing...' : 'Subscribe'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Subscription;







