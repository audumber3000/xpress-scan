import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { notify } from '../utils/notify';
import { SkeletonBox, SkeletonTableRows } from "../components/Skeleton";
import { api } from "../utils/api";
import { formatMoney } from "../utils/currency";
import { clinicDateKey, clinicToday } from "../utils/datetime";
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
import { PettyCashRows, PettyCashCardList, PETTY_CASH_COLUMNS } from "../components/expenses/PettyCashTable";
import VendorFormDrawer from "../components/vendors/VendorFormDrawer";
import FormDrawer, { Field, TextInput, SelectInput } from "../components/FormDrawer";
import { ALL_CATEGORIES } from "../constants/expenseCategories";
import ExpenseModal from "../components/payments/ExpenseModal";
import InvoiceEditor from "../components/payments/InvoiceEditor";
import ExportModal from "../components/payments/ExportModal";
import { receipt } from "../assets/illustrations";
import { useBreakpoint } from "../utils/useBreakpoint";
import useDockedHeader from "../utils/useDockedHeader";
import MoreMenu from "../components/common/MoreMenu";
import { ColGroup, ResizeHandle } from "../components/common/ColumnResizer";
import useColumnWidths from "../utils/useColumnWidths";
import { Download, Columns3, Wallet, ArrowUpRight, Scale, ClipboardCheck } from "lucide-react";

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

// Ten rows was a page of table and half a page of nothing once the summary
// cards scroll away. Slicing is client side here, so this costs nothing.
const PER_PAGE = 25;

/**
 * A supplier bill, in the shape the payables table already speaks.
 *
 * `amount` is what is STILL OWED, not the face value of the bill: the column is
 * headed "Amount" on a list of things you owe, and a 50,000 bill with 45,000
 * already paid is 5,000 of exposure. Showing the full figure would make a
 * clinic that pays promptly look like one that does not, and would not add up
 * to the total on the card above it.
 */
const emptyBillForm = () => ({
  vendor_id: '', bill_number: '', bill_date: clinicToday(),
  terms_days: '', amount: '', category: 'Dental materials', notes: '',
});

const normaliseBill = (b) => ({
  id: `bill-${b.id}`,
  billId: b.id,
  source: 'bill',
  kind: 'bill',
  created_at: b.bill_date,
  due_date: b.due_date,
  days_overdue: b.days_overdue,
  payee_name: b.vendor_name,
  patient_name: null,
  description: b.bill_number ? `Bill #${b.bill_number}` : 'Supplier bill',
  amount: b.status === 'paid' ? b.amount : b.outstanding,
  paid_so_far: b.paid,
  total_amount: b.amount,
  status: b.status === 'paid' ? 'paid' : 'unpaid',
  vendor_id: b.vendor_id,
  payments: b.payments || [],
  bill_file_url: b.bill_file_url || null,
  has_attachment: !!b.has_attachment,
});

const TABS = [
  { id: 'payables', label: 'Payables' },
  // Supplier bills live inside Payables rather than beside it: both are money
  // the clinic owes, and two tabs meant adding two numbers together to know
  // what that was. Petty cash stays separate — a float is not an obligation.
  { id: 'ledger', label: 'Ledger' },
  { id: 'petty_cash', label: 'Petty cash' },
  { id: 'vendors', label: 'Vendors' },
];

const EMPTY_FILTERS = {
  dateFrom: '', dateTo: '', preset: '',
  kind: '', payableStatus: '', ledgerType: '', ledgerCategory: '',
  vendorCategory: '', vendorStatus: '',
};

const PETTY_CASH_FILTERS = [
  {
    key: 'kind',
    label: 'Kind',
    options: [
      { value: 'top_up', label: 'Top-ups' },
      { value: 'spend', label: 'Spends' },
      { value: 'adjustment', label: 'Adjustments' },
    ],
  },
];

