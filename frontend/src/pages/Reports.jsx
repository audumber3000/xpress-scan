import React, { useState, useEffect, useCallback } from "react";
import { toast } from 'react-toastify';
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import GearLoader from "../components/GearLoader";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import FeatureLock from "../components/FeatureLock";

// ─── Report definitions ──────────────────────────────────────────────────────

const REPORTS = [
  // Financial
  {
    id: "monthly_revenue",
    title: "Monthly Revenue",
    category: "Financial",
    description: "Total collections, payment modes and revenue breakdown.",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    badgeBg: "bg-green-100 text-green-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "outstanding_invoices",
    title: "Outstanding Invoices",
    category: "Financial",
    description: "Pending & overdue invoices with patient details.",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    badgeBg: "bg-orange-100 text-orange-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "payment_methods",
    title: "Payment Methods",
    category: "Financial",
    description: "Analysis of cash, UPI, card and other collection modes.",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    badgeBg: "bg-blue-100 text-blue-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    id: "expense_summary",
    title: "Expense Summary",
    category: "Financial",
    description: "Clinic expenditure overview with category breakdown.",
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
    badgeBg: "bg-red-100 text-red-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  // Operational
  {
    id: "appointment_utilization",
    title: "Chair Utilization",
    category: "Operational",
    description: "Slot fill rate, idle time and peak hours analysis.",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    badgeBg: "bg-purple-100 text-purple-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "patient_flow",
    title: "Patient Flow",
    category: "Operational",
    description: "New vs returning patients, visit frequency and drop-off.",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
    badgeBg: "bg-teal-100 text-teal-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: "staff_performance",
    title: "Staff Performance",
    category: "Operational",
    description: "Doctor-wise patient counts, collections and attendance.",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    badgeBg: "bg-indigo-100 text-indigo-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: "no_show_analysis",
    title: "No-show Analysis",
    category: "Operational",
    description: "Cancellation and no-show rates by day and provider.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    badgeBg: "bg-amber-100 text-amber-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  // Clinical
  {
    id: "treatment_plans",
    title: "Treatment Completion",
    category: "Clinical",
    description: "Plan acceptance, completion rates and pending treatments.",
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    badgeBg: "bg-cyan-100 text-cyan-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "procedure_breakdown",
    title: "Procedure Breakdown",
    category: "Clinical",
    description: "Most performed procedures with frequency and revenue.",
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    badgeBg: "bg-pink-100 text-pink-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "lab_orders",
    title: "Lab Orders",
    category: "Clinical",
    description: "Lab order status, turnaround time and vendor summary.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    badgeBg: "bg-violet-100 text-violet-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    id: "prescription_summary",
    title: "Prescription Summary",
    category: "Clinical",
    description: "Most prescribed medications, frequency and patient reach.",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    badgeBg: "bg-rose-100 text-rose-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

// ─── Date preset helpers ───────────────────────────────────────────────────────

const today = () => new Date().toISOString().split("T")[0];
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};
const startOfMonth = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - offset, 1);
  return d.toISOString().split("T")[0];
};
const endOfMonth = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - offset + 1, 0);
  return d.toISOString().split("T")[0];
};

const DATE_PRESETS = [
  { label: "Today", start: () => today(), end: () => today() },
  { label: "Last 7 days", start: () => daysAgo(7), end: () => today() },
  { label: "Last 30 days", start: () => daysAgo(30), end: () => today() },
  { label: "This month", start: () => startOfMonth(0), end: () => today() },
  { label: "Last month", start: () => startOfMonth(1), end: () => endOfMonth(1) },
  { label: "Last 3 months", start: () => daysAgo(90), end: () => today() },
  { label: "Custom", start: null, end: null },
];

// ─── Tiny helpers ──────────────────────────────────────────────────────────────

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

const CategoryBadge = ({ category }) => {
  const map = {
    Financial: "bg-green-100 text-green-700",
    Operational: "bg-purple-100 text-purple-700",
    Clinical: "bg-cyan-100 text-cyan-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[category] || "bg-gray-100 text-gray-600"}`}>
      {category}
    </span>
  );
};

// ─── Report Card ──────────────────────────────────────────────────────────────

const ReportCard = ({ report, onClick }) => (
  <div
    onClick={() => onClick(report)}
    className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-[#2a276e]/30 transition-all duration-200 cursor-pointer p-5 flex flex-col gap-3 group"
  >
    {/* Icon + Category */}
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 ${report.iconBg} ${report.iconColor} rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}>
        {report.icon}
      </div>
      <CategoryBadge category={report.category} />
    </div>

    {/* Text */}
    <div>
      <h4 className="text-sm font-bold text-gray-900 leading-snug">{report.title}</h4>
      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{report.description}</p>
    </div>

    {/* CTA hint */}
    <div className="flex items-center gap-1 text-xs text-[#2a276e] font-medium mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      Generate report
    </div>
  </div>
);

// ─── Report Drawer ────────────────────────────────────────────────────────────

