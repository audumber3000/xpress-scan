import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO, isToday, startOfDay } from "date-fns";
import { api } from "../../utils/api";
import { formatCurrency } from "../../utils/currency";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Search, Briefcase, Plus, RefreshCw, X } from "lucide-react";
import CaseDrawer from "./CaseDrawer";

const TABS = [
  { key: "all", label: "All" },
  { key: "due_today", label: "Due Today" },
  { key: "overdue", label: "Overdue" },
  { key: "in_production", label: "In Production" },
  { key: "delivered", label: "Delivered" },
];

const OPEN_STATUSES = (s) => s !== "delivered" && s !== "cancelled";

function isOverdue(c) {
  if (!c.due_date || !OPEN_STATUSES(c.status)) return false;
  return parseISO(c.due_date) < startOfDay(new Date());
}
function isDueToday(c) {
  if (!c.due_date || !OPEN_STATUSES(c.status)) return false;
  return isToday(parseISO(c.due_date));
}

function matchesTab(c, tab) {
  switch (tab) {
    case "due_today": return isDueToday(c);
    case "overdue": return isOverdue(c);
    case "in_production": return c.status === "in_production";
    case "delivered": return c.status === "delivered";
    default: return true;
  }
}

export default function CasesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeTab = TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "all";
  const clientFilter = searchParams.get("client");
  const setActiveTab = (key) => {
    const next = {};
    if (key !== "all") next.tab = key;
    if (clientFilter) next.client = clientFilter;
    setSearchParams(next);
  };
  const clearClientFilter = () => setSearchParams(activeTab === "all" ? {} : { tab: activeTab });

  const loadCases = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await api.get("/cases");
      setCases(data.cases || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  const counts = { all: cases.length, due_today: 0, overdue: 0, in_production: 0, delivered: 0 };
  for (const k of cases) {
    if (isDueToday(k)) counts.due_today++;
    if (isOverdue(k)) counts.overdue++;
    if (k.status === "in_production") counts.in_production++;
    if (k.status === "delivered") counts.delivered++;
  }

  const query = search.trim().toLowerCase();
  const filtered = cases
    .filter((c) => {
      if (clientFilter && String(c.client_id) !== String(clientFilter)) return false;
      if (!matchesTab(c, activeTab)) return false;
      if (!query) return true;
      return (
        c.case_number?.toLowerCase().includes(query) ||
        c.client_name?.toLowerCase().includes(query) ||
        c.patient_name?.toLowerCase().includes(query) ||
        c.doctor_name?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) =>
      activeTab === "overdue" || activeTab === "due_today"
        ? new Date(a.due_date) - new Date(b.due_date)
        : new Date(b.received_date) - new Date(a.received_date)
    );

  const clientFilterName = clientFilter
    ? cases.find((c) => String(c.client_id) === String(clientFilter))?.client_name
    : null;

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      {/* Tabs with live counts */}
      <div className="px-6 pt-4 border-b border-gray-200 bg-white">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const count = counts[tab.key];
            const danger = tab.key === "overdue" && count > 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`${
                  active ? "border-[#2a276e] text-[#2a276e]" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2`}
              >
                {tab.label}
                {!loading && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    danger ? "bg-red-100 text-red-700" : active ? "bg-indigo-100 text-[#2a276e]" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Search & actions */}
      <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-200 bg-white">
        <div className="w-full md:max-w-sm relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search all cases by #, clinic, doctor, or patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          {clientFilter && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-[#2a276e] border border-indigo-100">
              {clientFilterName || "Client"}
              <button onClick={clearClientFilter} className="hover:text-indigo-900" title="Clear filter">
                <X size={13} />
              </button>
            </span>
          )}
          <button
            onClick={() => loadCases(true)}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#2a276e] hover:border-indigo-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-all shadow-sm whitespace-nowrap"
          >
            <Plus size={18} /> New Case
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-6 pb-6 pt-6">
        <div className="h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <Briefcase size={48} className="opacity-40 text-[#2a276e] mb-4" />
              <h3 className="text-sm font-semibold text-gray-900">
                {search ? "No matching cases" : activeTab === "all" ? "No cases yet" : `Nothing ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}`}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {search ? "Try a different search term" : activeTab === "all" ? "Register your first case to get started" : "You're all caught up here"}
              </p>
              {activeTab === "all" && !search && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm"
                >
                  <Plus size={16} /> New Case
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="px-6 py-2.5 border-b border-gray-100 text-xs text-gray-400 flex-shrink-0">
                Showing {filtered.length} {filtered.length === 1 ? "case" : "cases"}
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Case Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic & Doctor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timeline</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filtered.map((c) => {
                      const overdue = isOverdue(c);
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-indigo-50/30 transition-colors duration-150 cursor-pointer group"
                          onClick={() => navigate(`/cases/${c.id}`)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-[#2a276e] group-hover:text-indigo-800">{c.case_number}</div>
                            {c.priority === "rush" && (
                              <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Rush</span>
                            )}
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">
                              {c.items?.map((i) => i.product_name).join(", ") || "No items"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{c.client_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{c.doctor_name || "N/A"}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{c.patient_name || "N/A"}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{[c.patient_age, c.patient_sex].filter(Boolean).join(" / ")}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="text-gray-700">In: {format(parseISO(c.received_date), "dd MMM")}</div>
                            <div className={`font-medium mt-0.5 ${overdue ? "text-red-600" : "text-gray-600"}`}>
                              Due: {c.due_date ? format(parseISO(c.due_date), "dd MMM yyyy") : "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                            {formatCurrency(c.total_amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <CaseDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(id) => {
          loadCases(true);
          if (id) navigate(`/cases/${id}`);
        }}
      />
    </div>
  );
}
