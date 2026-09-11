/**
 * SettingsPage — real lab profile editing + team management (owner only),
 * with honest placeholders for features still in flight.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../utils/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Building2, Users, Bell, CreditCard, Box, Save, Plus, X, Trash2, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

const TABS = [
  { id: "profile", label: "Lab Profile", icon: <Building2 size={18} /> },
  { id: "team", label: "Team & Staff", icon: <Users size={18} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={18} /> },
  { id: "billing", label: "Billing", icon: <CreditCard size={18} /> },
  { id: "catalog", label: "Catalog config", icon: <Box size={18} /> },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const isOwner = user?.role === "lab_owner";

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      <div className="px-6 py-8 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your lab's profile, team, and preferences.</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 bg-white border-r border-gray-200 overflow-y-auto">
          <nav className="flex flex-col p-4 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab.id ? "bg-indigo-50 text-[#2a276e]" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl">
            {activeTab === "profile" && <ProfileTab isOwner={isOwner} />}
            {activeTab === "team" && <TeamTab isOwner={isOwner} currentUserId={user?.id} />}
            {activeTab === "notifications" && <NotificationsTab />}
            {activeTab === "billing" && <BillingTab />}
            {activeTab === "catalog" && <CatalogTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled, placeholder, hint, type = "text" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        className={`w-full px-4 py-2 border border-gray-200 rounded-lg text-sm transition-all ${
          disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
        }`}
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function ProfileTab({ isOwner }) {
  const { refreshUser } = useAuth();
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/labs/profile").then((d) => setLab(d.lab)).catch(() => toast.error("Failed to load lab profile")).finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => setLab((l) => ({ ...l, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const { lab: updated } = await api.put("/labs/profile", {
        name: lab.name, address: lab.address, phone: lab.phone, email: lab.email,
        tax_id: lab.tax_id, case_number_prefix: lab.case_number_prefix,
      });
      setLab(updated);
      await refreshUser();
      toast.success("Lab profile updated");
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!lab) return null;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Lab Profile</h2>
        <p className="text-sm text-gray-500 mb-6">These details appear on your statements and client communications.</p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Lab Name" value={lab.name} onChange={set("name")} disabled={!isOwner} />
            <Field label="Contact Email" value={lab.email} onChange={set("email")} disabled={!isOwner} placeholder="lab@example.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone" value={lab.phone} onChange={set("phone")} disabled={!isOwner} placeholder="+91 ..." />
            <Field label={lab.tax_label || "Tax ID"} value={lab.tax_id} onChange={set("tax_id")} disabled={!isOwner} placeholder="e.g. 27ABCDE1234F1Z5" />
          </div>
          <Field label="Address" value={lab.address} onChange={set("address")} disabled={!isOwner} placeholder="Full lab address" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Case Number Prefix" value={lab.case_number_prefix} onChange={set("case_number_prefix")} disabled={!isOwner} hint="Applies to new cases, e.g. AB-2026-0001" />
            <Field label="Currency" value={`${lab.currency_symbol} · ${lab.currency_code}`} disabled hint="Set during onboarding" />
          </div>
        </div>

        {isOwner ? (
          <div className="flex justify-end mt-6">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm disabled:opacity-50">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-6">Only the lab owner can edit these details.</p>
        )}
      </div>
    </div>
  );
}

function TeamTab({ isOwner, currentUserId }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/labs/staff").then((d) => setStaff(d.staff || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { if (isOwner) load(); else setLoading(false); }, [isOwner]);

  const deactivate = async (s) => {
    if (!window.confirm(`Deactivate ${s.name}? They'll lose access immediately.`)) return;
    try {
      await api.delete(`/labs/staff/${s.id}`);
      setStaff((xs) => xs.map((x) => (x.id === s.id ? { ...x, is_active: false } : x)));
      toast.success("Staff member deactivated");
    } catch (err) {
      toast.error(err.message || "Failed");
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center py-12 animate-fadeIn">
        <Users size={48} className="text-gray-300 mb-4 mx-auto" />
        <h2 className="text-lg font-bold text-gray-900">Team Management</h2>
        <p className="text-sm text-gray-500 mt-2">Only the lab owner can manage staff.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Team & Staff</h2>
            <p className="text-sm text-gray-500 mt-1">Staff can manage cases but not billing or settings.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm">
            <Plus size={16} /> Add Staff
          </button>
        </div>

        {loading ? (
          <div className="p-10"><LoadingSpinner /></div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-40 text-[#2a276e]" />
            <p className="text-sm font-semibold text-gray-900">No staff yet</p>
            <p className="text-xs mt-1">Invite a technician or front-desk user to help run the lab.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-[#2a276e] flex items-center justify-center font-bold">
                    {s.first_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      {s.name}
                      {!s.is_active && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                    </div>
                    <div className="text-xs text-gray-500">{s.email} · {s.role.replace("_", " ")}</div>
                  </div>
                </div>
                {s.is_active && s.id !== currentUserId && (
                  <button onClick={() => deactivate(s)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onAdded={(s) => { setStaff((xs) => [...xs, s]); setShowAdd(false); }} />}
    </div>
  );
}

function AddStaffModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { staff } = await api.post("/labs/staff", form);
      toast.success(`${staff.name} added`);
      onAdded(staff);
    } catch (err) {
      toast.error(err.message || "Failed to add staff");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add Staff Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" value={form.first_name} onChange={set("first_name")} placeholder="Asha" />
            <Field label="Last Name" value={form.last_name} onChange={set("last_name")} placeholder="Rao" />
          </div>
          <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="asha@lab.in" />
          <Field label="Temporary Password" type="password" value={form.password} onChange={set("password")} hint="At least 6 characters. Share it with them to log in." />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors disabled:opacity-50">
              {saving ? "Adding..." : "Add Staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const NOTIFY_EVENTS = [
  { id: "case_received", label: "Case received", desc: "When a new case is logged." },
  { id: "case_dispatched", label: "Case dispatched", desc: "When work ships back to the clinic." },
  { id: "case_delivered", label: "Case delivered", desc: "When the case is marked delivered." },
  { id: "statement_ready", label: "Statement ready", desc: "When a monthly statement is generated." },
];
const NOTIFY_CHANNELS = ["whatsapp", "email"];

function NotificationsTab() {
  const { user } = useAuth();
  const isOwner = user?.role === "lab_owner";
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/labs/profile"),
      api.get("/notifications/channel-status").catch(() => null),
    ])
      .then(([d, s]) => {
        setSettings(d.lab?.notification_settings || {});
        setStatus(s);
      })
      .catch(() => toast.error("Failed to load notification settings"))
      .finally(() => setLoading(false));
  }, []);

  const isOn = (event, channel) => (settings?.[event] || []).includes(channel);

  const toggle = (event, channel) => {
    if (!isOwner) return;
    setSettings((prev) => {
      const current = new Set(prev?.[event] || []);
      current.has(channel) ? current.delete(channel) : current.add(channel);
      return { ...prev, [event]: [...current] };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/labs/profile", { notification_settings: settings });
      toast.success("Notification settings saved");
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const chConfigured = (ch) => status?.[ch]?.configured;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Client Notifications</h2>
        <p className="text-sm text-gray-500 mb-5">Choose which events notify the clinic, and on which channels.</p>

        {status && (
          <div className="flex flex-wrap gap-2 mb-5">
            {NOTIFY_CHANNELS.map((ch) => (
              <span
                key={ch}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  chConfigured(ch)
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {ch === "whatsapp" ? "WhatsApp" : "Email"}: {chConfigured(ch) ? "connected" : "not configured"}
              </span>
            ))}
          </div>
        )}

        <div className="overflow-hidden border border-gray-100 rounded-lg">
          <div className="grid grid-cols-[1fr_auto_auto] items-center bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Event</span>
            <span className="w-24 text-center">WhatsApp</span>
            <span className="w-24 text-center">Email</span>
          </div>
          <div className="divide-y divide-gray-100">
            {NOTIFY_EVENTS.map((ev) => (
              <div key={ev.id} className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{ev.label}</p>
                  <p className="text-xs text-gray-500">{ev.desc}</p>
                </div>
                {NOTIFY_CHANNELS.map((ch) => (
                  <div key={ch} className="w-24 flex justify-center">
                    <MiniToggle on={isOn(ev.id, ch)} disabled={!isOwner} onToggle={() => toggle(ev.id, ch)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {isOwner ? (
          <div className="flex justify-end mt-6">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm disabled:opacity-50">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-6">Only the lab owner can change notification settings.</p>
        )}
      </div>
    </div>
  );
}

function MiniToggle({ on, disabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      className={`w-11 h-6 rounded-full relative transition-colors ${on ? "bg-[#2a276e]" : "bg-gray-300"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${on ? "right-1" : "left-1"}`} />
    </button>
  );
}

function BillingTab() {
  const { lab } = useAuth();
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Subscription</h2>
        <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
          <div>
            <p className="text-sm text-gray-500">Current plan</p>
            <p className="text-xl font-bold text-[#2a276e] capitalize">{lab?.subscription_plan || "Free"}</p>
          </div>
          <Mail size={32} className="text-indigo-200" />
        </div>
        <p className="text-xs text-gray-400 mt-4">Paid plans and invoicing for your MolarPlus Labs subscription are coming soon.</p>
      </div>
    </div>
  );
}

function CatalogTab() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center py-12">
        <Box size={48} className="text-gray-300 mb-4 mx-auto" />
        <h2 className="text-lg font-bold text-gray-900">Catalog Configuration</h2>
        <p className="text-sm text-gray-500 mt-2 mb-4 max-w-sm mx-auto">Your products, prices, and turnaround times are managed in the Catalog.</p>
        <Link to="/catalog" className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors">
          Go to Catalog
        </Link>
      </div>
    </div>
  );
}
