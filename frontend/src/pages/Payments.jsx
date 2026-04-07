import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";
import InvoiceEditor from "../components/payments/InvoiceEditor";
import InvoiceItem from "../components/payments/InvoiceItem";
import ExpenseModal from "../components/payments/ExpenseModal";

const INVOICES_PER_PAGE = 10;
const LEDGER_PER_PAGE = 10;

const Payments = () => {
  const { user } = useAuth();
  const { setTitle, setRefreshFunction } = useHeader();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [stats, setStats] = useState({ revenue: 0, pending: 0, total: 0, paidCount: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Ledger states
  const [activeTab, setActiveTab] = useState('payments'); // 'payments' or 'ledger'
  const [ledgerItems, setLedgerItems] = useState([]);
  const [ledgerTotalCount, setLedgerTotalCount] = useState(0);
  const [ledgerStats, setLedgerStats] = useState({ inflow: 0, outflow: 0, net: 0, expensesCount: 0 });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);

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
      
      setStats({
        revenue: totalRevenue,
        pending: totalPending,
        total: (allInvoices || []).length,
        paidCount
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch invoices from API with pagination and search
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError("");
      
      const skip = (page - 1) * INVOICES_PER_PAGE;
      
      const params = {
        skip: skip,
        limit: INVOICES_PER_PAGE
      };
      
      const invoicesData = await api.get('/invoices', { params });
      setInvoices(invoicesData || []);
      
      if (invoicesData && invoicesData.length === INVOICES_PER_PAGE) {
        setTotalCount((page) * INVOICES_PER_PAGE + 1);
      } else {
        setTotalCount((page - 1) * INVOICES_PER_PAGE + (invoicesData?.length || 0));
      }
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
      const data = await api.get('/ledger/', { params: { skip, limit: LEDGER_PER_PAGE } });
      setLedgerItems(data || []);
      
      // Compute Ledger Stats (this could be optimized via a backend stats route)
      const allLedgerData = await api.get('/ledger/', { params: { skip: 0, limit: 10000 } });
      let inflow = 0, outflow = 0, expensesCount = 0;
      (allLedgerData || []).forEach(item => {
        if (item.type === 'invoice' && item.status?.includes('paid')) {
          inflow += item.amount;
        } else if (item.type === 'expense') {
          outflow += item.amount;
          expensesCount++;
        }
      });
      setLedgerStats({ inflow, outflow, net: inflow - outflow, expensesCount });
      
      if (data && data.length === LEDGER_PER_PAGE) {
        setLedgerTotalCount((ledgerPage) * LEDGER_PER_PAGE + 1);
      } else {
        setLedgerTotalCount((ledgerPage - 1) * LEDGER_PER_PAGE + (data?.length || 0));
      }
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
      } else {
        fetchLedger();
      }
    });
    fetchStats();
  }, [setTitle, setRefreshFunction, activeTab]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchInvoices();
    } else {
      fetchLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, ledgerPage, debouncedSearch, activeTab]);

  const handleInvoiceSelect = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
  };

  const handleInvoiceClose = () => {
    setSelectedInvoiceId(null);
    fetchInvoices();
    fetchStats();
    if (activeTab === 'ledger') fetchLedger();
  };

  const handleExpenseSave = () => {
    fetchLedger();
  };

  // Filter items client-side for search
  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.patient_name?.toLowerCase().includes(searchLower) ||
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.patient_phone?.toLowerCase().includes(searchLower)
    );
  });
  
  const filteredLedger = ledgerItems.filter((item) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.entity_name?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.category?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = activeTab === 'payments' 
    ? Math.ceil(totalCount / INVOICES_PER_PAGE) || 1
    : Math.ceil(ledgerTotalCount / LEDGER_PER_PAGE) || 1;
    
  const currentPageDisplay = activeTab === 'payments' ? page : ledgerPage;

  const currentItems = activeTab === 'payments' ? filteredInvoices : filteredLedger;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50/30">
      
      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('payments')}
            className={`${
              activeTab === 'payments'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Payments (Patients)
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`${
              activeTab === 'ledger'
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Ledger (All Transactions)
          </button>
        </nav>
      </div>
      {/* Summary Cards Section */}
      <div className="px-6 pt-6 pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {activeTab === 'payments' ? (
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

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="w-full sm:max-w-md">
            <div className="relative border border-gray-200 rounded-lg bg-white focus-within:ring-1 focus-within:ring-[#2a276e] focus-within:border-[#2a276e] transition-colors shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-none bg-transparent focus:outline-none text-sm placeholder-gray-500"
              />
            </div>
          </div>
          <div className="w-full sm:w-auto flex space-x-3">
            {activeTab === 'payments' ? (
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
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <GearLoader size="w-8 h-8" className="mx-auto" />
                <p className="mt-2 text-sm text-gray-600">Loading ledger data...</p>
              </div>
            </div>
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div>
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="mt-2 text-lg font-medium text-gray-900">No ledgers found</p>
                        <p className="text-sm text-gray-500 mt-1">Invoices and transactions will appear here.</p>
                      </div>
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
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div>
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="mt-2 text-lg font-medium text-gray-900">No ledger items found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => (
                    <tr key={`${item.type}_${item.id}`} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => item.type === 'invoice' ? handleInvoiceSelect(item.id) : setSelectedExpenseId(item.id)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString()}
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

      {/* Pagination Container */}
      {totalPages > 1 && (
        <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => activeTab === 'payments' ? setPage(page - 1) : setLedgerPage(ledgerPage - 1)}
              disabled={currentPageDisplay === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => activeTab === 'payments' ? setPage(page + 1) : setLedgerPage(ledgerPage + 1)}
              disabled={currentPageDisplay === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPageDisplay - 1) * INVOICES_PER_PAGE + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPageDisplay * INVOICES_PER_PAGE, activeTab === 'payments' ? totalCount : ledgerTotalCount)}</span> of{' '}
                <span className="font-medium">{activeTab === 'payments' ? totalCount : ledgerTotalCount}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => activeTab === 'payments' ? setPage(page - 1) : setLedgerPage(ledgerPage - 1)}
                  disabled={currentPageDisplay === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => activeTab === 'payments' ? setPage(pageNum) : setLedgerPage(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                      currentPageDisplay === pageNum
                        ? 'z-10 bg-[#2a276e] border-[#2a276e] text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                
                <button
                  onClick={() => activeTab === 'payments' ? setPage(page + 1) : setLedgerPage(ledgerPage + 1)}
                  disabled={currentPageDisplay === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default Payments;
