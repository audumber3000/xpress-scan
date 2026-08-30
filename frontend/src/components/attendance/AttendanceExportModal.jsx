import React, { useState, useEffect } from "react";
import { X, FileSpreadsheet, FileText, Download } from "lucide-react";
import { notify } from "../../utils/notify";

/**
 * Export the register over a date range.
 *
 * A range rather than a single day, because attendance is only ever read over
 * a period: nobody exports one day of it. The range is pre-filled from whatever
 * the screen is currently showing, so the common case (export exactly what I am
 * looking at) is one click through this dialog and no typing.
 *
 * A modal, not a drawer: it edits the parameters of something that already
 * exists on screen rather than creating anything.
 */

const FORMATS = [
  {
    id: "pdf",
    label: "PDF register",
    hint: "The grid as it looks here, laid out for printing and filing",
    Icon: FileText,
    tone: "bg-red-50 text-red-600",
  },
  {
    id: "csv",
    label: "CSV spreadsheet",
    hint: "One row per employee per day, with clock-in detail. For payroll",
    Icon: FileSpreadsheet,
    tone: "bg-green-50 text-green-600",
  },
];

const AttendanceExportModal = ({ open, onClose, defaultStart, defaultEnd, employees = [] }) => {
  const [format, setFormat] = useState("pdf");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [userId, setUserId] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormat("pdf");
    setStart(defaultStart);
    setEnd(defaultEnd);
    setUserId("");
  }, [open, defaultStart, defaultEnd]);

  if (!open) return null;

  const rangeInvalid = !start || !end || start > end;

  const handleExport = async () => {
    if (rangeInvalid) return;
    setExporting(true);
    try {
      const baseURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const qs = new URLSearchParams({ start, end, format });
      if (userId) qs.set("user_id", userId);

      const res = await fetch(`${baseURL}/api/v1/attendance/export?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) {
        // The server explains a bad range better than "Export failed" does.
        let detail = "";
        try {
          detail = (await res.json())?.detail || "";
        } catch { /* not JSON — fall through to the generic message */ }
        throw new Error(detail || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${start}_to_${end}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notify.sent("Export ready");
      onClose();
    } catch (e) {
      notify.problem(e?.message || "Could not export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const field = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => !exporting && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#29828a]/10 flex items-center justify-center">
              <Download size={18} className="text-[#29828a]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Export attendance</h3>
              <p className="text-xs text-gray-500">Pre-filled with the period on screen</p>
            </div>
          </div>
          <button
            onClick={() => !exporting && onClose()}
            disabled={exporting}
            className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-40"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">From</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">To</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
            </div>
          </div>
          {rangeInvalid && (
            <p className="text-xs text-red-600">Pick a start date on or before the end date.</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Employee</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={field}>
              <option value="">Everyone</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {FORMATS.map(({ id, label, hint, Icon, tone }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFormat(id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                  format === id ? "border-[#29828a] bg-[#29828a]/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{label}</span>
                  <span className="block text-xs text-gray-500">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={exporting}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || rangeInvalid}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-[#29828a] hover:bg-[#216b71] rounded-xl transition-colors disabled:opacity-50"
          >
            {exporting ? "Preparing..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceExportModal;
