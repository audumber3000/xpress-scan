import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../utils/api";
import {
  Building2,
  MapPin,
  Check,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  Globe,
  Hash,
  FileText
} from 'lucide-react';
import toast from "react-hot-toast";

const STEPS = [
  { id: 1, title: 'Lab Profile' },
  { id: 2, title: 'Settings' }
];

export default function OnboardingPage() {
  const { completeOnboarding, isOnboarded } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    country: "IN",
    tax_id: "",
    case_number_prefix: "DL"
  });

  useEffect(() => {
    if (isOnboarded) navigate("/");
  }, [isOnboarded, navigate]);

  useEffect(() => {
    api.get("/auth/countries").then(data => {
      setCountries(data.countries || []);
    }).catch(() => {});
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const isValidStep = () => {
    if (currentStep === 1) return form.name.trim() && form.address.trim() && form.phone.trim();
    if (currentStep === 2) return form.case_number_prefix.trim().length >= 1;
    return true;
  };

  const submitOnboarding = async () => {
    setLoading(true);
    try {
      await completeOnboarding({
        ...form,
        case_number_prefix: form.case_number_prefix.toUpperCase().slice(0, 5)
      });
      toast.success("Lab setup complete! 🎉");
      navigate("/");
    } catch (error) {
      toast.error(error.message || "Setup failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = (e) => {
    e?.preventDefault();
    if (!isValidStep()) return;
    if (currentStep < 2) setCurrentStep(currentStep + 1);
    else submitOnboarding();
  };

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

  const inputCls = "w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a276e]/5 to-indigo-50 py-12 px-4 flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#2a276e]">MolarPlus Labs</h1>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl shadow-xl shadow-indigo-100/50 p-6 md:p-8 animate-fadeIn border border-gray-100">
          <StepIndicator />

          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
            {currentStep === 1 && (
              <div className="space-y-5 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">About your laboratory</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    These details appear on invoices and public communications.
                  </p>
                </div>

                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-gray-400" /> Country <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <select
                    name="country"
                    value={form.country}
                    onChange={handleInputChange}
                    className={inputCls}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.currency_symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-gray-400" /> Lab Name <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleInputChange}
                    className={inputCls}
                    placeholder="Precision Dental Lab"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      <span className="flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-green-600" /> Phone number <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleInputChange}
                      className={inputCls}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      <span className="flex items-center gap-1.5">
                        Contact Email
                      </span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleInputChange}
                      className={inputCls}
                      placeholder="lab@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" /> Address <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleInputChange}
                    className={`${inputCls} resize-y`}
                    rows={2}
                    placeholder="Suite, building, street, city"
                    required
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Lab Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure your case numbering and tax information.
                  </p>
                </div>

                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-gray-400" /> Case Number Prefix <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    name="case_number_prefix"
                    value={form.case_number_prefix}
                    onChange={e => setForm({ ...form, case_number_prefix: e.target.value.toUpperCase().slice(0, 5) })}
                    className={inputCls}
                    placeholder="DL"
                    maxLength={5}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2 ml-1">
                    Cases will be automatically numbered like: <span className="font-semibold text-[#2a276e]">{form.case_number_prefix || "DL"}-{new Date().getFullYear()}-0001</span>
                  </p>
                </div>

                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-gray-400" /> Tax Registration No.
                    </span>
                  </label>
                  <input
                    name="tax_id"
                    value={form.tax_id}
                    onChange={handleInputChange}
                    className={inputCls}
                    placeholder="GST / VAT / Tax ID (Optional)"
                  />
                  <p className="text-xs text-gray-500 mt-2 ml-1">
                    Will be displayed on your generated invoices.
                  </p>
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                  disabled={loading}
                  className="flex items-center justify-center gap-1 px-6 py-3 border border-gray-300 text-gray-700 bg-white rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button
                type="submit"
                disabled={!isValidStep() || loading}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#2a276e] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#1a1548] disabled:opacity-50 transition-colors shadow-sm"
              >
                {loading
                  ? 'Setting up…'
                  : currentStep === 2
                  ? 'Finish setup'
                  : 'Continue'}
                {!loading && currentStep !== 2 && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>

        <div className="text-center mt-8 text-xs font-medium text-gray-400">
          A product by Clino Health
        </div>
      </div>
    </div>
  );
}
