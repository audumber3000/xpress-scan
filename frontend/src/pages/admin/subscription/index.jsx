import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, Receipt, RefreshCw } from 'lucide-react';

import { notify } from '../../../utils/notify';
import { api } from '../../../utils/api';
import { useAuth } from '../../../contexts/AuthContext';
import { track, EVENTS } from '../../../analytics/track';
import { usePlanCatalogue, usePlanUsage, TRIAL_PLAN } from '../../../utils/plans';
import GearLoader from '../../../components/GearLoader';
import SectionTabs from '../../../components/common/SectionTabs';
import SectionHeader from '../../../components/common/SectionHeader';
import TrialCelebrationModal from '../../../components/TrialCelebrationModal';

import PlansTab from './PlansTab';
import HistoryTab from './HistoryTab';

/**
 * Subscription & Billing.
 *
 * Restructured to match every other tabbed Control Center section
 * (admin/notifications/index.jsx is the reference): SectionHeader, SectionTabs,
 * and a page file that is composition only. What used to live here was a
 * 649-line component holding its own tab strip, a free-versus-paid comparison
 * table for a free tier that no longer exists, and 120 lines of inline invoice
 * CSS.
 */

const TABS = [
  { id: 'plans', label: 'Manage Subscription', icon: CreditCard },
  { id: 'history', label: 'Billing History', icon: Receipt },
];

const Subscription = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const { catalogue } = usePlanCatalogue();
  const { usage } = usePlanUsage();

  const [activeTab, setActiveTab] = useState('plans');
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [startingTrial, setStartingTrial] = useState(false);
  const [celebration, setCelebration] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sub, hist] = await Promise.all([
        api.get('/subscriptions/'),
        api.get('/subscriptions/history').catch(() => ({ history: [] })),
      ]);
      setSubscription(sub);
      setHistory(hist.history || []);
    } catch {
      // A subscription screen that cannot load is still better than a blank
      // one: fall back to the entry plan so the plan cards render and the
      // clinic can at least see what is on offer.
      setSubscription({ plan_name: 'plus', status: 'active' });
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Coming back from Cashfree with ?order_id=... means a payment just happened
  // and the webhook may not have landed yet, so verify directly before reading.
  useEffect(() => {
    const orderId = new URLSearchParams(location.search).get('order_id');
    if (!orderId) {
      fetchAll();
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/subscriptions/verify-status?order_id=${orderId}`);
        if (res.success) {
          notify.done('Payment received. Your plan is active.');
          refreshUser?.();
        }
      } catch {
        // The webhook is the source of truth and will catch up; nothing to say.
      } finally {
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchAll();
      }
    })();
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChoosePlan = (planKey, cycle, coupon = null) => {
    track(EVENTS.SUBSCRIPTION_CTA_CLICKED, { plan: planKey, billing_cycle: cycle, coupon });
    // The code rides along so Checkout can pre-apply it. Somebody who has
    // already typed a promo code once should not be asked for it again on the
    // screen where they are about to pay.
    const q = new URLSearchParams({ plan: planKey, billing: cycle });
    if (coupon) q.set('coupon', coupon);
    navigate(`/checkout?${q.toString()}`);
  };

  const handleStartTrial = async () => {
    if (startingTrial) return;
    setStartingTrial(true);
    track(EVENTS.FREE_TRIAL_STARTED, { plan: TRIAL_PLAN, source: 'subscription_page' });
    try {
      const res = await api.post('/subscriptions/start-trial');
      await Promise.all([fetchAll(), refreshUser?.()]);
      setCelebration({
        trialEndsAt: res?.trial_ends_at || null,
        daysRemaining: res?.trial_days_remaining ?? catalogue.trial_days,
      });
    } catch (err) {
      notify.problem(err, 'Could not start your trial.');
    } finally {
      setStartingTrial(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><GearLoader /></div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto custom-scrollbar bg-[#f8fafc] p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <SectionHeader
          title="Subscription & Billing"
          subtitle="Your plan, what it covers, and what you have paid"
          action={
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          }
        />
        <SectionTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'plans' && (
        <PlansTab
          subscription={subscription}
          catalogue={catalogue}
          usage={usage}
          lastPayment={history.find((h) => h.status === 'PAID') || null}
          clinicName={user?.clinic?.name}
          startingTrial={startingTrial}
          onStartTrial={handleStartTrial}
          onChoosePlan={handleChoosePlan}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab history={history} clinicName={user?.clinic?.name} />
      )}

      <TrialCelebrationModal
        open={!!celebration}
        trialEndsAt={celebration?.trialEndsAt}
        daysRemaining={celebration?.daysRemaining}
        onClose={() => setCelebration(null)}
      />
    </div>
  );
};

export default Subscription;
