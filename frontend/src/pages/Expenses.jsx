import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { SkeletonBox, SkeletonTableRows } from "../components/Skeleton";
import { api } from "../utils/api";
import { formatMoney } from "../utils/currency";
import { clinicDateKey } from "../utils/datetime";
import FilterPanel from "../components/FilterPanel";
import Pagination from "../components/Pagination";
import EmptyState from "../components/common/EmptyState";
import HelpBulb from "../components/common/HelpBulb";
import ExpenseKpiRow from "../components/expenses/ExpenseKpiRow";
import KpiDetailDrawer from "../components/common/KpiDetailDrawer";
import { buildExpenseKpiDetail } from "./expenses/kpiDetail";
import { CATEGORY_GROUPS } from "../constants/expenseCategories";
import { PayablesRows, PayablesCardList, PAYABLE_COLUMNS } from "../components/expenses/PayablesTable";
import { LedgerRows, LedgerCardList, LEDGER_COLUMNS } from "../components/expenses/LedgerTable";
import { VendorRows, VendorCardList, VENDOR_COLUMNS } from "../components/expenses/VendorsTable";
import VendorFormDrawer from "../components/vendors/VendorFormDrawer";
import ExpenseModal from "../components/payments/ExpenseModal";
import InvoiceEditor from "../components/payments/InvoiceEditor";
import ExportModal from "../components/payments/ExportModal";
import { receipt } from "../assets/illustrations";
import { useBreakpoint } from "../utils/useBreakpoint";

/**
 * Money going out, the mirror of Payments.
 *
 * Payables and the ledger used to sit in two different sections: payables under
 * Inventory, where the question is what is on the shelf, and the ledger inside
 * Payments, next to the invoices that are money coming in. A lab bill is not
 * stock, and outflow beside collections is how the two get read as one number.
 *
 * This page is built to the same skeleton as Payments on purpose — same tab
 * strip, same storytelling KPI row, same FilterPanel, same table container,
 * same Pagination, same stacked cards on small screens. The first version was
 * written from scratch with its own tab styling, its own stat boxes and its own
 * page size, and the result was that the two halves of the clinic's money read
 * like two different products.
 *
 * Below 1024px the tables become the stacked card lists each table module
 * exports. Seven columns do not survive an iPad in portrait.
 *
 * Inventory keeps its own Activity tab. That one is stock movement, not money,
 * and it belongs where the stock is.
 *
 * Tab order follows the work: what is owed, what has moved, who it goes to.
 */

const PER_PAGE = 10;

const TABS = [
  { id: 'payables', label: 'Payables' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'vendors', label: 'Vendors' },
];

const EMPTY_FILTERS = {
  dateFrom: '', dateTo: '', preset: '',
  kind: '', payableStatus: '', ledgerType: '', ledgerCategory: '',
  vendorCategory: '', vendorStatus: '',
};

