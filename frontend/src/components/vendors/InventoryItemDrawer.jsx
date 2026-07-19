import React, { useState, useEffect } from "react";
import FormDrawer, { Field, TextInput, SelectInput } from "../FormDrawer";

const CATEGORIES = ["Consumables", "Equipment", "Lab Services", "Office", "Other"];

const blank = {
  name: "", category: "Consumables", quantity: "0", unit: "units",
  min_stock_level: "10", price_per_unit: "0", batch_number: "", expiry_date: "", vendor_id: "",
};

const InventoryItemDrawer = ({ open, onClose, onSubmit, submitting, item, vendors = [] }) => {
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!open) return;
    setForm(item ? {
      name: item.name || "",
      category: item.category || "Consumables",
      quantity: String(item.quantity ?? 0),
      unit: item.unit || "units",
      min_stock_level: String(item.min_stock_level ?? 10),
      price_per_unit: String(item.price_per_unit ?? 0),
      batch_number: item.batch_number || "",
      expiry_date: item.expiry_date || "",
      vendor_id: item.vendor_id ? String(item.vendor_id) : "",
    } : blank);
  }, [open, item]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      category: form.category,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit.trim() || "units",
      min_stock_level: parseFloat(form.min_stock_level) || 0,
      price_per_unit: parseFloat(form.price_per_unit) || 0,
      batch_number: form.batch_number.trim() || null,
      expiry_date: form.expiry_date || null,
      vendor_id: form.vendor_id ? parseInt(form.vendor_id) : null,
    });
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={item ? "Edit stock item" : "Add stock item"}
      subtitle="General consumables, equipment and supplies"
      onSubmit={submit}
      submitting={submitting}
      submitLabel={item ? "Update item" : "Add item"}
    >
      <Field label="Item name">
        <TextInput required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Composite Kit" />
      </Field>
      <Field label="Category">
        <SelectInput value={form.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectInput>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity">
          <TextInput type="number" min="0" step="any" required value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
        </Field>
        <Field label="Unit">
          <TextInput value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="units, ml, box" />
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
        <Field label="Expiry date (optional)">
          <TextInput type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
        </Field>
      </div>
      <Field label="Vendor (optional)">
        <SelectInput value={form.vendor_id} onChange={(e) => set("vendor_id", e.target.value)}>
          <option value="">Unassigned</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </SelectInput>
      </Field>
    </FormDrawer>
  );
};

export default InventoryItemDrawer;
