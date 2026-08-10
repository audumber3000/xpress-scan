import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { X, UploadCloud, Download, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../utils/api";
import { getCurrencySymbol } from "../../../utils/currency";

/*
 * ON-REQUEST IMPORT — TEMPORARY / DISPOSABLE.
 *
 * Purpose-built importer for one clinic's invoice ledger export:
 *   Invoice #, Patient, Total, Discount, Tax, Net Amount, Paid, Status, Date
 *
 * One row -> one finalized invoice on our own numbering, with the sheet's
 * discount applied and its paid amount recorded as a Cash payment. Delete this
 * folder to remove the accommodation; core invoicing is unaffected.
 */

const TEMPLATE_HEADERS = [
  "Invoice #", "Patient", "Total", "Discount", "Tax", "Net Amount", "Paid", "Status", "Date",
];
const EXAMPLE_ROW = [
  "INV-20260810-0002", "ishika sai. P", "14300", "4100", "0", "10200", "10200", "paid", "10/08/2026",
];

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString("en-IN")}`;

// Preview columns, named as they appear in the clinic's own sheet. `num` right
// aligns and formats; everything else renders as typed.
const COLUMNS = [
  { key: "invoice_ref", title: "Invoice #" },
  { key: "patient_name", title: "Patient", required: true },
  { key: "total", title: "Total", num: true, required: true },
  { key: "discount", title: "Discount", num: true },
  { key: "tax", title: "Tax", num: true },
  { key: "net_amount", title: "Net Amount", num: true },
  { key: "paid", title: "Paid", num: true },
  { key: "status", title: "Status" },
  { key: "date", title: "Date" },
];

/**
 * Header matching that survives the export.
 *
 * The real file's headers arrive as `Total (â¹)` — a rupee sign written as UTF-8
 * and read back as Latin-1. Stripping everything that is not a letter or digit
 * makes `Total (₹)`, `Total (â¹)` and `Total` all collapse to `total`, so the
 * importer does not care which encoding the clinic's spreadsheet used.
 */
const norm = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const toRow = (raw) => {
  const get = (label) => {
    const key = Object.keys(raw).find((k) => norm(k) === norm(label));
    return key ? String(raw[key] ?? "").trim() : "";
  };
  const num = (label) => {
    // Amounts can arrive as "1,499.99" or "₹1,499.99".
    const v = get(label).replace(/[^0-9.-]/g, "");
    return v === "" ? 0 : parseFloat(v);
  };
  const net = get("Net Amount");
  return {
    invoice_ref: get("Invoice #") || get("Invoice No") || null,
    patient_name: get("Patient") || get("Patient Name"),
    total: num("Total"),
    discount: num("Discount"),
    tax: num("Tax"),
    net_amount: net === "" ? null : parseFloat(net.replace(/[^0-9.-]/g, "")),
    paid: num("Paid"),
    status: get("Status") || null,
    date: get("Date") || null,
  };
};

const rowProblems = (r) => {
  const out = [];
  if (!r.patient_name) out.push("Patient name is missing");
  if (!(r.total > 0)) out.push("Total must be greater than zero");
  if (r.discount > r.total) out.push("Discount is larger than the total");
  if (r.net_amount != null) {
    const computed = r.total - r.discount + (r.tax || 0);
    if (Math.abs(computed - r.net_amount) > 0.5) {
      out.push(`Net ${r.net_amount} does not match ${r.total} less ${r.discount}`);
    }
  }
  const netForPaid = r.net_amount != null ? r.net_amount : r.total - r.discount;
  if (r.paid > netForPaid + 0.5) out.push("Paid is more than the net amount");
  // DD/MM/YYYY only. A date read the other way round is the one error that
  // never announces itself, so anything else is refused rather than guessed.
  if (r.date && !/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(r.date) && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
    out.push(`Date "${r.date}" is not DD/MM/YYYY`);
  }
  return out;
};

/** Rows sharing a name are one patient. Mirrors normalise_name on the server. */
const nameKey = (s) =>
  String(s || "").replace(/\((camp|fd)\)/gi, " ").replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();

const InvoiceSheetImporter = ({ onClose, onDone }) => {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const parsed = data.map(toRow).filter((r) => r.patient_name || r.total > 0);
        if (!parsed.length) {
          toast.error("No usable rows found. Check the column names against the template.");
          return;
        }
        setRows(parsed);
      },
      error: () => toast.error("Could not read that file"),
    });
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: TEMPLATE_HEADERS, data: [EXAMPLE_ROW] });
    // BOM so Excel opens the rupee sign as UTF-8 rather than mangling it.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoice-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const valid = rows.filter((r) => rowProblems(r).length === 0);
  const invalid = rows.filter((r) => rowProblems(r).length > 0);
  const patientCount = new Set(valid.map((r) => nameKey(r.patient_name))).size;
  const netTotal = valid.reduce((s, r) => s + (r.net_amount ?? r.total - r.discount), 0);
  const paidTotal = valid.reduce((s, r) => s + r.paid, 0);

  const runImport = async () => {
    if (!valid.length) return;
    setBusy(true);
    try {
      const res = await api.post("/on-request-import/invoice-sheet", { rows: valid });

      // Same shape as the Standard tab: one success toast, warnings for anything
      // that needs following up, then reset and close. An in-modal result screen
      // would be the only place in this flow that behaves differently.
      toast.success(
        `Imported ${res.invoices_created} invoices for ${res.patients_created} patients`
      );
      if (res.skipped > 0) {
        toast.info(`${res.skipped} rows were already imported earlier and were skipped.`);
      }
      if (res.patients_created > 0) {
        toast.warning(
          `${res.patients_created} patients were saved with the placeholder number 0000000000. Add real numbers before sending reminders.`
        );
      }
      if (res.errors?.length > 0) {
        toast.warning(`${res.errors.length} rows could not be saved. ${res.errors[0].message}`);
      }

      setRows([]);
      setFileName("");
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e?.message || "Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl w-full ${rows.length > 0 ? "max-w-6xl" : "max-w-3xl"} max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="flex items-start justify-between gap-3 px-5 md:px-6 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">Import invoices from a sheet</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              One row per invoice. Patients are created from the names in the file.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5">
          {rows.length === 0 ? (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-12 flex flex-col items-center gap-3 hover:border-[#2a276e]/40 hover:bg-gray-50 transition-colors"
              >
                <UploadCloud size={28} className="text-gray-400" />
                <span className="text-sm font-bold text-gray-700">Choose a CSV file</span>
                <span className="text-xs text-gray-400">Invoice #, Patient, Total, Discount, Tax, Net Amount, Paid, Status, Date</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                onClick={downloadTemplate}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#2a276e] hover:underline"
              >
                <Download size={14} /> Download the template
              </button>

              <div className="mt-5 rounded-xl border border-gray-200 p-4 text-xs text-gray-600 leading-relaxed space-y-1.5">
                <p className="font-bold text-gray-800">How this import behaves</p>
                <p>Invoice numbers and patient IDs are generated on your own sequence. The sheet&apos;s invoice number is kept only so the same file cannot be imported twice.</p>
                <p>Dates are read as <b>DD/MM/YYYY</b>, so 10/08/2026 is 10 August.</p>
                <p>Payments are recorded as <b>Cash</b>, because the sheet does not say how the money arrived.</p>
                <p>Patients are created fresh from the names in the file. Rows sharing a name become one patient, and nothing is matched against your existing records.</p>
                <p>Without a phone column, patients are saved with <b>0000000000</b> so you can find and fix them later.</p>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: preview. Same shape as the Standard tab's CSV review:
                  filename, a ready/skipped line, then a scrollable table with a
                  status column pinned left and the reason in the last column. */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600 truncate">
                  <span className="font-medium text-gray-900">{fileName}</span>
                </div>
                <button
                  onClick={() => { setRows([]); setFileName(""); }}
                  className="text-sm text-[#2a276e] hover:underline font-medium flex-shrink-0"
                >
                  Choose a different file
                </button>
              </div>

              <div className="flex items-center gap-4 mb-3 text-sm flex-wrap">
                <span className="flex items-center gap-1.5 font-semibold text-green-600">
                  <CheckCircle2 size={16} /> {valid.length} ready
                </span>
                {invalid.length > 0 && (
                  <span className="flex items-center gap-1.5 font-semibold text-red-500">
                    <AlertCircle size={16} /> {invalid.length} will be skipped
                  </span>
                )}
                <span className="text-gray-400">
                  {patientCount} patients · {money(netTotal)} billed · {money(paidTotal)} collected
                  {netTotal - paidTotal > 0.5 && ` · ${money(netTotal - paidTotal)} outstanding`}
                </span>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  This creates <b>{patientCount} new patients</b> with the placeholder phone
                  number <b>0000000000</b>, because the sheet has none. Nothing is matched
                  against your existing records, so anyone already in MolarPlus will end up
                  with two entries.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[42vh] overflow-auto">
                  <table className="text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 w-10 md:sticky md:left-0 bg-gray-50"></th>
                        {COLUMNS.map((c) => (
                          <th
                            key={c.key}
                            className={`px-3 py-2 font-semibold text-gray-500 ${c.num ? "text-right" : "text-left"}`}
                          >
                            {c.title}
                            {c.required && <span className="text-red-400"> *</span>}
                          </th>
                        ))}
                        {/* Pinned right the way the status icon is pinned left:
                            with nine data columns the table scrolls, and the
                            reason a row is being skipped is the last thing that
                            should be the one to slide off screen. */}
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 md:sticky md:right-0 bg-gray-50 md:min-w-[13rem]">Issue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => {
                        const problems = rowProblems(r);
                        const ok = problems.length === 0;
                        return (
                          <tr key={i} className={ok ? "" : "bg-red-50/50"}>
                            <td className={`px-3 py-2 md:sticky md:left-0 ${ok ? "bg-white" : "bg-red-50"}`}>
                              {ok
                                ? <CheckCircle2 size={16} className="text-green-500" />
                                : <AlertCircle size={16} className="text-red-400" />}
                            </td>
                            {COLUMNS.map((c) => {
                              const val = r[c.key];
                              const empty = val === null || val === undefined || val === "";
                              return (
                                <td
                                  key={c.key}
                                  className={`px-3 py-2 text-gray-600 ${c.num ? "text-right tabular-nums" : ""}`}
                                  title={empty ? "" : String(val)}
                                >
                                  {empty
                                    ? <span className="text-gray-300">—</span>
                                    : c.num
                                      ? money(val)
                                      : String(val).length > 20 ? `${String(val).slice(0, 20)}…` : String(val)}
                                </td>
                              );
                            })}
                            <td className={`px-3 py-2 text-xs text-red-500 whitespace-normal md:min-w-[13rem] md:sticky md:right-0 ${ok ? "bg-white" : "bg-red-50"}`}>
                              {problems.join(", ")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="px-5 md:px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              onClick={runImport}
              disabled={busy || !valid.length}
              className="px-5 py-2.5 min-h-[2.75rem] rounded-lg bg-[#2a276e] hover:bg-[#1f1d52] text-white text-sm font-bold transition-colors disabled:bg-gray-100 disabled:text-gray-400"
            >
              {busy ? "Importing..." : `Import ${valid.length} invoices`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceSheetImporter;