const PAYABLE_FILTERS = [
  {
    key: 'kind',
    label: 'Kind',
    options: [
      { value: 'lab', label: 'Lab bills' },
      { value: 'consultant', label: 'Consultant fees' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    key: 'payableStatus',
    label: 'Status',
    options: [
      { value: 'unpaid', label: 'Still owed' },
      { value: 'paid', label: 'Settled' },
    ],
  },
];

// A date-only comparison on the clinic's calendar. `dateFrom`/`dateTo` come out
// of FilterPanel as YYYY-MM-DD in clinic time, so comparing the row's own
// clinic day key keeps both sides on the same calendar — a plain `new Date()`
// here would push late-evening rows into the wrong day.
const withinRange = (value, from, to) => {
  if (!from && !to) return true;
  if (!value) return false;
  const key = clinicDateKey(value);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
};

const Expenses = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();

  const [activeTab, setActiveTab] = useState('payables');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValue, setFilterValue] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [payables, setPayables] = useState([]);
  const [ledgerItems, setLedgerItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorOwed, setVendorOwed] = useState({});

  const [vendorDrawer, setVendorDrawer] = useState({ open: false, vendor: null });
  const [savingVendor, setSavingVendor] = useState(false);
  const [expenseId, setExpenseId] = useState(null);
  const [invoiceId, setInvoiceId] = useState(null);
  const [showExport, setShowExport] = useState(false);
  // Which card is open behind the drawer, and the window its chart is drawn
  // over. The window is the drawer's own — the page's date filter says which
  // records exist, this says how the chart's x-axis is cut.
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [kpiPeriod, setKpiPeriod] = useState('all');

  // ?tab=ledger lands on the ledger — the Payments page still points old
  // bookmarks here, and its banner links to exactly that.
  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get('tab');
    if (wanted && TABS.some((t) => t.id === wanted)) setActiveTab(wanted);
  }, [location.search]);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadPayables = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Everything, paid and unpaid. The status filter is applied below rather
      // than in the request so the KPI meter still has both halves to compare —
      // "72% still owed" needs the settled ones to be a percentage of anything.
      const res = await api.get('/clinical/case-costs');
      setPayables(res?.items || []);
    } catch (e) {
      setError(e?.message || 'Could not load payables');
      setPayables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { skip: 0, limit: 10000 };
      if (filterValue.dateFrom) params.date_from = filterValue.dateFrom;
      if (filterValue.dateTo) params.date_to = filterValue.dateTo;
      // The window comes back whole and is sliced here. Paging on the server
      // would be tidier, but /ledger has no search parameter, so a server page
      // would mean the search box only ever looked at the ten rows on screen.
      const rows = await api.get('/ledger/', { params });
      setLedgerItems(rows || []);
    } catch (e) {
      setError(e?.message || 'Could not load the ledger');
      setLedgerItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterValue.dateFrom, filterValue.dateTo]);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // The payables come along rather than just their summary, because the
      // "Owed to vendors" card opens into the individual bills behind each
      // balance — a total with no rows under it is a dead end.
      const [list, costs] = await Promise.all([
        api.get('/vendors'),
        api.get('/clinical/case-costs').catch(() => null),
      ]);
      setVendors(list || []);

      const items = costs?.items || [];
      setPayables(items);
      const owed = {};
      items.filter((c) => c.status === 'unpaid' && c.vendor_id).forEach((c) => {
        owed[c.vendor_id] = (owed[c.vendor_id] || 0) + (Number(c.amount) || 0);
      });
      setVendorOwed(owed);
    } catch (e) {
      setError(e?.message || 'Could not load vendors');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    if (activeTab === 'payables') return loadPayables();
    if (activeTab === 'ledger') return loadLedger();
    return loadVendors();
  }, [activeTab, loadPayables, loadLedger, loadVendors]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { setPage(1); }, [activeTab, searchTerm, filterValue]);

  // ── Payables: window, rows, figures ────────────────────────────────────────

  const matchesSearch = useCallback((haystack) => {
    const s = searchTerm.trim().toLowerCase();
    if (!s) return true;
    return haystack.filter(Boolean).join(' ').toLowerCase().includes(s);
  }, [searchTerm]);

  // The window the KPIs describe: date, kind and search, but NOT status.
  const payableWindow = useMemo(() => payables.filter((r) => {
    if (filterValue.kind && r.kind !== filterValue.kind) return false;
    if (!withinRange(r.created_at, filterValue.dateFrom, filterValue.dateTo)) return false;
    return matchesSearch([r.payee_name, r.vendor_name, r.patient_name, r.description]);
  }), [payables, filterValue.kind, filterValue.dateFrom, filterValue.dateTo, matchesSearch]);

  const payableRows = useMemo(() => (
    filterValue.payableStatus
      ? payableWindow.filter((r) => r.status === filterValue.payableStatus)
      : payableWindow
  ), [payableWindow, filterValue.payableStatus]);

  const payableStats = useMemo(() => {
    const byKind = {};
    const byVendor = {};
    let unpaid = 0, paid = 0, unpaidCount = 0;

    payableWindow.forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (r.status === 'paid') { paid += amt; return; }
      unpaid += amt;
      unpaidCount += 1;
      const k = byKind[r.kind] || (byKind[r.kind] = { amount: 0, count: 0 });
      k.amount += amt;
      k.count += 1;
      const name = r.payee_name || r.vendor_name || 'Unassigned';
      byVendor[name] = (byVendor[name] || 0) + amt;
    });

    return {
      unpaid, paid, unpaidCount, byKind,
      vendors: Object.entries(byVendor)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [payableWindow]);

  // ── Ledger: window, rows, figures ──────────────────────────────────────────

  const ledgerRows = useMemo(() => ledgerItems.filter((item) => {
    if (filterValue.ledgerType && item.type !== filterValue.ledgerType) return false;
    if (filterValue.ledgerCategory && item.category !== filterValue.ledgerCategory) return false;
    return matchesSearch([item.entity_name, item.description, item.category, item.payment_method]);
  }), [ledgerItems, filterValue.ledgerType, filterValue.ledgerCategory, matchesSearch]);

  // Built from the categories actually present rather than the whole chart of
  // accounts: a clinic that has never paid for security should not have to
  // scroll past it. Grouped in the same order the expense form offers them.
  const ledgerFilters = useMemo(() => {
    const present = new Set(ledgerItems.filter((r) => r.type === 'expense').map((r) => r.category).filter(Boolean));
    const ordered = [
      ...CATEGORY_GROUPS.flatMap((g) => g.categories).filter((c) => present.has(c)),
      ...[...present].filter((c) => !CATEGORY_GROUPS.some((g) => g.categories.includes(c))).sort(),
    ];
    return [
      {
        key: 'ledgerType',
        label: 'Direction',
        options: [
          { value: 'expense', label: 'Money out' },
          { value: 'invoice', label: 'Money in' },
        ],
      },
      { key: 'ledgerCategory', label: 'Category', options: ordered },
    ];
  }, [ledgerItems]);

  // What the cards and their drawers describe: the window, narrowed by search
  // and by category, but NOT by the in/out toggle. Switching to "Money out"
  // must not make the net position look like it changed, whereas narrowing to
  // Rent is a question about rent and the cards should answer it.
  const ledgerScope = useMemo(() => ledgerItems.filter((item) => {
    if (filterValue.ledgerCategory && item.category !== filterValue.ledgerCategory) return false;
    return matchesSearch([item.entity_name, item.description, item.category, item.payment_method]);
  }), [ledgerItems, filterValue.ledgerCategory, matchesSearch]);

  const ledgerStats = useMemo(() => {
    const scoped = ledgerScope;

    let inflow = 0, outflow = 0, expensesCount = 0;
    const byCategory = {};
    scoped.forEach((item) => {
      const amt = Number(item.amount) || 0;
      if (item.type === 'expense') {
        outflow += amt;
        expensesCount += 1;
        const cat = item.category || 'Uncategorised';
        byCategory[cat] = (byCategory[cat] || 0) + amt;
      } else {
        inflow += amt;
      }
    });
    const categories = Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { inflow, outflow, expensesCount, categories, topCategory: categories[0]?.category || null };
  }, [ledgerScope]);

  // ── Vendors: window, rows, figures ─────────────────────────────────────────

  const vendorCategories = useMemo(() => {
    const seen = new Map();
    vendors.forEach((v) => {
      const c = v.category || 'General';
      seen.set(c, (seen.get(c) || 0) + 1);
    });
    return [...seen.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [vendors]);

  const vendorFilters = useMemo(() => [
    {
      key: 'vendorCategory',
      label: 'Category',
      options: vendorCategories.map((c) => ({ value: c.category, label: c.category })),
    },
    {
      key: 'vendorStatus',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ], [vendorCategories]);

  const vendorRows = useMemo(() => vendors.filter((v) => {
    if (filterValue.vendorCategory && (v.category || 'General') !== filterValue.vendorCategory) return false;
    if (filterValue.vendorStatus === 'active' && !v.is_active) return false;
    if (filterValue.vendorStatus === 'inactive' && v.is_active) return false;
    return matchesSearch([v.name, v.category, v.contact_name, v.phone, v.email]);
  }), [vendors, filterValue.vendorCategory, filterValue.vendorStatus, matchesSearch]);

  const vendorStats = useMemo(() => {
    const owedValues = Object.values(vendorOwed);
    return {
      total: vendors.length,
      active: vendors.filter((v) => v.is_active).length,
      categories: vendorCategories,
      owed: owedValues.reduce((s, n) => s + (Number(n) || 0), 0),
      owedCount: owedValues.filter((n) => Number(n) > 0).length,
    };
  }, [vendors, vendorCategories, vendorOwed]);

  // ── The card breakdowns ────────────────────────────────────────────────────

  const kpiDetail = useMemo(() => (
    selectedKpi
      ? buildExpenseKpiDetail({
        metric: selectedKpi.key,
        period: kpiPeriod,
        // Payables and vendors go in whole; the ledger goes in as the window
        // the page filters produced. Both are then cut again by the drawer's
        // own period, so the drawer can never show a record the page hid.
        payables: payableWindow,
        ledgerItems: ledgerScope,
        vendors,
        vendorOwed,
      })
      : undefined
  ), [selectedKpi, kpiPeriod, payableWindow, ledgerScope, vendors, vendorOwed]);

  // ── The rows the table actually paints ─────────────────────────────────────

  const allRows = activeTab === 'payables' ? payableRows
    : activeTab === 'ledger' ? ledgerRows
      : vendorRows;

  const currentItems = useMemo(
    () => allRows.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [allRows, page],
  );

  const columns = activeTab === 'payables' ? PAYABLE_COLUMNS
    : activeTab === 'ledger' ? LEDGER_COLUMNS
      : VENDOR_COLUMNS;

  // ── Actions ────────────────────────────────────────────────────────────────

  const settle = async (row) => {
    setBusyId(row.id);
    try {
      await api.post(`/clinical/case-costs/${row.id}/settle`, { payment_method: 'Cash' });
      toast.success(`Paid ${formatMoney(row.amount)} to ${row.payee_name || 'vendor'}`);
      await loadPayables();
    } catch (e) {
      toast.error(e?.message || 'Could not record that payment');
    } finally {
      setBusyId(null);
    }
  };

  const unsettle = async (row) => {
    setBusyId(row.id);
    try {
      await api.post(`/clinical/case-costs/${row.id}/unsettle`);
      toast.info('Payment undone, and its expense removed from the ledger');
      await loadPayables();
    } catch (e) {
      toast.error(e?.message || 'Could not undo that');
    } finally {
      setBusyId(null);
    }
  };

  const saveVendor = async (form) => {
    if (!form.name) return;
    setSavingVendor(true);
    try {
      if (vendorDrawer.vendor) {
        await api.put(`/vendors/${vendorDrawer.vendor.id}`, form);
        toast.success(`${form.name} updated`);
      } else {
        await api.post('/vendors', form);
        toast.success(`${form.name} added`);
      }
      setVendorDrawer({ open: false, vendor: null });
      await loadVendors();
    } catch (e) {
      toast.error(e?.message || 'Could not save that vendor');
    } finally {
      setSavingVendor(false);
    }
  };

  const emptyState = activeTab === 'payables'
    ? {
      title: filterValue.payableStatus === 'paid' ? 'Nothing settled here yet' : 'Nothing owed right now',
      subtitle: 'A lab bill appears here as soon as a lab order has a cost on it. Consultant fees are added from the case paper.',
    }
    : activeTab === 'ledger'
      ? {
        title: 'Nothing moved in this window',
        subtitle: 'Every payment collected and every expense recorded shows up here, newest first.',
      }
      : {
        title: 'No vendors yet',
        subtitle: 'Add the labs, suppliers and consultants you pay, and their bills can be tracked against them.',
      };

  const emptyBlock = <EmptyState image={receipt} title={emptyState.title} subtitle={emptyState.subtitle} />;

  return (
    <div className="flex flex-col h-screen bg-gray-50/30">
      {/* Tabs */}
      <div className="px-4 md:px-6 pt-4 border-b border-gray-200 flex items-end justify-between gap-3">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); navigate('/expenses', { replace: true }); }}
              className={`${
                activeTab === t.id
                  ? 'border-[#2a276e] text-[#2a276e]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <HelpBulb section="expenses" className="mb-2" />
      </div>

      {/* Summary cards. Same spacing as Payments and the dashboard
          (pt-4 / gap-3 / mb-4) so the three screens line up vertically. */}
      <div className="px-4 md:px-6 pt-4 pb-2 flex-shrink-0">
        <ExpenseKpiRow
          tab={activeTab}
          payables={payableStats}
          ledger={ledgerStats}
          vendors={vendorStats}
          onSelect={setSelectedKpi}
        />

        {/* Settling is the one action on this page that writes somewhere else,
            so it is said out loud rather than discovered. */}
        {activeTab === 'payables' && payableStats.unpaidCount > 0 && (
          <p className="mt-2.5 text-[11px] text-gray-500">
            Marking one paid records it as an expense, so it lands in the Ledger and counts against your net.
          </p>
        )}
      </div>

      <div className="px-4 md:px-6 flex-shrink-0">
        {/* Search, filters and the tab's action.
            Split at `lg`, not `sm`. On iPad portrait this row has a search box,
            a filter trigger, Export and Record expense in it; side by side at
            768px the search shrank past its own placeholder and rendered as a
            bare magnifying glass. */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
          <div className="flex items-center gap-3 w-full lg:w-auto flex-1 min-w-0">
            <div className="flex-1 min-w-0 lg:max-w-sm relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder={
                  activeTab === 'payables' ? 'Search payables...'
                    : activeTab === 'ledger' ? 'Search the ledger...'
                      : 'Search vendors...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
              />
            </div>
            <FilterPanel
              tab={activeTab === 'ledger' ? 'ledger' : activeTab}
              value={filterValue}
              onApply={(next) => setFilterValue({ ...EMPTY_FILTERS, ...next })}
              /* A vendor has no date to filter on — the list is who you pay,
                 not when. Offering a range there would return an empty table
                 and look like a bug. */
              dateEnabled={activeTab !== 'vendors'}
              filters={activeTab === 'payables' ? PAYABLE_FILTERS
                : activeTab === 'vendors' ? vendorFilters
                  : ledgerFilters}
            />
          </div>

          <div className="w-full lg:w-auto flex gap-3 flex-shrink-0">
            {activeTab === 'ledger' && (
              <button
                onClick={() => setShowExport(true)}
                className="flex-1 lg:flex-none inline-flex justify-center items-center whitespace-nowrap px-4 py-2.5 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a276e] transition-colors"
              >
                <svg className="mr-2 h-5 w-5 text-[#2a276e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            )}
            {activeTab === 'vendors' ? (
              <button
                onClick={() => setVendorDrawer({ open: true, vendor: null })}
                className="flex-1 lg:flex-none inline-flex justify-center items-center whitespace-nowrap px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#2a276e] hover:bg-[#1e1c4f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a276e] transition-colors"
              >
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add vendor
              </button>
            ) : (
              <button
                onClick={() => setExpenseId('new')}
                className="flex-1 lg:flex-none inline-flex justify-center items-center whitespace-nowrap px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600 transition-colors"
              >
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Record expense
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table container */}
      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="h-full overflow-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          {loading && allRows.length === 0 ? (
            <table className="w-full">
              <thead className="bg-[#f8fafc] border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  {columns.map((_, i) => (
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
                    <h3 className="text-sm font-medium text-red-800">Could not load this tab</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                    <button
                      onClick={reload}
                      className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded border border-red-300 font-medium transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : breakpoint !== 'desktop' ? (
            // Every tab here is seven columns wide, and seven columns have no
            // honest layout below 1024px — on iPad portrait the description
            // column came out three words wide and the rest scrolled off the
            // side. Stacked cards until there is room for the table.
            currentItems.length === 0 ? (
              <div className="px-4 py-8">{emptyBlock}</div>
            ) : activeTab === 'payables' ? (
              <PayablesCardList rows={currentItems} busyId={busyId} onSettle={settle} onUnsettle={unsettle} />
            ) : activeTab === 'ledger' ? (
              <LedgerCardList rows={currentItems} onOpenExpense={setExpenseId} onOpenInvoice={setInvoiceId} />
            ) : (
              <VendorCardList
                rows={currentItems}
                owedBy={vendorOwed}
                onEdit={(v) => setVendorDrawer({ open: true, vendor: v })}
              />
            )
          ) : (
            <table className="w-full">
              <thead className="bg-[#f8fafc] border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  {columns.map((label, i) => (
                    <th
                      key={i}
                      className={`px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                        label ? 'text-left' : 'text-right'
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-8">{emptyBlock}</td>
                  </tr>
                ) : activeTab === 'payables' ? (
                  <PayablesRows rows={currentItems} busyId={busyId} onSettle={settle} onUnsettle={unsettle} />
                ) : activeTab === 'ledger' ? (
                  <LedgerRows rows={currentItems} onOpenExpense={setExpenseId} onOpenInvoice={setInvoiceId} />
                ) : (
                  <VendorRows
                    rows={currentItems}
                    owedBy={vendorOwed}
                    onEdit={(v) => setVendorDrawer({ open: true, vendor: v })}
                  />
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination — the same shared component the patient and payment lists use */}
      <Pagination
        page={page}
        pageSize={PER_PAGE}
        totalItems={allRows.length}
        onPageChange={setPage}
        className="flex-shrink-0"
      />

      {/* FormDrawer animates on `open`, and takes `onSubmit`, not `onSaved` —
          the previous version of this page passed neither, so Add vendor
          opened nothing and Edit saved nothing. */}
      <VendorFormDrawer
        open={vendorDrawer.open}
        vendor={vendorDrawer.vendor}
        submitting={savingVendor}
        onClose={() => setVendorDrawer({ open: false, vendor: null })}
        onSubmit={saveVendor}
      />

      {expenseId && (
        <ExpenseModal
          expenseId={expenseId}
          onClose={() => setExpenseId(null)}
          onSave={reload}
        />
      )}

      {invoiceId && (
        <InvoiceEditor
          invoiceId={invoiceId}
          onClose={() => { setInvoiceId(null); reload(); }}
          onSave={() => { setInvoiceId(null); reload(); }}
        />
      )}

      <ExportModal open={showExport} onClose={() => setShowExport(false)} mode="ledger" />

      {/* The card's breakdown. Built here rather than fetched: the page already
          holds every row the cards were computed from, so a round trip would
          only add a way for the drawer and the card above it to disagree. */}
      <KpiDetailDrawer
        card={selectedKpi}
        data={kpiDetail}
        onPeriodChange={setKpiPeriod}
        onClose={() => setSelectedKpi(null)}
      />
    </div>
  );
};

export default Expenses;
