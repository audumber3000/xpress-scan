import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { X, UploadCloud, Download, CheckCircle2, AlertCircle, FileSpreadsheet, Table2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { api, getFriendlyErrorMessage } from "../../utils/api";
import { isValidPhone } from "../../utils/validators";
import { computeAgeFromDob } from "./AgeOrDobField";

// One blank row for the manual-entry table.
const emptyManualRow = () => ({
  name: "", phone: "", age: "", date_of_birth: "", gender: "",
  village: "", treatment_type: "", referred_by: "", registered_at: "",
});

// Columns the importer understands. `key` matches the backend Patient fields.
const COLUMNS = [
  { key: "name", label: "name", required: true },
  { key: "age", label: "age" },
  { key: "date_of_birth", label: "date_of_birth" },
  { key: "gender", label: "gender" },
  { key: "phone", label: "phone", required: true },
  { key: "village", label: "village" },
  { key: "treatment_type", label: "treatment_type" },
  { key: "referred_by", label: "referred_by" },
  { key: "blood_group", label: "blood_group" },
  { key: "patient_history", label: "patient_history" },
  { key: "notes", label: "notes" },
  { key: "registered_at", label: "registered_at" },
];

const TEMPLATE_HEADERS = COLUMNS.map((c) => c.label);
const EXAMPLE_ROW = ["Ravi Kumar", "32", "1992-05-14", "Male", "9876543210", "Pune", "Cleaning", "Dr. Sharma", "B+", "Diabetic", "First visit", "2023-01-20"];

// Validate one parsed row → list of human-readable problems.
const validateRow = (row) => {
  const problems = [];
  if (!String(row.name || "").trim()) problems.push("Name is required");
  if (!isValidPhone(row.phone)) problems.push("Valid phone required");
  return problems;
};

const ImportPatientsModal = ({ isOpen, onClose, onImported }) => {
  const [rows, setRows] = useState([]);          // [{ data, problems }]
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState(null);        // null = choose, 'csv' = CSV, 'manual' = table
  const [manualRows, setManualRows] = useState([emptyManualRow(), emptyManualRow(), emptyManualRow()]);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const reset = () => {
    setRows([]);
    setFileName("");
    setParsing(false);
    setImporting(false);
    setMode(null);
    setManualRows([emptyManualRow(), emptyManualRow(), emptyManualRow()]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Manual-entry table helpers ──────────────────────────────
  const updateManual = (i, field, value) =>
    setManualRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addManualRow = () => setManualRows((prev) => [...prev, emptyManualRow()]);
  const removeManualRow = (i) => setManualRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const manualRowValid = (r) => r.name.trim() && isValidPhone(r.phone);
  const manualValid = manualRows.filter(manualRowValid);

  const buildManualPayload = () =>
    manualValid.map((r) => {
      const out = {
        name: r.name.trim(),
        phone: r.phone.trim(),
        gender: r.gender || undefined,
        village: r.village.trim() || undefined,
        treatment_type: r.treatment_type.trim() || undefined,
        referred_by: r.referred_by.trim() || undefined,
        registered_at: r.registered_at || undefined,
      };
      if (r.date_of_birth) {
        out.date_of_birth = r.date_of_birth;
        const derived = computeAgeFromDob(r.date_of_birth);
        if (derived !== "") out.age = String(derived);
      } else if (r.age) {
        out.age = r.age;
      }
      return out;
    });

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: TEMPLATE_HEADERS, data: [EXAMPLE_ROW] });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "molarplus-patients-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        const parsed = (results.data || []).map((raw) => {
          // Keep only known columns; trim values.
          const data = {};
          COLUMNS.forEach(({ key }) => {
            data[key] = String(raw[key] ?? "").trim();
          });
          return { data, problems: validateRow(data) };
        });
        setRows(parsed);
        setParsing(false);
        if (parsed.length === 0) {
          toast.error("No rows found in that file. Make sure it has a header row and at least one patient.");
        }
      },
      error: (err) => {
        setParsing(false);
        toast.error(`Couldn't read that file: ${err.message}`);
      },
    });
  };

  const validRows = rows.filter((r) => r.problems.length === 0);
  const invalidCount = rows.length - validRows.length;

  const handleImport = async () => {
    const patients = mode === "manual" ? buildManualPayload() : validRows.map((r) => r.data);
    if (patients.length === 0) return;
    setImporting(true);
    try {
      const res = await api.post("/patients/import", { patients });
      toast.success(res.message || `Imported ${res.imported_count} patients`);
      if (res.errors && res.errors.length > 0) {
        toast.warning(`${res.errors.length} row(s) couldn't be saved. ${res.errors[0]}`);
      }
      reset();
      onImported?.();
      onClose();
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err, "Import failed. Please try again."));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${mode === "manual" ? "max-w-6xl" : "max-w-3xl"} max-h-[90vh] flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Add Patients</h3>
              <p className="text-xs text-gray-500">Import from a spreadsheet or add manually</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" disabled={importing}>
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {mode === null ? (
            /* Choose how to add patients */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setMode("csv")}
                className="flex flex-col items-start gap-2 p-5 border border-gray-200 rounded-xl text-left hover:border-[#2a276e] hover:bg-gray-50 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileSpreadsheet size={20} className="text-blue-500" />
                </div>
                <span className="text-sm font-bold text-gray-900">Import from CSV</span>
                <span className="text-xs text-gray-500">Bulk-add many patients from a spreadsheet. Supports back-dated registration.</span>
              </button>
              <button
                onClick={() => setMode("manual")}
                className="flex flex-col items-start gap-2 p-5 border border-gray-200 rounded-xl text-left hover:border-[#2a276e] hover:bg-gray-50 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Table2 size={20} className="text-violet-500" />
                </div>
                <span className="text-sm font-bold text-gray-900">Enter manually in a table</span>
                <span className="text-xs text-gray-500">Type several patients row by row — with age or date of birth — then import them all together.</span>
              </button>
            </div>
          ) : mode === "manual" ? (
            /* Manual entry table */
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setMode(null)}
                  className="text-sm text-[#2a276e] hover:underline font-medium"
                >
                  ← Back
                </button>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                  <CheckCircle2 size={16} /> {manualValid.length} ready to import
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Add one row per patient. <strong>Name</strong> and <strong>Phone</strong> are required.
                Fill either <strong>Age</strong> or <strong>Date of birth</strong>. <strong>Registered on</strong> back-dates the patient.
              </p>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[52vh] overflow-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr className="text-left text-xs font-semibold text-gray-500">
                        <th className="px-2 py-2 w-8"></th>
                        <th className="px-2 py-2 min-w-[140px]">Name *</th>
                        <th className="px-2 py-2 min-w-[120px]">Phone *</th>
                        <th className="px-2 py-2 w-16">Age</th>
                        <th className="px-2 py-2 min-w-[140px]">Date of birth</th>
                        <th className="px-2 py-2 w-24">Gender</th>
                        <th className="px-2 py-2 min-w-[110px]">Village</th>
                        <th className="px-2 py-2 min-w-[120px]">Treatment</th>
                        <th className="px-2 py-2 min-w-[120px]">Referred by</th>
                        <th className="px-2 py-2 min-w-[140px]">Registered on</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {manualRows.map((r, i) => {
                        const touched = r.name.trim() || r.phone.trim();
                        const ok = manualRowValid(r);
                        const cell = "w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#2a276e] text-sm";
                        return (
                          <tr key={i} className={touched && !ok ? "bg-red-50/40" : ""}>
                            <td className="px-2 py-1.5 text-center">
                              {touched ? (ok
                                ? <CheckCircle2 size={15} className="text-green-500 inline" />
                                : <AlertCircle size={15} className="text-red-400 inline" />) : <span className="text-gray-300 text-xs">{i + 1}</span>}
                            </td>
                            <td className="px-1 py-1.5">
                              <input value={r.name} onChange={(e) => updateManual(i, "name", e.target.value)} className={cell} placeholder="Full name" />
                            </td>
                            <td className="px-1 py-1.5">
                              <input value={r.phone} onChange={(e) => updateManual(i, "phone", e.target.value.replace(/[^\d+]/g, ""))} className={cell} placeholder="Phone" />
                            </td>
                            <td className="px-1 py-1.5">
                              <input value={r.age} onChange={(e) => updateManual(i, "age", e.target.value.replace(/\D/g, ""))} className={cell} placeholder="—" maxLength={3} disabled={!!r.date_of_birth} />
                            </td>
                            <td className="px-1 py-1.5">
                              <input type="date" value={r.date_of_birth} max={new Date().toISOString().split("T")[0]} onChange={(e) => updateManual(i, "date_of_birth", e.target.value)} className={cell} />
                            </td>
                            <td className="px-1 py-1.5">
                              <select value={r.gender} onChange={(e) => updateManual(i, "gender", e.target.value)} className={cell}>
                                <option value="">—</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td className="px-1 py-1.5">
                              <input value={r.village} onChange={(e) => updateManual(i, "village", e.target.value)} className={cell} />
                            </td>
                            <td className="px-1 py-1.5">
                              <input value={r.treatment_type} onChange={(e) => updateManual(i, "treatment_type", e.target.value)} className={cell} placeholder="e.g. Cleaning" />
                            </td>
                            <td className="px-1 py-1.5">
                              <input value={r.referred_by} onChange={(e) => updateManual(i, "referred_by", e.target.value)} className={cell} placeholder="Doctor" />
                            </td>
                            <td className="px-1 py-1.5">
                              <input type="date" value={r.registered_at} max={new Date().toISOString().split("T")[0]} onChange={(e) => updateManual(i, "registered_at", e.target.value)} className={cell} />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button onClick={() => removeManualRow(i)} disabled={manualRows.length === 1} className="text-gray-300 hover:text-red-500 disabled:opacity-30">
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={addManualRow}
                className="mt-3 flex items-center gap-2 px-4 py-2 border border-dashed border-[#2a276e] text-[#2a276e] text-sm font-semibold rounded-lg hover:bg-[#2a276e]/5 transition-all"
              >
                <Plus size={16} /> Add another patient
              </button>
            </>
          ) : rows.length === 0 ? (
            <>
              <button
                onClick={() => setMode(null)}
                className="text-sm text-[#2a276e] hover:underline font-medium mb-4"
              >
                ← Back
              </button>
              {/* Step 1: guide + template */}
              <ol className="space-y-3 text-sm text-gray-700 mb-5">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2a276e] text-white text-xs font-bold flex items-center justify-center">1</span>
                  <span>Download our template — it already has the right column headers.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2a276e] text-white text-xs font-bold flex items-center justify-center">2</span>
                  <span>Fill in one patient per row in Excel or Google Sheets. <strong>Name</strong> and <strong>Phone</strong> are required; everything else is optional.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2a276e] text-white text-xs font-bold flex items-center justify-center">3</span>
                  <span>Save as <strong>.csv</strong> and upload it below. You'll get a preview to review before anything is saved.</span>
                </li>
              </ol>

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 mb-5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-all"
              >
                <Download size={16} className="text-[#2a276e]" /> Download template
              </button>

              {/* Upload dropzone */}
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-[#2a276e] hover:bg-gray-50 transition-all"
              >
                <UploadCloud size={32} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  {parsing ? "Reading file..." : "Click to choose a CSV file, or drag it here"}
                </span>
                <span className="text-xs text-gray-400">.csv files only</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
            </>
          ) : (
            <>
              {/* Step 2: preview */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600 truncate">
                  <span className="font-medium text-gray-900">{fileName}</span>
                </div>
                <button onClick={reset} className="text-sm text-[#2a276e] hover:underline font-medium flex-shrink-0">
                  Choose a different file
                </button>
              </div>

              <div className="flex items-center gap-4 mb-3 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-green-600">
                  <CheckCircle2 size={16} /> {validRows.length} ready
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1.5 font-semibold text-red-500">
                    <AlertCircle size={16} /> {invalidCount} will be skipped
                  </span>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[42vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 w-10"></th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Age</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Phone</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Treatment</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Issue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => {
                        const ok = r.problems.length === 0;
                        return (
                          <tr key={i} className={ok ? "" : "bg-red-50/50"}>
                            <td className="px-3 py-2">
                              {ok
                                ? <CheckCircle2 size={16} className="text-green-500" />
                                : <AlertCircle size={16} className="text-red-400" />}
                            </td>
                            <td className="px-3 py-2 text-gray-900">{r.data.name || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600">{r.data.age || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{r.data.phone || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600">{r.data.treatment_type || "—"}</td>
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

        {/* Footer */}
        {((mode === "csv" && rows.length > 0) || mode === "manual") && (() => {
          const count = mode === "manual" ? manualValid.length : validRows.length;
          return (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {mode === "manual"
                ? "Rows without a name or valid phone are skipped."
                : invalidCount > 0 ? "Only valid rows will be imported." : "All rows look good."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={importing}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || count === 0}
                className="px-5 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-all disabled:opacity-50"
              >
                {importing ? "Importing..." : `Import ${count} patient${count === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ImportPatientsModal;
