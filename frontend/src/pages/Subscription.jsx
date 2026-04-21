import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { useHeader } from '../contexts/HeaderContext';
import {
  CheckCircle2,
  XCircle,
  CreditCard,
  Download,
  Zap,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  Users,
  Bell,
  BarChart3,
  Building2,
  Headphones,
  Star,
  Image,
  CalendarDays,
  Receipt,
  Cloud,
  Smartphone,
  FlaskConical,
  Package,
  TrendingUp,
  MessageCircle,
  Database,
  Bot,
} from 'lucide-react';
import GearLoader from '../components/GearLoader';

const PRO_FEATURES = [
  { icon: Users,        label: 'Patient Management',       starter: true,    pro: true },
  { icon: FileText,     label: 'Treatment Records',        starter: true,    pro: true },
  { icon: FileText,     label: 'Digital Case Sheets',      starter: true,    pro: true },
  { icon: Image,        label: 'Media Uploads (X-rays)',   starter: true,    pro: true },
  { icon: CalendarDays, label: 'Appointment Scheduling',   starter: true,    pro: true },
  { icon: CalendarDays, label: 'Calendar View',            starter: true,    pro: true },
  { icon: Receipt,      label: 'Billing & Invoicing',      starter: true,    pro: true },
  { icon: CreditCard,   label: 'Payment Tracking',         starter: true,    pro: true },
  { icon: BarChart3,    label: 'Dashboard Analytics',      starter: true,    pro: true },
  { icon: Star,         label: 'Google Review Management', starter: true,    pro: true },
  { icon: Cloud,        label: 'Cloud Storage',            starter: true,    pro: true },
  { icon: Smartphone,   label: 'Cross-platform Access',    starter: true,    pro: true },
  { icon: Bot,          label: 'AI Report Generation',     starter: false,   pro: true },
  { icon: Bell,         label: 'Notifications & Alerts',   starter: false,   pro: true },
  { icon: ShieldCheck,  label: 'Consent Forms',            starter: false,   pro: true },
  { icon: Users,        label: 'Multi-user Access',        starter: false,   pro: true },
  { icon: Package,      label: 'Inventory Management',     starter: false,   pro: true },
  { icon: FlaskConical, label: 'Lab Order Management',     starter: false,   pro: true },
  { icon: TrendingUp,   label: 'Competitor Tracking',      starter: false,   pro: true },
  { icon: MessageCircle,label: 'Patient Communication',    starter: false,   pro: true },
  { icon: Database,     label: 'Data Backup & Security',   starter: false,   pro: true },
  { icon: Headphones,   label: 'Priority Support',         starter: false,   pro: true },
];

const FeatVal = ({ val }) => {
  if (val === true)  return <CheckCircle2 size={15} className="text-[#29828a]" />;
  if (val === false) return <XCircle size={15} className="text-gray-200" />;
  return <span className="text-xs font-medium text-gray-600">{val}</span>;
};

