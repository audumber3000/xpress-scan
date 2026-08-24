import React, { useState, useEffect } from "react";
import { X, UserRound, CheckCircle2 } from "lucide-react";
import AgeOrDobField, { computeAgeFromDob } from "./AgeOrDobField";
import InlineFeedback from "../common/InlineFeedback";
import { api, getFriendlyErrorMessage } from "../../utils/api";
import { isValidPhone } from "../../utils/validators";
import { clinicToday } from "../../utils/datetime";

/**
 * Edit an existing patient.
 *
 * A modal, not a drawer, on purpose: changing one field on a record already on
 * screen is a decision you make and come straight back from. Drawers are for
 * creating something new, or for a panel you go into and work inside.
 *
 * Shared by the patient file header and the Patients list, so there is exactly
 * one patient form to keep correct. Creation still lives in the Patients list
 * drawer, which carries its own post-create flow (daily register, case paper
 * nudge) that has no meaning when editing.
 *
 * @param {object}   patient   the record to edit
 * @param {function} onSaved   called with the updated patient on success
 */
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// The API stores gender lowercase ("female"), the <select> options are
// capitalised ("Female"). Without this the select matched nothing and every
// patient opened with "Select Gender", silently clearing a required field.
const toOptionCase = (g) => {
  const v = String(g || "").trim();
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

const emptyForm = {
  name: "", age: "", date_of_birth: "", gender: "Male", phone: "", village: "",
  treatment_type: "General", referred_by: "", blood_group: "", patient_history: "",
  display_id: "", registered_on: "", notes: "",
};

const PatientEditModal = ({ open, patient, onClose, onSaved }) => {
  const [form, setForm] = useState(emptyForm);
  const [ageMode, setAgeMode] = useState("age");
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed whenever the modal opens on a patient. Stale values from the last
  // edit would be a form that silently describes someone else.
  useEffect(() => {
    if (!open || !patient) return;
    setForm({
      name: patient.name || "",
      age: patient.age ?? "",
      date_of_birth: patient.date_of_birth || "",
      gender: toOptionCase(patient.gender) || "Male",
      phone: patient.phone || "",
      village: patient.village || "",
      treatment_type: patient.treatment_type || "General",
      referred_by: patient.referred_by || "",
      blood_group: patient.blood_group || "",
      patient_history: patient.patient_history || "",
      display_id: patient.display_id || "",
      registered_on: patient.registered_on || clinicToday(),
      notes: patient.notes || "",
    });
    setAgeMode(patient.date_of_birth ? "dob" : "age");
    setErrors({});
    setSaveError("");
    setSaving(false);
  }, [open, patient]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Every required field checked up front, so the user sees which one is wrong
  // rather than a server rejection with no field attached.
  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Name is required.";

    if (ageMode === "dob") {
      if (!form.date_of_birth) e.age = "Date of birth is required.";
      else if (form.date_of_birth > clinicToday()) e.age = "Date of birth can't be in the future.";
    } else {
      const age = String(form.age ?? "").trim();
      if (!age) e.age = "Age is required.";
      else {
        const n = Number(age);
        if (!Number.isFinite(n) || n < 0 || n > 150) e.age = "Enter a valid age between 0 and 150.";
      }
    }

    if (!form.gender?.trim()) e.gender = "Gender is required.";

    if (!form.phone?.trim()) e.phone = "Phone number is required.";
    else if (form.phone.replace(/\D/g, "").length < 7) e.phone = "Enter a valid phone number (at least 7 digits).";

    if (!form.registered_on) e.registered_on = "Registration date is required.";
    // Both are YYYY-MM-DD, so a string compare is a date compare.
    else if (form.registered_on > clinicToday()) e.registered_on = "Registration date can't be in the future.";

    if (!form.village?.trim()) e.village = "Village/City is required.";
    if (!form.treatment_type?.trim()) e.treatment_type = "Treatment type is required.";
    if (!form.referred_by?.trim()) e.referred_by = "Referred by is required.";
    return e;
  };

  const handleSave = async () => {
    const found = validate();
    setSaveError("");
    if (Object.keys(found).length > 0) {
      // No toast: each bad field is outlined with its reason underneath, which
      // is where the fix has to happen anyway.
      setErrors(found);
      return;
    }
    setErrors({});

    // Send either age or date of birth, following the toggle.
    const payload = { ...form };
    if (ageMode === "dob") {
      payload.date_of_birth = form.date_of_birth || null;
      payload.age = computeAgeFromDob(form.date_of_birth) || null;
    } else {
      payload.age = form.age === "" ? null : Number(form.age);
      payload.date_of_birth = null;
    }

    try {
      setSaving(true);
      const updated = await api.put(`/patients/${patient.id}`, payload);
      onSaved?.(updated || { ...patient, ...payload });
      onClose?.();
    } catch (err) {
      console.error("Error saving patient:", err);
      // Kept inside the modal, above its own Save button: a duplicate phone is
      // a reason to change what you typed, not a toast behind a closing dialog.
      setSaveError(getFriendlyErrorMessage(err, "We couldn't save this patient. Please check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (name) =>
    `w-full px-4 py-2 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all ${
      errors[name] ? "border-red-400 bg-red-50" : "border-gray-200"
    }`;

  const FieldError = ({ name }) =>
    errors[name] ? <p className="mt-1 text-sm text-red-600">{errors[name]}</p> : null;

  const plainInput =
    "w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] text-sm transition-all";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => !saving && onClose?.()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2a276e]/10 flex items-center justify-center">
              <UserRound size={18} className="text-[#2a276e]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Edit patient</h3>
              <p className="text-xs text-gray-500">Update {patient?.name || "this patient"}'s details</p>
            </div>
          </div>
          <button
            onClick={() => !saving && onClose?.()}
            disabled={saving}
            className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-40"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form
            id="patient-edit-form"
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} className={fieldClass("name")} />
                <FieldError name="name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                <input
                  type="text"
                  readOnly
                  value={form.display_id}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AgeOrDobField
                mode={ageMode}
                onModeChange={setAgeMode}
                age={form.age}
                onAgeChange={(v) => setField("age", v)}
                dob={form.date_of_birth}
                onDobChange={(v) => setField("date_of_birth", v)}
                error={errors.age}
                inputClass={fieldClass("age")}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select value={form.gender} onChange={(e) => setField("gender", e.target.value)} className={fieldClass("gender")}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <FieldError name="gender" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    className={`${fieldClass("phone")} pr-11`}
                  />
                  {isValidPhone(form.phone) && (
                    <CheckCircle2
                      size={20}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-green-500 animate-in fade-in zoom-in duration-200"
                    />
                  )}
                </div>
                <FieldError name="phone" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Registration <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.registered_on || ""}
                  max={clinicToday()}
                  onChange={(e) => setField("registered_on", e.target.value)}
                  className={fieldClass("registered_on")}
                />
                <FieldError name="registered_on" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Village/City <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.village} onChange={(e) => setField("village", e.target.value)} className={fieldClass("village")} />
                <FieldError name="village" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Treatment Type <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.treatment_type} onChange={(e) => setField("treatment_type", e.target.value)} className={fieldClass("treatment_type")} />
                <FieldError name="treatment_type" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referred By <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.referred_by} onChange={(e) => setField("referred_by", e.target.value)} className={fieldClass("referred_by")} />
                <FieldError name="referred_by" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                <select value={form.blood_group} onChange={(e) => setField("blood_group", e.target.value)} className={plainInput}>
                  <option value="">Select Blood Group</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient History</label>
              <input
                type="text"
                placeholder="e.g. Diabetics, Hypertension"
                value={form.patient_history}
                onChange={(e) => setField("patient_history", e.target.value)}
                className={plainInput}
              />
              <p className="mt-1 text-xs text-gray-400">Shows as a warning on the patient's file.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows="3"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                className={`${plainInput} resize-none`}
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          {saveError && <InlineFeedback tone="error" className="mb-3">{saveError}</InlineFeedback>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => !saving && onClose?.()}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="patient-edit-form"
              disabled={saving}
              className="px-6 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientEditModal;
