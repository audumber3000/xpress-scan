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
import { receipt } from "../assets/illustrations";
import { formatDate, formatTime } from "../utils/datetime";

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
  const [showExport, setShowExport] = useState(false);

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

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (activeTab === 'payments') setPage(1);
      else setLedgerPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, activeTab]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const allInvoices = await api.get('/invoices', { params: { skip: 0, limit: 10000 } });
      let totalRevenue = 0;
      let totalPending = 0;
      let paidCount = 0;

      (allInvoices || []).forEach(inv => {
        const amount = parseFloat(inv.total) || 0;
        const due = parseFloat(inv.due_amount ?? amount) || 0;

        if (inv.status === 'paid_verified' || inv.status === 'paid_unverified') {
          totalRevenue += amount;
          paidCount += 1;
        } else if (inv.status === 'draft' || inv.status === 'finalized' || inv.status === 'partially_paid') {
          totalPending += due;
        }
      });

      setStats(prev => ({
        ...prev,
        revenue: totalRevenue,
        pending: totalPending,
        total: (allInvoices || []).length,
        paidCount,
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
      const res = await api.get('/invoices/collections');
      setTodayCollections(res?.entries || []);
      setStats(prev => ({
        ...prev,
        todayRevenue: res?.total || 0,
        todayCash: res?.cash || 0,
        todayOnline: res?.online || 0,
      }));
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
      let inflow = 0, outflow = 0, expensesCount = 0;
      (allLedgerData || []).forEach(item => {
        if (item.type === 'expense') {
          outflow += item.amount;
          expensesCount++;
        } else {
          inflow += item.amount;
        }
      });
      setLedgerStats({ inflow, outflow, net: inflow - outflow, expensesCount });
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
        fetchTodayCollections();
        fetchStats();
      } else {
        fetchLedger();
      }
    });
    fetchStats();
    fetchTodayCollections();
  }, [setTitle, setRefreshFunction, activeTab]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchInvoices();
    } else {
      fetchLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, ledgerPage, debouncedSearch, activeTab, filterStatus, filterMode, filterLedgerType, dateFrom, dateTo]);

  // Deep links from global search: ?invoice=<id> opens that invoice,
  // ?tab=ledger lands on the ledger. Params are stripped once applied so a
  // refresh doesn't force the editor back open.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invoiceId = params.get('invoice');
    const tabParam = params.get('tab');
    if (!invoiceId && !tabParam) return;

    if (tabParam === 'ledger' || tabParam === 'payments') setActiveTab(tabParam);
    if (invoiceId) setSelectedInvoiceId(Number(invoiceId));

    params.delete('invoice');
    params.delete('tab');
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
      <div className="px-6 pt-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
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
          <button
            onClick={() => setActiveTab('ledger')}
            className={`${
              activeTab === 'ledger'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Ledger
          </button>
        </nav>
      </div>
      {/* Summary Cards Section */}
      <div className="px-6 pt-6 pb-2">
        <div className={`grid gap-6 mb-8 ${activeTab === 'today' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
          
          {activeTab === 'today' ? (
            <>
              {/* Today Card 1: Total */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-green-50 text-green-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Today's Total</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? "..." : formatCurrency(stats.todayRevenue || 0)}</h4>
                </div>
              </div>
              
              {/* Today Card 2: Cash */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-amber-50 text-amber-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Cash Collection</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? "..." : formatCurrency(stats.todayCash || 0)}</h4>
                </div>
              </div>

              {/* Today Card 3: Online */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Online Collection</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? "..." : formatCurrency(stats.todayOnline || 0)}</h4>
                </div>
              </div>
            </>
          ) : activeTab === 'payments' ? (
            <>
              {/* Card 1: Revenue */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-green-50 text-green-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? "..." : formatCurrency(stats.revenue)}</h4>
                </div>
              </div>
              
              {/* Card 2: Pending */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-orange-50 text-orange-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Pending Amount</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? "..." : formatCurrency(stats.pending)}</h4>
                </div>
              </div>

              {/* Card 3: Total Invoices */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Invoices</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? "..." : stats.total}</h4>
                </div>
              </div>

              {/* Card 4: Paid Invoices */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-[#2a276e]/10 text-[#2a276e] mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Paid Invoices</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? "..." : stats.paidCount}</h4>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Ledger Card 1: Total Inflow */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-green-50 text-green-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Inflow</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{loading ? "..." : formatCurrency(ledgerStats.inflow)}</h4>
                </div>
              </div>
              
              {/* Ledger Card 2: Total Outflow */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-red-50 text-red-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Outflow</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{loading ? "..." : formatCurrency(ledgerStats.outflow)}</h4>
                </div>
              </div>

              {/* Ledger Card 3: Net Balance */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className={`p-3 rounded-lg ${ledgerStats.net >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'} mr-4`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Net Balance</p>
                  <h4 className={`text-2xl font-bold mt-1 ${ledgerStats.net >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {loading ? "..." : formatCurrency(ledgerStats.net)}
                  </h4>
                </div>
              </div>

              {/* Ledger Card 4: Expense Count */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
                <div className="p-3 rounded-lg bg-amber-50 text-amber-600 mr-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Recorded Expenses</p>
                  <h4 className="text-2xl font-bold text-gray-900 mt-1">{loading ? "..." : ledgerStats.expensesCount}</h4>
                </div>
              </div>
            </>
          )}
          
        </div>

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
            <FilterPanel
              tab={activeTab}
              value={filterValue}
              onApply={applyFilters}
              dateEnabled={activeTab !== 'today'}
            />
          </div>
          <div className="w-full sm:w-auto flex space-x-3">
            <button
              onClick={() => setShowExport(true)}
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
          ) : activeTab === 'payments' ? (
            <table className="w-full">
              <thead className="bg-[#f8fafc] border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient Details</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient Details</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#2a276e]">{e.invoice_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{e.patient_name || 'Unknown'}</span>
                        {e.patient_display_id && <span className="text-xs text-gray-400"> · {e.patient_display_id}</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.patient_phone || '-'}</td>
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
        <Pagination
          page={ledgerPage}
          pageSize={LEDGER_PER_PAGE}
          totalItems={ledgerTotalCount}
          onPageChange={setLedgerPage}
          className="flex-shrink-0"
        />
      )}

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
    </div>
  );
};

export default Payments;
