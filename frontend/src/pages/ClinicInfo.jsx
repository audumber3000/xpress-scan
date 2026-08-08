import React, { useState, useEffect, useCallback } from 'react';
import { useHeader } from '../contexts/HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { toast } from 'react-toastify';
import GearLoader from '../components/GearLoader';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Building2, IdCard, Receipt, MapPin, Clock, GitBranch, PlusCircle, Check } from 'lucide-react';

/**
 * Clinic Profile — the details for one branch, split across tabs.
 *
 * Works on any branch the user belongs to: /admin/clinic?clinic=<id> loads that
 * clinic, and no param falls back to the active one. The Control Center's branch
 * list links here with the id, so every branch is editable without switching
 * clinics first.
 */

const TABS = [
  { id: 'basic',    label: 'Basic',    icon: Building2 },
  { id: 'license',  label: 'License',  icon: IdCard },
  { id: 'taxation', label: 'Taxation', icon: Receipt },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'timings',  label: 'Timings',  icon: Clock },
  // Branches used to be its own Control Center section with a sidebar tree. A
  // branch is just another clinic record edited on this very screen, so it
  // belongs here as a tab rather than as a parallel destination.
  { id: 'branches', label: 'Branches', icon: GitBranch },
];

const DEFAULT_TIMINGS = {
  monday: { open: '08:00', close: '20:00', closed: false },
  tuesday: { open: '08:00', close: '20:00', closed: false },
  wednesday: { open: '08:00', close: '20:00', closed: false },
  thursday: { open: '08:00', close: '20:00', closed: false },
  friday: { open: '08:00', close: '20:00', closed: false },
  saturday: { open: '08:00', close: '20:00', closed: false },
  sunday: { open: '08:00', close: '20:00', closed: true },
};

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#29828a] focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 mb-2';

