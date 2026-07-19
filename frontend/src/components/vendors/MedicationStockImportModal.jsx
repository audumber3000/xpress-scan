import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { X, Pill, Table2, UploadCloud, Download, CheckCircle2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../utils/api";

/*
 * Bulk-add medication stock. Two ways in:
 *  - "From your medication list": pulls the clinic's Control Center medications
 *    so names aren't retyped; you add the stock-only details (qty, expiry, ...).
 *  - "Enter manually": blank rows.
 * Posts to /medication-stock/bulk.
 */
const FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Gel", "Drops", "Ointment", "Powder", "Other"];
const cell = "w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-[#2a276e] focus:border-[#2a276e]";

const emptyRow = () => ({ name: "", generic_name: "", strength: "", form: "Tablet", quantity: "0", unit: "strip", price_per_unit: "0", batch_number: "", expiry_date: "", vendor_id: "" });

// CSV header label -> row field.
const CSV_COLUMNS = [
  ["Brand / Name", "name"], ["Generic", "generic_name"], ["Strength", "strength"], ["Form", "form"], ["Quantity", "quantity"],
  ["Unit", "unit"], ["Price", "price_per_unit"], ["Batch", "batch_number"], ["Expiry", "expiry_date"],
];
const norm = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const MedicationStockImportModal = ({ open, onClose, onImported, vendors = [] }) => {
  const [mode, setMode] = useState(null);       // null | 'catalog' | 'manual' | 'csv'
  const [rows, setRows] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const reset = () => { setMode(null); setRows([]); };
  const close = () => { if (!importing) { reset(); onClose(); } };

  const loadFromCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const meds = await api.get("/medications");
      const seeded = (meds || []).map((m) => ({ ...emptyRow(), name: m.name }));
      if (seeded.length === 0) { toast.info("No medications in Control Center yet."); return; }
      setRows(seeded);
      setMode("catalog");
    } catch {
      toast.error("Could not load your medication list.");
    } finally { setLoadingCatalog(false); }
  };

  const startManual = () => { setRows([emptyRow(), emptyRow(), emptyRow()]); setMode("manual"); };

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: CSV_COLUMNS.map(([l]) => l), data: [["Augmentin 625", "Amoxicillin + Clavulanic acid", "625 mg", "Tablet", "10", "strip", "180", "", "2027-01-31"]] });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = "medication-stock-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSV = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        const parsed = (res.data || []).map((raw) => {
          const r = emptyRow();
          for (const [label, key] of CSV_COLUMNS) {
            const hit = Object.keys(raw).find((k) => norm(k) === norm(label) || norm(k) === norm(key));
            if (hit && String(raw[hit] ?? "").trim()) r[key] = String(raw[hit]).trim();
          }
          return r;
        }).filter((r) => r.name);
        if (parsed.length === 0) { toast.error("No rows found. Check the file has a header row."); return; }
        setRows(parsed);
        setMode("csv");
      },
      error: (err) => toast.error(`Couldn't read that file: ${err.message}`),
    });
  };
  const setCell = (i, k, v) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const validRows = rows.filter((r) => r.name.trim());

  const doImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const items = validRows.map((r) => ({
        name: r.name.trim(),
        generic_name: r.generic_name.trim() || null,
        strength: r.strength.trim() || null,
        form: r.form || null,
        quantity: parseFloat(r.quantity) || 0,
        unit: r.unit.trim() || "strip",
        price_per_unit: parseFloat(r.price_per_unit) || 0,
        batch_number: r.batch_number.trim() || null,
        expiry_date: r.expiry_date || null,
        vendor_id: r.vendor_id ? parseInt(r.vendor_id) : null,
      }));
      const res = await api.post("/medication-stock/bulk", { items });
      toast.success(`Added ${res.created_count} medication(s) to stock`);
      if (res.errors?.length) toast.warning(`${res.errors.length} skipped. ${res.errors[0].message}`);
      onImported?.();
      close();
    } catch (e) {
      toast.error(e?.message || "Import failed");
    } finally { setImporting(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Pill size={18} className="text-emerald-600" /></div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Import medications to stock</h3>
              <p className="text-xs text-gray-500">Pull from your medication list, then add stock details like expiry</p>
            </div>
          </div>
          <button onClick={close} disabled={importing} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-40"><X size={20} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {mode === null ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={loadFromCatalog} disabled={loadingCatalog} className="flex flex-col items-start gap-2 p-5 border-[1.5px] border-[#2a276e] rounded-xl text-left bg-[#fafaff] hover:bg-[#2a276e]/5 transition-all disabled:opacity-60">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Pill size={20} className="text-emerald-600" /></div>
                  <span className="text-sm font-bold text-gray-900">{loadingCatalog ? "Loading..." : "From your medication list"}</span>
                  <span className="text-xs text-gray-500">Bring in the medicines from Control Center. Add stock details like quantity and expiry, no retyping.</span>
                </button>
                <button onClick={() => fileRef.current?.click()} className="flex flex-col items-start gap-2 p-5 border border-gray-200 rounded-xl text-left hover:border-[#2a276e] hover:bg-gray-50 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><UploadCloud size={20} className="text-blue-500" /></div>
                  <span className="text-sm font-bold text-gray-900">Upload a CSV</span>
                  <span className="text-xs text-gray-500">Import many medicines from a spreadsheet. Download the template first.</span>
                </button>
                <button onClick={startManual} className="flex flex-col items-start gap-2 p-5 border border-gray-200 rounded-xl text-left hover:border-[#2a276e] hover:bg-gray-50 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><Table2 size={20} className="text-violet-500" /></div>
                  <span className="text-sm font-bold text-gray-900">Enter manually</span>
                  <span className="text-xs text-gray-500">Type several medicines row by row, then add them all together.</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleCSV(e.target.files?.[0])} />
              <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 mt-4 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
                <Download size={16} className="text-[#2a276e]" /> Download CSV template
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">
                  {mode === "catalog" ? "From your medication list" : mode === "csv" ? "CSV upload" : "Manual entry"} · <span className="text-green-600">{validRows.length} ready</span>
                </span>
                <button onClick={reset} className="text-sm text-[#2a276e] hover:underline font-medium">Start over</button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[52vh] overflow-auto">
                  <table className="text-sm whitespace-nowrap min-w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 min-w-[150px]">Brand / Name</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 min-w-[140px]">Generic</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Strength</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Form</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-20">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Unit</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-24">Price</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Batch</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Expiry</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Vendor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => {
                        const ok = r.name.trim();
                        return (
                          <tr key={i} className={ok ? "" : "bg-gray-50/60"}>
                            <td className="px-3 py-1.5 text-center">
                              <button onClick={() => removeRow(i)} title="Remove row" className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                            </td>
                            <td className="px-2 py-1.5">
                              <input className={cell} value={r.name} onChange={(e) => setCell(i, "name", e.target.value)} placeholder="Brand / name" />
                            </td>
                            <td className="px-2 py-1.5"><input className={cell} value={r.generic_name} onChange={(e) => setCell(i, "generic_name", e.target.value)} placeholder="Generic (optional)" /></td>
                            <td className="px-2 py-1.5"><input className={cell} value={r.strength} onChange={(e) => setCell(i, "strength", e.target.value)} placeholder="625 mg" /></td>
                            <td className="px-2 py-1.5">
                              <select className={cell} value={r.form} onChange={(e) => setCell(i, "form", e.target.value)}>
                                {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5"><input type="number" min="0" className={cell} value={r.quantity} onChange={(e) => setCell(i, "quantity", e.target.value)} /></td>
                            <td className="px-2 py-1.5"><input className={cell} value={r.unit} onChange={(e) => setCell(i, "unit", e.target.value)} placeholder="strip" /></td>
                            <td className="px-2 py-1.5"><input type="number" min="0" className={cell} value={r.price_per_unit} onChange={(e) => setCell(i, "price_per_unit", e.target.value)} /></td>
                            <td className="px-2 py-1.5"><input className={cell} value={r.batch_number} onChange={(e) => setCell(i, "batch_number", e.target.value)} /></td>
                            <td className="px-2 py-1.5"><input type="date" className={cell} value={r.expiry_date} onChange={(e) => setCell(i, "expiry_date", e.target.value)} /></td>
                            <td className="px-2 py-1.5">
                              <select className={cell} value={r.vendor_id} onChange={(e) => setCell(i, "vendor_id", e.target.value)}>
                                <option value="">—</option>
                                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#2a276e] text-[#2a276e] text-sm font-semibold rounded-lg hover:bg-[#2a276e]/5"><Plus size={16} /> Add row</button>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-green-500" /> Remove any you don't stock. Expiry and batch are optional but recommended.
                </p>
              </div>
            </>
          )}
        </div>

        {mode !== null && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              {validRows.length === 0 && <><AlertCircle size={14} className="text-amber-500" /> Nothing selected yet</>}
            </p>
            <div className="flex gap-3">
              <button onClick={close} disabled={importing} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancel</button>
              <button onClick={doImport} disabled={importing || validRows.length === 0} className="px-5 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50">
                {importing ? "Importing..." : `Add ${validRows.length} to stock`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicationStockImportModal;
