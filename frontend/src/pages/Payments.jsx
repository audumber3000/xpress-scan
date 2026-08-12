import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import { SkeletonBox, SkeletonTableRows } from "../components/Skeleton";
import { api } from "../utils/api";
import { getCurrencyCode } from "../utils/currency";
import InvoiceEditor from "../components/payments/InvoiceEditor";
import InvoiceItem from "../components/payments/InvoiceItem";
import ExpenseModal from "../components/payments/ExpenseModal";
import ExportModal from "../components/payments/ExportModal";
import FilterPanel from "../components/FilterPanel";
import Pagination from "../components/Pagination";
import EmptyState from "../components/common/EmptyState";
import TrendBadge from "../components/common/TrendBadge";
import WorkDoneCell from "../components/payments/WorkDoneCell";
import { generatePatientPersona, generateInitialsAvatar } from "../utils/avatar";
import DayExportModal from "../components/common/DayExportModal";
import { receipt } from "../assets/illustrations";
import { formatDate, formatTime, clinicToday } from "../utils/datetime";
import PaymentKpiRow from "../components/payments/PaymentKpiRow";
import KpiDetailDrawer from "../components/common/KpiDetailDrawer";
import InvoiceCardList from "../components/payments/InvoiceCardList";
import HelpBulb from "../components/common/HelpBulb";
import { useBreakpoint } from "../utils/useBreakpoint";

const INVOICES_PER_PAGE = 10;
const LEDGER_PER_PAGE = 10;