/** One tab's panel: a titled card the fields sit in. */
const Panel = ({ title, description, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6">
    <div className="mb-5">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
);

const ClinicInfo = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Which branch are we editing? ?clinic=<id> wins; otherwise the active clinic.
  const params = new URLSearchParams(location.search);
  const requestedId = params.get('clinic');
  const targetClinicId = requestedId ? Number(requestedId) : user?.clinic_id;
  const isActiveClinic = targetClinicId === user?.clinic_id;

  const [activeTab, setActiveTab] = useState('basic');

  // Every clinic this user belongs to. `clinics` is the multi-branch list;
  // single-clinic accounts only have the one.
  const branches = (user?.clinics?.length > 0 ? user.clinics : [user?.clinic]).filter(Boolean);

  // Switching branch is a URL change on this same screen, so the reload below
  // picks up the new id — no clinic switch, no page swap.
  const openBranch = (id) => {
    navigate(`/admin/clinic?clinic=${id}`);
    setActiveTab('basic');
  };
  const [clinicData, setClinicData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    tagline: '',
    gst_number: '',
    tax_label: 'GST No.',
    license_number: '',
    license_authority: '',
    license_expiry: '',
    timings: DEFAULT_TIMINGS,
  });
  const [loadingClinicData, setLoadingClinicData] = useState(false);
  const [savingClinicData, setSavingClinicData] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Control Center</span>
        </button>
      </div>
    );
  }, [setTitle, navigate]);

  const fetchClinicData = useCallback(async () => {
    if (!targetClinicId) return;
    try {
      setLoadingClinicData(true);
      // /me and /{id} return the same shape; /me avoids a redundant lookup.
      const data = await api.get(isActiveClinic ? '/clinics/me' : `/clinics/${targetClinicId}`);
      setClinicData({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        logo_url: data.logo_url || data.logo || '',
        gst_number: data.gst_number || '',
        tagline: data.tagline || '',
        tax_label: data.tax_label || 'GST No.',
        license_number: data.license_number || '',
        license_authority: data.license_authority || '',
        license_expiry: data.license_expiry || '',
        timings: data.timings || DEFAULT_TIMINGS,
      });
    } catch (error) {
      console.error('Error fetching clinic data:', error);
      toast.error('Failed to load clinic data');
    } finally {
      setLoadingClinicData(false);
    }
  }, [targetClinicId, isActiveClinic]);

  useEffect(() => { fetchClinicData(); }, [fetchClinicData]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      toast.error('Please upload PNG/JPG/WEBP image');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Logo must be under 1MB');
      return;
    }

    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setClinicData((prev) => ({ ...prev, logo_url: ev.target?.result }));
      setLogoUploading(false);
      toast.success('Logo selected. Click Save Changes to apply.');
    };
    reader.onerror = () => {
      setLogoUploading(false);
      toast.error('Failed to read logo file');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveClinicData = async () => {
    try {
      setSavingClinicData(true);
      // An empty date must go as null — "" isn't a valid date for the DTO.
      const payload = { ...clinicData, license_expiry: clinicData.license_expiry || null };
      await api.put(isActiveClinic ? '/clinics/me' : `/clinics/${targetClinicId}`, payload);
      toast.success('Clinic information updated successfully');
    } catch (error) {
      console.error('Error saving clinic data:', error);
      toast.error('Failed to save clinic data');
    } finally {
      setSavingClinicData(false);
    }
  };

  if (!user?.clinic_id) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-yellow-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-yellow-800 mb-2">Clinic Access Required</h3>
          <p className="text-yellow-700">You are not associated with any clinic. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  if (loadingClinicData) {
    return (
      <div className="flex items-center justify-center h-full">
        <GearLoader />
      </div>
    );
  }

  const setField = (field) => (e) => setClinicData({ ...clinicData, [field]: e.target.value });

  const setTiming = (day, patch) =>
    setClinicData((prev) => ({
      ...prev,
      timings: { ...prev.timings, [day]: { ...prev.timings[day], ...patch } },
    }));

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Clinic Details
              {!isActiveClinic && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Other branch
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {clinicData.name ? `Identity, licence and hours for ${clinicData.name}.` : 'Identity, licence and hours for this branch.'}
            </p>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg whitespace-nowrap ${
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

      {/* Panels */}
      {activeTab === 'basic' && (
        <Panel title="Basic details" description="Identity and contact information for this branch">
          <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50">
            <label className={labelClass}>Clinic Logo</label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-20 h-20 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                {clinicData.logo_url ? (
                  <img src={clinicData.logo_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400 text-center px-1">No logo</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="px-4 py-2 bg-[#29828a] text-white rounded-lg hover:bg-[#216b71] cursor-pointer text-sm font-semibold transition-colors">
                  {logoUploading ? 'Uploading...' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={logoUploading}
                  />
                </label>
                {clinicData.logo_url && (
                  <button
                    type="button"
                    onClick={() => setClinicData((prev) => ({ ...prev, logo_url: '' }))}
                    className="px-3 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">PNG/JPG/WEBP, max 1MB. Save changes after upload.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Clinic Name *</label>
              <input type="text" value={clinicData.name} onChange={setField('name')} className={inputClass} placeholder="Enter clinic name" />
            </div>
            <div className="xl:col-span-2">
              <label className={labelClass}>Tagline</label>
              <input
                type="text"
                value={clinicData.tagline}
                onChange={setField('tagline')}
                className={inputClass}
                maxLength={120}
                placeholder="e.g. Comprehensive Dental & Orthodontic Care"
              />
              <p className="text-xs text-gray-400 mt-1">
                Printed under your clinic name on invoices, prescriptions and consent forms.
                Leave blank to show none. You can switch it off per document in Templates Editor.
              </p>
            </div>
            <div>
              <label className={labelClass}>Phone *</label>
              <input type="tel" value={clinicData.phone} onChange={setField('phone')} className={inputClass} placeholder="Enter phone number" />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input type="email" value={clinicData.email} onChange={setField('email')} className={inputClass} placeholder="Enter clinic email" />
            </div>
          </div>
        </Panel>
      )}

      {activeTab === 'license' && (
        <Panel title="Practice licence" description="Registration details for this branch">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Registration Number</label>
              <input type="text" value={clinicData.license_number} onChange={setField('license_number')} className={inputClass} placeholder="e.g. Dental Council reg. no." />
            </div>
            <div>
              <label className={labelClass}>Issuing Authority</label>
              <input type="text" value={clinicData.license_authority} onChange={setField('license_authority')} className={inputClass} placeholder="e.g. State Dental Council" />
            </div>
            <div>
              <label className={labelClass}>Expiry Date</label>
              <input type="date" value={clinicData.license_expiry || ''} onChange={setField('license_expiry')} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">All optional — leave blank if your practice isn't separately registered.</p>
        </Panel>
      )}

      {activeTab === 'taxation' && (
        <Panel title="Taxation" description="Used on invoices for this branch">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{clinicData.tax_label || 'GST No.'}</label>
              <input
                type="text"
                value={clinicData.gst_number}
                onChange={setField('gst_number')}
                className={inputClass}
                placeholder={`Enter ${clinicData.tax_label || 'GST No.'} (optional)`}
              />
            </div>
          </div>
        </Panel>
      )}

      {activeTab === 'location' && (
        <Panel title="Location" description="Where this branch operates">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Address *</label>
              <input type="text" value={clinicData.address} onChange={setField('address')} className={inputClass} placeholder="Enter clinic address" />
            </div>
          </div>
        </Panel>
      )}

      {activeTab === 'timings' && (
        <Panel title="Operating hours" description="Set this branch's working hours for each day">
          <div className="space-y-3">
            {Object.entries(clinicData.timings).map(([day, timing]) => (
              <div key={day} className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <div className="w-28">
                  <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={timing.open}
                    onChange={(e) => setTiming(day, { open: e.target.value })}
                    disabled={timing.closed}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#29828a] focus:border-transparent disabled:bg-gray-200 disabled:text-gray-500"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={timing.close}
                    onChange={(e) => setTiming(day, { close: e.target.value })}
                    disabled={timing.closed}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#29828a] focus:border-transparent disabled:bg-gray-200 disabled:text-gray-500"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timing.closed}
                    onChange={(e) => setTiming(day, { closed: e.target.checked })}
                    className="w-4 h-4 text-[#29828a] border-gray-300 rounded focus:ring-[#29828a]"
                  />
                  <span className="text-sm text-gray-600">Closed</span>
                </label>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {activeTab === 'branches' && (
        <Panel
          title="Branches"
          description="Every clinic on this account. Open one to edit its details."
        >
          {branches.length === 0 ? (
            <p className="text-sm text-gray-500">No branches on this account yet.</p>
          ) : (
            <div className="divide-y divide-gray-100 -mx-6 -mt-2">
              {branches.map((branch) => {
                const isViewing = branch.id === targetClinicId;
                const isSignedInTo = branch.id === user?.clinic_id;
                return (
                  <button
                    key={branch.id}
                    onClick={() => openBranch(branch.id)}
                    className={`w-full text-left px-6 py-4 flex items-center gap-3 transition-colors ${
                      isViewing ? 'bg-[#29828a]/5' : 'hover:bg-indigo-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isViewing ? 'bg-[#29828a] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate">{branch.name}</span>
                        {isSignedInTo && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Signed in
                          </span>
                        )}
                      </div>
                      {(branch.address || branch.clinic_code) && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {[branch.clinic_code, branch.address].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    {isViewing
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-[#29828a] shrink-0"><Check size={14} /> Viewing</span>
                      : <span className="text-xs font-medium text-gray-400 shrink-0">Open</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-gray-100">
            <button
              onClick={() => navigate('/add-clinic')}
              className="flex items-center gap-2 px-4 py-2 bg-[#29828a] text-white text-sm font-semibold rounded-lg hover:bg-[#216b71] transition-colors"
            >
              <PlusCircle size={16} /> Add New Branch
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Adding a second branch moves this account onto the paid plan.
            </p>
          </div>
        </Panel>
      )}

      {/* Save — one button for every tab; they all edit the same clinic record. */}
      {activeTab !== 'branches' && (
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSaveClinicData}
            disabled={savingClinicData}
            className="px-6 py-3 bg-[#29828a] text-white rounded-lg hover:bg-[#216b71] disabled:opacity-50 font-semibold transition-colors"
          >
            {savingClinicData ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

    </div>
  );
};

export default ClinicInfo;