// ── Section row helper (left label + right content, like reference image) ──
const Section = ({ title, description, action, children, noBorder }) => (
  <div className={`flex flex-col md:flex-row gap-6 py-8 ${noBorder ? '' : 'border-b border-gray-100'}`}>
    <div className="md:w-64 lg:w-72 flex-shrink-0">
      <h4 className="text-sm font-semibold text-gray-800 mb-1">{title}</h4>
      {description && <p className="text-xs text-gray-400 leading-relaxed">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const TABS = [
  { id: 'subscription', label: 'Manage Subscription' },
  { id: 'history',      label: 'Billing History' },
];

const Subscription = () => {
  const { setTitle } = useHeader();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('subscription');
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [billingHistory, setBillingHistory] = useState([
    { id: 1, plan: 'Professional Plan', invoice: 'INV-CF-0001', amount: 1200.00, date: 'Mar 12, 2024', status: 'PAID' },
  ]);

  useEffect(() => {
    setTitle('Subscription & Billing');
    const queryParams = new URLSearchParams(window.location.search);
    const orderId = queryParams.get('order_id');
    if (orderId) {
      verifyPaymentStatus(orderId);
    } else {
      fetchSubscription();
    }
  }, []); // eslint-disable-line

  const verifyPaymentStatus = async (orderId) => {
    try {
      setLoading(true);
      const res = await api.get(`/subscriptions/verify-status?order_id=${orderId}`);
      if (res.success) {
        toast.success('Payment successful! Your Professional Plan is now active.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      await fetchSubscription();
    } catch {
      fetchSubscription();
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const [subData, historyData] = await Promise.all([
        api.get('/subscriptions/'),
        api.get('/subscriptions/history'),
      ]);
      setSubscription(subData);
      setBillingHistory(historyData.history || []);
    } catch {
      setSubscription({ plan_name: 'free', status: 'active' });
      setBillingHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (billing = 'monthly') => navigate(`/checkout?plan=professional&billing=${billing}`);

  const downloadInvoice = (inv) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${inv.invoice}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a1a; padding: 48px; max-width: 720px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 2px solid #f0f0f0; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 40px; height: 40px; background: #29828a; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .brand-icon svg { width: 22px; height: 22px; }
    .brand-name { font-size: 22px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: #888; margin-top: 1px; }
    .invoice-meta { text-align: right; }
    .invoice-title { font-size: 28px; font-weight: 700; color: #29828a; letter-spacing: -0.5px; }
    .invoice-num { font-size: 13px; color: #888; margin-top: 4px; font-family: monospace; }
    .badges { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
    .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .section { margin-bottom: 36px; }
    .section-label { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .info-card { background: #f9fafb; border-radius: 12px; padding: 16px 20px; }
    .info-card p { font-size: 13px; color: #555; line-height: 1.7; }
    .info-card strong { color: #1a1a1a; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.8px; }
    td { padding: 14px; font-size: 13px; color: #333; border-bottom: 1px solid #f0f0f0; }
    .total-row td { font-weight: 700; font-size: 15px; color: #1a1a1a; background: #f9fafb; border-bottom: none; border-top: 2px solid #e5e7eb; }
    .total-row td:last-child { color: #29828a; font-size: 17px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center; font-size: 11px; color: #bbb; line-height: 1.8; }
    @media print { body { padding: 32px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9z" fill="white" opacity="0.3"/>
          <path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">MolarPlus</div>
        <div class="brand-sub">Dental Practice Software</div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-num">${inv.invoice}</div>
      <div class="badges">
        <span class="badge ${inv.status === 'PAID' ? 'badge-paid' : 'badge-pending'}">${inv.status}</span>
      </div>
    </div>
  </div>

  <div class="section two-col">
    <div>
      <div class="section-label">Billed by</div>
      <div class="info-card">
        <p><strong>MolarPlus Technologies</strong><br/>support@molarplus.com<br/>India</p>
      </div>
    </div>
    <div>
      <div class="section-label">Invoice details</div>
      <div class="info-card">
        <p><strong>Invoice Date:</strong> ${inv.date}<br/><strong>Invoice No:</strong> ${inv.invoice}<br/><strong>Payment:</strong> Cashfree</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Summary</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Period</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${inv.plan}</strong><br/><span style="font-size:12px;color:#888">Monthly subscription — MolarPlus Professional</span></td>
          <td style="color:#888">${inv.date}</td>
          <td style="text-align:right">₹${inv.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr class="total-row">
          <td colspan="2">Total</td>
          <td style="text-align:right">₹${inv.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    Thank you for using MolarPlus · This is a computer-generated invoice · No signature required<br/>
    For support: support@molarplus.com
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onafterprint = () => URL.revokeObjectURL(url);
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <GearLoader />
    </div>
  );

  const isExpired = subscription?.is_expired === true;
  const isTrial = subscription?.plan_name === 'trial' && subscription?.status === 'active' && !isExpired;
  const isPro = ['professional', 'professional_annual'].includes(subscription?.plan_name) && subscription?.status === 'active' && !isExpired;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar">

      {/* ── Header + Tabs ── */}
      <div className="bg-white border-b border-gray-100 px-6 lg:px-8 pt-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">Subscription &amp; Billing</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage your plan and view payment history.</p>
        </div>

        {/* Tab navigation — underline style */}
        <div className="flex gap-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#29828a] text-[#29828a]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 px-6 lg:px-8">

        {/* ════ MANAGE SUBSCRIPTION TAB ════ */}
        {activeTab === 'subscription' && (
          <>
            {/* Trial Banner */}
            {isTrial && (
              <div className="mt-6 rounded-2xl border border-[#29828a]/30 bg-[#29828a]/5 p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#29828a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap size={16} className="text-[#29828a]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#29828a]">
                      7-Day Free Trial Active
                      {subscription?.trial_days_remaining != null && (
                        <span className="ml-2 text-xs font-semibold bg-[#29828a]/10 text-[#29828a] px-2 py-0.5 rounded-full">
                          {subscription.trial_days_remaining === 0
                            ? 'Ends today'
                            : `${subscription.trial_days_remaining} day${subscription.trial_days_remaining !== 1 ? 's' : ''} left`}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      You have full access to all Professional features during the trial.
                      Upgrade before it ends to avoid interruption.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleUpgrade('monthly')}
                    className="px-3 py-2 border border-[#29828a] text-[#29828a] text-xs font-bold rounded-lg hover:bg-[#29828a]/5 transition-all"
                  >
                    ₹899/mo
                  </button>
                  <button
                    onClick={() => handleUpgrade('annual')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#29828a] hover:bg-[#1f6b72] text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Annual — 25% off <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* Expired Banner */}
            {isExpired && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-700">Your Professional Plan has expired</p>
                    <p className="text-xs text-red-500 mt-0.5">
                      Expired on {formatDate(subscription?.current_end)}. Your premium features are now locked. Renew to restore full access.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleUpgrade('monthly')}
                    className="px-3 py-2 border border-red-300 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-all"
                  >
                    ₹899/mo
                  </button>
                  <button
                    onClick={() => handleUpgrade('annual')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    ₹675/mo — Annual <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* Current Plan */}
            <Section
              title="Current Plan"
              description="You can update your plan anytime for best benefit from the product."
              action={
                !isPro ? (
                  <button
                    onClick={handleUpgrade}
                    className="text-sm font-semibold text-[#29828a] hover:underline"
                  >
                    Switch Plan
                  </button>
                ) : null
              }
            >
              <div className={`relative overflow-hidden flex items-center justify-between gap-4 p-4 rounded-xl border ${isPro ? 'bg-amber-50 border-amber-200' : isTrial ? 'bg-[#29828a]/5 border-[#29828a]/20' : isExpired ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                {isPro && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-amber-50/20 to-transparent pointer-events-none rounded-xl" />
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-amber-200/30 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute top-0 left-8 w-32 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent pointer-events-none" />
                  </>
                )}
                <div className="relative flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isPro ? 'bg-amber-100' : isTrial ? 'bg-[#29828a]/10' : 'bg-gray-100'}`}>
                    {isPro ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 17L5.5 8L9.5 13L12 6L14.5 13L18.5 8L21 17H3Z" fill="#F59E0B" stroke="#D97706" strokeWidth="1.2" strokeLinejoin="round"/>
                        <rect x="3" y="18" width="18" height="2.5" rx="1.25" fill="#D97706"/>
                        <circle cx="12" cy="5.5" r="1.5" fill="#F59E0B" stroke="#D97706" strokeWidth="1"/>
                        <circle cx="3.5" cy="8.5" r="1.5" fill="#F59E0B" stroke="#D97706" strokeWidth="1"/>
                        <circle cx="20.5" cy="8.5" r="1.5" fill="#F59E0B" stroke="#D97706" strokeWidth="1"/>
                      </svg>
                    ) : isTrial ? (
                      <Zap size={18} className="text-[#29828a]" />
                    ) : (
                      <ShieldCheck size={18} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {isPro ? 'Professional Plan' : isTrial ? '7-Day Free Trial' : isExpired ? 'Professional Plan' : 'Starter Plan'}
                      </p>
                      {isPro && (
                        <span className="text-xs font-semibold text-[#29828a]">₹899 / month</span>
                      )}
                      {isTrial && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#29828a]/10 text-[#29828a]">Trial</span>
                      )}
                      {isExpired && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Expired</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isPro
                        ? `Next billing: ${formatDate(subscription?.current_end)}`
                        : isTrial
                        ? `Trial ends ${formatDate(subscription?.current_end)} — upgrade to keep full access`
                        : isExpired
                        ? `Expired on ${formatDate(subscription?.current_end)} — renew to restore access`
                        : 'Free forever — unlimited upgrade available'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${isPro ? 'bg-amber-100 text-amber-700' : isTrial ? 'bg-[#29828a]/10 text-[#29828a]' : isExpired ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                    {isExpired ? 'Expired' : isTrial ? 'Trial' : subscription?.status || 'Active'}
                  </span>
                  {(isPro || isTrial) && <CheckCircle2 size={18} className="text-[#29828a]" />}
                </div>
              </div>

              {!isPro && (
                <div className="mt-3 rounded-xl border border-gray-100 bg-white overflow-hidden">
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#29828a]/8 flex items-center justify-center flex-shrink-0">
                        <Zap size={18} className="text-[#29828a]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Professional Plan</p>
                        <p className="text-xs text-gray-400 mt-0.5">Unlimited patients, staff, WhatsApp &amp; more</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpgrade('monthly')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#29828a] hover:bg-[#1f6b72] text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0"
                    >
                      ₹899/mo <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-t border-green-100">
                    <p className="text-xs text-green-700 font-medium">
                      💰 Save ₹1,488/year — pay <strong>₹675/month</strong> billed annually
                    </p>
                    <button
                      onClick={() => handleUpgrade('annual')}
                      className="text-xs font-bold text-green-700 hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      25% off <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              )}
            </Section>

            {/* What's Included */}
            <Section
              title="What's Included"
              description="Features available in your current plan compared to Professional."
              noBorder
            >
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Feature</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Starter</div>
                  <div className="text-[10px] font-bold text-[#29828a] uppercase tracking-wider text-center">Professional</div>
                </div>
                <div className="divide-y divide-gray-50">
                  {PRO_FEATURES.map((row, i) => {
                    const Icon = row.icon;
                    return (
                      <div key={i} className="grid grid-cols-3 px-4 py-3 hover:bg-gray-50/40 transition-colors items-center">
                        <div className="flex items-center gap-2">
                          <Icon size={12} className="text-gray-300 flex-shrink-0" />
                          <span className="text-xs text-gray-700">{row.label}</span>
                        </div>
                        <div className="flex justify-center"><FeatVal val={row.starter} /></div>
                        <div className="flex justify-center"><FeatVal val={row.pro} /></div>
                      </div>
                    );
                  })}
                </div>
                {!isPro && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-[#29828a]/5 border-t border-[#29828a]/10">
                    <p className="text-xs text-gray-600 font-medium">₹899/month or <strong className="text-[#29828a]">₹675/month</strong> billed annually — save 25%</p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleUpgrade('monthly')}
                        className="px-3 py-2 border border-[#29828a] text-[#29828a] text-xs font-semibold rounded-lg transition-all hover:bg-[#29828a]/5"
                      >
                        Monthly
                      </button>
                      <button
                        onClick={() => handleUpgrade('annual')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#29828a] hover:bg-[#1f6b72] text-white text-xs font-semibold rounded-lg transition-all"
                      >
                        Annual — 25% off <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </>
        )}

        {/* ════ BILLING HISTORY TAB ════ */}
        {activeTab === 'history' && (
          <Section
            title="Billing History"
            description="Summary of payments made for your subscription plan."
            noBorder
          >
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {billingHistory.length > 0 ? (
                <>
                  <div className="grid grid-cols-5 px-5 py-3 bg-gray-50 border-b border-gray-100">
                    {['Invoice', 'Plan', 'Amount', 'Date', 'Status'].map(h => (
                      <div key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</div>
                    ))}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {billingHistory.map(inv => (
                      <div key={inv.id} className="grid grid-cols-5 px-5 py-4 items-center hover:bg-gray-50/40 transition-colors">
                        <span className="text-xs font-mono text-gray-500">{inv.invoice}</span>
                        <span className="text-sm text-gray-700">{inv.plan}</span>
                        <span className="text-sm font-semibold text-gray-900">₹{inv.amount.toLocaleString('en-IN')}</span>
                        <span className="text-xs text-gray-500">{inv.date}</span>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${inv.status === 'PAID' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'PAID' ? 'bg-green-500' : 'bg-amber-500'}`} />
                            {inv.status}
                          </span>
                          <button
                            onClick={() => downloadInvoice(inv)}
                            title="Download Invoice"
                            className="p-1.5 text-gray-300 hover:text-[#29828a] hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <Download size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center">
                  <FileText size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400 font-medium">No billing history yet.</p>
                  <p className="text-xs text-gray-300 mt-1">Invoices will appear here after your first payment.</p>
                </div>
              )}
            </div>
          </Section>
        )}

      </div>
    </div>
  );
};

export default Subscription;







