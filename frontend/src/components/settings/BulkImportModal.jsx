import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { X, UploadCloud, Download, CheckCircle2, AlertCircle, Plus, Trash2, Table2, FileSpreadsheet } from "lucide-react";
import { toast } from "react-toastify";

/*
 * Generic bulk-add modal with two ways in: upload a CSV, or type rows manually
 * in a table. Driven by `columns` = [{ key, label, required, type, placeholder }].
 * Calls onImport(rows) with clean objects; the parent does the API call.
 */
const inputCls = "w-full px-2 py-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-[#2a276e] focus:border-[#2a276e]";
const norm = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const BulkImportModal = ({ open, onClose, onImport, title, columns, importing }) => {
  const [mode, setMode] = useState(null);          // null | 'csv' | 'manual'
  const [rows, setRows] = useState([]);            // parsed/typed rows (objects)
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  const emptyRow = () => Object.fromEntries(columns.map((c) => [c.key, ""]));

  const reset = () => { setMode(null); setRows([]); setFileName(""); };
  const close = () => { if (!importing) { reset(); onClose(); } };

  const rowProblems = (r) => columns.filter((c) => c.required && !String(r[c.key] ?? "").trim()).map((c) => `${c.label} required`);

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: columns.map((c) => c.label), data: [columns.map((c) => c.placeholder || "")] });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        const parsed = (res.data || []).map((raw) => {
          const out = {};
          for (const c of columns) {
            const key = Object.keys(raw).find((k) => norm(k) === norm(c.label) || norm(k) === norm(c.key));
            out[c.key] = key ? String(raw[key] ?? "").trim() : "";
          }
          return out;
        }).filter((r) => Object.values(r).some((v) => v));
        setRows(parsed);
        setMode("csv");
        if (parsed.length === 0) toast.error("No rows found. Check the file has a header row.");
      },
      error: (err) => { toast.error(`Couldn't read that file: ${err.message}`); },
    });
  };

  const startManual = () => { setRows([emptyRow(), emptyRow(), emptyRow()]); setMode("manual"); };
  const setCell = (i, key, val) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const validRows = rows.filter((r) => rowProblems(r).length === 0 && Object.values(r).some((v) => String(v).trim()));

  const doImport = () => {
    if (validRows.length === 0) return;
    onImport(validRows);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2a276e]/10 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-[#2a276e]" />
            </div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
          </div>
          <button onClick={close} disabled={importing} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-40">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {mode === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => fileRef.current?.click()} className="flex flex-col items-start gap-2 p-5 border border-gray-200 rounded-xl text-left hover:border-[#2a276e] hover:bg-gray-50 transition-all">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><UploadCloud size={20} className="text-blue-500" /></div>
                <span className="text-sm font-bold text-gray-900">Upload a CSV</span>
                <span className="text-xs text-gray-500">Import many rows from a spreadsheet. Download the template first.</span>
              </button>
              <button onClick={startManual} className="flex flex-col items-start gap-2 p-5 border border-gray-200 rounded-xl text-left hover:border-[#2a276e] hover:bg-gray-50 transition-all">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><Table2 size={20} className="text-violet-500" /></div>
                <span className="text-sm font-bold text-gray-900">Enter manually</span>
                <span className="text-xs text-gray-500">Type several rows in a table, then add them all together.</span>
              </button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <div className="sm:col-span-2">
                <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
                  <Download size={16} className="text-[#2a276e]" /> Download CSV template
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">
                  {mode === "csv" ? fileName : "Manual entry"} · <span className="text-green-600">{validRows.length} ready</span>
                  {rows.length - validRows.length > 0 && <span className="text-red-500"> · {rows.length - validRows.length} skipped</span>}
                </span>
                <button onClick={reset} className="text-sm text-[#2a276e] hover:underline font-medium">Start over</button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[52vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 w-8"></th>
                        {columns.map((c) => (
                          <th key={c.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{c.label}{c.required && <span className="text-red-400"> *</span>}</th>
                        ))}
                        {mode === "manual" && <th className="w-8"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => {
                        const ok = rowProblems(r).length === 0;
                        return (
                          <tr key={i} className={ok ? "" : "bg-red-50/40"}>
                            <td className="px-3 py-2 text-center">{ok ? <CheckCircle2 size={15} className="text-green-500 inline" /> : <AlertCircle size={15} className="text-red-400 inline" />}</td>
                            {columns.map((c) => (
                              <td key={c.key} className="px-2 py-1.5">
                                {mode === "manual" ? (
                                  <input
                                    className={inputCls}
                                    type={c.type === "number" ? "number" : "text"}
                                    value={r[c.key] ?? ""}
                                    placeholder={c.placeholder || ""}
                                    onChange={(e) => setCell(i, c.key, e.target.value)}
                                  />
                                ) : (
                                  <span className="text-gray-700">{r[c.key] || <span className="text-gray-300">—</span>}</span>
                                )}
                              </td>
                            ))}
                            {mode === "manual" && (
                              <td className="px-2 py-1.5 text-center">
                                <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {mode === "manual" && (
                <button onClick={addRow} className="mt-3 flex items-center gap-2 px-4 py-2 border border-dashed border-[#2a276e] text-[#2a276e] text-sm font-semibold rounded-lg hover:bg-[#2a276e]/5">
                  <Plus size={16} /> Add row
                </button>
              )}
            </>
          )}
        </div>

        {mode !== null && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button onClick={close} disabled={importing} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancel</button>
            <button onClick={doImport} disabled={importing || validRows.length === 0} className="px-5 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50">
              {importing ? "Importing..." : `Import ${validRows.length} row${validRows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkImportModal;