const Payments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { setTitle, setRefreshFunction } = useHeader();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [stats, setStats] = useState({ revenue: 0, pending: 0, total: 0, paidCount: 0, todayRevenue: 0, todayCash: 0, todayOnline: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  // Today's Collection is the money received today: one entry per payment
  // (InvoicePayment.paid_on = today), including partials on older invoices.
  const [todayCollections, setTodayCollections] = useState([]);
  // The same weekday a week earlier, so each today-card can show its change.
  const [todayPrevious, setTodayPrevious] = useState(null);
  // Which day the collection tab is showing. Defaults to the clinic's today.
  const [collectionDate, setCollectionDate] = useState(clinicToday());
  const [showDayExport, setShowDayExport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  // Which KPI card has its detail drawer open, if any.
  const [selectedKpi, setSelectedKpi] = useState(null);
  const breakpoint = useBreakpoint();

  // Ledger states
  const [activeTab, setActiveTab] = useState('payments'); // 'payments' or 'ledger'
  const [ledgerItems, setLedgerItems] = useState([]);
  const [ledgerTotalCount, setLedgerTotalCount] = useState(0);
  const [ledgerStats, setLedgerStats] = useState({ inflow: 0, outflow: 0, net: 0, expensesCount: 0 });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);

  // Filter states — all filters now live in one unified FilterPanel per tab.
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterLedgerType, setFilterLedgerType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('');

  // Apply the whole filter set at once (fired by FilterPanel's Apply button).
  const applyFilters = (next) => {
    setFilterStatus(next.status || '');
    setFilterMode(next.mode || '');
    setFilterLedgerType(next.ledgerType || '');
    setDateFrom(next.dateFrom || '');
    setDateTo(next.dateTo || '');
    setDatePreset(next.preset || '');
    setPage(1);
    setLedgerPage(1);
  };

  const filterValue = {
    dateFrom, dateTo, preset: datePreset,
    status: filterStatus, mode: filterMode, ledgerType: filterLedgerType,
  };

  // What the KPI drawer inherits from the page: the invoice filters, so it
  // describes the same population as the card that opened it — but not the date
  // range, because the drawer's own period control owns the chart's x-axis and a
  // one-day page filter would leave every chart with a single bar.
  // Memoised because it's a dependency of the drawer's fetch effect; a fresh
  // object each render would refetch on every keystroke.
  const kpiFilters = useMemo(() => {
    const f = {};
    if (debouncedSearch.trim().length >= 2) f.search = debouncedSearch.trim();
    if (filterStatus) f.status = filterStatus;
    if (filterMode) f.payment_mode = filterMode;
    return f;
  }, [debouncedSearch, filterStatus, filterMode]);

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (activeTab === 'payments') setPage(1);
      else setLedgerPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, activeTab]);

  // The four cards describe the invoices the filters selected, not the clinic's
  // whole history. They used to pull every invoice (limit 10000) and sum it in
  // the browser regardless of what was filtered, so narrowing to one patient or
  // one month left the headline figures unchanged — and quietly contradicting
  // the rows underneath them. Aggregated server-side by the same filter helper
  // the list and count endpoints use, so the two can't disagree.
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const filters = {};
      if (debouncedSearch.trim().length >= 2) filters.search = debouncedSearch.trim();
      if (filterStatus) filters.status = filterStatus;
      if (filterMode) filters.payment_mode = filterMode;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const s = await api.get('/invoices/summary', { params: filters });
      setStats(prev => ({
        ...prev,
        revenue: Number(s?.revenue) || 0,
        pending: Number(s?.pending) || 0,
        total: Number(s?.total) || 0,
        paidCount: Number(s?.paid_count) || 0,
        // Everything the storytelling cards need. Passed through as-is so the
        // card layer stays the only place that decides how to phrase them.
        billed: Number(s?.billed) || 0,
        collected: Number(s?.collected) || 0,
        outstanding: s?.outstanding || {},
        plans: s?.plans || {},
        methods: s?.methods || {},
        drafts: s?.drafts || {},
      }));
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Today's Collection = money actually received today (each payment is an entry,
  // including partials on older invoices). Cash vs Online split by payment method.
  const fetchTodayCollections = async () => {
    try {
      // One clinic-local day at a time, like the daily register's picker.
      const res = await api.get('/invoices/collections', { params: { date_from: collectionDate } });
      setTodayCollections(res?.entries || []);
      setStats(prev => ({
        ...prev,
        todayRevenue: res?.total || 0,
        todayCash: res?.cash || 0,
        todayOnline: res?.online || 0,
      }));
      // Same weekday last week, for the change pills on the cards.
      setTodayPrevious(res?.previous || null);
    } catch (err) {
      console.error('Error fetching today collections:', err);
      setTodayCollections([]);
    }
  };

  // Server-side pagination + search: fetch one page and the matching total.
  // Search and filters run in the DB so results span every invoice, not just the
  // rows on the current page.
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError("");

      // Backend requires 2+ chars for search; below that, list everything.
      const filters = {};
      if (debouncedSearch.trim().length >= 2) filters.search = debouncedSearch.trim();
      if (filterStatus) filters.status = filterStatus;
      if (filterMode) filters.payment_mode = filterMode;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;

      const [invoicesData, countRes] = await Promise.all([
        api.get('/invoices', { params: { skip: (page - 1) * INVOICES_PER_PAGE, limit: INVOICES_PER_PAGE, ...filters } }),
        api.get('/invoices/count', { params: filters }),
      ]);

      setInvoices(invoicesData || []);
      setTotalCount(Number(countRes?.total) || 0);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to fetch invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError("");
      const skip = (ledgerPage - 1) * LEDGER_PER_PAGE;
      // Date + type filter the page and its count (server-side, so pagination is
      // right). The stats aggregate honors the date window but not type, so
      // inflow/outflow always reflect the whole window regardless of the toggle.
      const dateParams = {};
      if (dateFrom) dateParams.date_from = dateFrom;
      if (dateTo) dateParams.date_to = dateTo;
      const pageParams = { ...dateParams };
      if (filterLedgerType) pageParams.type_filter = filterLedgerType;
      const [data, countRes, allLedgerData] = await Promise.all([
        api.get('/ledger/', { params: { skip, limit: LEDGER_PER_PAGE, ...pageParams } }),
        api.get('/ledger/count', { params: pageParams }),
        api.get('/ledger/', { params: { skip: 0, limit: 10000, ...dateParams } }),
      ]);
      setLedgerItems(data || []);
      setLedgerTotalCount(Number(countRes?.total) || 0);

      // Money in = every payment received; money out = every expense.
      // Categories are tallied in the same pass — the rows are already here, so
      // "where it went" costs nothing extra to answer.
      let inflow = 0, outflow = 0, expensesCount = 0;
      const byCategory = {};
      (allLedgerData || []).forEach(item => {
        if (item.type === 'expense') {
          outflow += item.amount;
          expensesCount++;
          const cat = item.category || 'Uncategorised';
          byCategory[cat] = (byCategory[cat] || 0) + item.amount;
        } else {
          inflow += item.amount;
        }
      });
      const categories = Object.entries(byCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      setLedgerStats({
        inflow, outflow, net: inflow - outflow, expensesCount,
        categories, topCategory: categories[0]?.category || null,
      });
    } catch (err) {
      console.error('Error fetching ledger:', err);
      setError(err.message || 'Failed to fetch ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTitle('Payment & Ledger');
    setRefreshFunction(() => () => {
      if (activeTab === 'payments') {
        fetchInvoices();
        fetchStats();
      } else if (activeTab === 'today') {
        // The day's KPIs come from fetchTodayCollections; the invoice summary
        // feeds cards this tab doesn't show.
        fetchTodayCollections();
      } else {
        fetchLedger();
      }
    });
    // No fetchStats() here — the filter effect below owns it, and calling it
    // from both fired two identical requests on every load.
    fetchTodayCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTitle, setRefreshFunction, activeTab]);

  // Changing the day on the collection tab reloads that day's payments and KPIs.
  useEffect(() => {
    if (activeTab === 'today') fetchTodayCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionDate]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchInvoices();
      // Refetched alongside the list so the cards and the rows always describe
      // the same set of invoices.
      fetchStats();
    } else {
      fetchLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, ledgerPage, debouncedSearch, activeTab, filterStatus, filterMode, filterLedgerType, dateFrom, dateTo]);

  // Deep links from global search: ?invoice=<id> opens that invoice,
  // ?tab=ledger lands on the ledger, ?new=1 opens a blank invoice (the
  // dashboard's "Create invoice" shortcut). Params are stripped once applied so
  // a refresh doesn't force the editor back open.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invoiceId = params.get('invoice');
    const tabParam = params.get('tab');
    const isNew = params.get('new') === '1';
    if (!invoiceId && !tabParam && !isNew) return;

    if (tabParam === 'ledger' || tabParam === 'payments') setActiveTab(tabParam);
    if (invoiceId) setSelectedInvoiceId(Number(invoiceId));
    // 'new' is the sentinel InvoiceEditor already understands for a blank
    // invoice; an explicit ?invoice=<id> wins if somehow both are present.
    else if (isNew) setSelectedInvoiceId('new');

    params.delete('invoice');
    params.delete('tab');
    params.delete('new');
    navigate({ search: params.toString() }, { replace: true });
  }, [location.search, navigate]);

  // Stable identity so memoized InvoiceItem rows don't re-render on selection change.
  const handleInvoiceSelect = useCallback((invoiceId) => {
    setSelectedInvoiceId(invoiceId);
  }, []);

  const handleInvoiceClose = () => {
    setSelectedInvoiceId(null);
    fetchInvoices();
    fetchStats();
    fetchTodayCollections();
    if (activeTab === 'ledger') fetchLedger();
  };

  const handleExpenseSave = () => {
    fetchLedger();
  };

  // The 'payments' tab is filtered/searched on the server (whole clinic).
  const filteredInvoices = invoices;

  // The 'today' tab is a small in-memory set of payments received today, so its
  // search/filters run here. Mode matches the payment method; status the invoice.
  const filteredTodayCollections = useMemo(() => {
    return todayCollections.filter((e) => {
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        if (!e.patient_name?.toLowerCase().includes(s) &&
            !e.invoice_number?.toLowerCase().includes(s) &&
            !e.patient_phone?.toLowerCase().includes(s)) return false;
      }
      if (filterStatus && e.invoice_status !== filterStatus) return false;
      if (filterMode && (e.method || '').toLowerCase() !== filterMode.toLowerCase()) return false;
      return true;
    });
  }, [todayCollections, searchTerm, filterStatus, filterMode]);
  
  const filteredLedger = useMemo(() => {
    return ledgerItems.filter((item) => {
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        if (!item.entity_name?.toLowerCase().includes(searchLower) &&
            !item.description?.toLowerCase().includes(searchLower) &&
            !item.category?.toLowerCase().includes(searchLower)) return false;
      }
      if (filterLedgerType && item.type !== filterLedgerType) return false;
      return true;
    });
  }, [ledgerItems, searchTerm, filterLedgerType]);

  const currentItems = activeTab === 'ledger' ? filteredLedger : filteredInvoices;

  // "last Saturday (12 Jul)" — names the day each today-card is measured against,
  // so the percentage is never an unexplained number.
  const comparedTo = useMemo(() => {
    const prevDate = todayPrevious?.date_from;
    if (!prevDate) return "last week";
    const [y, m, d] = prevDate.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
    return `last ${weekday} (${formatDate(prevDate)})`;
  }, [todayPrevious?.date_from]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: getCurrencyCode(),
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50/30">
      
      {/* Tabs */}
      <div className="px-4 md:px-6 pt-4 border-b border-gray-200 flex items-end justify-between gap-3">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('today')}
            className={`${
              activeTab === 'today'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Today's Collection
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`${
              activeTab === 'payments'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            All payments
          </button>
          {/* The Ledger tab moved to Expenses, where the payables that feed
              it live. Money in and money out on one screen is how the two get
              read as a single number. The tab's code is still reachable via
              ?tab=ledger so an existing bookmark keeps working, and that path
              now shows a pointer to the new home. */}
        </nav>
        <HelpBulb section="payments" className="mb-2" />
      </div>
      {/* Summary cards + filters.
          Spacing is the dashboard's (pt-4 / gap-3 / mb-4) rather than the old
          pt-6 / gap-6 / mb-8. The tighter gaps pay for the story line and the
          meter on each card, so the block above the table ends up marginally
          shorter than before — the table gains height rather than losing it. */}
      <div className="px-4 md:px-6 pt-4 pb-2 flex-shrink-0">
        <PaymentKpiRow
          tab={activeTab}
          summary={stats}
          todayPrevious={todayPrevious}
          ledgerStats={ledgerStats}
          onSelect={activeTab === 'payments' ? setSelectedKpi : undefined}
        />

        {/* Drafts are excluded from every figure above — correctly, a draft is
            not a debt — but they are also money nobody has been asked for, so
            they get a nudge rather than a whole card. */}
        {activeTab === 'payments' && stats.drafts?.count > 0 && (
          <button
            onClick={() => { setFilterStatus('draft'); setPage(1); }}
            className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-semibold hover:bg-amber-100 transition-colors"
          >
            {stats.drafts.count} unissued {stats.drafts.count === 1 ? 'draft' : 'drafts'} worth {formatCurrency(stats.drafts.amount)} — never billed
          </button>
        )}
      </div>

      <div className="px-4 md:px-6 flex-shrink-0">

        {/* Search, Filters & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="w-full sm:max-w-sm relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
              />
            </div>
            {/* Status and mode filters don't belong on a single day's cash
                sheet — the day picker and search are the whole story there. */}
            {activeTab !== 'today' && (
              <FilterPanel
                tab={activeTab}
                value={filterValue}
                onApply={applyFilters}
                dateEnabled={activeTab !== 'today'}
              />
            )}
            {/* The collection tab is one day at a time, so it gets the same
                simple day picker the daily register uses rather than a range. */}
            {activeTab === 'today' && (
              <input
                type="date"
                value={collectionDate}
                max={clinicToday()}
                onChange={(e) => setCollectionDate(e.target.value || clinicToday())}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
              />
            )}
          </div>
          <div className="w-full sm:w-auto flex space-x-3">
            <button
              onClick={() => activeTab === 'today' ? setShowDayExport(true) : setShowExport(true)}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a276e] transition-colors"
            >
              <svg className="mr-2 h-5 w-5 text-[#2a276e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            {activeTab === 'payments' || activeTab === 'today' ? (
              <button
                 onClick={() => setSelectedInvoiceId('new')}
                 className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#2a276e] hover:bg-[#1e1c4f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a276e] transition-colors"
              >
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Transaction
              </button>
            ) : (
              <button
                 onClick={() => setSelectedExpenseId('new')}
                 className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600 transition-colors"
              >
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Expense
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoices Table Container */}
      <div className="flex-1 overflow-hidden px-6 pb-4">
        <div className="h-full overflow-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          {loading && invoices.length === 0 ? (
            <table className="w-full">
              <thead className="bg-[#f8fafc] border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <th key={i} className="px-6 py-4"><SkeletonBox className="h-3 w-20" /></th>
                  ))}
                </tr>
              </thead>
              <SkeletonTableRows rows={10} />
            </table>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading ledger</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                    <button 
                      onClick={fetchInvoices}
                      className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded border border-red-300 font-medium transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'payments' && breakpoint === 'mobile' ? (
            // Below 768px the seven-column table has no honest layout — shrunk,
            // the columns are unreadable and the page scrolls sideways. Same
            // data as stacked cards instead.
            currentItems.length === 0 ? (
              <div className="px-4 py-8">
                <EmptyState
                  image={receipt}
                  title="No transactions yet"
                  subtitle="Invoices and payments show up here as you start billing patients."
                />
              </div>
            ) : (
              <InvoiceCardList invoices={currentItems} onSelect={handleInvoiceSelect} />
            )
          ) : activeTab === 'payments' ? (
            <table className="w-full">
              <thead className="bg-[#f8fafc] border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice / Patient ID</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Done</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8">
                      <EmptyState
                        image={receipt}
                        title="No transactions yet"
                        subtitle="Invoices and payments show up here as you start billing patients."
                      />
                    </td>
                  </tr>
                ) : (
                  currentItems.map((invoice) => (
                    <InvoiceItem
                      key={invoice.id}
                      invoice={invoice}
                      onSelect={handleInvoiceSelect}
                    />
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'today' ? (
            /* Today's Collection — one row per payment received today (incl. partials on older invoices) */
            <table className="w-full">
              <thead className="bg-[#f8fafc] border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice / Patient ID</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Done</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTodayCollections.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8">
                      <EmptyState
                        image={receipt}
                        title="No payments collected today"
                        subtitle="Payments you record today, including part payments, show up here."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredTodayCollections.map((e) => (
                    <tr
                      key={e.payment_id}
                      onClick={() => handleInvoiceSelect(e.invoice_id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {/* Invoice number over patient ID, matching All payments */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-[#2a276e]">{e.invoice_number}</div>
                        <div className="text-xs text-gray-400">
                          {e.patient_display_id ? `Patient #${e.patient_display_id}` : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img
                            src={generatePatientPersona({ id: e.patient_id, name: e.patient_name }, 80)}
                            onError={(ev) => { ev.target.onerror = null; ev.target.src = generateInitialsAvatar(e.patient_name || 'Patient'); }}
                            alt={e.patient_name || 'Patient'}
                            className="w-9 h-9 rounded-full flex-shrink-0 object-cover border border-gray-100"
                          />
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{e.patient_name || 'Unknown'}</div>
                            <div className="text-xs text-gray-400">{e.patient_phone || 'No phone'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><WorkDoneCell items={e.items} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">+{formatCurrency(e.amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.created_at ? formatTime(e.created_at) : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.method || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                          {(e.invoice_status || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-[#f8fafc] border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">In / Out</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8">
                      <EmptyState
                        image={receipt}
                        title="No ledger items yet"
                        subtitle="Money in and out for this period will be listed here."
                      />
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => (
                    <tr key={`${item.type}_${item.id}`} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => item.type === 'invoice' ? handleInvoiceSelect(item.invoice_id) : setSelectedExpenseId(item.id)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{formatDate(item.date)}</div>
                        {item.recorded_at && <div className="text-xs text-gray-400">{formatTime(item.recorded_at)}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.entity_name || 'N/A'}</div>
                        <div className="text-xs text-gray-400">{item.type.toUpperCase()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 break-words">{item.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.type === 'expense' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${item.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                          {item.type === 'expense' ? '-' : '+'}{formatCurrency(item.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.payment_method || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {item.bill_file_url ? (
                          <a href={item.bill_file_url} target="_blank" rel="noopener noreferrer" className="text-[#2a276e] hover:text-[#1e1c4f] flex items-center" onClick={(e) => e.stopPropagation()}>
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            View Bill
                          </a>
                        ) : item.type === 'invoice' ? (
                          <span className="text-green-600 hover:text-green-800 flex items-center">
                            Open 
                          </span>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination — shared component (same as the patient section) */}
      {activeTab === 'payments' && (
        <Pagination
          page={page}
          pageSize={INVOICES_PER_PAGE}
          totalItems={totalCount}
          onPageChange={setPage}
          className="flex-shrink-0"
        />
      )}
      {activeTab === 'ledger' && (
        <div className="mx-4 mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-blue-900">
            The ledger now lives under <strong>Expenses</strong>, beside the payables that feed it.
          </p>
          <a href="/expenses" className="text-[11px] font-bold text-blue-900 hover:underline flex-shrink-0">
            Go to Expenses
          </a>
        </div>
      )}

      {activeTab === 'ledger' && (
        <Pagination
          page={ledgerPage}
          pageSize={LEDGER_PER_PAGE}
          totalItems={ledgerTotalCount}
          onPageChange={setLedgerPage}
          className="flex-shrink-0"
        />
      )}

      {/* KPI detail drawer. Gets the page's invoice filters so it describes the
          same population as the card that opened it; its own period control
          drives the chart's x-axis. */}
      <KpiDetailDrawer
        card={selectedKpi}
        filters={kpiFilters}
        endpoint="/invoices/kpi-detail"
        onClose={() => setSelectedKpi(null)}
      />

      {/* Invoice Editor Panel Drawer */}
      {selectedInvoiceId && (
        <InvoiceEditor
          invoiceId={selectedInvoiceId}
          onClose={handleInvoiceClose}
          onSave={handleInvoiceClose}
        />
      )}

      {/* Expense Modal */}
      {selectedExpenseId && (
        <ExpenseModal
          expenseId={selectedExpenseId}
          onClose={() => setSelectedExpenseId(null)}
          onSave={handleExpenseSave}
        />
      )}

      {/* Export to CSV — shape depends on the active tab */}
      <ExportModal open={showExport} onClose={() => setShowExport(false)} mode={activeTab} />

      {/* Collections export — same dialog and the same two formats as the
          daily register's day sheet. */}
      <DayExportModal
        open={showDayExport}
        onClose={() => setShowDayExport(false)}
        date={collectionDate}
        endpoint="/invoices/collections/export"
        dateParam="date_from"
        fileTag="collections"
        title="Export collections"
        subtitle="One row per payment, part payments included"
      />
    </div>
  );
};

export default Payments;