const ReportDrawer = ({ report, onClose, onGenerated }) => {
  const [selectedPreset, setSelectedPreset] = useState("Last 30 days");
  const [dateRange, setDateRange] = useState({
    start: daysAgo(30),
    end: today(),
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePreset = (preset) => {
    setSelectedPreset(preset.label);
    if (preset.label !== "Custom") {
      setDateRange({ start: preset.start(), end: preset.end() });
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await api.post("/dashboard/reports/generate", {
        report_type: report.id,
        report_category: report.category,
        title: report.title,
        start_date: dateRange.start,
        end_date: dateRange.end,
      });

      // Redirect triggers here
      onGenerated?.();
      onClose();
      toast.info("Report generation started...");
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
      toast.error(getPermissionAwareErrorMessage(
        err,
        "Failed to start report generation",
        "You don't have permission to generate reports."
      ));
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-[70] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 ${report.iconBg} ${report.iconColor} rounded-lg flex items-center justify-center`}>
              {report.icon}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{report.title}</h2>
              <CategoryBadge category={report.category} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Date presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</label>
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    selectedPreset === p.label
                      ? "bg-[#2a276e] border-[#2a276e] text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date inputs */}
          <div className={`grid grid-cols-2 gap-3 transition-all ${selectedPreset === "Custom" ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500">From</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm transition-all"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500">To</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none text-sm transition-all"
              />
            </div>
          </div>

          {/* Selected range summary */}
          {selectedPreset !== "Custom" && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {fmtDate(dateRange.start)} → {fmtDate(dateRange.end)}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2.5 bg-[#2a276e] text-white font-semibold rounded-lg hover:bg-[#1a1548] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

// ─── Generated Reports Table ──────────────────────────────────────────────────

const GeneratedReportsTab = ({ refreshKey }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get("/dashboard/reports/history");
      setRecords(res || []);
    } catch (err) {
      console.error(err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    
    // Poll for updates if any record is generating
    const hasGenerating = records.some(r => r.status === 'generating');
    let poll;
    if (hasGenerating) {
      poll = setInterval(fetchAll, 3000);
    }
    return () => clearInterval(poll);
  }, [fetchAll, refreshKey, records.some(r => r.status === 'generating')]);

  const reportMeta = (id) => REPORTS.find((r) => r.id === id);

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <GearLoader size="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Generated Reports</h3>
          <p className="text-xs text-gray-500 mt-0.5">All reports generated for this clinic</p>
        </div>
        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
          {records.length} total
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {["Report", "Category", "Period", "Generated On", "Generated By", "Downloads", "Status"].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="py-16 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900">No reports generated yet</p>
                    <p className="text-xs text-gray-500">Switch to the Reports tab and generate your first report.</p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((rec) => {
                const meta = reportMeta(rec.report_type);
                return (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {meta && (
                          <div className={`w-8 h-8 ${meta.iconBg} ${meta.iconColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            {meta.icon}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">{rec.title || rec.report_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CategoryBadge category={rec.report_category || meta?.category || "—"} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {fmtDate(rec.parameters?.start_date)} → {fmtDate(rec.parameters?.end_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {fmtDate(rec.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#2a276e]/10 flex items-center justify-center text-[#2a276e] text-xs font-bold">
                          {(rec.generated_by_name || "U")[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-700">{rec.generated_by_name || "System"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {rec.download_count ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {rec.status === 'generating' ? (
                        <div className="flex flex-col gap-1 w-24">
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#2a276e] animate-progress-buffer rounded-full w-1/2"></div>
                          </div>
                          <span className="text-[10px] text-[#2a276e] font-bold animate-pulse">Generating...</span>
                        </div>
                      ) : rec.status === 'completed' && (rec.file_url || rec.id) ? (
                        <button
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('auth_token');
                              const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
                              const response = await fetch(`${baseUrl}/api/v1/dashboard/reports/download/${rec.id}`, {
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                }
                              });
                              
                              if (!response.ok) throw new Error("Download failed");
                              
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', `${rec.title.replace(/\s+/g, '_')}.pdf`);
                              document.body.appendChild(link);
                              link.click();
                              link.parentNode.removeChild(link);
                              window.URL.revokeObjectURL(url);
                            } catch (err) {
                              console.error("Download failed", err);
                              toast.error(getPermissionAwareErrorMessage(
                                err,
                                "Failed to download report",
                                "You don't have permission to download reports."
                              ));
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#2a276e] hover:bg-[#1a1548] rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">Failed</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Reports = () => {
  const { setTitle } = useHeader();
  const [activeTab, setActiveTab] = useState("reports");
  const [drawerReport, setDrawerReport] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setTitle("Reports");
  }, [setTitle]);

  const handleGenerated = () => {
    setActiveTab("history"); // Redirect to history tab
    setRefreshKey((k) => k + 1);
  };

  const categories = ["Financial", "Operational", "Clinical"];

  return (
    <div className="flex-1 bg-gray-50/50 min-h-screen">
      <FeatureLock featureName="Advanced Analytics & Reports">
        <div className="px-8 pt-6 border-b border-gray-200 bg-white sticky top-0 z-10">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: "reports", label: "Reports" },
              { key: "history", label: "Generated Reports" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? "border-[#2a276e] text-[#2a276e]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="px-8 py-6 max-w-7xl mx-auto space-y-8">
          {activeTab === "reports" ? (
            <>
              {categories.map((cat) => {
                const catReports = REPORTS.filter((r) => r.category === cat);
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-sm font-bold text-gray-700">{cat}</h3>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{catReports.length} reports</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {catReports.map((report) => (
                        <ReportCard
                          key={report.id}
                          report={report}
                          onClick={setDrawerReport}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </>
          ) : (
            <GeneratedReportsTab refreshKey={refreshKey} />
          )}
        </div>
      </FeatureLock>

      {drawerReport && (
        <ReportDrawer
          report={drawerReport}
          onClose={() => setDrawerReport(null)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
};

export default Reports;