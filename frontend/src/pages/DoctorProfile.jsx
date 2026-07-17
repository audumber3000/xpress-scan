import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";
import { toast } from 'react-toastify';
import { BadgeCheck } from "lucide-react";
import { generateAvatarUrl } from "../utils/avatar";

const ROLE_INFO = {
  clinic_owner: { label: "Clinic Owner", color: "text-purple-700", bg: "bg-purple-50" },
  doctor: { label: "Doctor", color: "text-blue-700", bg: "bg-blue-50" },
  receptionist: { label: "Receptionist", color: "text-[#2a276e]", bg: "bg-purple-50" },
};
const getRoleInfo = (role) => ROLE_INFO[role] || { label: "Staff", color: "text-gray-700", bg: "bg-gray-100" };


const DoctorProfile = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Loaded profile + clinic data
  const [userData, setUserData] = useState(null);
  const [clinicData, setClinicData] = useState(user?.clinic ?? null);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [userDataError, setUserDataError] = useState("");

  // Editable personal info
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  // Signature (unchanged behaviour)
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const signatureInputRef = useRef(null);

  // Change password
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);

  const role = userData?.role || user?.role || "staff";
  const roleInfo = getRoleInfo(role);
  const canAdmin = role === 'clinic_owner' || user?.permissions?.staff?.read === true;
  const displayName = userData?.name || user?.name || "User";
  const email = userData?.email || user?.email || "";

  const fetchUserAndClinicData = async () => {
    try {
      setLoadingUserData(true);
      const response = await api.get("/auth/me");
      setUserData(response);
      setClinicData(response.clinic);
      setForm({
        first_name: response.first_name || "",
        last_name: response.last_name || "",
        phone: response.phone || "",
      });
      setSignaturePreview(response.signature_url || null);
      setAvatarPreview(response.avatar_url || null);
    } catch (error) {
      console.error("Error fetching user and clinic data:", error);
      setUserDataError("Failed to load profile data");
    } finally {
      setLoadingUserData(false);
    }
  };

  useEffect(() => {
    fetchUserAndClinicData();
  }, []);

  // ── Personal info ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setSavingProfile(true);
    try {
      await api.patch("/auth/me", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
      });
      toast.success("Profile updated");
      await fetchUserAndClinicData();
      refreshUser?.();
    } catch (e) {
      toast.error(e?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Avatar ─────────────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Only PNG or JPG images are allowed');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image must be under 3MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setAvatarPreview(base64);
      setAvatarUploading(true);
      try {
        const res = await api.patch('/auth/me/avatar', { avatar_url: base64 });
        setAvatarPreview(res.avatar_url);
        toast.success('Photo updated');
        refreshUser?.();
      } catch {
        toast.error('Failed to update photo');
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    try {
      await api.patch('/auth/me/avatar', { avatar_url: null });
      setAvatarPreview(null);
      toast.success('Photo removed');
      refreshUser?.();
    } catch {
      toast.error('Failed to remove photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Signature ──────────────────────────────────────────────────────────────
  const handleSignatureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Only PNG or JPG images are allowed');
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error('Signature image must be under 512KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setSignaturePreview(base64);
      setSignatureUploading(true);
      try {
        await api.patch('/auth/me/signature', { signature_url: base64 });
        toast.success('Signature saved successfully');
      } catch {
        toast.error('Failed to save signature');
      } finally {
        setSignatureUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = async () => {
    setSignatureUploading(true);
    try {
      await api.patch('/auth/me/signature', { signature_url: null });
      setSignaturePreview(null);
      toast.success('Signature removed');
    } catch {
      toast.error('Failed to remove signature');
    } finally {
      setSignatureUploading(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!pwForm.current_password || !pwForm.new_password) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setChangingPw(true);
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success("Password changed successfully");
      setPwForm({ current_password: "", new_password: "", confirm: "" });
    } catch (e) {
      toast.error(e?.message || "Failed to change password");
    } finally {
      setChangingPw(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a276e]/30 focus:border-[#2a276e] transition";
  const labelCls = "block text-sm font-medium text-gray-500 mb-1";

  const quickLinks = [
    canAdmin && {
      label: "Control Center", desc: "Staff, clinic, pricing & settings", to: "/admin",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
    canAdmin && {
      label: "Clinic Info", desc: "Name, address & branding", to: "/admin/clinic",
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-14h10M7 11h10M7 15h4",
    },
    {
      label: "Subscription", desc: "Plan & billing", to: "/subscription",
      icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
    },
  ].filter(Boolean);

  return (
    // h-full, not a 100vh-based maxHeight: this renders inside <main>, which
    // already sits below the 56px header. Pinning to the viewport made the pane
    // taller than its container, so it scrolled twice and clipped at the bottom.
    <div className="p-6 md:p-8 max-w-4xl mx-auto overflow-y-auto h-full">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Profile Settings</h1>

      {loadingUserData ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-center py-10">
            <GearLoader size="w-8 h-8" />
            <span className="ml-3 text-gray-600">Loading profile…</span>
          </div>
        </div>
      ) : userDataError ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-red-600 text-center py-4">{userDataError}</div>
        </div>
      ) : (
        <>
          {/* Identity header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="h-20 bg-gradient-to-r from-[#2a276e] to-[#4a4699]" />
            <div className="px-6 pb-6">
              {/* The pull-up belongs on the avatar alone. On the row it dragged
                  the name and role badge up into the banner too, so they rendered
                  on top of the purple. */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="relative -mt-10">
                  <div className="w-24 h-24 rounded-full ring-4 ring-white bg-[#2a276e] overflow-hidden flex items-center justify-center shadow">
                    {/* No uploaded photo falls back to the same DiceBear cartoon
                        the header shows, so the two surfaces match. */}
                    <img
                      src={avatarPreview || generateAvatarUrl(email || displayName, 160)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    title="Change photo"
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-gray-50 disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 text-[#2a276e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarChange} />
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-900 truncate">{displayName}</h2>
                    {/* Decorative only — there is no verification data behind this.
                        Don't treat it as a signal that anything was verified. */}
                    <BadgeCheck size={18} className="text-white fill-[#00ba7c] flex-shrink-0" />
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${roleInfo.color} ${roleInfo.bg}`}>{roleInfo.label}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate" title={email}>{email || 'No email on file'}</p>
                  {userData?.is_google_account && (
                    <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-600">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
                        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                      </svg>
                      Signed in with Google
                    </span>
                  )}
                  {clinicData?.name && <p className="text-sm text-gray-400 truncate mt-1">{clinicData.name}</p>}
                </div>
                {avatarPreview && (
                  <button onClick={handleRemoveAvatar} disabled={avatarUploading} className="text-xs text-red-500 hover:text-red-600 font-medium self-start sm:self-end disabled:opacity-60">
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Personal information (editable) */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input className={inputCls} value={form.first_name} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input className={inputCls} value={form.last_name} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Optional contact number" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`} value={email} disabled readOnly title="Email can't be changed here" />
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-5 py-2 bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick links (role-aware) */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                <button
                  key={link.to}
                  onClick={() => navigate(link.to)}
                  className="text-left bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-[#2a276e] hover:shadow transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-[#2a276e] transition-colors">
                      <svg className="w-5 h-5 text-[#2a276e] group-hover:text-white transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={link.icon} /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{link.label}</p>
                      <p className="text-xs text-gray-500 truncate">{link.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Security</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-4">Change your password. You'll need your current password to confirm.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Current Password</label>
                  <input type="password" autoComplete="current-password" className={inputCls} value={pwForm.current_password} onChange={(e) => setPwForm(p => ({ ...p, current_password: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>New Password</label>
                  <input type="password" autoComplete="new-password" className={inputCls} value={pwForm.new_password} onChange={(e) => setPwForm(p => ({ ...p, new_password: e.target.value }))} placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <input type="password" autoComplete="new-password" className={inputCls} value={pwForm.confirm} onChange={(e) => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={handleChangePassword}
                  disabled={changingPw}
                  className="px-5 py-2 bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {changingPw ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Signature</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-4">Your signature will appear on prescriptions and official documents generated by the system.</p>
              <div className="flex items-start gap-6 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Current Signature</label>
                  <div className="h-28 w-full max-w-sm border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50">
                    {signaturePreview ? (
                      <img src={signaturePreview} alt="Signature" className="max-h-24 max-w-full object-contain p-2" />
                    ) : (
                      <p className="text-xs text-gray-400 text-center px-4">No signature uploaded yet</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 justify-center pt-6">
                  <input ref={signatureInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleSignatureChange} />
                  <button
                    onClick={() => signatureInputRef.current?.click()}
                    disabled={signatureUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#29828a] hover:bg-[#1f6b72] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    {signatureUploading ? 'Saving…' : signaturePreview ? 'Change Signature' : 'Upload Signature'}
                  </button>
                  {signaturePreview && (
                    <button
                      onClick={handleRemoveSignature}
                      disabled={signatureUploading}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                      Remove
                    </button>
                  )}
                  <p className="text-[11px] text-gray-400">PNG or JPG, max 512KB</p>
                </div>
              </div>
            </div>
          </div>

          {/* Clinic management lives in Admin → Clinic Info (owner-only). */}
          {canAdmin && (
            <div className="mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Manage clinic settings</p>
                  <p className="text-xs text-gray-500">Clinic details, staff, pricing and account actions are in the Control Center.</p>
                </div>
                <button onClick={() => navigate('/admin/clinic')} className="px-4 py-2 border border-[#2a276e] text-[#2a276e] hover:bg-purple-50 text-sm font-semibold rounded-lg transition-colors">
                  Open Clinic Settings
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DoctorProfile;
