import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, MessageSquare, Wallet, AlertCircle,
  CreditCard, CheckCircle2, XCircle, Send,
  RefreshCw, BarChart2, FileText, Loader2,
  ChevronLeft, ChevronRight, X, Plug, ExternalLink,
  Clock, Eye,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { load as loadCashfree } from '@cashfreepayments/cashfree-js';
import GearLoader from '../../components/GearLoader';

const WhatsAppIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#25D366" d="M4.868 43.303l2.694-9.835a19.5 19.5 0 01-2.612-9.768C4.953 13.001 13.954 4 25.003 4a19.45 19.45 0 0113.832 5.727A19.4 19.4 0 0144.56 23.51c-.005 10.745-8.734 19.5-19.557 19.5a19.55 19.55 0 01-9.352-2.38z" />
    <path fill="#fff" d="M31.07 27.32c-.51-.255-3.016-1.487-3.485-1.658-.47-.17-.81-.255-1.15.255-.34.51-1.32 1.658-1.617 2-.297.34-.595.383-1.105.128-.51-.256-2.152-.793-4.097-2.53-1.515-1.35-2.54-3.015-2.835-3.525-.297-.51-.032-.787.223-1.04.23-.23.51-.596.765-.893.255-.298.34-.51.51-.85.17-.34.085-.638-.043-.893-.128-.255-1.15-2.77-1.575-3.79-.414-.992-.837-.858-1.15-.874-.297-.013-.638-.016-.978-.016-.34 0-.893.128-1.36.638-.467.51-1.79 1.745-1.79 4.258 0 2.514 1.832 4.942 2.088 5.283.255.34 3.604 5.498 8.732 7.712 1.22.527 2.172.84 2.914 1.076 1.224.389 2.338.334 3.218.202.982-.146 3.016-1.232 3.443-2.42.427-1.19.427-2.21.298-2.42-.127-.212-.467-.34-.978-.595z" />
  </svg>
);

const GmailIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 75.6 75.6" width={size} height={size}>
    <path d="M3.6 75.6h14.5V37.8L0 26.5v45.5c0 2 1.6 3.6 3.6 3.6z" fill="#4285F4" />
    <path d="M57.5 75.6H72c2 0 3.6-1.6 3.6-3.6V26.5L57.5 37.8z" fill="#34A853" />
    <path d="M57.5 3.6v34.2L75.6 26.5V7.2c0-4.4-5-6.9-8.5-4.3z" fill="#FBBC04" />
    <path d="M18.1 37.8V3.6l19.7 14.8 19.7-14.8v34.2L37.8 52.6z" fill="#EA4335" />
    <path d="M0 7.2v19.3l18.1 11.3V3.6L8.5.3C5-.5 0 1.5 0 7.2z" fill="#C5221F" />
  </svg>
);

const EVENT_AUDIENCE = {
  appointment_booked:          'patient',
  appointment_confirmation:    'patient',
  checked_in:                  'patient',
  invoice_notification:        'patient',
  prescription_notification:   'patient',
  appointment_reminder:        'patient',
  google_review:               'patient',
  consent_form:                'patient',
  daily_summary:               'doctor',
  // platform / automated
  molarplus_app_welcome:              'owner',
  molarplus_subscription_confirmed:   'owner',
  molarplus_topup_success:            'owner',
  molarplus_weekly_report_mk:         'owner',
  molarplus_monthly_report_mk:        'owner',
  molarplus_review_report_mk:         'owner',
  molarplus_lab_due_tomorrow_mk:      'owner',
  molarplus_trial_started_mk:         'owner',
  molarplus_trial_mid_mk:             'owner',
  molarplus_trial_ending_mk:          'owner',
  molarplus_trial_ended_mk:           'owner',
};


// WhatsApp utility rate (patient events); marketing rate for _mk templates
const MARKETING_EVENTS = new Set([
  'google_review', 'molarplus_weekly_report_mk', 'molarplus_monthly_report_mk',
  'molarplus_review_report_mk', 'molarplus_trial_started_mk', 'molarplus_trial_mid_mk',
  'molarplus_trial_ending_mk', 'molarplus_trial_ended_mk',
]);
const getChannelCost = (channel, eventType = '') => {
  if (channel === 'whatsapp') return MARKETING_EVENTS.has(eventType) ? 0.8631 : 0.115;
  if (channel === 'email') return 0.02;
  if (channel === 'sms') return 0.15;
  return 0;
};

