import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Check } from "lucide-react";
import { api } from "../../utils/api";
import { getCurrencySymbol } from "../../utils/currency";

/**
 * Add or edit an invoice line.
 *
 * The catalogue picker and the description are one field, not two. You type to
 * filter the catalogue, and whatever ends up in the box is the description — so
 * editing it is obviously just editing the text, and a custom item is simply
 * something that isn't in the catalogue. The old version showed a dropdown and
 * then repeated the chosen name in a second greyed box, which read as a
 * duplicate and left "which one is the real description?" unanswered.
 *
 * Price stays editable after a catalogue pick on purpose: that is how a clinic
 * gives a one-off rate without editing its price list.
 */
const TYPES = [
  { id: "Treatment", label: "Treatment" },
  { id: "Medication", label: "Medication" },
  { id: "Product", label: "Inventory" },
  { id: "Custom", label: "Custom" },
];

const InvoiceLineItemForm = ({ lineItem, onSave, onCancel }) => {
  const [itemType, setItemType] = useState("Treatment");

  const [treatments, setTreatments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // `description` is the single source of truth for what this line says. The
  // picker writes into it; the user can type over it.
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [pickedFromCatalogue, setPickedFromCatalogue] = useState(false);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [errors, setErrors] = useState({});
  const wrapRef = useRef(null);

  const currency = getCurrencySymbol();
  const isEditing = !!lineItem;
  const isCustom = itemType === "Custom";

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [treatmentData, inventoryData, medicationData] = await Promise.all([
          api.get("/treatment-types"),
          api.get("/inventory").catch(() => []),
          api.get("/medications/").catch(() => []),
        ]);
        setTreatments(Array.isArray(treatmentData) ? treatmentData : []);
        setInventory(Array.isArray(inventoryData) ? inventoryData : (inventoryData.items || []));
        setMedications(Array.isArray(medicationData) ? medicationData : []);
      } catch (err) {
        console.error("Error fetching line item options", err);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (!lineItem) return;
    setDescription(lineItem.description || "");
    setQuantity(String(lineItem.quantity ?? 1));
    setUnitPrice(String(lineItem.unit_price ?? ""));
    setItemType("Custom");
  }, [lineItem]);

  // Close the suggestion list on an outside click.
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // One shape for all three catalogues, so the list renders the same way.
  const catalogue = useMemo(() => {
    if (itemType === "Treatment") {
      return treatments.map((t) => ({ id: t.id, name: t.name, price: Number(t.price || 0) }));
    }
    if (itemType === "Medication") {
      return medications.map((m) => ({
        id: m.id,
        name: `${m.name} ${m.dosage || ""}`.trim(),
        price: Number(m.unit_price || 0),
      }));
    }
    if (itemType === "Product") {
      return inventory.map((p) => ({ id: p.id, name: p.name, price: Number(p.price_per_unit || 0) }));
    }
    return [];
  }, [itemType, treatments, medications, inventory]);

  const matches = useMemo(() => {
    const q = description.trim().toLowerCase();
    const list = q ? catalogue.filter((c) => (c.name || "").toLowerCase().includes(q)) : catalogue;
    return list.slice(0, 40);
  }, [catalogue, description]);

  const setField = (name, value) => {
    if (name === "description") setDescription(value);
    if (name === "quantity") setQuantity(value);
    if (name === "unitPrice") setUnitPrice(value);
    if (errors[name]) setErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  };

  const choose = (item) => {
    setDescription(item.name);
    setUnitPrice(String(item.price ?? 0));
    setPickedFromCatalogue(true);
    setOpen(false);
    setErrors({});
  };

  const onTypeChange = (id) => {
    setItemType(id);
    setDescription("");
    setUnitPrice("");
    setPickedFromCatalogue(false);
    setOpen(false);
    setErrors({});
  };

  const onKeyDown = (e) => {
    if (isCustom || !open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(matches[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const qtyNum = parseFloat(quantity);
  const priceNum = parseFloat(unitPrice);
  const amount = (Number.isFinite(qtyNum) ? qtyNum : 0) * (Number.isFinite(priceNum) ? priceNum : 0);

  const money = (n) =>
    `${currency}${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const validate = () => {
    const e = {};
    if (!description.trim()) e.description = "Pick an item or type a description.";
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) e.quantity = "Enter a quantity above zero.";
    if (unitPrice === "" || !Number.isFinite(priceNum) || priceNum < 0) e.unitPrice = "Enter a price.";
    return e;
  };

  const handleSubmit = (evt) => {
    evt.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    onSave({
      description: description.trim(),
      quantity: qtyNum,
      unit_price: priceNum,
      amount,
    });
  };

  const inputCls = (name) =>
    `w-full px-3 py-2 bg-white border rounded-lg text-sm outline-none transition-colors focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 ${
      errors[name] ? "border-red-400 bg-red-50" : "border-gray-200"
    }`;

  const FieldError = ({ name }) =>
    errors[name] ? <p className="mt-1 text-xs text-red-600">{errors[name]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-4">

      {/* Type — a segmented control, matching the ₹/% toggle on the totals row */}
      {!isEditing && (
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTypeChange(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                itemType === t.id ? "bg-white shadow-sm text-[#2a276e]" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* One field: search the catalogue and hold the description */}
      <div ref={wrapRef}>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
          Item <span className="text-red-500">*</span>
        </label>

        <div className="relative">
          {!isCustom && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
          )}
          <input
            type="text"
            value={description}
            onChange={(e) => {
              setField("description", e.target.value);
              setPickedFromCatalogue(false);
              setHighlight(0);
              if (!isCustom) setOpen(true);
            }}
            onFocus={() => !isCustom && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={
              isCustom
                ? "Describe this charge"
                : loadingOptions
                ? "Loading..."
                : `Search ${itemType === "Product" ? "inventory" : itemType.toLowerCase()} or type your own`
            }
            autoFocus
            className={`${inputCls("description")} ${!isCustom ? "pl-9" : ""} ${pickedFromCatalogue ? "pr-9" : ""}`}
          />
          {pickedFromCatalogue && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Check className="h-4 w-4 text-green-500" />
            </div>
          )}

          {/* Suggestions. Free text is always allowed, so anything not in the
              catalogue simply stays as typed — no separate "custom" step. */}
          {open && !isCustom && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {matches.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-500">
                  {description.trim()
                    ? <>Nothing in your list matches. <span className="text-gray-700 font-medium">"{description.trim()}"</span> will be added as typed.</>
                    : "Nothing in this list yet. Type to add an item of your own."}
                </div>
              ) : (
                matches.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(m)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                      i === highlight ? "bg-[#2a276e]/5" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-sm text-gray-900 truncate">{m.name}</span>
                    <span className="text-xs font-semibold text-gray-500 shrink-0">{money(m.price)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <FieldError name="description" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setField("quantity", e.target.value)}
            min="0"
            step="any"
            className={inputCls("quantity")}
          />
          <FieldError name="quantity" />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Unit price</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-sm text-gray-400 pointer-events-none">
              {currency}
            </span>
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => { setField("unitPrice", e.target.value); setPickedFromCatalogue(false); }}
              min="0"
              step="any"
              placeholder="0.00"
              className={`${inputCls("unitPrice")} pl-8 text-right`}
            />
          </div>
          <FieldError name="unitPrice" />
        </div>
      </div>

      {/* The maths, not just the result — so a wrong quantity is obvious here
          rather than after the line is added. */}
      <div className="flex items-baseline justify-between px-1">
        <span className="text-sm text-gray-500">
          {Number.isFinite(qtyNum) && Number.isFinite(priceNum) && qtyNum > 0
            ? <>{qtyNum} × {money(priceNum)}</>
            : "Amount"}
        </span>
        <span className="text-lg font-bold text-gray-900">{money(amount)}</span>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 px-4 py-2.5 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition-colors text-sm font-semibold"
        >
          {isEditing ? "Update item" : "Add item"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default InvoiceLineItemForm;
