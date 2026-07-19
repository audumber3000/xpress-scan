import React, { useState, useEffect } from "react";
import FormDrawer, { Field, TextInput, SelectInput } from "../FormDrawer";
import { getCurrencySymbol } from "../../utils/currency";

const MED_CATEGORIES = ["General", "Antibiotics", "Analgesics", "Gastrointestinal", "Dental"];

const blankFor = (type) => type === "service"
  ? { name: "", price: "" }
  : { name: "", category: "General", dosage: "", duration: "", quantity: "", notes: "" };

/*
 * Add/edit a treatment (service) or a medication default, in the app's standard
 * right-side drawer. type = 'service' | 'medication'.
 */
const PracticeItemDrawer = ({ open, onClose, onSubmit, submitting, type, item }) => {
  const [form, setForm] = useState(blankFor(type));

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm(type === "service"
        ? { name: item.name || "", price: item.price ?? "" }
        : {
            name: item.name || "", category: item.category || "General",
            dosage: item.dosage || "", duration: item.duration || "",
            quantity: item.quantity || "", notes: item.notes || "",
          });
    } else {
      setForm(blankFor(type));
    }
  }, [open, item, type]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (type === "service") {
      onSubmit({ name: form.name.trim(), price: parseFloat(form.price) || 0 });
    } else {
      onSubmit({
        name: form.name.trim(),
        category: form.category,
        dosage: form.dosage.trim(),
        duration: form.duration.trim(),
        quantity: String(form.quantity).trim(),
        notes: form.notes.trim(),
      });
    }
  };

  const isService = type === "service";
  const noun = isService ? "treatment" : "medication";

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={`${item ? "Edit" : "Add"} ${noun}`}
      subtitle={isService ? "A billable service and its price" : "A prescription default"}
      onSubmit={submit}
      submitting={submitting}
      submitLabel={item ? `Update ${noun}` : `Add ${noun}`}
      accentClass="bg-[#2D9596] hover:bg-[#1F6B72]"
    >
      <Field label={isService ? "Treatment name" : "Medicine name"}>
        <TextInput required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={isService ? "e.g. Root Canal" : "e.g. Amoxicillin"} />
      </Field>

      {isService ? (
        <Field label={`Price (${getCurrencySymbol()})`}>
          <TextInput type="number" min="0" step="any" required value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
        </Field>
      ) : (
        <>
          <Field label="Category">
            <SelectInput value={form.category} onChange={(e) => set("category", e.target.value)}>
              {MED_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Dosage">
              <TextInput value={form.dosage} onChange={(e) => set("dosage", e.target.value)} placeholder="1-0-1" />
            </Field>
            <Field label="Duration">
              <TextInput value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="5 days" />
            </Field>
            <Field label="Default qty">
              <TextInput value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="10" />
            </Field>
          </div>
          <Field label="Notes / instructions">
            <textarea
              rows="2"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Special instructions..."
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:bg-white focus:ring-2 focus:ring-[#2a276e]/20 transition-colors"
            />
          </Field>
        </>
      )}
    </FormDrawer>
  );
};

export default PracticeItemDrawer;
