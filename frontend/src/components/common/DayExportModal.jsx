import React, { useState, useEffect } from "react";
import { X, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "react-toastify";
import { clinicToday, formatDate } from "../../utils/datetime";

/**
 * Export one day as a file, in PDF or CSV.
 *
 * Shared by the daily register and Today's Collection so the two "Export"
 * buttons behave identically — same dialog, same day picker, same two formats.
 *
 * @param {string} endpoint  API path, e.g. "/daily-register/export"
 * @param {string} dateParam query key the endpoint expects for the day
 *   ("date" for the register, "date_from" for collections)
 * @param {string} fileTag   download filename prefix
 */
const FORMATS = [
  { id: "pdf", label: "PDF sheet", hint: "Formatted for printing and filing", Icon: FileText, tone: "bg-red-50 text-red-600" },
  { id: "csv", label: "CSV spreadsheet", hint: "One row per entry, for Excel", Icon: FileSpreadsheet, tone: "bg-green-50 text-green-600" },
];

const DayExportModal = ({
  open,
  onClose,
  date,
  endpoint,
  dateParam = "date",
  fileTag = "export",
  title = "Export day sheet",
  subtitle = "",
  extraParams = {},
}) => {
  const [format, setFormat] = useState("pdf");
  const [exportDate, setExportDate] = useState(date || clinicToday());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormat("pdf");
    setExportDate(date || clinicToday());
  }, [open, date]);

  if (!open) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const baseURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const qs = new URLSearchParams({ [dateParam]: exportDate, format, ...extraParams });
      const res = await fetch(`${baseURL}/api/v1${endpoint}?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileTag}_${exportDate}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export ready");
      onClose();
    } catch (e) {
      toast.error(e?.message || "Could not export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => !exporting && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2a276e]/10 flex items-center justify-center">
              <FileText size={18} className="text-[#2a276e]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Day</label>
            <input
              type="date"
              value={exportDate}
              max={clinicToday()}
              onChange={(e) => setExportDate(e.target.value || clinicToday())}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Format</label>
            <div className="space-y-2">
              {FORMATS.map(({ id, label, hint, Icon, tone }) => {
                const active = format === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFormat(id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      active ? "border-[#2a276e] bg-[#2a276e]/[0.04]" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{hint}</p>
                    </div>
                    <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${active ? "border-[#2a276e] bg-[#2a276e]" : "border-gray-300"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-500">Covers {formatDate(exportDate)} only.</p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={() => !exporting && onClose()}
            disabled={exporting}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-6 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50"
          >
            {exporting ? "Preparing..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayExportModal;
