import React, { useState, useEffect } from "react";
import { X, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "react-toastify";
import { clinicToday, getClinicTimezone } from "../../utils/datetime";

/*
 * Context-aware CSV export. The `mode` matches the active Payments tab and shapes
 * both the dialog (filters) and the CSV the server returns:
 *   payments -> one row per invoice (status filter, invoice-date range)
 *   today    -> one row per payment received (collection-date range)
 *   ledger   -> one row per money movement, in and out (movement-date range)
 */

// Clinic-local "today" and first-of-month, so ranges match the clinic's calendar.
const today = () => clinicToday();
const monthStart = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: getClinicTimezone(), year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = p.find((x) => x.type === "year").value;
  const m = p.find((x) => x.type === "month").value;
  return `${y}-${m}-01`;
};

const CONFIG = {
  payments: {
    title: "Export invoices",
    subtitle: "One row per invoice, with patient and payment details",
    endpoint: "/invoices/export",
    filterKey: "status",
    filterLabel: "Payment status",
    filterOptions: [
      { value: "all", label: "All invoices" },
      { value: "unpaid", label: "Unpaid" },
      { value: "partial", label: "Partially paid" },
      { value: "paid", label: "Paid" },
    ],
    defaultFilter: "all",
    dateHint: "Dates filter by invoice date.",
    range: "month",
    fileTag: "invoices",
  },
  today: {
    title: "Export collections",
    subtitle: "One row per payment received, part payments included",
    endpoint: "/invoices/collections/export",
    filterKey: null,
    dateHint: "Dates filter by the day the money was received.",
    range: "today",
    fileTag: "collections",
  },
  ledger: {
    title: "Export ledger",
    subtitle: "One row per money movement, in and out",
    endpoint: "/ledger/export",
    filterKey: "type_filter",
    filterLabel: "Show",
    filterOptions: [
      { value: "", label: "Everything (in and out)" },
      { value: "invoice", label: "Payments in only" },
      { value: "expense", label: "Expenses out only" },
    ],
    defaultFilter: "",
    dateHint: "Dates filter by the movement date.",
    range: "month",
    fileTag: "ledger",
  },
};

const ExportModal = ({ open, onClose, mode = "payments" }) => {
  const cfg = CONFIG[mode] || CONFIG.payments;
  const [filterValue, setFilterValue] = useState(cfg.defaultFilter ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  // Re-seed filters/date range whenever the dialog opens for a given tab.
  useEffect(() => {
    if (!open) return;
    setFilterValue(cfg.defaultFilter ?? "");
    setDateFrom(cfg.range === "today" ? today() : monthStart());
    setDateTo(today());
  }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const handleExport = async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error("The 'from' date can't be after the 'to' date.");
      return;
    }
    setExporting(true);
    try {
      const baseURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const qs = new URLSearchParams();
      if (cfg.filterKey && filterValue) qs.set(cfg.filterKey, filterValue);
      if (dateFrom) qs.set("date_from", dateFrom);
      if (dateTo) qs.set("date_to", dateTo);

      const res = await fetch(`${baseURL}/api/v1${cfg.endpoint}?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      if (blob.size <= 120) {
        toast.info("Nothing to export for those filters.");
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cfg.fileTag}_${today()}.csv`;
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
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{cfg.title}</h3>
              <p className="text-xs text-gray-500">{cfg.subtitle}</p>
            </div>
          </div>
          <button onClick={() => !exporting && onClose()} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-40" disabled={exporting}>
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {cfg.filterKey && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{cfg.filterLabel}</label>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
              >
                {cfg.filterOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">From</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                max={today()}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e]"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">{cfg.dateHint}</p>
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
            className="px-5 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Download size={16} /> {exporting ? "Preparing..." : "Export CSV"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
