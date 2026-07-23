import React, { useState, useEffect } from "react";
import FormDrawer, { Field, TextInput, SelectInput } from "../FormDrawer";
import PatientMatchModal from "./PatientMatchModal";

/**
 * Register a patient for the day.
 *
 * The drawer collects who's here; if anyone already on the books looks like the
 * same person, the choice pops up in PatientMatchModal rather than unfolding
 * inside the drawer, so it reads as a decision to make rather than more form.
 * Picking a match records a repeat visit; "register a new patient" hands off to
 * the clinic's create-patient drawer, so there is one patient form in the app.
 *
 * @param {function} onLookup       - ({name, phone}) => Promise<match[]>
 * @param {function} onPickExisting - (patient, {reason, doctor_id}) => Promise
 * @param {function} onCreateNew    - ({name, phone}) => void
 */
const blank = { name: "", phone: "", reason: "", doctor_id: "" };

const DailyRegisterDrawer = ({ open, onClose, onLookup, onPickExisting, onCreateNew, doctors = [], dateLabel }) => {
  const [form, setForm] = useState(blank);
  const [matches, setMatches] = useState([]);
  const [showMatches, setShowMatches] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(blank);
    setMatches([]);
    setShowMatches(false);
    setError("");
  }, [open]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() && !form.phone.trim()) {
      setError("Enter a name or a phone number to look them up.");
      return;
    }
    try {
      setBusy(true);
      const found = await onLookup({ name: form.name.trim(), phone: form.phone.trim() });
      const list = Array.isArray(found) ? found : [];
      if (list.length === 0) {
        // Nobody on the books matches, so this is a genuinely new patient.
        createNew();
        return;
      }
      setMatches(list);
      setShowMatches(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Couldn't check existing patients. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (patient) => {
    try {
      setBusy(true);
      await onPickExisting(patient, {
        reason: form.reason.trim() || null,
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
      });
      setShowMatches(false);
    } catch (err) {
      setShowMatches(false);
      setError(err?.response?.data?.detail || "Couldn't add this patient to the register.");
    } finally {
      setBusy(false);
    }
  };

  const createNew = () => {
    setShowMatches(false);
    onCreateNew({ name: form.name.trim(), phone: form.phone.trim() });
  };

  return (
    <>
      <FormDrawer
        open={open}
        onClose={onClose}
        title="Register patient"
        subtitle={dateLabel ? `For ${dateLabel}` : "For today"}
        onSubmit={handleSubmit}
        submitting={busy}
        submitLabel="Continue"
      >
        <Field label="Patient name">
          <TextInput
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Full name"
            autoFocus
          />
        </Field>

        <Field label="Phone" hint="We check the name and phone against your existing patients before creating anything.">
          <TextInput
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="10-digit number"
          />
        </Field>

        <Field label="Reason for visit">
          <TextInput
            value={form.reason}
            onChange={(e) => set("reason", e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Doctor">
          <SelectInput value={form.doctor_id} onChange={(e) => set("doctor_id", e.target.value)}>
            <option value="">Not assigned</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectInput>
        </Field>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </FormDrawer>

      <PatientMatchModal
        open={open && showMatches}
        matches={matches}
        onPick={pick}
        onCreateNew={createNew}
        onClose={() => setShowMatches(false)}
        busy={busy}
      />
    </>
  );
};

export default DailyRegisterDrawer;
