import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft, User, Building2, Users, CalendarDays, Receipt,
  Trash2, Loader2, AlertTriangle, Mail, Phone,
} from 'lucide-react';
import api from '../utils/api';
import { StatCard, Card, Badge, StatusBadge, Spinner, fmt } from '../components/ui';

const PLAN_MAP = { free: 'slate', professional: 'violet', professional_annual: 'sky', enterprise: 'amber' };
const ROLE_MAP = { clinic_owner: 'violet', doctor: 'sky', receptionist: 'slate' };

export default function OwnerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/owners/${id}`);
      setData(res);
    } catch { toast.error('Failed to load owner'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/owners/${id}`, { data: { password: deletePassword } });
      toast.success(
        `Deleted ${res.clinics_deleted} clinic(s) + ${res.users_deleted} user(s). Firebase: ${res.firebase_users_deleted}/${res.firebase_users_total}.`
      );
      window.location.href = '/clinics?tab=owners';
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner />;
  if (!data) return <div className="p-6 text-slate-500">Owner not found.</div>;

  const { owner, clinics, impact, subscriptions } = data;
  const confirmPhrase = owner.email || `owner-${owner.id}`;
  const canDelete = deletePassword && confirmText === confirmPhrase;

  return (
    <div className="p-6 space-y-5 max-w-[960px]">
      <Link to="/clinics?tab=owners" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors">
        <ArrowLeft size={14} /> Owners
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{owner.name || owner.email}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-slate-400 font-mono">#{owner.id}</span>
              <Badge color={ROLE_MAP[owner.role] || 'slate'}>{owner.role}</Badge>
              {owner.is_active
                ? <Badge color="emerald">active</Badge>
                : <Badge color="slate">inactive</Badge>}
            </div>
          </div>
        </div>
        <button
          onClick={() => { setDeletePassword(''); setConfirmText(''); setDeleteModal(true); }}
          className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
        >
          <Trash2 size={13} /> Delete Owner + All Clinics
        </button>
      </div>

      {/* Contact */}
      <Card>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-400" />
            <span className="text-slate-700">{owner.email}</span>
          </div>
          {owner.phone && (
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-slate-400" />
              <span className="text-slate-700">{owner.phone}</span>
            </div>
          )}
          <div className="text-[11px] text-slate-400 ml-auto">
            Registered {fmt.date(owner.created_at)}
          </div>
        </div>
      </Card>

      {/* Impact KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Clinics" value={fmt.num(impact.clinic_count)} icon={Building2} color="violet" />
        <StatCard label="Patients" value={fmt.num(impact.patient_count)} icon={Users} color="brand" />
        <StatCard label="Appointments" value={fmt.num(impact.appointment_count)} icon={CalendarDays} color="emerald" />
        <StatCard label="Revenue" value={fmt.inr(impact.total_revenue)} icon={Receipt} color="amber" />
      </div>

      {/* Clinics */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Owned Clinics ({clinics.length})</h3>
        {clinics.length === 0 ? (
          <Card><p className="text-sm text-slate-400">This user does not own any clinics.</p></Card>
        ) : (
          <div className="space-y-2">
            {clinics.map(c => (
              <Link key={c.id} to={`/clinics/${c.id}`} className="block">
                <Card className="hover:border-brand-300 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 size={15} className="text-brand-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                        <p className="text-[11px] text-slate-400">{c.clinic_code} · {c.address || 'No address'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.clinic_label && (
                        <Badge color={c.clinic_label === 'main_branch' ? 'violet' : 'sky'}>{c.clinic_label}</Badge>
                      )}
                      <Badge color={PLAN_MAP[c.subscription_plan] || 'slate'}>{c.subscription_plan || 'free'}</Badge>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Users that will be deleted */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Users to be deleted ({impact.users_to_delete.length})
        </h3>
        <Card>
          {impact.users_to_delete.length === 0 ? (
            <p className="text-sm text-slate-400">No users will be deleted.</p>
          ) : (
            <div className="space-y-1.5">
              {impact.users_to_delete.map(u => (
                <div key={u.id} className="flex items-center justify-between py-1.5 px-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <User size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{u.name || u.email}</span>
                    <span className="text-[11px] text-slate-400 truncate">{u.email}</span>
                  </div>
                  <Badge color={ROLE_MAP[u.role] || 'slate'}>{u.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Subscriptions */}
      {subscriptions && subscriptions.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Subscriptions</h3>
          <Card>
            <div className="space-y-1.5">
              {subscriptions.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge color={PLAN_MAP[s.plan_name] || 'slate'}>{s.plan_name}</Badge>
                    <StatusBadge status={s.status} />
                    {s.is_trial && <Badge color="amber">trial</Badge>}
                    <span className="text-[11px] text-slate-400">{s.provider}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {s.current_end ? `ends ${fmt.date(s.current_end)}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Delete Owner Permanently</h2>
                <p className="text-xs text-slate-400 mt-0.5">{owner.email}</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 leading-relaxed space-y-1.5">
              <p className="font-semibold">This action will permanently delete:</p>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                <li><strong>{impact.clinic_count}</strong> clinic(s) — main branch and all branches</li>
                <li><strong>{fmt.num(impact.patient_count)}</strong> patient record(s)</li>
                <li><strong>{fmt.num(impact.appointment_count)}</strong> appointment(s)</li>
                <li><strong>{fmt.num(impact.invoice_count)}</strong> invoice(s) worth {fmt.inr(impact.total_revenue)}</li>
                <li><strong>{impact.users_to_delete.length}</strong> user account(s) (including Firebase auth)</li>
                <li>All notifications, treatments, settings, files, etc.</li>
              </ul>
              <p className="font-semibold pt-1">This cannot be undone.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Type <code className="px-1 py-0.5 bg-slate-100 rounded text-red-600 font-mono text-[11px]">{confirmPhrase}</code> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={confirmPhrase}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Admin password</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canDelete && !deleting && handleDelete()}
                placeholder="Password"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setDeleteModal(false)}
                disabled={deleting}
                className="h-9 px-4 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !canDelete}
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