const EVENT_LABELS = {
  appointment_booked:       'Appointment Booked',
  appointment_confirmation: 'Appointment Confirmed',
  checked_in:               'Patient Checked In',
  invoice_notification:     'Invoice Sent',
  prescription_notification:'Prescription Sent',
  appointment_reminder:     'Appointment Reminder',
  google_review:            'Google Review Request',
  consent_form:             'Consent Form Notification',
  daily_summary:            'Doctor Daily Summary',
  // platform / automated
  molarplus_app_welcome:              'Welcome Message',
  molarplus_subscription_confirmed:   'Subscription Confirmed',
  molarplus_topup_success:            'Wallet Top-up Success',
  molarplus_weekly_report_mk:         'Weekly Report',
  molarplus_monthly_report_mk:        'Monthly Report',
  molarplus_review_report_mk:         'Monthly Review Reminder',
  molarplus_lab_due_tomorrow_mk:      'Lab Order Due Tomorrow',
  molarplus_trial_started_mk:         'Trial Started',
  molarplus_trial_mid_mk:             'Trial — Day 4 Nudge',
  molarplus_trial_ending_mk:          'Trial Ending Soon',
  molarplus_trial_ended_mk:           'Trial Ended',
};


const CHANNEL_META = {
  whatsapp: { label: 'WhatsApp', color: 'text-green-600', bg: 'bg-white',     badge: 'bg-green-100 text-green-700',  icon: WhatsAppIcon,  priceLabel: '₹0.115 utility / ₹0.8631 marketing' },
  email:    { label: 'Email',    color: 'text-blue-600',  bg: 'bg-white',     badge: 'bg-blue-100 text-blue-700',    icon: GmailIcon,     priceLabel: '~₹0.02 / Mail'            },
  sms:      { label: 'SMS',      color: 'text-purple-600',bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700', icon: MessageCircle, priceLabel: '~₹0.15 / SMS'            },
};

const Notifications = () => {
  const [activeTab, setActiveTab]         = useState('overview');
  const [stats, setStats]                 = useState({});
  const [channelStatus, setChannelStatus] = useState({});
  const [wallet, setWallet]               = useState({ balance: 0, last_topup_at: null, transactions: [] });
  const [preferences, setPreferences]     = useState([]);
  const [logs, setLogs]                   = useState([]);
  const [logsTotal, setLogsTotal]         = useState(0);
  const [logsPage, setLogsPage]           = useState(1);
  const [logsFilter, setLogsFilter]       = useState({ channel: '', status: '' });
  const [loading, setLoading]             = useState(true);
  const [savingPrefs, setSavingPrefs]     = useState(false);
  const [topUpAmount, setTopUpAmount]     = useState(500);
  const [toppingUp, setToppingUp]         = useState(false);


  // Provider marketplace drawer
  const [drawerProvider, setDrawerProvider] = useState(null);

  // Template test drawer
  const [testDrawer, setTestDrawer] = useState({
    open: false, pref: null, templates: {}, recipient: '',
    selectedChannel: '', loadingTpl: false, sending: false,
  });

  const location = useLocation();
  const navigate = useNavigate();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, cs, w, p] = await Promise.all([
        api.get('/notification-admin/stats').catch(() => ({})),
        api.get('/notification-admin/channel-status').catch(() => ({})),
        api.get('/notification-admin/wallet').catch(() => ({ balance: 0, transactions: [] })),
        api.get('/notification-admin/preferences').catch(() => []),
      ]);
      setStats(s);
      setChannelStatus(cs);
      setWallet(w);
      setPreferences(Array.isArray(p) ? p : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1, filter = logsFilter) => {
    const params = new URLSearchParams({ page, per_page: 20 });
    if (filter.channel) params.set('channel', filter.channel);
    if (filter.status)  params.set('status',  filter.status);
    try {
      const data = await api.get(`/notification-admin/logs?${params}`);
      setLogs(data.logs || []);
      setLogsTotal(data.total || 0);
    } catch {
      setLogs([]);
    }
  }, [logsFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (activeTab === 'logs') fetchLogs(1); }, [activeTab, fetchLogs]);

  const openTestDrawer = async (pref) => {
    const ch = (pref.channels && pref.channels.length > 0) ? pref.channels[0] : 'whatsapp';
    setTestDrawer(d => ({ ...d, open: true, pref, selectedChannel: ch, recipient: '', loadingTpl: true }));
    try {
      const data = await api.get('/notification-admin/templates');
      setTestDrawer(d => ({ ...d, templates: data || {}, loadingTpl: false }));
    } catch {
      setTestDrawer(d => ({ ...d, loadingTpl: false }));
    }
  };

  const handleTemplateSend = async () => {
    const { pref, selectedChannel, recipient } = testDrawer;
    if (!recipient) { toast.error('Enter a recipient'); return; }
    setTestDrawer(d => ({ ...d, sending: true }));
    try {
      const res = await api.post('/notification-admin/test/template-send', {
        event_type: pref.event_type,
        channel: selectedChannel,
        recipient,
      });
      toast.success(`✅ Sent! ₹${res.cost?.toFixed(2)} deducted. New balance: ₹${res.new_balance?.toFixed(2)}`);
      setWallet(w => ({ ...w, balance: res.new_balance }));
      setTestDrawer(d => ({ ...d, open: false }));
    } catch (err) {
      toast.error(err?.detail || err?.message || 'Send failed');
    } finally {
      setTestDrawer(d => ({ ...d, sending: false }));
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await api.put('/notification-admin/preferences', { preferences });
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  const updatePref = (event_type, field, value) => {
    setPreferences(prev =>
      prev.map(p => {
        if (p.event_type !== event_type) return p;
        if (field === 'toggleChannel') {
          const chs = p.channels || [];
          return { ...p, channels: chs.includes(value) ? chs.filter(c => c !== value) : [...chs, value] };
        }
        return { ...p, [field]: value };
      })
    );
  };

  const handleWalletTopup = async () => {
    if (topUpAmount < 100) { toast.error('Minimum top-up is ₹100'); return; }
    setToppingUp(true);
    try {
      const sessionData = await api.post('/notification-admin/wallet/topup', { amount: topUpAmount });
      if (!sessionData.payment_session_id) throw new Error('No payment session');

      const isProd = window.location.hostname !== 'localhost';
      const cashfree = await loadCashfree({ mode: isProd ? 'production' : 'sandbox' });
      await cashfree.checkout({ paymentSessionId: sessionData.payment_session_id, redirectTarget: '_self' });
    } catch (err) {
      toast.error(err.message || 'Failed to initiate payment');
      setToppingUp(false);
    }
  };

  // Verify wallet top-up after Cashfree redirect back
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const walletSuccess = params.get('wallet_success');
    const orderId = params.get('order_id');
    if (walletSuccess === '1' && orderId && orderId.startsWith('WALLET_')) {
      navigate('/admin/notifications', { replace: true });
      api.get(`/notification-admin/wallet/verify?order_id=${orderId}`)
        .then(res => {
          if (res.success) {
            toast.success(`🎉 Wallet top-up successful! ₹${res.balance?.toFixed(2)} is your new balance.`);
            api.get('/notification-admin/wallet')
              .then(w => setWallet(w))
              .catch(() => {});
          } else {
            toast.error(`Payment not confirmed yet. Status: ${res.status || 'unknown'}`);
          }
        })
        .catch(() => toast.error('Could not verify payment. Please refresh.'));
    }
  }, [location.search]);   // eslint-disable-line

  const TABS = [
    { id: 'overview',    label: 'Overview',       icon: BarChart2    },
    { id: 'preferences', label: 'Preferences',    icon: MessageSquare},
    { id: 'logs',        label: 'Message Logs',   icon: FileText     },
    { id: 'channels',    label: 'Integrations',   icon: Plug         },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GearLoader />
      </div>
    );
  }

  // ── Sub-components ──────────────────────────────────────────────────────────

  const StatCard = ({ channel }) => {
    const meta = CHANNEL_META[channel] || {};
    const Icon = meta.icon || MessageCircle;
    const data = stats[channel] || { sent: 0, total_cost: 0 };
    const status = channelStatus[channel] || {};
    return (
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 ${meta.bg} ${meta.color} rounded-lg`}>
              <Icon size={28} />
            </div>
            <div>
              <span className="font-semibold text-gray-800 text-sm">{meta.label}</span>
              <p className="text-[11px] text-gray-400">{meta.priceLabel}</p>
            </div>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.configured ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {status.configured ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {status.configured ? 'Active' : 'Not set'}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider font-semibold">Sent this month</p>
        <h4 className="text-3xl font-bold text-gray-900 mb-4">{data.sent.toLocaleString()}</h4>
        <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">Total spend</span>
          <span className="text-sm font-semibold text-gray-700">₹{(data.total_cost || 0).toFixed(2)}</span>
        </div>
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">

      {/* Header & Tabs */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage channels, preferences, and message delivery</p>
          </div>
          <button onClick={fetchAll} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-1 -mb-px">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg ${
                  activeTab === id
                    ? 'border-[#29828a] text-[#29828a] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <StatCard channel="whatsapp" />
              <StatCard channel="email" />
              <StatCard channel="sms" />
            </div>

            {/* Wallet + Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Transaction history */}
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm lg:col-span-3">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-semibold text-gray-900">Recent Top-ups</h3>
                </div>
                {wallet.transactions && wallet.transactions.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {wallet.transactions.map(txn => (
                      <div key={txn.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{txn.description || 'Wallet Top-up'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {txn.created_at ? new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${txn.transaction_type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                            {txn.transaction_type === 'credit' ? '+' : '-'}₹{txn.amount.toFixed(2)}
                          </p>
                          <span className={`text-[11px] font-medium ${txn.status === 'completed' ? 'text-green-600' : txn.status === 'pending' ? 'text-amber-500' : 'text-red-500'}`}>
                            {txn.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50 h-44 gap-2">
                    <Wallet size={24} className="text-gray-300" />
                    <span className="text-gray-400 text-sm">No transactions yet</span>
                  </div>
                )}
              </div>

              {/* Wallet balance + top-up */}
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm lg:col-span-2 flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#29828a]/10 text-[#29828a] rounded-xl">
                    <Wallet size={22} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Wallet Balance</p>
                    <h2 className="text-3xl font-bold text-gray-900">₹{(wallet.balance || 0).toFixed(2)}</h2>
                  </div>
                </div>

                {wallet.last_topup_at && (
                  <p className="text-xs text-gray-400">
                    Last top-up: {new Date(wallet.last_topup_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}

                {(wallet.balance || 0) < 100 && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-semibold border border-red-100">
                    <AlertCircle size={14} /> Low balance — top up to continue sending
                  </div>
                )}

                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/40">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-3">
                    <CreditCard size={13} className="text-gray-400" /> Add Funds
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {[100, 500, 1000, 5000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setTopUpAmount(amt)}
                        className={`py-2 text-xs rounded-lg border font-medium transition-all ${
                          topUpAmount === amt
                            ? 'border-[#29828a] bg-[#29828a]/10 text-[#29828a]'
                            : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={100}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a] outline-none mb-3 transition-all"
                    placeholder="Custom amount (min ₹100)"
                    value={topUpAmount}
                    onChange={e => setTopUpAmount(Number(e.target.value))}
                  />
                  <button
                    onClick={handleWalletTopup}
                    disabled={toppingUp}
                    className="w-full py-2.5 bg-[#29828a] hover:bg-[#1f6b72] disabled:bg-gray-300 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2"
                  >
                    {toppingUp ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : `Add ₹${topUpAmount} via Cashfree`}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── INTEGRATIONS TAB ── */}
        {activeTab === 'channels' && (
          <>
            {/* Provider marketplace */}
            {(() => {
              const PROVIDERS = [
                {
                  id: 'msg91',
                  name: 'MSG91',
                  tagline: 'India\'s leading CPaaS platform',
                  description: 'Send WhatsApp, SMS, and transactional emails with high deliverability through India\'s most popular messaging API.',
                  channels: ['whatsapp', 'sms', 'email'],
                  color: 'bg-violet-600',
                  textColor: 'text-violet-600',
                  bgLight: 'bg-violet-50',
                  docsUrl: 'https://docs.msg91.com',
                  fields: [
                    { key: 'auth_key', label: 'Auth Key', placeholder: 'Enter MSG91 Auth Key', type: 'password' },
                    { key: 'sender_id', label: 'SMS Sender ID', placeholder: 'e.g. MOLARPLUS', type: 'text' },
                    { key: 'whatsapp_sender', label: 'WhatsApp Number', placeholder: 'e.g. 919876543210', type: 'text' },
                  ],
                  initials: 'M9',
                },
                {
                  id: 'fast2sms',
                  name: 'Fast2SMS',
                  tagline: 'Affordable bulk messaging for India',
                  description: 'Budget-friendly SMS, WhatsApp, and email notifications for Indian businesses with simple REST API integration.',
                  channels: ['whatsapp', 'sms', 'email'],
                  color: 'bg-blue-600',
                  textColor: 'text-blue-600',
                  bgLight: 'bg-blue-50',
                  docsUrl: 'https://www.fast2sms.com/docs',
                  fields: [
                    { key: 'api_key', label: 'API Key', placeholder: 'Enter Fast2SMS API Key', type: 'password' },
                    { key: 'sender_id', label: 'Sender ID', placeholder: 'e.g. FSTSMS', type: 'text' },
                  ],
                  initials: 'F2',
                },
                {
                  id: 'kaleyra',
                  name: 'Kaleyra',
                  tagline: 'Enterprise-grade cloud communications',
                  description: 'Trusted by 3000+ enterprises globally for WhatsApp Business API, SMS, and email at scale with carrier-grade reliability.',
                  channels: ['whatsapp', 'sms', 'email'],
                  color: 'bg-teal-600',
                  textColor: 'text-teal-600',
                  bgLight: 'bg-teal-50',
                  docsUrl: 'https://developers.kaleyra.io',
                  fields: [
                    { key: 'api_key', label: 'API Key', placeholder: 'Enter Kaleyra API Key', type: 'password' },
                    { key: 'sid', label: 'Account SID', placeholder: 'Enter Account SID', type: 'text' },
                    { key: 'sender', label: 'Sender Number / ID', placeholder: 'e.g. +919876543210', type: 'text' },
                  ],
                  initials: 'KL',
                },
                {
                  id: 'wareach',
                  name: 'WA Reach',
                  tagline: 'Free WhatsApp notifications',
                  description: 'Send WhatsApp notifications for free using the official WhatsApp Cloud API. No per-message charges for business-initiated messages under Meta\'s free tier.',
                  channels: ['whatsapp'],
                  color: 'bg-green-600',
                  textColor: 'text-green-600',
                  bgLight: 'bg-green-50',
                  docsUrl: 'https://developers.facebook.com/docs/whatsapp',
                  fields: [
                    { key: 'access_token', label: 'Meta Access Token', placeholder: 'Enter Meta Access Token', type: 'password' },
                    { key: 'phone_number_id', label: 'Phone Number ID', placeholder: 'Enter Phone Number ID', type: 'text' },
                    { key: 'waba_id', label: 'WhatsApp Business Account ID', placeholder: 'Enter WABA ID', type: 'text' },
                  ],
                  initials: 'WA',
                  badge: 'Free',
                },
                {
                  id: 'twilio',
                  name: 'Twilio',
                  tagline: 'Global cloud communications leader',
                  description: 'Send and receive SMS, WhatsApp messages, and emails globally with Twilio\'s programmable communications platform.',
                  channels: ['whatsapp', 'sms', 'email'],
                  color: 'bg-red-600',
                  textColor: 'text-red-600',
                  bgLight: 'bg-red-50',
                  docsUrl: 'https://www.twilio.com/docs',
                  fields: [
                    { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
                    { key: 'auth_token', label: 'Auth Token', placeholder: 'Enter Auth Token', type: 'password' },
                    { key: 'from_number', label: 'From Number / Sender', placeholder: 'e.g. +15005550006', type: 'text' },
                  ],
                  initials: 'TW',
                },
                {
                  id: 'gupshup',
                  name: 'Gupshup',
                  tagline: 'Conversational AI & messaging',
                  description: 'Build conversational experiences on WhatsApp, SMS, and more with Gupshup\'s AI-powered messaging platform.',
                  channels: ['whatsapp', 'sms', 'email'],
                  color: 'bg-orange-500',
                  textColor: 'text-orange-500',
                  bgLight: 'bg-orange-50',
                  docsUrl: 'https://docs.gupshup.io',
                  fields: [
                    { key: 'api_key', label: 'API Key', placeholder: 'Enter Gupshup API Key', type: 'password' },
                    { key: 'app_name', label: 'App Name', placeholder: 'Enter your Gupshup App name', type: 'text' },
                    { key: 'source_number', label: 'Source Number', placeholder: 'e.g. 917834811114', type: 'text' },
                  ],
                  initials: 'GS',
                },
                {
                  id: 'aws',
                  name: 'AWS',
                  tagline: 'SNS for SMS · SES for Email',
                  description: 'Use Amazon SNS for reliable transactional SMS and Amazon SES for high-volume email delivery at enterprise scale.',
                  channels: ['sms', 'email'],
                  color: 'bg-[#FF9900]',
                  textColor: 'text-[#FF9900]',
                  bgLight: 'bg-amber-50',
                  docsUrl: 'https://docs.aws.amazon.com',
                  fields: [
                    { key: 'access_key_id', label: 'AWS Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE', type: 'text' },
                    { key: 'secret_access_key', label: 'Secret Access Key', placeholder: 'Enter Secret Access Key', type: 'password' },
                    { key: 'region', label: 'AWS Region', placeholder: 'e.g. ap-south-1', type: 'text' },
                    { key: 'ses_from_email', label: 'SES From Email', placeholder: 'noreply@yourdomain.com', type: 'text' },
                  ],
                  initials: 'AWS',
                },
              ];

              const CHANNEL_BADGE = {
                whatsapp: { label: 'WhatsApp', cls: 'bg-green-50 text-green-700 border border-green-100' },
                email:    { label: 'Email',    cls: 'bg-blue-50 text-blue-700 border border-blue-100'   },
                sms:      { label: 'SMS',      cls: 'bg-purple-50 text-purple-700 border border-purple-100' },
              };

              return (
                <>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Choose your notification provider</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Click any provider to configure API credentials. Currently using MolarPlus global keys.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {PROVIDERS.map(provider => (
                      <div
                        key={provider.id}
                        onClick={() => setDrawerProvider(provider)}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-[#29828a]/40 hover:shadow-md transition-all group relative"
                      >
                        {provider.badge && (
                          <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            {provider.badge}
                          </span>
                        )}
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`w-11 h-11 rounded-xl ${provider.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                            {provider.initials}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 text-[15px] group-hover:text-[#29828a] transition-colors">{provider.name}</h4>
                            <p className="text-[11px] text-gray-400">{provider.tagline}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{provider.description}</p>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {provider.channels.map(ch => (
                            <span key={ch} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_BADGE[ch].cls}`}>
                              {CHANNEL_BADGE[ch].label}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                          <a
                            href={provider.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#29828a] transition-colors"
                          >
                            <ExternalLink size={11} /> API Docs
                          </a>
                          <span className="text-xs font-semibold text-[#29828a] group-hover:underline">Configure →</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right Drawer */}
                  {drawerProvider && (
                    <>
                      <div
                        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
                        onClick={() => setDrawerProvider(null)}
                      />
                      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
                        {/* Drawer header */}
                        <div className={`p-6 ${drawerProvider.bgLight} border-b border-gray-100`}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl ${drawerProvider.color} flex items-center justify-center text-white font-bold text-sm`}>
                                {drawerProvider.initials}
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900 text-lg">{drawerProvider.name}</h3>
                                <p className="text-xs text-gray-500">{drawerProvider.tagline}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setDrawerProvider(null)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-white/60 hover:text-gray-600 transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {drawerProvider.channels.map(ch => (
                              <span key={ch} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${CHANNEL_BADGE[ch].cls}`}>
                                {CHANNEL_BADGE[ch].label}
                              </span>
                            ))}
                            {drawerProvider.badge && (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                                {drawerProvider.badge}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Drawer body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                          <p className="text-sm text-gray-600 leading-relaxed">{drawerProvider.description}</p>

                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                            <strong>Note:</strong> Per-clinic credential storage is coming soon. These credentials will apply globally to your MolarPlus account.
                          </div>

                          <div className="space-y-3">
                            {drawerProvider.fields.map(field => (
                              <div key={field.key}>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{field.label}</label>
                                <input
                                  type={field.type}
                                  placeholder={field.placeholder}
                                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a] outline-none transition-all placeholder:text-gray-300"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Drawer footer */}
                        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-2">
                          <button
                            onClick={() => {
                              toast.info('Per-clinic provider configuration coming soon!');
                              setDrawerProvider(null);
                            }}
                            className="w-full py-2.5 bg-[#29828a] hover:bg-[#1f6b72] text-white font-semibold rounded-lg text-sm transition-all"
                          >
                            Save Configuration
                          </button>
                          <a
                            href={drawerProvider.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-[#29828a] transition-colors"
                          >
                            <ExternalLink size={12} /> View {drawerProvider.name} API Documentation
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* ── PREFERENCES TAB ── */}
        {activeTab === 'preferences' && (
          <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-50">
              <div>
                <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
                <p className="text-xs text-gray-400 mt-0.5">Choose channel, enable/disable, and send a test notification for each event.</p>
              </div>
              <button
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#1f6b72] disabled:bg-gray-200 text-white text-sm font-semibold rounded-lg transition-all"
              >
                {savingPrefs ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Preferences
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Event</div>
              {['whatsapp', 'email', 'sms'].map(ch => (
                <div key={ch} className={`text-xs font-semibold uppercase tracking-wider text-center ${ch === 'sms' ? 'text-gray-300' : CHANNEL_META[ch].color}`}>
                  {CHANNEL_META[ch].label}
                  {ch === 'sms' && (
                    <span className="ml-1 text-[9px] font-semibold bg-gray-100 text-gray-400 border border-gray-200 rounded px-1 py-0.5 normal-case">Soon</span>
                  )}
                </div>
              ))}
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Test</div>
            </div>

            <div className="divide-y divide-gray-50">
              {preferences.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">Loading preferences...</div>
              ) : (
                preferences.map(pref => {
                  const audience = EVENT_AUDIENCE[pref.event_type] || 'patient';
                  return (
                    <div key={pref.event_type} className="grid grid-cols-6 gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors items-center">
                      <div className="col-span-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-800">{EVENT_LABELS[pref.event_type] || pref.event_type}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            audience === 'doctor'
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {audience === 'doctor' ? '👨‍⚕️ Doctor' : '🧑‍🦷 Patient'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={pref.is_enabled}
                              onChange={e => updatePref(pref.event_type, 'is_enabled', e.target.checked)}
                            />
                            <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#29828a]/20 rounded-full peer peer-checked:bg-[#29828a] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 transition-all" />
                          </label>
                          <span className="text-xs text-gray-400">{pref.is_enabled ? 'Enabled' : 'Disabled'}</span>
                        </div>
                      </div>
                      {['whatsapp', 'email', 'sms'].map(ch => {
                        const checked = (pref.channels || []).includes(ch);
                        const isSmsLocked = ch === 'sms';
                        return (
                          <div key={ch} className="flex items-center justify-center">
                            {isSmsLocked ? (
                              <div title="SMS coming soon" className="w-5 h-5 rounded flex items-center justify-center border-2 border-gray-200 bg-gray-50 cursor-not-allowed opacity-40">
                                <svg width="9" height="12" viewBox="0 0 9 12" fill="none">
                                  <rect x="1" y="5" width="7" height="6" rx="1" stroke="#9ca3af" strokeWidth="1.4"/>
                                  <path d="M2.5 5V3.5a2 2 0 014 0V5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/>
                                </svg>
                              </div>
                            ) : (
                              <button
                                onClick={() => updatePref(pref.event_type, 'toggleChannel', ch)}
                                disabled={!pref.is_enabled}
                                className={`w-5 h-5 rounded flex items-center justify-center transition-all disabled:opacity-30 border-2 ${
                                  checked
                                    ? 'border-[#29828a] bg-[#29828a]'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                              >
                                {checked && (
                                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                    <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => openTestDrawer(pref)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#29828a] border border-[#29828a]/30 bg-[#29828a]/5 hover:bg-[#29828a]/10 rounded-lg transition-all"
                        >
                          <Send size={11} /> Test
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Automated / Platform Notifications ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-6">
            <div className="p-5 border-b border-gray-50">
              <h3 className="font-semibold text-gray-900">Automated Notifications</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                System-sent messages to clinic owners — triggered automatically. Use Test to preview and send a sample.
              </p>
            </div>

            <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="col-span-5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Event</div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Test</div>
            </div>

            <div className="divide-y divide-gray-50">
              {[
                { event_type: 'molarplus_app_welcome',            channels: ['whatsapp', 'email'] },
                { event_type: 'molarplus_subscription_confirmed', channels: ['whatsapp', 'email'] },
                { event_type: 'molarplus_topup_success',          channels: ['whatsapp', 'email'] },
                { event_type: 'molarplus_weekly_report_mk',       channels: ['whatsapp'] },
                { event_type: 'molarplus_monthly_report_mk',      channels: ['whatsapp'] },
                { event_type: 'molarplus_review_report_mk',       channels: ['whatsapp'] },
                { event_type: 'molarplus_lab_due_tomorrow_mk',    channels: ['whatsapp'] },
                { event_type: 'molarplus_trial_started_mk',       channels: ['whatsapp'] },
                { event_type: 'molarplus_trial_mid_mk',           channels: ['whatsapp'] },
                { event_type: 'molarplus_trial_ending_mk',        channels: ['whatsapp'] },
                { event_type: 'molarplus_trial_ended_mk',         channels: ['whatsapp'] },
              ].map(pref => (
                <div key={pref.event_type} className="grid grid-cols-6 gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors items-center">
                  <div className="col-span-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">{EVENT_LABELS[pref.event_type] || pref.event_type}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                        🤖 Auto
                      </span>
                      <span className="text-[10px] font-mono text-gray-300">{pref.event_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => openTestDrawer({ ...pref, is_enabled: true })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#29828a] border border-[#29828a]/30 bg-[#29828a]/5 hover:bg-[#29828a]/10 rounded-lg transition-all"
                    >
                      <Send size={11} /> Test
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>
        )}

        {/* ── MESSAGE LOGS TAB ── */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-gray-50">
              <div>
                <h3 className="font-semibold text-gray-900">Message Logs</h3>
                <p className="text-xs text-gray-400 mt-0.5">{logsTotal} total messages</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={logsFilter.channel}
                  onChange={e => { const f = { ...logsFilter, channel: e.target.value }; setLogsFilter(f); setLogsPage(1); fetchLogs(1, f); }}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 bg-white outline-none focus:ring-2 focus:ring-[#29828a]/10"
                >
                  <option value="">All Channels</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
                <select
                  value={logsFilter.status}
                  onChange={e => { const f = { ...logsFilter, status: e.target.value }; setLogsFilter(f); setLogsPage(1); fetchLogs(1, f); }}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 bg-white outline-none focus:ring-2 focus:ring-[#29828a]/10"
                >
                  <option value="">All Status</option>
                  <option value="queued">Queued</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                  <option value="failed">Failed</option>
                </select>
                <button onClick={() => fetchLogs(logsPage)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {['Time', 'Channel', 'Recipient', 'Event', 'Status', 'Cost'].map(h => (
                      <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-sm text-gray-400">
                        <FileText size={28} className="mx-auto mb-2 text-gray-200" />
                        No messages have been sent yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => {
                      const meta = CHANNEL_META[log.channel] || {};
                      const Icon = meta.icon || MessageCircle;
                      return (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                            {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge || 'bg-gray-100 text-gray-600'}`}>
                              <Icon size={10} />
                              {meta.label || log.channel}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-700 font-mono text-xs">{log.recipient}</td>
                          <td className="px-5 py-3.5 text-xs text-gray-500">{EVENT_LABELS[log.event_type] || log.event_type || '—'}</td>
                          <td className="px-5 py-3.5">
                            {(() => {
                              const s = log.status;
                              const cfg = {
                                queued:    { cls: 'bg-gray-100 text-gray-500',   icon: <Clock size={10} />,        label: 'Queued' },
                                sent:      { cls: 'bg-blue-50 text-blue-600',    icon: <Send size={10} />,         label: 'Sent' },
                                delivered: { cls: 'bg-green-50 text-green-700',  icon: <CheckCircle2 size={10} />, label: 'Delivered' },
                                read:      { cls: 'bg-purple-50 text-purple-700',icon: <Eye size={10} />,          label: 'Read' },
                                failed:    { cls: 'bg-red-50 text-red-600',      icon: <XCircle size={10} />,      label: 'Failed' },
                              }[s] || { cls: 'bg-gray-100 text-gray-500', icon: null, label: s };
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}
                                  title={log.error_message || undefined}
                                >
                                  {cfg.icon}
                                  {cfg.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-medium text-gray-600 text-right pr-6">
                            {log.cost > 0 ? `₹${log.cost.toFixed(4)}` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logsTotal > 20 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Showing {((logsPage - 1) * 20) + 1}–{Math.min(logsPage * 20, logsTotal)} of {logsTotal}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={logsPage <= 1}
                    onClick={() => { const p = logsPage - 1; setLogsPage(p); fetchLogs(p); }}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                    {logsPage}
                  </span>
                  <button
                    disabled={logsPage * 20 >= logsTotal}
                    onClick={() => { const p = logsPage + 1; setLogsPage(p); fetchLogs(p); }}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Test Notification Drawer (top-level, fixed position) ── */}
      {testDrawer.open && testDrawer.pref && (() => {
        const pref = testDrawer.pref;
        const audience = EVENT_AUDIENCE[pref.event_type] || 'patient';
        const tpl = testDrawer.templates[pref.event_type];
        const ch = testDrawer.selectedChannel;
        const cost = getChannelCost(ch, pref.event_type);
        const isEmail = ch === 'email';
        const renderedPreview = tpl?.content
          ? tpl.content
              .replace(/\{patient_name\}/g, 'Rahul Sharma')
              .replace(/\{doctor_name\}/g, 'Dr. Mehta')
              .replace(/\{clinic_name\}/g, 'Your Clinic')
              .replace(/\{appointment_date\}/g, 'Tomorrow, 10:30 AM')
              .replace(/\{appointment_time\}/g, '10:30 AM')
              .replace(/\{invoice_amount\}/g, '₹850')
              .replace(/\{invoice_number\}/g, 'INV-001')
              .replace(/\{review_link\}/g, 'https://g.page/r/example')
              .replace(/\{consent_link\}/g, 'https://molarplus.com/consent/demo')
              .replace(/\{report_date\}/g, 'Today')
          : null;
        return (
          <React.Fragment key="test-drawer">
            <div
              className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
              onClick={() => setTestDrawer(d => ({ ...d, open: false }))}
            />
            <div className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-gray-900">{EVENT_LABELS[pref.event_type]}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${audience === 'doctor' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                      {audience === 'doctor' ? '👨‍⚕️ Doctor' : '🧑‍🦷 Patient'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Preview template &amp; send a test notification</p>
                </div>
                <button onClick={() => setTestDrawer(d => ({ ...d, open: false }))} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Channel selector */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Send via</p>
                  <div className="flex gap-2">
                    {['whatsapp', 'email', 'sms'].map(c => {
                      const m = CHANNEL_META[c];
                      const Ic = m.icon;
                      return (
                        <button
                          key={c}
                          onClick={() => setTestDrawer(d => ({ ...d, selectedChannel: c }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${ch === c ? 'border-[#29828a] text-[#29828a] bg-[#29828a]/5' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          <Ic size={14} /> {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Template preview */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Template Preview</p>
                  {testDrawer.loadingTpl ? (
                    <div className="flex items-center justify-center h-24 bg-gray-50 rounded-xl">
                      <Loader2 size={18} className="animate-spin text-gray-300" />
                    </div>
                  ) : renderedPreview ? (
                    <div className="bg-gray-50 rounded-xl p-4 whitespace-pre-wrap leading-relaxed border border-gray-100 font-mono text-xs text-gray-700">
                      {renderedPreview}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
                      No template for <strong>{pref.event_type}</strong>. A generic fallback will be sent.
                      <span className="block mt-1 text-amber-500">Create a template named <code className="bg-amber-100 px-1 rounded">{pref.event_type}</code> in Templates Manager.</span>
                    </div>
                  )}
                  {tpl?.variables?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tpl.variables.map(v => (
                        <span key={v} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">{v}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recipient */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {isEmail ? 'Recipient Email' : 'Recipient Phone (with country code)'}
                  </label>
                  <input
                    type={isEmail ? 'email' : 'tel'}
                    placeholder={isEmail ? 'doctor@clinic.com' : '919876543210'}
                    value={testDrawer.recipient}
                    onChange={e => setTestDrawer(d => ({ ...d, recipient: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a] outline-none transition-all"
                  />
                </div>

                {/* Cost + balance */}
                <div className="bg-[#29828a]/5 border border-[#29828a]/15 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Cost of this test</p>
                    <p className="text-lg font-bold text-[#29828a]">₹{cost.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium">Wallet balance</p>
                    <p className={`text-lg font-bold ${wallet.balance < cost ? 'text-red-500' : 'text-gray-800'}`}>
                      ₹{(wallet.balance || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {wallet.balance < cost && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-600">
                    Insufficient balance. Please top up your wallet from the Overview tab.
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={handleTemplateSend}
                  disabled={testDrawer.sending || wallet.balance < cost || !testDrawer.recipient}
                  className="w-full py-2.5 bg-[#29828a] hover:bg-[#1f6b72] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                  {testDrawer.sending
                    ? <><Loader2 size={14} className="animate-spin" /> Sending...</>
                    : <><Send size={14} /> Send Test — ₹{cost.toFixed(2)} deducted</>}
                </button>
              </div>
            </div>
          </React.Fragment>
        );
      })()}
    </div>
  );
};

export default Notifications;
