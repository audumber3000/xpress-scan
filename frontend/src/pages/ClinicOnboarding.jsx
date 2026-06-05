import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { api } from '../utils/api';
import { detectCountry, detectCountryAsync, flagEmoji } from '../utils/detectCountry';
import ValidatedInput from '../components/forms/ValidatedInput';
import { isNonEmpty, isValidPhone } from '../utils/validators';
import { getSubscriptionPricing } from '../utils/pricing';
import {
  Building2,
  MapPin,
  User,
  GraduationCap,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Check,
  Minus,
  MessageCircle,
  Globe,
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Profile' },
  { id: 2, title: 'Clinic' },
  { id: 3, title: 'Setup' },
  { id: 4, title: 'Plan' },
];

const SPECIALIZATIONS = [
  'General Dentistry',
  'Orthodontics',
  'Pediatric',
  'Implantology',
  'Cosmetic',
  'Periodontics',
];

const ClinicOnboarding = () => {
  const navigate = useNavigate();
  const { setUser: setAuthUser, signOut } = useAuth();
  const [user, setUser] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [countries, setCountries] = useState([]);
  const [formData, setFormData] = useState({
    full_name: "",
    specialty: "",
    clinic_name: "",
    clinic_address: "",
    clinic_phone: "",
    clinic_email: "",
    country: detectCountry(),
    number_of_chairs: 1,
    category: "General Dentistry",
    subscription_plan: "free",
    billing_cycle: "monthly",
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const u = JSON.parse(userData);
      setUser(u);
      setFormData((prev) => ({
        ...prev,
        clinic_email: u.email || "",
        full_name: u.name || u.full_name || "",
      }));
    }
    // Fetch supported countries for the dropdown.
    // If the locale-detected country isn't in the supported list, snap back
    // to "IN" so the dropdown doesn't render an invalid/blank selection.
    api.get('/clinics/countries').then(async (list) => {
      setCountries(list);
      // Refine to the IP-detected country (most accurate); fall back gracefully.
      const detected = await detectCountryAsync();
      setFormData((prev) =>
        list.some((c) => c.code === detected)
          ? { ...prev, country: detected }
          : list.some((c) => c.code === prev.country)
          ? prev
          : { ...prev, country: 'IN' }
      );
    }).catch(() => {});
  }, []);

  // Don't let people wander off mid-setup. Warn on tab close/refresh, and
  // intercept the browser Back button with a friendly "finish your clinic" nudge.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      setShowExitModal(true);
      // Re-trap so a second Back press still shows the nudge instead of leaving.
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const handleLeaveAnyway = async () => {
    setShowExitModal(false);
    try { await signOut?.(); } catch { /* ignore */ }
    navigate('/login', { replace: true });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const adjustChairs = (delta) => {
    setFormData((prev) => ({
      ...prev,
      number_of_chairs: Math.max(1, Math.min(50, (prev.number_of_chairs || 1) + delta)),
    }));
  };

  const isValidStep = () => {
    if (currentStep === 1) return formData.full_name.trim() && formData.specialty.trim();
    if (currentStep === 2) {
      const phone = formData.clinic_phone.replace(/\D/g, '');
      return formData.clinic_name.trim() && formData.clinic_address.trim() && phone.length >= 4;
    }
    if (currentStep === 3) return formData.number_of_chairs >= 1 && !!formData.category;
    return true;
  };

  const submitOnboarding = async (planOverride) => {
    setLoading(true);
    try {
      const cleanPhone = formData.clinic_phone.replace(/\D/g, '');
      if (cleanPhone.length < 4) throw new Error("Enter a valid phone number.");

      const referralCode = sessionStorage.getItem('referred_by_code');
      const payload = {
        ...formData,
        subscription_plan: planOverride || formData.subscription_plan,
        number_of_chairs: parseInt(formData.number_of_chairs, 10) || 1,
        specialization: formData.category,
        referred_by_code: referralCode,
      };

      const result = await api.post('/auth/onboarding', payload);
      if (referralCode) sessionStorage.removeItem('referred_by_code');

      localStorage.setItem('user', JSON.stringify(result.user));
      setAuthUser(result.user);
      // Show the one-time welcome on the dashboard, and keep the recurring
      // device-app upsell quiet for this first session so they don't stack —
      // the welcome already carries a soft "get the app" nudge.
      localStorage.setItem('mp_welcome_pending', '1');
      try {
        localStorage.setItem('mp_device_upsell_v1', JSON.stringify({ dismissedAt: Date.now() }));
      } catch (_) { /* ignore */ }
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || "Onboarding failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = (e) => {
    e?.preventDefault();
    if (!isValidStep()) return;
    if (currentStep < 4) setCurrentStep(currentStep + 1);
    else submitOnboarding();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  // Step indicator — horizontal pills with connecting lines
  const StepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#2a276e] text-white'
                      : isDone
                      ? 'bg-[#2a276e]/15 text-[#2a276e]'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium ${
                    isActive ? 'text-[#2a276e]' : isDone ? 'text-gray-700' : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 -mt-5 ${
                    currentStep > step.id ? 'bg-[#2a276e]/40' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  const inputCls =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a276e] focus:border-transparent text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";
  // Currency-aware pricing based on the chosen country (₹ for India, $ elsewhere).
  const pricing = getSubscriptionPricing(formData.country);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a276e]/5 to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/molarplus-logo.svg" alt="MolarPlus" className="h-10" />
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8">
          <StepIndicator />

          <div>
            {currentStep === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Tell us about you</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    A few details for your patient-facing profile.
                  </p>
                </div>

                <ValidatedInput
                  label={
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-gray-400" /> Full name *
                    </span>
                  }
                  labelClassName={labelCls}
                  className="text-sm"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="Dr. Rajesh Kumar"
                  isValid={isNonEmpty(formData.full_name)}
                  errorText="Full name is required"
                />

                <ValidatedInput
                  label={
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-gray-400" /> Specialty / Degree *
                    </span>
                  }
                  labelClassName={labelCls}
                  className="text-sm"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleInputChange}
                  placeholder="BDS, MDS (Orthodontics)"
                  isValid={isNonEmpty(formData.specialty)}
                  errorText="Specialty is required"
                />
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">About your clinic</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    These details appear on invoices, prescriptions, and the public booking page.
                  </p>
                </div>

                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-gray-400" /> Country *
                    </span>
                  </label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className={inputCls}
                  >
                    {countries.length > 0 ? (
                      // Float the auto-detected / selected country to the top so it's the obvious default.
                      [...countries]
                        .sort((a, b) =>
                          a.code === formData.country ? -1 : b.code === formData.country ? 1 : 0
                        )
                        .map((c) => (
                          <option key={c.code} value={c.code}>
                            {flagEmoji(c.code)}  {c.name} ({c.currency_symbol})
                          </option>
                        ))
                    ) : (
                      <option value="IN">{flagEmoji('IN')}  India (₹)</option>
                    )}
                  </select>
                </div>

                <ValidatedInput
                  label={
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-gray-400" /> Clinic name *
                    </span>
                  }
                  labelClassName={labelCls}
                  className="text-sm"
                  name="clinic_name"
                  value={formData.clinic_name}
                  onChange={handleInputChange}
                  placeholder="MolarPlus Dental Care"
                  isValid={isNonEmpty(formData.clinic_name)}
                  errorText="Clinic name is required"
                />

                <ValidatedInput
                  label={
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp / Phone number *
                    </span>
                  }
                  labelClassName={labelCls}
                  className="text-sm"
                  type="tel"
                  name="clinic_phone"
                  value={formData.clinic_phone}
                  onChange={handleInputChange}
                  placeholder={countries.find(c => c.code === formData.country)?.phone_code + ' ...' || '+91 98765 43210'}
                  isValid={isValidPhone(formData.clinic_phone)}
                  errorText="Enter a valid phone number"
                  hint="Used for appointment reminders and consent links sent to patients."
                />

                <ValidatedInput
                  label={
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" /> Address *
                    </span>
                  }
                  labelClassName={labelCls}
                  className="text-sm"
                  name="clinic_address"
                  value={formData.clinic_address}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Suite, building, street, city"
                  isValid={isNonEmpty(formData.clinic_address)}
                  errorText="Address is required"
                />
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Set up your practice</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Tell us your capacity and focus. We'll seed a default list of treatments you can edit later.
                  </p>
                </div>

                <div>
                  <label className={labelCls}>Number of chairs</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustChairs(-1)}
                      disabled={formData.number_of_chairs <= 1}
                      className="w-10 h-10 rounded-lg border border-gray-300 text-gray-700 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                      aria-label="Decrease"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.number_of_chairs}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          number_of_chairs: Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)),
                        }))
                      }
                      className={`${inputCls} text-center w-24 font-semibold`}
                    />
                    <button
                      type="button"
                      onClick={() => adjustChairs(1)}
                      disabled={formData.number_of_chairs >= 50}
                      className="w-10 h-10 rounded-lg border border-gray-300 text-gray-700 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                      aria-label="Increase"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Specialization</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {SPECIALIZATIONS.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, category: cat }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                          formData.category === cat
                            ? 'bg-[#9B8CFF]/15 border-[#2a276e] text-[#2a276e]'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Pick a plan</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Start free, upgrade anytime. No card required.
                  </p>
                </div>

                {/* Billing toggle */}
                <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, billing_cycle: 'monthly' }))}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                      formData.billing_cycle === 'monthly' ? 'bg-white text-[#2a276e] shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, billing_cycle: 'annual' }))}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${
                      formData.billing_cycle === 'annual' ? 'bg-white text-[#2a276e] shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    Annual
                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{pricing.pctOff}% OFF</span>
                  </button>
                </div>

                {/* Plan cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Free */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, subscription_plan: 'free' }))}
                    className={`text-left rounded-xl border-2 p-5 transition-colors ${
                      formData.subscription_plan === 'free'
                        ? 'border-[#2a276e] bg-[#9B8CFF]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-gray-900">Free</h3>
                      {formData.subscription_plan === 'free' && (
                        <CheckCircle className="w-5 h-5 text-[#2a276e]" />
                      )}
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{pricing.symbol}0</div>
                    <p className="text-xs text-gray-500 mb-3">Forever — get started</p>
                    <ul className="space-y-1.5 text-xs text-gray-600">
                      {['Up to 50 patients', 'Basic appointments', 'Single user'].map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-gray-400" /> {f}
                        </li>
                      ))}
                    </ul>
                  </button>

                  {/* Professional */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, subscription_plan: 'professional' }))}
                    className={`text-left rounded-xl border-2 p-5 transition-colors ${
                      formData.subscription_plan === 'professional'
                        ? 'border-[#2a276e] bg-[#9B8CFF]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-gray-900">Professional</h3>
                      {formData.subscription_plan === 'professional' && (
                        <CheckCircle className="w-5 h-5 text-[#2a276e]" />
                      )}
                    </div>
                    {formData.billing_cycle === 'annual' ? (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-gray-900">{pricing.symbol}{pricing.annualMonthly}</span>
                          <span className="text-xs text-gray-500">/month</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          Billed {pricing.symbol}{pricing.annualTotal.toLocaleString('en-US')}/year — save {pricing.symbol}{pricing.save.toLocaleString('en-US')}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-gray-900">{pricing.symbol}{pricing.monthly}</span>
                          <span className="text-xs text-gray-500">/month</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Billed monthly</p>
                      </>
                    )}
                    <ul className="space-y-1.5 text-xs text-gray-600">
                      {['Unlimited patients & staff', 'WhatsApp reminders', 'Treatment planning', 'Reports & analytics'].map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-gray-400" /> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Nav buttons */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                disabled={loading}
                className="flex items-center justify-center gap-1 px-5 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!isValidStep() || loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#2a276e] text-white py-3 rounded-lg font-semibold hover:bg-[#1a1548] disabled:opacity-50 transition-colors"
            >
              {loading
                ? 'Setting up…'
                : currentStep === 4
                ? 'Finish setup'
                : 'Continue'}
              {!loading && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-gray-400">
          A product by Clino Health · Upclick Labs (OPC)
        </div>
      </div>

      {/* Exit-intent nudge */}
      {showExitModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-celebrate-overlay">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-celebrate-pop">
            <div className="bg-gradient-to-br from-[#2a276e] to-[#403bb1] px-8 pt-8 pb-10 text-center text-white">
              <div className="text-5xl mb-3">🦷✨</div>
              <h2 className="text-2xl font-bold tracking-tight">Wait — your clinic is almost ready!</h2>
              <p className="mt-2 text-sm text-white/80">
                You're literally one step away from running your practice on MolarPlus.
                Don't lose your progress now!
              </p>
            </div>
            <div className="px-6 pt-6 pb-7 -mt-6 bg-white rounded-t-3xl flex flex-col gap-2.5">
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-3.5 rounded-xl bg-[#2a276e] text-white font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
              >
                Finish setting up my clinic →
              </button>
              <button
                onClick={handleLeaveAnyway}
                className="w-full py-2.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicOnboarding;
