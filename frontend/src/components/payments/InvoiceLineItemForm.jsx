import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Check, CornerDownLeft } from "lucide-react";
import { api } from "../../utils/api";
import { getCurrencySymbol } from "../../utils/currency";
import { useIsDentalPatient } from '../../utils/casePaper';

/**
 * The add-a-line bar at the foot of an invoice's items.
 *
 * It used to be a tall card: a type switch, then a labelled field per row, then
 * the maths, then two buttons — about 380px of drawer for one line, opened by a
 * separate "Add Item" click and closed again after every save. Billing five
 * procedures meant opening it five times. It is now a single row that stays
 * docked under the table, keyboard-first: type, Tab across, Enter to add, and
 * the cursor comes back to the search box ready for the next one.
 *
 * What did not change, deliberately:
 *  - the catalogue picker and the description are one field. Type to filter,
 *    and whatever ends up in the box IS the description, so a custom item is
 *    simply something that is not in the catalogue.
 *  - price stays editable after a pick — how a clinic gives a one-off rate
 *    without touching its price list.
 *  - what is sent to `onSave` is exactly what the old form sent, so the invoice
 *    routes see no difference at all.
 *
 * `From stock` is a fifth source rather than a separate panel: picking a
 * medicine there bills it AND deducts it from Medication Stock, which is what
 * the old "+ From stock" panel did beside this form.
 */
const TYPES = [
  { id: "Treatment", label: "Treatment" },
  { id: "Medication", label: "Medication" },
  { id: "Product", label: "Inventory" },
  { id: "Stock", label: "From stock" },
  { id: "Custom", label: "Custom" },
];

const PRESET_COUNT = 3;