const PAYABLE_FILTERS = [
  {
    key: 'kind',
    label: 'Kind',
    options: [
      { value: 'lab', label: 'Lab bills' },
      { value: 'consultant', label: 'Consultant fees' },
      { value: 'bill', label: 'Supplier bills' },
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
  // The page scrolls as one and the tab strip and filter bar dock at the top.
  const { tabsRef, filtersRef, offsets } = useDockedHeader();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValue, setFilterValue] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  // Supplier bills: the record drawer and the pay dialog.
  const [billDrawer, setBillDrawer] = useState(false);
  const [billForm, setBillForm] = useState(emptyBillForm);
  const [savingBill, setSavingBill] = useState(false);
  const [payBill, setPayBill] = useState(null);
  // The supplier's bill, chosen before the record exists. Uploaded the moment
  // the bill is created — there is nowhere to attach it before that.
  const [billFile, setBillFile] = useState(null);
  // Petty cash: the movements, the derived balance and the last count.
  const [petty, setPetty] = useState({ items: [], balance: 0, opening_balance: 0,
                                       topped_up: 0, spent: 0 });
  const [lastClose, setLastClose] = useState(null);
  const [cashDrawer, setCashDrawer] = useState(null);   // the entry being added
  const [closeDrawer, setCloseDrawer] = useState(null); // the day close
  const [savingCash, setSavingCash] = useState(false);

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
      // Both sources of "what we owe", in one request pair. They are raised
      // differently — case costs per case, supplier bills per vendor — but the
      // question is the same, so the answer is one list.
      const [costs, bills] = await Promise.all([
        api.get('/clinical/case-costs'),
        api.get('/purchase-bills').catch(() => ({ items: [] })),
      ]);
      setPayables([
        ...(costs?.items || []).map((c) => ({ ...c, source: 'case' })),
        ...(bills?.items || []).filter((b) => b.status !== 'cancelled').map(normaliseBill),
      ]);
    } catch (e) {
      setError(e?.message || 'Could not load payables');
      setPayables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPettyCash = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, balance] = await Promise.all([
        api.get('/petty-cash'),
        api.get('/petty-cash/balance'),
      ]);
      setPetty(list || { items: [] });
      setLastClose(balance?.last_close || null);
    } catch (e) {
      setError(e?.message || 'Could not load petty cash');
      setPetty({ items: [], balance: 0, topped_up: 0, spent: 0 });
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
      const [list, costs, bills] = await Promise.all([
        api.get('/vendors'),
        api.get('/clinical/case-costs').catch(() => null),
        api.get('/purchase-bills').catch(() => ({ items: [] })),
      ]);
      setVendors(list || []);

      const items = [
        ...(costs?.items || []).map((c) => ({ ...c, source: 'case' })),
        ...(bills?.items || []).filter((b) => b.status !== 'cancelled').map(normaliseBill),
      ];
      setPayables(items);
      const owed = {};
      items.filter((c) => c.status === 'unpaid' && c.vendor_id).forEach((c) => {
        owed[c.vendor_id] = (owed[c.vendor_id] || 0) + (Number(c.amount) || 0);
      });
      // Supplier bills count against the same vendor balance: a lab that also
      // invoices for materials is owed one figure, not two.
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
    if (activeTab === 'petty_cash') return loadPettyCash();
    return loadVendors();
  }, [activeTab, loadPayables, loadLedger, loadVendors, loadPettyCash]);

  useEffect(() => { reload(); }, [reload]);
  // The bill drawer's supplier picker lives on the payables tab, so the names
  // have to exist there too. Deliberately NOT `loadVendors`: that one also
  // rebuilds `payables`, and on mount it raced the payables loader and won,
  // wiping the merged list back to case costs only.
  useEffect(() => {
    api.get('/vendors').then((list) => setVendors(list || [])).catch(() => {});
  }, []);
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
    // Only bills carry a due date, so only bills can be late. Tracked here
    // rather than derived in the card so the figure and the rows it describes
    // come from the same pass over the same filtered window.
    let overdue = 0, overdueCount = 0;

    payableWindow.forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (r.status === 'paid') { paid += amt; return; }
      unpaid += amt;
      unpaidCount += 1;
      if (r.days_overdue > 0) { overdue += amt; overdueCount += 1; }
      const k = byKind[r.kind] || (byKind[r.kind] = { amount: 0, count: 0 });
      k.amount += amt;
      k.count += 1;
      const name = r.payee_name || r.vendor_name || 'Unassigned';
      byVendor[name] = (byVendor[name] || 0) + amt;
    });

    return {
      unpaid, paid, unpaidCount, byKind, overdue, overdueCount,
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

  // ── Petty cash: rows and figures ───────────────────────────────────────────

  const pettyRows = useMemo(() => (petty.items || []).filter((r) => {
    if (filterValue.kind && r.kind !== filterValue.kind) return false;
    if (!withinRange(r.occurred_on, filterValue.dateFrom, filterValue.dateTo)) return false;
    return matchesSearch([r.description, r.category, r.kind]);
  }), [petty.items, filterValue.kind, filterValue.dateFrom, filterValue.dateTo, matchesSearch]);

  const pettyStats = useMemo(() => ({
    // The balance is the server's, not a sum of the visible rows: filtering the
    // list must not change what is in the drawer.
    balance: petty.balance || 0,
    toppedUp: petty.topped_up || 0,
    spent: petty.spent || 0,
    spendCount: (petty.items || []).filter((r) => r.kind === 'spend').length,
    lastClose,
  }), [petty, lastClose]);

  // ── The rows the table actually paints ─────────────────────────────────────

  const allRows = activeTab === 'payables' ? payableRows
    : activeTab === 'ledger' ? ledgerRows
      : activeTab === 'petty_cash' ? pettyRows
        : vendorRows;

  const currentItems = useMemo(
    () => allRows.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [allRows, page],
  );

  const columns = activeTab === 'payables' ? PAYABLE_COLUMNS
    : activeTab === 'ledger' ? LEDGER_COLUMNS
      : activeTab === 'petty_cash' ? PETTY_CASH_COLUMNS
        : VENDOR_COLUMNS;
  // One hook, four tables. The storage key carries the tab, so each keeps its
  // own layout and switching tabs reloads the right one.
  const { tableRef, widths, startResize, reset: resetColumns } = useColumnWidths(
    `expenses.${activeTab}`, columns,
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const settle = async (row) => {
    // A case cost settles in one move — it is owed in full or not at all. A
    // supplier bill can be part-paid, so it opens the dialog instead of
    // silently paying the whole balance the moment the button is pressed.
    if (row.source === 'bill') {
      setPayBill({ row, amount: String(row.amount), paid_on: clinicToday(),
                   payment_method: 'Cash', reference: '', from_petty_cash: false });
      return;
    }
    setBusyId(row.id);
    try {
      await api.post(`/clinical/case-costs/${row.id}/settle`, { payment_method: 'Cash' });
      notify.done(`Paid ${formatMoney(row.amount)} to ${row.payee_name || 'vendor'}`);
      await loadPayables();
    } catch (e) {
      notify.problem(e?.message || 'Could not record that payment');
    } finally {
      setBusyId(null);
    }
  };

  const recordBillPayment = async () => {
    if (!payBill?.amount) return;
    setBusyId(payBill.row.id);
    try {
      await api.post(`/purchase-bills/${payBill.row.billId}/payments`, {
        amount: Number(payBill.amount),
        paid_on: payBill.paid_on,
        payment_method: payBill.payment_method,
        reference: payBill.reference || null,
        from_petty_cash: payBill.from_petty_cash,
      });
      notify.done(`Paid ${formatMoney(Number(payBill.amount))} to ${payBill.row.payee_name}`);
      setPayBill(null);
      await loadPayables();
    } catch (e) {
      notify.problem(e?.message || 'Could not record that payment');
    } finally {
      setBusyId(null);
    }
  };

  const saveCashEntry = async (e) => {
    e?.preventDefault?.();
    if (!cashDrawer?.amount) return;
    setSavingCash(true);
    try {
      await api.post('/petty-cash', {
        kind: cashDrawer.kind,
        amount: Number(cashDrawer.amount),
        occurred_on: cashDrawer.occurred_on,
        description: cashDrawer.description || null,
        category: cashDrawer.kind === 'spend' ? cashDrawer.category : null,
        increases_float: cashDrawer.increases_float,
      });
      notify.done(
        cashDrawer.kind === 'top_up' ? 'Float topped up'
          : cashDrawer.kind === 'spend' ? 'Spend recorded, and added to your ledger'
            : 'Adjustment recorded',
      );
      setCashDrawer(null);
      await loadPettyCash();
    } catch (err) {
      notify.problem(err?.message || 'Could not record that');
    } finally {
      setSavingCash(false);
    }
  };

  const removeCashEntry = async (row) => {
    setBusyId(row.id);
    try {
      await api.delete(`/petty-cash/${row.id}`);
      notify.done('Removed, and its expense taken out of the ledger');
      await loadPettyCash();
    } catch (e) {
      notify.problem(e?.message || 'Could not remove that');
    } finally {
      setBusyId(null);
    }
  };

  const closeCashDay = async (e) => {
    e?.preventDefault?.();
    if (closeDrawer?.counted_amount === '') return;
    setSavingCash(true);
    try {
      const res = await api.post('/petty-cash/close', {
        counted_amount: Number(closeDrawer.counted_amount),
        closed_on: closeDrawer.closed_on,
        notes: closeDrawer.notes || null,
      });
      const v = res?.variance || 0;
      notify.done(v === 0
        ? 'Day closed, and the drawer balanced'
        : `Day closed. ${formatMoney(Math.abs(v))} ${v < 0 ? 'short' : 'over'}, recorded as it stands.`);
      setCloseDrawer(null);
      await loadPettyCash();
    } catch (err) {
      notify.problem(err?.message || 'Could not close the day');
    } finally {
      setSavingCash(false);
    }
  };

  const openCashEntry = (kind) => setCashDrawer({
    kind, amount: '', occurred_on: clinicToday(), description: '',
    category: 'Other', increases_float: true,
  });

  const attachBillFile = async (billId, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { notify.problem('That file is over 10 MB'); return; }
    const body = new FormData();
    body.append('file', file, file.name);
    await api.post(`/purchase-bills/${billId}/attachment`, body);
  };

  const attachToRow = async (row, file) => {
    setBusyId(row.id);
    try {
      await attachBillFile(row.billId, file);
      notify.done('Bill attached');
      await loadPayables();
    } catch (e) {
      notify.problem(e?.message || 'Could not attach that file');
    } finally {
      setBusyId(null);
    }
  };

  const saveBill = async (e) => {
    e?.preventDefault?.();
    if (!billForm.vendor_id || !billForm.amount) return;
    setSavingBill(true);
    try {
      const body = {
        vendor_id: Number(billForm.vendor_id),
        bill_number: billForm.bill_number || null,
        bill_date: billForm.bill_date,
        amount: Number(billForm.amount),
        category: billForm.category,
        notes: billForm.notes || null,
      };
      if (billForm.terms_days !== '') body.terms_days = Number(billForm.terms_days);
      const created = await api.post('/purchase-bills', body);
      // The file goes up once the bill exists. Not fatal: a bill recorded
      // without its PDF is still a bill recorded, and the row can take the file
      // afterwards — losing the whole entry over an upload would be wrong.
      if (billFile && created?.id) {
        try {
          await attachBillFile(created.id, billFile);
        } catch {
          notify.problem('Bill recorded, but the file did not upload. Attach it from the row.');
        }
      }
      notify.done('Bill recorded. Nothing leaves your account until you pay it.');
      setBillDrawer(false);
      setBillForm(emptyBillForm());
      setBillFile(null);
      await loadPayables();
    } catch (err) {
      notify.problem(err?.message || 'Could not save that bill');
    } finally {
      setSavingBill(false);
    }
  };

  const unsettle = async (row) => {
    setBusyId(row.id);
    try {
      if (row.source === 'bill') {
        // Bills are settled by payments, so undoing one means reversing the
        // most recent payment rather than flipping a status.
        const last = row.payments?.[row.payments.length - 1];
        if (!last) { notify.problem('Nothing to undo on this bill'); return; }
        await api.delete(`/purchase-bills/${row.billId}/payments/${last.id}`);
        notify.done('Payment undone, and its expense removed from the ledger');
        await loadPayables();
        return;
      }
      await api.post(`/clinical/case-costs/${row.id}/unsettle`);
      notify.done('Payment undone, and its expense removed from the ledger');
      await loadPayables();
    } catch (e) {
      notify.problem(e?.message || 'Could not undo that');
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
      } else {
        await api.post('/vendors', form);
        notify.done(`${form.name} added`);
      }
      setVendorDrawer({ open: false, vendor: null });
      await loadVendors();
    } catch (e) {
      notify.problem(e?.message || 'Could not save that vendor');
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
      : activeTab === 'petty_cash'
        ? {
          title: 'Nothing in the drawer yet',
          subtitle: 'Top up the float with what you keep in the drawer, then record what comes out of it.',
        }
      : {
        title: 'No vendors yet',
        subtitle: 'Add the labs, suppliers and consultants you pay, and their bills can be tracked against them.',
      };

  const emptyBlock = <EmptyState image={receipt} title={emptyState.title} subtitle={emptyState.subtitle} />;

  return (
    <div className="flex flex-col min-h-full bg-gray-50/30">
      {/* Tabs. #fdfdfe is gray-50/30 over white: the colour the page already
          shows, but opaque, so rows pass behind the docked strip rather than
          through it. */}
      <div
        ref={tabsRef}
        className="px-4 md:px-6 pt-4 border-b border-gray-200 flex items-end justify-between gap-3 sticky top-0 z-30 bg-[#fdfdfe]"
      >
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
            pettyCash={pettyStats}
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

        <div
          ref={filtersRef}
          style={{ top: offsets.filters }}
          className="px-4 md:px-6 flex-shrink-0 sticky z-20 bg-[#fdfdfe] pt-2 pb-4"
        >
          {/* Search, filters and the tab's action.
              Split at `lg`, not `sm`. On iPad portrait this row has a search box,
              a filter trigger, Export and Record expense in it; side by side at
              768px the search shrank past its own placeholder and rendered as a
              bare magnifying glass. */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
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
                        : activeTab === 'petty_cash' ? 'Search the drawer...'
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
                    : activeTab === 'petty_cash' ? PETTY_CASH_FILTERS
                      : ledgerFilters}
              />
            </div>

            <div className="w-full lg:w-auto flex gap-3 flex-shrink-0">
              {/* Only the ledger has a CSV writer behind it today, so on the
                  other two tabs this renders nothing rather than offering an
                  export that would come back empty. */}
              <MoreMenu
                className="flex-1 lg:flex-none"
                items={[
                  activeTab === 'ledger' && {
                    key: 'export',
                    label: 'Export to CSV',
                    icon: <Download size={15} />,
                    hint: 'Every row your filters select',
                    onClick: () => setShowExport(true),
                  },
                  activeTab === 'petty_cash' && {
                    key: 'cash-spend',
                    label: 'Record a spend',
                    icon: <ArrowUpRight size={15} />,
                    hint: 'Money out of the drawer',
                    onClick: () => openCashEntry('spend'),
                  },
                  activeTab === 'petty_cash' && {
                    key: 'cash-adjust',
                    label: 'Adjust the float',
                    icon: <Scale size={15} />,
                    hint: 'When the drawer and the record disagree',
                    onClick: () => openCashEntry('adjustment'),
                  },
                  activeTab === 'petty_cash' && {
                    key: 'cash-close',
                    label: 'Close the day',
                    icon: <ClipboardCheck size={15} />,
                    hint: 'Count it against what should be there',
                    onClick: () => setCloseDrawer({ counted_amount: '', closed_on: clinicToday(), notes: '' }),
                  },
                  activeTab === 'payables' && {
                    key: 'record-expense',
                    label: 'Record an expense',
                    icon: <Wallet size={15} />,
                    hint: 'Money that has already left',
                    onClick: () => setExpenseId('new'),
                  },
                  {
                    key: 'reset-columns',
                    label: 'Reset column widths',
                    icon: <Columns3 size={15} />,
                    hint: 'Back to the default layout',
                    onClick: resetColumns,
                  },
                ]}
              />
              {activeTab === 'petty_cash' ? (
                /* Topping up is the drawer's primary act — nothing else can
                   happen until there is money in it. Spend, adjust and the day
                   close sit in the menu beside it, same as every other tab. */
                <button
                  onClick={() => openCashEntry('top_up')}
                  className="flex-1 lg:flex-none inline-flex justify-center items-center whitespace-nowrap px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#2a276e] hover:bg-[#1e1c4f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a276e] transition-colors"
                >
                  <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Top up the float
                </button>
              ) : activeTab === 'payables' ? (
                /* Recording a bill is the payables tab's own action, the way
                   Add vendor is the vendors tab's. Recording an expense stays
                   reachable from the menu beside it. */
                <button
                  onClick={() => { setBillForm(emptyBillForm()); setBillFile(null); setBillDrawer(true); }}
                  className="flex-1 lg:flex-none inline-flex justify-center items-center whitespace-nowrap px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#2a276e] hover:bg-[#1e1c4f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a276e] transition-colors"
                >
                  <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Record a bill
                </button>
              ) : activeTab === 'vendors' ? (
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

        {/* Table container. The page is the only scroller: an overflow here
            would capture the sticky header and pin it to this box. */}
        <div className="flex-1 flex flex-col px-4 md:px-6 pb-4">
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm">
            {loading && allRows.length === 0 ? (
              <table className="w-full min-w-[880px] table-fixed">
                <ColGroup widths={widths} />
                <thead
                  className="bg-[#f8fafc] border-b border-gray-100 sticky z-10"
                  style={{ top: offsets.thead }}
                >
                  <tr>
                    {columns.map((col, i) => (
                      <th key={col.key || i} className="px-6 py-4"><SkeletonBox className="h-3 w-20" /></th>
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
                <PayablesCardList rows={currentItems} busyId={busyId} onSettle={settle} onUnsettle={unsettle} onAttach={attachToRow} />
              ) : activeTab === 'ledger' ? (
                <LedgerCardList rows={currentItems} onOpenExpense={setExpenseId} onOpenInvoice={setInvoiceId} />
              ) : activeTab === 'petty_cash' ? (
                <PettyCashCardList rows={currentItems} busyId={busyId} onRemove={removeCashEntry} />
              ) : (
                <VendorCardList
                  rows={currentItems}
                  owedBy={vendorOwed}
                  onEdit={(v) => setVendorDrawer({ open: true, vendor: v })}
                />
              )
            ) : (
              <table ref={tableRef} className="w-full min-w-[880px] table-fixed mp-table-fixed">
                {/* table-fixed is what makes a dragged width hold; mp-table-fixed
                    is what stops a clipped cell spilling into the one beside it. */}
                <ColGroup widths={widths} />
                <thead
                  className="border-b border-gray-100 sticky z-10"
                  style={{ top: offsets.thead }}
                >
                  <tr>
                    {columns.map((col, i) => (
                      <th
                        key={col.key}
                        className={`relative bg-[#f8fafc] px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        } ${i === 0 ? 'rounded-tl-xl' : ''} ${i === columns.length - 1 ? 'rounded-tr-xl' : ''}`}
                      >
                        <span className="block truncate">{col.label}</span>
                        {i < columns.length - 1 && (
                          <ResizeHandle
                            onPointerDown={(e) => startResize(i, e)}
                            onDoubleClick={resetColumns}
                          />
                        )}
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
                    <PayablesRows rows={currentItems} busyId={busyId} onSettle={settle} onUnsettle={unsettle} onAttach={attachToRow} />
                  ) : activeTab === 'ledger' ? (
                    <LedgerRows rows={currentItems} onOpenExpense={setExpenseId} onOpenInvoice={setInvoiceId} />
                  ) : activeTab === 'petty_cash' ? (
                    <PettyCashRows rows={currentItems} busyId={busyId} onRemove={removeCashEntry} />
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

      {/* Petty cash movements. The same drawer every other create on this page
          uses, so topping up the float is entered the way a vendor is. */}
      <FormDrawer
        open={!!cashDrawer}
        onClose={() => setCashDrawer(null)}
        title={cashDrawer?.kind === 'top_up' ? 'Top up the float'
          : cashDrawer?.kind === 'spend' ? 'Record a spend' : 'Adjust the float'}
        subtitle={cashDrawer?.kind === 'top_up'
          ? 'Cash moved from the bank into the drawer'
          : cashDrawer?.kind === 'spend'
            ? 'Money paid out of the drawer'
            : 'When the drawer and the record disagree'}
        onSubmit={saveCashEntry}
        submitting={savingCash}
        submitLabel="Record"
      >
        <Field label="Amount">
          <TextInput
            type="number" min="0" step="0.01" value={cashDrawer?.amount ?? ''}
            onChange={(e) => setCashDrawer({ ...cashDrawer, amount: e.target.value })}
            placeholder="0.00" autoFocus
          />
        </Field>

        {cashDrawer?.kind === 'adjustment' && (
          <Field label="Direction" hint="A recount that finds more is as real as one that finds less">
            <SelectInput
              value={cashDrawer.increases_float ? 'up' : 'down'}
              onChange={(e) => setCashDrawer({ ...cashDrawer, increases_float: e.target.value === 'up' })}
            >
              <option value="down">The drawer holds less than recorded</option>
              <option value="up">The drawer holds more than recorded</option>
            </SelectInput>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput
              type="date" value={cashDrawer?.occurred_on ?? ''}
              onChange={(e) => setCashDrawer({ ...cashDrawer, occurred_on: e.target.value })}
            />
          </Field>
          {cashDrawer?.kind === 'spend' && (
            <Field label="Category">
              <SelectInput
                value={cashDrawer.category}
                onChange={(e) => setCashDrawer({ ...cashDrawer, category: e.target.value })}
              >
                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
            </Field>
          )}
        </div>

        <Field label="What for">
          <TextInput
            value={cashDrawer?.description ?? ''}
            onChange={(e) => setCashDrawer({ ...cashDrawer, description: e.target.value })}
            placeholder={cashDrawer?.kind === 'top_up'
              ? 'Cash drawn from the bank' : 'Courier, tea, autorickshaw…'}
          />
        </Field>

        <p className="text-[11px] text-gray-500">
          {cashDrawer?.kind === 'spend'
            ? 'Lands in your Ledger as a cash expense.'
            : cashDrawer?.kind === 'top_up'
              ? 'Not an expense — it moves money into the drawer rather than spending it, and counting it would book the same rupee twice.'
              : 'Recorded as a correction. It does not write anything to your ledger.'}
        </p>
      </FormDrawer>

      {/* The day close. A drawer rather than a modal because it creates a new
          record — the count for that day — rather than editing one. */}
      <FormDrawer
        open={!!closeDrawer}
        onClose={() => setCloseDrawer(null)}
        title="Close the day"
        subtitle="What was counted against what should have been there"
        onSubmit={closeCashDay}
        submitting={savingCash}
        submitLabel="Close the day"
        accentClass="bg-[#29828a] hover:bg-[#20666c]"
      >
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Should be there</p>
          <p className="text-xl font-bold text-gray-900">{formatMoney(petty.balance || 0)}</p>
        </div>

        <Field label="Counted in the drawer">
          <TextInput
            type="number" min="0" step="0.01" value={closeDrawer?.counted_amount ?? ''}
            onChange={(e) => setCloseDrawer({ ...closeDrawer, counted_amount: e.target.value })}
            placeholder="0.00" autoFocus
          />
        </Field>

        {closeDrawer?.counted_amount !== '' && closeDrawer?.counted_amount != null && (
          <p className="text-xs text-gray-600">
            {Number(closeDrawer.counted_amount) === (petty.balance || 0)
              ? 'Balanced.'
              : `${formatMoney(Math.abs(Number(closeDrawer.counted_amount) - (petty.balance || 0)))} ${
                Number(closeDrawer.counted_amount) < (petty.balance || 0) ? 'short' : 'over'
              }. Recorded as it stands — the float is not adjusted.`}
          </p>
        )}

        <Field label="Date">
          <TextInput
            type="date" value={closeDrawer?.closed_on ?? ''}
            onChange={(e) => setCloseDrawer({ ...closeDrawer, closed_on: e.target.value })}
          />
        </Field>

        <Field label="Notes" hint="Anything that explains a difference">
          <TextInput
            value={closeDrawer?.notes ?? ''}
            onChange={(e) => setCloseDrawer({ ...closeDrawer, notes: e.target.value })}
          />
        </Field>
      </FormDrawer>

      {/* Recording a bill. The shared FormDrawer, like every other create on
          this page, so a supplier bill is entered the same way a vendor is
          rather than through a panel of its own invention. */}
      <FormDrawer
        open={billDrawer}
        onClose={() => setBillDrawer(false)}
        title="Record a bill"
        subtitle="What a supplier has invoiced you, payable on terms"
        onSubmit={saveBill}
        submitting={savingBill}
        submitLabel="Record bill"
      >
        <Field label="Supplier">
          <SelectInput
            value={billForm.vendor_id}
            onChange={(e) => {
              const id = e.target.value;
              const v = vendors.find((x) => String(x.id) === String(id));
              // The supplier's usual terms fill in on pick, which is the whole
              // reason they are stored on the vendor. Anything already typed
              // wins, so the default never overwrites a deliberate answer.
              setBillForm((f) => ({
                ...f,
                vendor_id: id,
                terms_days: f.terms_days !== '' ? f.terms_days : (v?.payment_terms_days ?? ''),
              }));
            }}
          >
            <option value="">Choose a supplier…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </SelectInput>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bill number">
            <TextInput
              value={billForm.bill_number}
              onChange={(e) => setBillForm({ ...billForm, bill_number: e.target.value })}
              placeholder="Their reference"
            />
          </Field>
          <Field label="Bill date">
            <TextInput
              type="date" value={billForm.bill_date}
              onChange={(e) => setBillForm({ ...billForm, bill_date: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <TextInput
              type="number" min="0" step="0.01" value={billForm.amount}
              onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>
          <Field label="Terms (days)" hint={billForm.bill_date
            ? `Due ${clinicDateKey(new Date(new Date(billForm.bill_date).getTime()
                + (Number(billForm.terms_days) || 0) * 86400000))}`
            : undefined}>
            <TextInput
              type="number" min="0" max="365" value={billForm.terms_days}
              onChange={(e) => setBillForm({ ...billForm, terms_days: e.target.value })}
              placeholder="0"
            />
          </Field>
        </div>

        <Field label="Category" hint="Where it lands in your ledger once paid">
          <SelectInput
            value={billForm.category}
            onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}
          >
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectInput>
        </Field>

        <Field label="Notes">
          <TextInput
            value={billForm.notes}
            onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
            placeholder="What was on it"
          />
        </Field>

        <Field label="Supplier's bill" hint="PDF or a photo of the paper bill, up to 10 MB">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setBillFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#2a276e]/10 file:text-[#2a276e] hover:file:bg-[#2a276e]/15"
          />
          {billFile && (
            <p className="mt-1 text-[11px] text-gray-500 truncate">{billFile.name}</p>
          )}
        </Field>

        <p className="text-[11px] text-gray-500">
          A bill is what you owe, not what you have spent. Nothing reaches the Ledger
          until you record a payment against it.
        </p>
      </FormDrawer>

      {/* Paying one. A modal rather than a drawer: it edits something that
          already exists, which is the rule the rest of the app follows. */}
      {payBill && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setPayBill(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Pay {payBill.row.payee_name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatMoney(payBill.row.amount)} outstanding on {payBill.row.description}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Amount">
                <TextInput
                  type="number" min="0" step="0.01" value={payBill.amount}
                  onChange={(e) => setPayBill({ ...payBill, amount: e.target.value })}
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Paid on">
                  <TextInput
                    type="date" value={payBill.paid_on}
                    onChange={(e) => setPayBill({ ...payBill, paid_on: e.target.value })}
                  />
                </Field>
                <Field label="Method">
                  <SelectInput
                    value={payBill.payment_method}
                    onChange={(e) => setPayBill({ ...payBill, payment_method: e.target.value })}
                  >
                    {['Cash', 'UPI', 'Card', 'Net Banking', 'Cheque'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <Field label="Reference">
                <TextInput
                  value={payBill.reference}
                  onChange={(e) => setPayBill({ ...payBill, reference: e.target.value })}
                  placeholder="Cheque or UPI reference"
                />
              </Field>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox" checked={payBill.from_petty_cash}
                  onChange={(e) => setPayBill({ ...payBill, from_petty_cash: e.target.checked })}
                  className="mt-0.5 rounded border-gray-300 text-[#29828a]"
                />
                <span className="text-xs text-gray-600">
                  Paid out of petty cash
                  <span className="block text-[11px] text-gray-400">
                    Comes off the float too, so the drawer still balances.
                  </span>
                </span>
              </label>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
              <button
                type="button" onClick={() => setPayBill(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button" onClick={recordBillPayment}
                disabled={!payBill.amount || busyId === payBill.row.id}
                className="px-6 py-2 text-white rounded-lg text-sm font-semibold bg-[#2a276e] hover:bg-[#1a1548] disabled:opacity-50"
              >
                Record payment
              </button>
            </div>
          </div>
        </div>
      )}

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
