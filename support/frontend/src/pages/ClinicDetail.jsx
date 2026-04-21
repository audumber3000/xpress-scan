import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft, Building2, Users, CalendarDays, Receipt,
  Edit2, Check, X, ShieldAlert, ShieldCheck, Save,
  MessageSquare, Wallet, Bell, Settings2, Smartphone, Mail, MessageCircle,
  CheckCircle2, XCircle, IndianRupee, Zap, Loader2, Trash2
} from 'lucide-react';
import api from '../utils/api';
import { StatCard, Card, Badge, StatusBadge, TabBar, Spinner, fmt } from '../components/ui';

const PLAN_MAP = { free: 'slate', professional: 'violet', professional_annual: 'sky', enterprise: 'amber' };
const ROLE_MAP = { clinic_owner: 'violet', doctor: 'sky', receptionist: 'slate' };
const APPT_MAP = { completed: 'emerald', confirmed: 'sky', cancelled: 'rose' };

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'activity', label: 'Activity' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'practice', label: 'Practice' },
];

const CHANNEL_ICONS = { whatsapp: Smartphone, email: Mail, sms: MessageCircle };
const CHANNEL_COLORS = { whatsapp: 'emerald', email: 'sky', sms: 'violet' };
const EVENT_LABELS = {
  appointment_confirmation: 'Appointment Confirmation',
  invoice_notification: 'Invoice',
  prescription_notification: 'Prescription',
  appointment_reminder: 'Appointment Reminder',
  google_review: 'Google Review Request',
  consent_form: 'Consent Form',
  daily_report: 'Daily Report',
};

const DEVICE_COLOR = { android: 'emerald', ios: 'sky', web: 'violet', desktop: 'amber', other: 'slate', unknown: 'slate' };

const InfoRow = ({ label, value }) => value ? (
  <div className="flex gap-2 text-sm py-1">
    <dt className="text-slate-400 w-24 shrink-0 text-xs font-medium pt-0.5">{label}</dt>
    <dd className="text-slate-800 font-medium break-all">{value}</dd>
  </div>
) : null;

