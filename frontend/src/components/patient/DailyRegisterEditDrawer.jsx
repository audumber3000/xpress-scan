import React, { useState, useEffect } from "react";
import FormDrawer, { Field, TextInput, SelectInput } from "../FormDrawer";

/**
 * Correct a register entry.
 *
 * Only what describes the visit is editable: reason, doctor, notes. The patient
 * and the day define the entry rather than describe it, so changing those isn't
 * a correction, it's a different visit. New vs Repeat is likewise fixed at
 * registration so past days' KPIs don't shift underneath you.
 */
const DailyRegisterEditDrawer = ({ open, entry, onClose, onSave, doctors = [] }) => {
  const [form, setForm] = useState({ reason: "", doctor_id: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !entry) return;
    setForm({
      reason: entry.reason || "",
      doctor_id: entry.doctor_id ? String(entry.doctor_id) : "",
      notes: entry.notes || "",
    });
    setError("");
  }, [open, entry]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      await onSave(entry.id, {
        reason: form.reason.trim() || null,
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
        notes: form.notes.trim() || null,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "Couldn't save those changes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="Edit register entry"
      subtitle={entry?.patient_name || ""}
      onSubmit={submit}
      submitting={busy}
      submitLabel="Save changes"
    >
      {entry && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">
            {entry.patient_name}
            {entry.display_id && <span className="text-xs font-normal text-gray-400"> · #{entry.display_id}</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {entry.patient_phone || "No phone"}
            {" · "}
            <span className={entry.is_repeat ? "text-amber-700" : "text-green-700"}>
              {entry.is_repeat ? "Repeat" : "New"} visit
            </span>
          </p>
        </div>
      )}

      <Field label="Reason for visit">
        <TextInput
          value={form.reason}
          onChange={(e) => set("reason", e.target.value)}
          placeholder="e.g. Toothache, upper left"
          autoFocus
        />
      </Field>

      <Field label="Doctor">
        <SelectInput value={form.doctor_id} onChange={(e) => set("doctor_id", e.target.value)}>
          <option value="">Not assigned</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectInput>
      </Field>

      <Field label="Notes" hint="Anything the front desk should know about this visit.">
        <textarea
          rows="3"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:bg-white focus:ring-2 focus:ring-[#2a276e]/20 transition-colors resize-none"
        />
      </Field>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </FormDrawer>
  );
};

export default DailyRegisterEditDrawer;
