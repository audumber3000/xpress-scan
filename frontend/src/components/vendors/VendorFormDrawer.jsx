import React, { useState, useEffect } from "react";
import FormDrawer, { Field, TextInput, SelectInput } from "../FormDrawer";

const CATEGORIES = ["General", "Equipment", "Consumables", "Lab Services", "Pharmacy"];

const blank = {
  name: "", category: "General", contact_name: "", email: "", phone: "", address: "", gst_number: "",
};

const VendorFormDrawer = ({ open, onClose, onSubmit, submitting, vendor }) => {
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!open) return;
    setForm(vendor ? {
      name: vendor.name || "",
      category: vendor.category || "General",
      contact_name: vendor.contact_name || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      gst_number: vendor.gst_number || "",
    } : blank);
  }, [open, vendor]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, name: form.name.trim() });
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={vendor ? "Edit vendor" : "Add vendor"}
      subtitle="Your supply partners"
      onSubmit={submit}
      submitting={submitting}
      submitLabel={vendor ? "Update vendor" : "Save vendor"}
    >
      <Field label="Company name">
        <TextInput required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. DentalSource Inc." />
      </Field>
      <Field label="Category">
        <SelectInput value={form.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectInput>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact person">
          <TextInput value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <Field label="Email">
        <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="GST number">
        <TextInput value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} />
      </Field>
      <Field label="Address">
        <textarea
          rows="2"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:bg-white focus:ring-2 focus:ring-[#2a276e]/20 transition-colors"
        />
      </Field>
    </FormDrawer>
  );
};

export default VendorFormDrawer;