export default function ClinicDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/clinics/${id}`);
      setData(res);
      setEditForm({
        name: res.clinic.name || '',
        phone: res.clinic.phone || '',
        email: res.clinic.email || '',
        address: res.clinic.address || '',
        number_of_chairs: res.clinic.number_of_chairs || 1,
        subscription_plan: res.clinic.subscription_plan || 'free',
      });
    } catch { toast.error('Failed to load clinic'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/clinics/${id}`, editForm);
      toast.success('Clinic updated');
      setEditing(false);
      load();
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const handleStatus = async (action) => {
    try {
      await api.post(`/clinics/${id}/${action}`);
      toast.success(action === 'suspend' ? 'Clinic suspended' : 'Clinic activated');
      load();
    } catch { toast.error('Action failed'); }
  };

  const handleActivateTrial = async () => {
    if (!window.confirm(`Activate 7-day Professional trial for "${data?.clinic?.name}"?\n\nThis will:\n• Set plan to Trial (7 days)\n• Send WhatsApp + email to the clinic owner`)) return;
    setActivatingTrial(true);
    try {
      const res = await api.post(`/clinics/${id}/activate-trial`);
      const wa = res.notifications?.whatsapp ? '✅ WA sent' : '⚠️ WA failed';
      const em = res.notifications?.email ? '✅ Email sent' : '⚠️ Email failed';
      toast.success(`Trial activated until ${new Date(res.trial_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${wa} · ${em}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to activate trial');
    } finally {
      setActivatingTrial(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/clinics/${id}`, { data: { password: deletePassword } });
      toast.success(`"${res.clinic_name}" deleted permanently`);
      window.location.href = '/clinics';
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner />;
  if (!data) return <div className="p-6 text-slate-500">Clinic not found.</div>;

  const { clinic, users, stats, subscription, google_reviews, tickets, recent_activity } = data;
  const isActive = clinic.status === 'active';

  return (
    <div className="p-6 space-y-5 max-w-[960px]">
      {/* Back */}
      <Link to="/clinics" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors">
        <ArrowLeft size={14} /> Clinics
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{clinic.name}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-slate-400 font-mono">{clinic.clinic_code}</span>
              <StatusBadge status={clinic.status} />
              <Badge color={PLAN_MAP[clinic.subscription_plan] || 'slate'}>{clinic.subscription_plan || 'free'}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isActive ? (
            <button onClick={() => handleStatus('suspend')} className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors">
              <ShieldAlert size={14} /> Suspend
            </button>
          ) : (
            <button onClick={() => handleStatus('activate')} className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
              <ShieldCheck size={14} /> Activate
            </button>
          )}
          {clinic.subscription_plan === 'free' && (
            <button
              onClick={handleActivateTrial}
              disabled={activatingTrial}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-60 transition-colors border border-amber-200"
            >
              {activatingTrial ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              Activate Trial
            </button>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors">
              <Edit2 size={14} /> Edit
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors">
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                <X size={14} /> Cancel
              </button>
            </>
          )}
          <button
            onClick={() => { setDeletePassword(''); setDeleteModal(true); }}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
          >
            <Trash2 size={13} /> Delete Account
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <Card className="border-brand-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'name', label: 'Clinic Name' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
              { key: 'address', label: 'Address' },
              { key: 'number_of_chairs', label: 'Chairs', type: 'number' },
            ].map(({ key, label, type = 'text' }) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
                <input type={type} value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full h-8 px-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400" />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Plan</label>
              <select value={editForm.subscription_plan || 'free'} onChange={e => setEditForm(f => ({ ...f, subscription_plan: e.target.value }))}
                className="w-full h-8 px-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400">
                <option value="free">Free</option>
                <option value="professional">Professional (Monthly)</option>
                <option value="professional_annual">Professional (Annual)</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Patients" value={fmt.num(stats.patient_count)} icon={Users} color="violet" />
        <StatCard label="Appointments" value={fmt.num(stats.appointment_count)} icon={CalendarDays} color="emerald" />
        <StatCard label="Invoices" value={fmt.num(stats.invoice_count)} icon={Receipt} color="amber" />
        <StatCard label="Revenue" value={fmt.inr(stats.total_revenue)} icon={Receipt} color="brand" />
      </div>

      {/* Tab content */}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <Card>
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Contact</h3>
              <dl>
                <InfoRow label="Email" value={clinic.email} />
                <InfoRow label="Phone" value={clinic.phone} />
                <InfoRow label="Address" value={clinic.address} />
                <InfoRow label="GST" value={clinic.gst_number} />
                <InfoRow label="Chairs" value={clinic.number_of_chairs} />
                <InfoRow label="Cashfree ID" value={clinic.cashfree_customer_id} />
              </dl>
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Subscription</h3>
              {subscription ? (
                <dl>
                  <InfoRow label="Plan" value={subscription.plan_name} />
                  <InfoRow label="Status" value={subscription.status} />
                  <InfoRow label="Provider" value={subscription.provider} />
                  <InfoRow label="Order ID" value={subscription.provider_order_id} />
                  <InfoRow label="Sub ID" value={subscription.provider_subscription_id} />
                  <InfoRow label="Start" value={fmt.date(subscription.current_start)} />
                  <InfoRow label="End" value={fmt.date(subscription.current_end)} />
                  {subscription.is_trial && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      <Zap size={12} />
                      Trial active
                      {subscription.current_end && (
                        <span className="font-normal text-amber-600">
                          — expires {new Date(subscription.current_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  )}
                  {!subscription.is_trial && subscription.current_end && new Date(subscription.current_end) < new Date() && (
                    <div className="mt-1 text-xs font-semibold text-rose-500">Expired</div>
                  )}
                </dl>
              ) : <p className="text-sm text-slate-400">No subscription record.</p>}
            </div>
          </div>
        )}

        {tab === 'users' && (
          users.length === 0 ? <p className="text-sm text-slate-400">No users found.</p> : (
            <div className="space-y-4">
              {!!data.user_activity_summary && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Clinic User Activity Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase">Login Events</p>
                      <p className="text-lg font-bold text-slate-900">{fmt.num(data.user_activity_summary.total_login_events)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase">Total Devices</p>
                      <p className="text-lg font-bold text-slate-900">{fmt.num(data.user_activity_summary.total_user_devices)}</p>
                    </div>
                    {['android', 'ios'].map(d => (
                      <div key={d} className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-[10px] text-slate-400 uppercase">{d}</p>
                        <p className="text-lg font-bold text-slate-900">{fmt.num(data.user_activity_summary.device_totals?.[d] || 0)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['web', 'desktop', 'other'].map(d => (
                      <Badge key={d} color={DEVICE_COLOR[d]}>{d}: {fmt.num(data.user_activity_summary.device_totals?.[d] || 0)}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {users.map(u => (
                  <div key={u.id} className="border border-slate-200 rounded-xl p-3.5 bg-white">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                      <Badge color={ROLE_MAP[u.role] || 'slate'}>{u.role}</Badge>
                      {u.is_active
                        ? <Badge color="emerald">active</Badge>
                        : <Badge color="slate">inactive</Badge>}
                      <span className="text-xs text-slate-400">{u.email}</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div>
                        <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Devices ({u.devices?.length || 0})</h5>
                        {(!u.devices || u.devices.length === 0) ? (
                          <p className="text-xs text-slate-400">No devices tracked.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {u.devices.slice(0, 6).map(dev => {
                              const bucket = (dev.device_platform || '').toLowerCase().includes('android')
                                ? 'android'
                                : (dev.device_platform || '').toLowerCase().includes('ios') || (dev.device_platform || '').toLowerCase().includes('iphone') || (dev.device_platform || '').toLowerCase().includes('ipad')
                                  ? 'ios'
                                  : (dev.device_type || '').toLowerCase() === 'web'
                                    ? 'web'
                                    : (dev.device_type || '').toLowerCase() === 'desktop'
                                      ? 'desktop'
                                      : 'other';
                              return (
                                <div key={dev.id} className="bg-slate-50 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-700 truncate">{dev.device_name || `${dev.device_platform || 'Unknown'} device`}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{dev.device_platform || 'Unknown'} · {dev.device_type || 'unknown'}</p>
                                  </div>
                                  <div className="text-right">
                                    <Badge color={DEVICE_COLOR[bucket] || 'slate'}>{bucket}</Badge>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{dev.last_seen ? fmt.datetime(dev.last_seen) : '—'}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Login / Logout Activity</h5>
                        {(!u.login_activity || u.login_activity.length === 0) ? (
                          <p className="text-xs text-slate-400">No login/logout events found.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-44 overflow-auto pr-1">
                            {u.login_activity.slice(0, 15).map(log => (
                              <div key={log.id} className="bg-slate-50 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-slate-700 capitalize">{(log.event_type || '').replace(/_/g, ' ')}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{log.description || '—'}</p>
                                </div>
                                <div className="text-right">
                                  <Badge color={DEVICE_COLOR[log.device] || 'slate'}>{log.device || 'unknown'}</Badge>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{fmt.datetime(log.created_at)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {tab === 'tickets' && (
          <div>
            <p className="text-sm text-slate-600 mb-3">
              <span className="font-semibold text-brand-600">{tickets.open_count}</span> open ticket(s).
              {tickets.last_ticket_at && <span className="text-slate-400 ml-2">Last: {fmt.date(tickets.last_ticket_at)}</span>}
            </p>
            <Link to={`/tickets?clinic_id=${clinic.id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              View all tickets for this clinic →
            </Link>
          </div>
        )}

        {tab === 'reviews' && (
          google_reviews ? (
            <dl>
              <InfoRow label="Place" value={google_reviews.place_name} />
              <InfoRow label="Rating" value={google_reviews.rating} />
              <InfoRow label="Reviews" value={google_reviews.review_count} />
              <InfoRow label="Last Synced" value={fmt.date(google_reviews.last_synced_at)} />
            </dl>
          ) : <p className="text-sm text-slate-400">No Google Place linked.</p>
        )}

        {tab === 'notifications' && (() => {
          const n = data.notifications || {};
          const byChannel = n.by_channel || {};
          return (
            <div className="space-y-5">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Total Sent</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{fmt.num(n.total)}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-3">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Failed</p>
                  <p className="text-xl font-bold text-rose-600 mt-0.5">{fmt.num(n.failed)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Total Cost</p>
                  <p className="text-xl font-bold text-amber-700 mt-0.5">{fmt.inr(n.total_cost)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Wallet Balance</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">{fmt.inr(n.wallet_balance)}</p>
                  {n.wallet_last_topup && <p className="text-[10px] text-slate-400 mt-0.5">Last top-up {fmt.date(n.wallet_last_topup)}</p>}
                </div>
              </div>

              {/* By Channel */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">By Channel</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {['whatsapp', 'email', 'sms'].map(ch => {
                    const stats = byChannel[ch] || { total: 0, failed: 0, total_cost: 0 };
                    const Icon = CHANNEL_ICONS[ch] || MessageSquare;
                    const color = CHANNEL_COLORS[ch] || 'slate';
                    const colorMap = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700' };
                    return (
                      <div key={ch} className="bg-slate-50 rounded-lg p-3.5 flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color]?.split(' ')[0] || 'bg-slate-100'}`}>
                          <Icon size={15} className={colorMap[color]?.split(' ')[1] || 'text-slate-500'} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 capitalize">{ch}</p>
                          <p className="text-base font-bold text-slate-900">{fmt.num(stats.total)} <span className="text-xs font-normal text-slate-400">sent</span></p>
                          <p className="text-[11px] text-slate-400">{fmt.num(stats.failed)} failed · {fmt.inr(stats.total_cost)} cost</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notification Preferences */}
              {n.preferences && n.preferences.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notification Preferences</h4>
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-100">
                        {['Event', 'Channels', 'Enabled'].map(h => (
                          <th key={h} className="py-2 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-left">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {n.preferences.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-4 text-sm text-slate-700">{EVENT_LABELS[p.event_type] || p.event_type.replace(/_/g, ' ')}</td>
                            <td className="py-2 px-4">
                              <div className="flex gap-1">
                                {(p.channels || []).map(ch => (
                                  <span key={ch} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">{ch}</span>
                                ))}
                                {(!p.channels || p.channels.length === 0) && <span className="text-[11px] text-slate-300">none</span>}
                              </div>
                            </td>
                            <td className="py-2 px-4">
                              {p.is_enabled
                                ? <CheckCircle2 size={15} className="text-emerald-500" />
                                : <XCircle size={15} className="text-slate-300" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Logs */}
              {n.recent_logs && n.recent_logs.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Logs (last 20)</h4>
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-100">
                        {['Event', 'Channel', 'Status', 'Cost', 'Sent'].map(h => (
                          <th key={h} className="py-2 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-left">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {n.recent_logs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-4 text-slate-700">{EVENT_LABELS[log.event_type] || log.event_type || '—'}</td>
                            <td className="py-2 px-4 capitalize text-slate-600">{log.channel}</td>
                            <td className="py-2 px-4"><StatusBadge status={log.status} /></td>
                            <td className="py-2 px-4 text-slate-500 text-xs">{log.cost ? `₹${log.cost}` : '—'}</td>
                            <td className="py-2 px-4 text-xs text-slate-400">{fmt.datetime(log.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {n.total === 0 && n.preferences?.length === 0 && (
                <div className="py-10 text-center">
                  <Bell size={24} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-400">No notification data for this clinic yet.</p>
                </div>
              )}
            </div>
          );
        })()}

        {tab === 'practice' && (
          <div className="space-y-5">
            {/* Logo */}
            {clinic.logo_url && (
              <div className="flex items-center gap-3">
                <img src={clinic.logo_url} alt="Clinic logo" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                <div>
                  <p className="text-xs font-semibold text-slate-600">Practice Logo</p>
                  <a href={clinic.logo_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline break-all">{clinic.logo_url}</a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Practice Details</h3>
                <dl>
                  <InfoRow label="Specialization" value={clinic.specialization} />
                  <InfoRow label="No. of Chairs" value={clinic.number_of_chairs} />
                  <InfoRow label="GST Number" value={clinic.gst_number} />
                  <InfoRow label="Clinic Code" value={clinic.clinic_code} />
                  <InfoRow label="Cashfree ID" value={clinic.cashfree_customer_id} />
                </dl>
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Registration & Status</h3>
                <dl>
                  <InfoRow label="Status" value={clinic.status} />
                  <InfoRow label="Plan" value={clinic.subscription_plan || 'free'} />
                  <InfoRow label="Registered" value={fmt.date(clinic.created_at)} />
                  <InfoRow label="Last Updated" value={fmt.date(clinic.updated_at)} />
                </dl>
              </div>
            </div>

            {!clinic.specialization && !clinic.logo_url && !clinic.gst_number && (
              <div className="mt-4 py-3 px-4 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-700 font-medium">This clinic has not completed their practice profile (no specialization, logo, or GST set).</p>
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Appointments</h4>
              {recent_activity.appointments.length === 0 ? <p className="text-sm text-slate-400">None</p> : (
                <div className="space-y-1.5">
                  {recent_activity.appointments.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-800">{a.patient_name}</span>
                      <div className="flex items-center gap-2">
                        <Badge color={APPT_MAP[a.status] || 'slate'}>{a.status}</Badge>
                        <span className="text-xs text-slate-400">{fmt.date(a.appointment_date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Invoices</h4>
              {recent_activity.invoices.length === 0 ? <p className="text-sm text-slate-400">None</p> : (
                <div className="space-y-1.5">
                  {recent_activity.invoices.map(i => (
                    <div key={i.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                      <StatusBadge status={i.status} />
                      <span className="text-sm font-semibold text-slate-800">{fmt.inr(i.paid_amount)} <span className="text-xs font-normal text-slate-400">/ {fmt.inr(i.total)}</span></span>
                      <span className="text-xs text-slate-400">{fmt.date(i.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Delete Account Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Delete Account</h2>
                <p className="text-xs text-slate-400 mt-0.5">{clinic.name}</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 leading-relaxed">
              This will <strong>permanently delete</strong> all clinic data — patients, appointments, invoices, users, notifications, and Firebase accounts. <strong>This cannot be undone.</strong>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Enter password to confirm</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !deleting && handleDelete()}
                placeholder="Password"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setDeleteModal(false)}
                className="h-9 px-4 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !deletePassword}
                className="flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
