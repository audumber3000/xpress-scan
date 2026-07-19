import React, { useState, useEffect } from "react";
import FormDrawer, { Field, TextInput, SelectInput } from "../FormDrawer";

const FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Gel", "Drops", "Ointment", "Powder", "Other"];
const SCHEDULES = ["OTC", "H", "H1", "X"];

const blank = {
  name: "", generic_name: "", strength: "", form: "Tablet",
  quantity: "0", unit: "strip", min_stock_level: "10", price_per_unit: "0",
  batch_number: "", expiry_date: "", schedule: "OTC", vendor_id: "",
};

const MedicationDrawer = ({ open, onClose, onSubmit, submitting, item, vendors = [] }) => {
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!open) return;
    setForm(item ? {
      name: item.name || "",
      generic_name: item.generic_name || "",
      strength: item.strength || "",
      form: item.form || "Tablet",
      quantity: String(item.quantity ?? 0),
      unit: item.unit || "strip",
      min_stock_level: String(item.min_stock_level ?? 10),
      price_per_unit: String(item.price_per_unit ?? 0),
      batch_number: item.batch_number || "",
      expiry_date: item.expiry_date || "",
      schedule: item.schedule || "OTC",
      vendor_id: item.vendor_id ? String(item.vendor_id) : "",
    } : blank);
  }, [open, item]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      generic_name: form.generic_name.trim() || null,
      strength: form.strength.trim() || null,
      form: form.form,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit.trim() || "strip",
      min_stock_level: parseFloat(form.min_stock_level) || 0,
      price_per_unit: parseFloat(form.price_per_unit) || 0,
      batch_number: form.batch_number.trim() || null,
      expiry_date: form.expiry_date || null,
      schedule: form.schedule || null,
      vendor_id: form.vendor_id ? parseInt(form.vendor_id) : null,
    });
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={item ? "Edit medication" : "Add medication"}
      subtitle="Medicine stock, with batch and expiry"
      onSubmit={submit}
      submitting={submitting}
      submitLabel={item ? "Update medication" : "Add medication"}
    >
      <Field label="Brand / medicine name">
        <TextInput required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Augmentin 625" />
      </Field>
      <Field label="Generic name (optional)">
        <TextInput value={form.generic_name} onChange={(e) => set("generic_name", e.target.value)} placeholder="e.g. Amoxicillin + Clavulanic acid" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Strength">
          <TextInput value={form.strength} onChange={(e) => set("strength", e.target.value)} placeholder="e.g. 625 mg" />
        </Field>
        <Field label="Form">
          <SelectInput value={form.form} onChange={(e) => set("form", e.target.value)}>
            {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
          </SelectInput>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity">
          <TextInput type="number" min="0" step="any" required value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
        </Field>
        <Field label="Unit">
          <TextInput value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="strip, bottle, vial" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Reorder level" hint="Warn at or below this stock">
          <TextInput type="number" min="0" step="any" value={form.min_stock_level} onChange={(e) => set("min_stock_level", e.target.value)} />
        </Field>
        <Field label="Price / unit">
          <TextInput type="number" min="0" step="any" value={form.price_per_unit} onChange={(e) => set("price_per_unit", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Batch no. (optional)">
          <TextInput value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} />
        </Field>
        <Field label="Expiry date">
          <TextInput type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Schedule">
          <SelectInput value={form.schedule} onChange={(e) => set("schedule", e.target.value)}>
            {SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        </Field>
        <Field label="Vendor (optional)">
          <SelectInput value={form.vendor_id} onChange={(e) => set("vendor_id", e.target.value)}>
            <option value="">Unassigned</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </SelectInput>
        </Field>
      </div>
    </FormDrawer>
  );
};

export default MedicationDrawer;
