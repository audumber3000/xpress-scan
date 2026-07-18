import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { X, UploadCloud, Download, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../utils/api";
import { getCurrencySymbol } from "../../../utils/currency";

/*
 * ON-REQUEST IMPORT — TEMPORARY / DISPOSABLE.
 * Purpose-built importer for one clinic's combined patient + payments sheet.
 * One row -> a patient + a finalized invoice + its partial payments. Delete this
 * whole folder to remove the accommodation; core invoicing is unaffected.
 */

const PAY_PAIRS = Array.from({ length: 10 }, (_, i) => i + 1);
const TEMPLATE_HEADERS = [
  "Patient ID", "Patient Name", "Village", "Mobile", "Doctor", "Tooth No.",
  "Procedure", "Start Date", "Total Amount",
  ...PAY_PAIRS.flatMap((n) => [`Pay ${n} Date`, `Pay ${n} Amount`]),
  "Total Paid", "Balance", "Status", "Remarks",
];
const EXAMPLE_ROW = [
  "P-101", "Ramesh Patil", "Shirur", "9876543210", "Dr. Sharma", "46",
  "Root Canal", "05-01-2024", "5000",
  "10-01-2024", "1000", "25-01-2024", "1500", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  "2500", "2500", "Ongoing", "Patient paying in parts",
];

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString("en-IN")}`;
const norm = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Build one import row from a parsed CSV record (keyed by original headers).
const toRow = (raw) => {
  const get = (label) => {
    const key = Object.keys(raw).find((k) => norm(k) === norm(label));
    return key ? String(raw[key] ?? "").trim() : "";
  };
  const payments = [];
  for (const n of PAY_PAIRS) {
    const amount = parseFloat(get(`Pay ${n} Amount`));
    if (amount > 0) payments.push({ date: get(`Pay ${n} Date`) || null, amount });
  }
  const totalPaidRaw = get("Total Paid");
  return {
    patient_ref: get("Patient ID") || null,
    name: get("Patient Name") || get("Name"),
    village: get("Village") || null,
    mobile: get("Mobile") || get("Phone"),
    doctor: get("Doctor") || null,
    tooth: get("Tooth No.") || get("Tooth") || null,
    procedure: get("Procedure") || null,
    start_date: get("Start Date") || null,
    total_amount: parseFloat(get("Total Amount")) || 0,
    remarks: get("Remarks") || null,
    sheet_total_paid: totalPaidRaw !== "" ? parseFloat(totalPaidRaw) : null,
    payments,
  };
};

const rowProblems = (r) => {
  const p = [];
  if (!r.name) p.push("Name required");
  if (!r.mobile) p.push("Mobile required");
  return p;
};

const PaymentsSheetImporter = ({ open, onClose, onImported }) => {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const reset = () => { setRows([]); setFileName(""); setResult(null); };
  const close = () => { if (!importing) { reset(); onClose(); } };

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: TEMPLATE_HEADERS, data: [EXAMPLE_ROW] });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = "patients-payments-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        const parsed = (res.data || [])
          .map(toRow)
          .filter((r) => r.name || r.mobile || r.patient_ref)
          .map((r) => ({ data: r, problems: rowProblems(r) }));
        setRows(parsed);
        setParsing(false);
        if (parsed.length === 0) toast.error("No rows found. Check the file has a header row.");
      },
      error: (err) => { setParsing(false); toast.error(`Couldn't read that file: ${err.message}`); },
    });
  };

  const valid = rows.filter((r) => r.problems.length === 0);

  const runImport = async () => {
    if (valid.length === 0) return;
    setImporting(true);
    try {
      const res = await api.post("/on-request-import/patients-payments", {
        rows: valid.map((r) => r.data),
      });
      setResult(res);
      toast.success(`Imported ${res.invoices_created} invoice(s)`);
      onImported?.();
    } catch (e) {
      toast.error(e?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Import patients and payments</h3>
              <p className="text-xs text-gray-500">Each row becomes a patient and an invoice with its part payments</p>
            </div>
          </div>
          <button onClick={close} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-40" disabled={importing}>
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {result ? (
            <div className="text-center py-8">
              <CheckCircle2 size={44} className="text-green-500 mx-auto mb-3" />
              <h4 className="text-lg font-bold text-gray-900">Import complete</h4>
              <p className="text-sm text-gray-600 mt-1">
                {result.invoices_created} invoice(s) created. {result.patients_created} new patient(s), {result.patients_matched} matched.
              </p>
              {result.warnings?.length > 0 && (
                <div className="mt-4 text-left max-w-lg mx-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">{result.warnings.length} reconciliation note(s):</p>
                  <ul className="text-xs text-amber-700 space-y-0.5 max-h-40 overflow-y-auto">
                    {result.warnings.map((w, i) => <li key={i}>Row {w.row}: {w.message}</li>)}
                  </ul>
                </div>
              )}
              {result.errors?.length > 0 && (
                <div className="mt-3 text-left max-w-lg mx-auto rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">{result.errors.length} row(s) skipped:</p>
                  <ul className="text-xs text-red-600 space-y-0.5 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : rows.length === 0 ? (
            <>
              <ol className="space-y-3 text-sm text-gray-700 mb-5">
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2a276e] text-white text-xs font-bold flex items-center justify-center">1</span><span>Download the template. It has one row per procedure, with up to 10 part payments.</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2a276e] text-white text-xs font-bold flex items-center justify-center">2</span><span>Fill it in. <strong>Patient Name</strong> and <strong>Mobile</strong> are required. Same Patient ID across rows means the same patient with several invoices. Dates are DD-MM-YYYY.</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2a276e] text-white text-xs font-bold flex items-center justify-center">3</span><span>Save as .csv and upload it here. You will see a preview before anything is saved.</span></li>
              </ol>
              <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 mb-5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
                <Download size={16} className="text-[#2a276e]" /> Download template
              </button>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-[#2a276e] hover:bg-gray-50"
              >
                <UploadCloud size={32} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{parsing ? "Reading file..." : "Click to choose a CSV file, or drag it here"}</span>
                <span className="text-xs text-gray-400">.csv files only</span>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900 truncate">{fileName}</span>
                <button onClick={reset} className="text-sm text-[#2a276e] hover:underline font-medium">Choose a different file</button>
              </div>
              <div className="flex items-center gap-4 mb-3 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-green-600"><CheckCircle2 size={16} /> {valid.length} ready</span>
                {rows.length - valid.length > 0 && <span className="flex items-center gap-1.5 font-semibold text-red-500"><AlertCircle size={16} /> {rows.length - valid.length} will be skipped</span>}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[46vh] overflow-auto">
                  <table className="text-sm whitespace-nowrap min-w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {["", "Patient", "Mobile", "Procedure", "Total", "Payments", "Paid", "Issue"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => {
                        const paid = r.data.payments.reduce((s, p) => s + (p.amount || 0), 0);
                        const ok = r.problems.length === 0;
                        return (
                          <tr key={i} className={ok ? "" : "bg-red-50/50"}>
                            <td className="px-3 py-2">{ok ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}</td>
                            <td className="px-3 py-2 text-gray-900">{r.data.name || <span className="text-gray-300">—</span>}{r.data.patient_ref ? <span className="text-gray-400"> · {r.data.patient_ref}</span> : ""}</td>
                            <td className="px-3 py-2 text-gray-600">{r.data.mobile || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600">{r.data.procedure || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{money(r.data.total_amount)}</td>
                            <td className="px-3 py-2 text-gray-600">{r.data.payments.length}</td>
                            <td className="px-3 py-2 text-gray-600">{money(paid)}</td>
                            <td className="px-3 py-2 text-xs text-red-500">{r.problems.join(", ")}</td>
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

        {rows.length > 0 && !result && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Only valid rows will be imported. Existing patients are matched by Patient ID.</p>
            <button
              onClick={runImport}
              disabled={importing || valid.length === 0}
              className="px-5 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50"
            >
              {importing ? "Importing..." : `Import ${valid.length} row(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsSheetImporter;
