import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import FeatureLock from "../components/FeatureLock";

const SPECIALIZATIONS = [
  { value: "dental", label: "Dental" },
  { value: "radiology", label: "Radiology" },
  { value: "cardiology", label: "Cardiology" },
  { value: "orthopedic", label: "Orthopedic" },
  { value: "general", label: "General Practice" },
  { value: "ophthalmology", label: "Ophthalmology" },
  { value: "dermatology", label: "Dermatology" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "other", label: "Other" },
];

const Field = ({ label, required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const Input = ({ ...props }) => (
  <input
    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/30 focus:border-[#2a276e] transition-all"
    {...props}
  />
);

const AddClinic = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    specialization: "dental",
    gst_number: "",
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Clinic name is required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/clinics/owner/add", form);
      toast.success(`"${form.name}" branch created successfully!`);
      // Refresh auth context so the user sees the new clinic in the switcher
      if (refreshUser) await refreshUser();
      navigate("/dashboard");
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to create clinic";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-6 flex flex-col items-center">
      <FeatureLock featureName="Multi-Clinic Expansion">
        <div className="w-full max-w-2xl">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-[#f0f0fd] to-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2a276e] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Add New Branch</h1>
                <p className="text-sm text-gray-500 mt-0.5">Create a new clinic branch under your account</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
            <Field label="Clinic / Branch Name" required>
              <Input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. MolarPlus - Beed Branch"
                required
              />
            </Field>

            <Field label="Specialization">
              <select
                name="specialization"
                value={form.specialization}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/30 focus:border-[#2a276e] transition-all bg-white"
              >
                {SPECIALIZATIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Phone">
                <Input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  type="tel"
                />
              </Field>
              <Field label="Email">
                <Input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="branch@example.com"
                  type="email"
                />
              </Field>
            </div>

            <Field label="Address">
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Full clinic address..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/30 focus:border-[#2a276e] transition-all resize-none"
              />
            </Field>

            <Field label="GST Number">
              <Input
                name="gst_number"
                value={form.gst_number}
                onChange={handleChange}
                placeholder="22AAAAA0000A1Z5"
              />
            </Field>

            {/* Info note */}
            <div className="flex items-start gap-3 p-4 bg-[#f0f0fd] rounded-xl border border-[#c5c2f0]">
              <svg className="w-4 h-4 text-[#2a276e] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-[#2a276e]">
                A unique Clinic ID will be auto-generated for this branch. You can switch between branches from the header dropdown anytime.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </>
                ) : "Create Branch"}
              </button>
            </div>
          </form>
        </div>
        </div>
      </FeatureLock>
    </div>
  );
};

export default AddClinic;