const InvoiceLineItemForm = ({ lineItem, onSave, onCancel, patient = null }) => {
  const isDental = useIsDentalPatient(patient);
  const [itemType, setItemType] = useState("Treatment");

  const [treatments, setTreatments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medStock, setMedStock] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  // Free text, not a tooth picker. A line is as often "upper right quadrant" or
  // "full arch" as it is a single FDI number, and a 32-box chart cannot say those.
  const [toothNumber, setToothNumber] = useState("");
  const [picked, setPicked] = useState(null);   // the catalogue entry, if any
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [errors, setErrors] = useState({});
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  const currency = getCurrencySymbol();
  const isEditing = !!lineItem;
  const isCustom = itemType === "Custom";
  const isStock = itemType === "Stock";

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        // Every catalogue catches its own failure: one 403 must not empty the
        // other three lists with nothing on screen to say why.
        const [treatmentData, inventoryData, medicationData, stockData] = await Promise.all([
          api.get("/treatment-types").catch(() => []),
          api.get("/inventory").catch(() => []),
          api.get("/medications/").catch(() => []),
          api.get("/medication-stock").catch(() => []),
        ]);
        setTreatments(Array.isArray(treatmentData) ? treatmentData : []);
        setInventory(Array.isArray(inventoryData) ? inventoryData : (inventoryData.items || []));
        setMedications(Array.isArray(medicationData) ? medicationData : []);
        setMedStock(Array.isArray(stockData) ? stockData : []);
      } catch (err) {
        console.error("Error fetching line item options", err);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  // Editing loads the row into the bar. Custom, because an existing line has
  // no memory of which catalogue it came from.
  useEffect(() => {
    if (!lineItem) return;
    setDescription(lineItem.description || "");
    setQuantity(String(lineItem.quantity ?? 1));
    setUnitPrice(String(lineItem.unit_price ?? ""));
    setToothNumber(lineItem.tooth_number || "");
    setItemType("Custom");
    setPicked(null);
    setErrors({});
    searchRef.current?.focus();
  }, [lineItem]);

  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // One shape for every catalogue, so the list and the presets render alike.
  const catalogue = useMemo(() => {
    if (itemType === "Treatment") {
      return treatments.map((t) => ({ id: t.id, name: t.name, price: Number(t.price || 0) }));
    }
    if (itemType === "Medication") {
      return medications.map((m) => ({
        id: m.id, name: `${m.name} ${m.dosage || ""}`.trim(), price: Number(m.unit_price || 0),
      }));
    }
    if (itemType === "Product") {
      return inventory.map((p) => ({ id: p.id, name: p.name, price: Number(p.price_per_unit || 0) }));
    }
    if (itemType === "Stock") {
      return medStock.map((m) => ({
        id: m.id,
        name: m.name + (m.strength ? ` ${m.strength}` : ""),
        price: Number(m.price_per_unit || 0),
        meta: `${m.quantity} ${m.unit || ""} left`.replace(/\s+/g, " ").trim(),
        stockId: m.id,
      }));
    }
    return [];
  }, [itemType, treatments, medications, inventory, medStock]);

  const matches = useMemo(() => {
    const q = description.trim().toLowerCase();
    const list = q ? catalogue.filter((c) => (c.name || "").toLowerCase().includes(q)) : catalogue;
    return list.slice(0, 40);
  }, [catalogue, description]);

  const qtyNum = parseFloat(quantity);
  const priceNum = parseFloat(unitPrice);
  const amount = (Number.isFinite(qtyNum) ? qtyNum : 0) * (Number.isFinite(priceNum) ? priceNum : 0);

  const money = (n) =>
    `${currency}${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const clearError = (name) => {
    if (errors[name]) setErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  };

  const reset = () => {
    setDescription("");
    setQuantity("1");
    setUnitPrice("");
    setToothNumber("");
    setPicked(null);
    setErrors({});
    setOpen(false);
  };

  const choose = (item) => {
    setDescription(item.name);
    setUnitPrice(String(item.price ?? 0));
    setPicked(item);
    setOpen(false);
    setErrors({});
  };

  const onTypeChange = (id) => {
    setItemType(id);
    setDescription("");
    setUnitPrice("");
    setPicked(null);
    setOpen(false);
    setErrors({});
    searchRef.current?.focus();
  };

  // The payload is built exactly as each old path built it: a stock line is
  // what the "+ From stock" panel sent, everything else is what the form sent.
  const payloadFor = (desc, qty, price, tooth, stockId) => (
    stockId
      ? { description: desc, quantity: qty, unit_price: price, medication_stock_id: stockId }
      : {
        description: desc,
        tooth_number: tooth || null,
        quantity: qty,
        unit_price: price,
        amount: qty * price,
      }
  );

  const commit = async (payload) => {
    setSaving(true);
    try {
      await onSave(payload);
      if (!isEditing) {
        reset();
        // Straight back to the search box: the next line is usually a second
        // procedure on the same visit, and reaching for the mouse between them
        // is what made billing five lines slow.
        searchRef.current?.focus();
      }
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    const e = {};
    if (!description.trim()) e.description = "Pick an item or type a description";
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) e.quantity = "Quantity above zero";
    if (unitPrice === "" || !Number.isFinite(priceNum) || priceNum < 0) e.unitPrice = "Enter a price";
    if (isStock && !picked) e.description = "Pick a medicine from stock";
    if (Object.keys(e).length) { setErrors(e); return; }
    commit(payloadFor(description.trim(), qtyNum, priceNum, toothNumber.trim(),
                      isStock ? picked?.stockId : null));
  };

  // One-tap presets: the first few from the list being shown. They add at the
  // catalogue price, quantity one — the common case — and the row can still be
  // edited afterwards.
  const presets = (!isEditing && !isCustom) ? catalogue.slice(0, PRESET_COUNT) : [];
  const addPreset = (item) => commit(payloadFor(item.name, 1, item.price, "", isStock ? item.stockId : null));

  const onSearchKeyDown = (e) => {
    if (!open && !isCustom && e.key === "ArrowDown") { e.preventDefault(); setOpen(true); return; }
    if (open && !isCustom && matches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, matches.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); return; }
      if (e.key === "Enter") { e.preventDefault(); choose(matches[highlight]); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Escape" && isEditing) onCancel?.();
  };

  // Enter anywhere in the row adds the line.
  const onFieldKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Escape" && isEditing) onCancel?.();
  };

  const field = (name) =>
    `h-10 w-full px-3 bg-white border rounded-lg text-sm outline-none transition-colors focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/15 ${
      errors[name] ? "border-red-400 bg-red-50" : "border-gray-200"
    }`;

  const firstError = errors.description || errors.quantity || errors.unitPrice;

  return (
    <div className={`border-t px-3 sm:px-4 py-3 space-y-3 ${isEditing ? "bg-[#2a276e]/[0.03] border-[#2a276e]/20" : "bg-[#f8fafc] border-gray-200"}`}>

      {/* Row one: where the line comes from on the left, the quickest ones to
          add pinned to the right end of the same line. They never wrap under
          the switch on a desktop — a second line of chips is exactly the
          clutter this bar exists to remove. On a phone there is no room for
          both, so the chips take their own line underneath. */}
      <div className="flex flex-col md:flex-row md:items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider shrink-0">
            {isEditing ? "Editing line" : "Add line"}
          </span>
          {isEditing ? (
            // The only way out of edit mode besides Escape and the row's pencil,
            // now that the bar has no X.
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="text-[11px] font-semibold text-gray-500 hover:text-[#2a276e] underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          ) : (
            // Scrolls sideways on a narrow phone rather than overflowing the
            // card: five tabs do not fit in 320px, and squashing them would
            // make each one too small to tap.
            <div className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                {TYPES.filter((t) => t.id !== "Stock" || medStock.length > 0).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTypeChange(t.id)}
                    className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      itemType === t.id ? "bg-white text-[#2a276e] shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {presets.length > 0 && (
          // Shows as many whole chips as fit and drops the rest — never half a
          // chip. The row wraps, but the box is one chip tall, so a chip that
          // does not fit falls to a second line nobody sees. Right-aligned from
          // `md` up, where it shares the line with the switch; left-aligned on
          // a phone, where it has a line of its own.
          <div className="min-w-0 md:flex-1 h-7 overflow-hidden">
            <div className="flex flex-wrap md:justify-end items-center gap-x-1 gap-y-2">
              <span className="h-7 inline-flex items-center text-[11px] text-gray-400 whitespace-nowrap mr-0.5">Quick:</span>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={saving}
                  onClick={() => addPreset(p)}
                  title={`Add ${p.name} at ${money(p.price)}`}
                  className="h-7 inline-flex items-center gap-0.5 px-1 rounded-md border border-gray-200 bg-white text-[11px] font-medium text-gray-700 hover:border-[#2a276e]/40 hover:text-[#2a276e] whitespace-nowrap disabled:opacity-50 transition-colors"
                >
                  <Plus size={11} className="shrink-0" />
                  <span className="max-w-[7.5rem] truncate">{p.name}</span>
                  <span className="text-gray-400">({money(p.price).replace(/\.00$/, "")})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row two: the line itself, laid out for the screen it is on.
          Phone:   item, tooth, then qty · price · total, then a full-width Add.
          Tablet:  item + tooth, then qty · price · total · Add.
          Desktop: one row, left to right, in the order you Tab through it.
          A six-column grid below `lg`, a flex row from `lg` up. One row at 820px
          ran about 20px wider than the card and pushed Add item off its edge. */}
      <div className="grid grid-cols-6 gap-2 lg:flex lg:items-center">
        <div ref={wrapRef} className={`relative col-span-6 ${isStock ? "sm:col-span-6" : "sm:col-span-4"} lg:flex-1 lg:min-w-[12rem]`}>
          {!isCustom && (
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
          <input
            ref={searchRef}
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setPicked(null);
              setHighlight(0);
              clearError("description");
              if (!isCustom) setOpen(true);
            }}
            // Opens on a click or on typing — not on focus. Focus comes back
            // here automatically after every add, and a list springing open
            // each time sat on top of the preset row above it.
            onClick={() => !isCustom && setOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder={
              isCustom ? "Describe this charge"
                : loadingOptions ? "Loading…"
                  : isStock ? "Search stock…"
                    : `Search ${itemType === "Product" ? "inventory" : itemType === "Treatment" ? "treatments" : "medications"}…`
            }
            // No autoFocus. The bar is always on screen now, so autofocus fired
            // every time an invoice opened — and on a phone that means the
            // keyboard springing up over the bill before anyone asked to add a
            // line. Focus moves here after an add, a tab change or an edit.
            aria-label="Item"
            className={`${field("description")} ${!isCustom ? "pl-9" : ""} ${picked ? "pr-9" : ""}`}
          />
          {picked && (
            <Check className="h-4 w-4 text-green-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}

          {open && !isCustom && (
            <div className="absolute z-30 left-0 top-full mt-1 w-full lg:w-[26rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
              {/* Its own width from `md` up, not the search box's: tied to the
                  box it came out at about 190px and cut every treatment name in
                  half. On a phone the box is already full width, so it matches
                  it. It drops down, as the old list did. */}
              {matches.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-500">
                  {isStock
                    ? "Nothing in stock matches."
                    : description.trim()
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
                    className={`w-full text-left px-3 py-2.5 md:py-2 flex items-center justify-between gap-4 transition-colors ${
                      i === highlight ? "bg-[#2a276e]/5" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="min-w-0">
                      {/* Wraps rather than truncates: the whole point of the list
                          is to tell two similar treatments apart. */}
                      <span className="block text-sm text-gray-900 break-words">{m.name}</span>
                      {m.meta && <span className="block text-[11px] text-gray-400">{m.meta}</span>}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 shrink-0 tabular-nums">{money(m.price)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {!isStock && (
          <input
            type="text"
            value={toothNumber}
            onChange={(e) => setToothNumber(e.target.value)}
            onKeyDown={onFieldKeyDown}
            placeholder={isDental ? "Tooth / area" : "Area / site"}
            maxLength={50}
            aria-label={isDental ? "Tooth or area" : "Area or site"}
            className={`${field("tooth")} col-span-6 sm:col-span-2 lg:w-32 lg:shrink-0`}
          />
        )}

        <input
          type="number"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => { setQuantity(e.target.value); clearError("quantity"); }}
          onKeyDown={onFieldKeyDown}
          min="0"
          step="any"
          aria-label="Quantity"
          className={`${field("quantity")} col-span-2 sm:col-span-1 lg:w-16 lg:shrink-0 text-center tabular-nums`}
        />

        <div className="relative col-span-2 lg:w-28 lg:shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
            {currency}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => { setUnitPrice(e.target.value); setPicked((p) => (isStock ? p : null)); clearError("unitPrice"); }}
            onKeyDown={onFieldKeyDown}
            min="0"
            step="any"
            placeholder="0.00"
            aria-label="Unit price"
            className={`${field("unitPrice")} pl-7 text-right tabular-nums`}
          />
        </div>

        {/* The line's total, as it will appear in the table above. */}
        <div className="col-span-2 sm:col-span-1 lg:shrink-0 h-10 px-2 sm:px-3 rounded-lg border border-gray-200 bg-white flex flex-col justify-center items-end lg:min-w-[6.5rem] min-w-0">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">Line total</span>
          <span className="text-sm font-bold text-gray-900 tabular-nums leading-tight">{money(amount)}</span>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="col-span-6 sm:col-span-2 lg:shrink-0 h-11 sm:h-10 inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-[#2a276e] hover:bg-[#1a1548] text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60 transition-colors"
        >
          {isEditing ? <Check size={15} /> : <Plus size={15} />}
          {isEditing ? "Update" : "Add item"}
          {/* A keyboard hint means nothing on a touchscreen. */}
          <kbd className="hidden lg:inline-flex items-center justify-center w-5 h-5 rounded bg-white/15 text-white/80">
            <CornerDownLeft size={11} />
          </kbd>
        </button>
      </div>

      {/* Said once, under the row, rather than squeezed beneath each narrow
          field where it would push the whole row out of line. */}
      {firstError && <p className="text-xs text-red-600 -mt-1">{firstError}</p>}
    </div>
  );
};

export default InvoiceLineItemForm;
