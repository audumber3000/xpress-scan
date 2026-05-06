import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, BarChart2, FileText, Plug,
  RefreshCw, Send, Loader2, X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';
import { load as loadCashfree } from '@cashfreepayments/cashfree-js';
import { api } from '../../../utils/api';
import GearLoader from '../../../components/GearLoader';

import { CHANNEL_META, EVENT_LABELS, EVENT_AUDIENCE, getChannelCost } from './constants';
import OverviewTab from './OverviewTab';
import PreferencesTab from './PreferencesTab';
import LogsTab from './LogsTab';
import IntegrationsTab from './IntegrationsTab';
import { getCurrencySymbol } from '../../../utils/currency';

const TABS = [
  { id: 'overview',    label: 'Overview',     icon: BarChart2     },
  { id: 'preferences', label: 'Preferences',  icon: MessageSquare },
  { id: 'logs',        label: 'Message Logs', icon: FileText      },
  { id: 'channels',    label: 'Integrations', icon: Plug          },
];

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
  const [drawerProvider, setDrawerProvider] = useState(null);
  const [testDrawer, setTestDrawer]       = useState({
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
            toast.success(`🎉 Wallet top-up successful! ${getCurrencySymbol()}${res.balance?.toFixed(2)} is your new balance.`);
            api.get('/notification-admin/wallet').then(w => setWallet(w)).catch(() => {});
          } else {
            toast.error(`Payment not confirmed yet. Status: ${res.status || 'unknown'}`);
          }
        })
        .catch(() => toast.error('Could not verify payment. Please refresh.'));
    }
  }, [location.search]); // eslint-disable-line

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
      toast.success(`✅ Sent! ${getCurrencySymbol()}${res.cost?.toFixed(2)} deducted. New balance: ${getCurrencySymbol()}${res.new_balance?.toFixed(2)}`);
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
    if (topUpAmount < 100) { toast.error(`Minimum top-up is ${getCurrencySymbol()}100`); return; }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GearLoader />
      </div>
    );
  }

  // Test drawer render helpers
  const renderTestDrawer = () => {
    if (!testDrawer.open || !testDrawer.pref) return null;
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
          .replace(/\{invoice_amount\}/g, `${getCurrencySymbol()}850`)
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
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  audience === 'doctor' ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : audience === 'owner' ? 'bg-violet-50 text-violet-600 border border-violet-100'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  {audience === 'doctor' ? '👨‍⚕️ Doctor' : audience === 'owner' ? '🤖 Auto' : '🧑‍🦷 Patient'}
                </span>
              </div>
              <p className="text-xs text-gray-400">Preview template &amp; send a test notification</p>
            </div>
            <button
              onClick={() => setTestDrawer(d => ({ ...d, open: false }))}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
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
                  <span className="block mt-1 text-amber-500">
                    Create a template named <code className="bg-amber-100 px-1 rounded">{pref.event_type}</code> in Templates Manager.
                  </span>
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

            <div className="bg-[#29828a]/5 border border-[#29828a]/15 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Cost of this test</p>
                <p className="text-lg font-bold text-[#29828a]">{getCurrencySymbol()}{cost.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">Wallet balance</p>
                <p className={`text-lg font-bold ${wallet.balance < cost ? 'text-red-500' : 'text-gray-800'}`}>
                  {getCurrencySymbol()}{(wallet.balance || 0).toFixed(2)}
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
                : <><Send size={14} /> Send Test — {getCurrencySymbol()}{cost.toFixed(2)} deducted</>}
            </button>
          </div>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage channels, preferences, and message delivery</p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
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
        {activeTab === 'overview' && (
          <OverviewTab
            stats={stats}
            channelStatus={channelStatus}
            wallet={wallet}
            topUpAmount={topUpAmount}
            setTopUpAmount={setTopUpAmount}
            toppingUp={toppingUp}
            handleWalletTopup={handleWalletTopup}
          />
        )}

        {activeTab === 'preferences' && (
          <PreferencesTab
            preferences={preferences}
            savingPrefs={savingPrefs}
            handleSavePreferences={handleSavePreferences}
            updatePref={updatePref}
            openTestDrawer={openTestDrawer}
          />
        )}

        {activeTab === 'logs' && (
          <LogsTab
            logs={logs}
            logsTotal={logsTotal}
            logsPage={logsPage}
            logsFilter={logsFilter}
            setLogsFilter={setLogsFilter}
            setLogsPage={setLogsPage}
            fetchLogs={fetchLogs}
          />
        )}

        {activeTab === 'channels' && (
          <IntegrationsTab
            drawerProvider={drawerProvider}
            setDrawerProvider={setDrawerProvider}
          />
        )}
      </div>

      {renderTestDrawer()}
    </div>
  );
};

export default Notifications;
