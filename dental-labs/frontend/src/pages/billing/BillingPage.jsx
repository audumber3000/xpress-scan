/**
 * BillingPage — two views:
 *   1. Statements   — every generated statement/transaction (all clinics).
 *   2. Clinic Balances — clinic-wise outstanding + unbilled, expandable to the
 *      actual delivered orders behind the money (labs bill clinics monthly).
 *
 * API:
 *   GET    /billing/statements                       list invoices
 *   POST   /billing/statements/generate              { client_id, period_start, period_end, tax_rate }
 *   GET    /billing/invoices/{id}/pdf                 statement PDF (blob)
 *   DELETE /billing/invoices/{id}                     void a draft/sent invoice
 *   POST   /billing/payments                          { client_id, invoice_id, amount, method }
 *   GET    /billing/outstanding                       per-clinic outstanding + unbilled
 *   GET    /billing/clients/{id}/unbilled-cases       delivered orders not yet billed
 */
import { useState, useEffect, Fragment } from "react";
import { api, apiDownload } from "../../utils/api";
import { formatCurrency } from "../../utils/currency";
import LoadingSpinner from "../../components/LoadingSpinner";
import {
  FileText, Download, CheckCircle, Clock, Trash2, X, ChevronRight,
  ChevronDown, Building2, Receipt, Plus,
} from "lucide-react";
import toast from "react-hot-toast";

const STATUS_STYLES = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_paid: "bg-blue-50 text-blue-700 border-blue-200",
  sent: "bg-amber-50 text-amber-700 border-amber-200",
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function fmtPeriod(start, end) {
  if (!start) return "";
  const opts = { day: "numeric", month: "short", year: "numeric" };
  const s = new Date(start).toLocaleDateString("en-GB", opts);
  const e = end ? new Date(end).toLocaleDateString("en-GB", opts) : "";
  return e ? `${s} – ${e}` : s;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// First/last day of a "YYYY-MM" month string, as YYYY-MM-DD
function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10); // day 0 of next month
  return { start, end };
}

export default function BillingPage() {
  const [tab, setTab] = useState("statements"); // statements | balances
  const [invoices, setInvoices] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [generateFor, setGenerateFor] = useState(null); // null = closed, {} = open, {clientId} = preset

  const load = async () => {
    setLoading(true);
    try {
      const [inv, out] = await Promise.all([
        api.get("/billing/statements").catch(() => ({ invoices: [] })),
        api.get("/billing/outstanding").catch(() => ({ outstanding: [] })),
      ]);
      setInvoices(inv.invoices || []);
      setOutstanding(out.outstanding || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const downloadPdf = async (inv) => {
    setDownloadingId(inv.id);
    try {
      const blob = await apiDownload(`/billing/invoices/${inv.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || "Failed to download PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const voidInvoice = async (inv) => {
    if (!window.confirm(`Void statement ${inv.invoice_number}? Its cases will be released for re-billing.`)) return;
    try {
      await api.delete(`/billing/invoices/${inv.id}`);
      toast.success("Statement voided");
      load();
    } catch (err) {
      toast.error(err.message || "Failed to void statement");
    }
  };

  const markPaid = async (inv) => {
    if (inv.due_amount <= 0) return;
    try {
      await api.post("/billing/payments", {
        client_id: inv.client_id,
        invoice_id: inv.id,
        amount: inv.due_amount,
        method: "cash",
      });
      toast.success("Payment recorded");
      load();
    } catch (err) {
      toast.error(err.message || "Failed to record payment");
    }
  };

  const totalOutstanding = outstanding.reduce((acc, o) => acc + (o.outstanding || 0), 0);
  const totalUnbilled = outstanding.reduce((acc, o) => acc + (o.unbilled || 0), 0);
  const collected = invoices.reduce((acc, i) => acc + (i.paid_amount || 0), 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly statements, clinic balances, and payments.</p>
        </div>
        <button
          onClick={() => setGenerateFor({})}
          className="flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm"
        >
          <FileText size={16} /> Generate Statement
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Outstanding" value={totalOutstanding} tone="text-red-600" />
        <SummaryCard label="Unbilled (delivered)" value={totalUnbilled} tone="text-amber-600" />
        <SummaryCard label="Collected (all statements)" value={collected} tone="text-emerald-600" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-8">
          <TabButton active={tab === "statements"} onClick={() => setTab("statements")} icon={<Receipt size={16} />}>
            Statements
          </TabButton>
          <TabButton active={tab === "balances"} onClick={() => setTab("balances")} icon={<Building2 size={16} />}>
            Clinic Balances
            {outstanding.length > 0 && (
              <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">{outstanding.length}</span>
            )}
          </TabButton>
        </nav>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tab === "statements" ? (
        <StatementsTab
          invoices={invoices}
          downloadPdf={downloadPdf}
          downloadingId={downloadingId}
          markPaid={markPaid}
          voidInvoice={voidInvoice}
          onGenerate={() => setGenerateFor({})}
        />
      ) : (
        <ClinicBalancesTab
          outstanding={outstanding}
          invoices={invoices}
          markPaid={markPaid}
          onGenerateFor={(clientId) => setGenerateFor({ clientId })}
        />
      )}

      {generateFor && (
        <GenerateStatementModal
          presetClientId={generateFor.clientId}
          onClose={() => setGenerateFor(null)}
          onGenerated={() => { setGenerateFor(null); load(); }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${tone}`}>{formatCurrency(value)}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
        active ? "border-[#2a276e] text-[#2a276e]" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {icon} {children}
    </button>
  );
}

// ── Tab 1: Statements ──────────────────────────────────────────────────────

function StatementsTab({ invoices, downloadPdf, downloadingId, markPaid, voidInvoice, onGenerate }) {
  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
        <FileText size={48} className="opacity-40 text-[#2a276e] mb-4" />
        <h3 className="text-base font-semibold text-gray-900">No statements yet</h3>
        <p className="text-sm mt-2">Generate a monthly statement for a clinic to start billing</p>
        <button onClick={onGenerate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm">
          <FileText size={16} /> Generate Statement
        </button>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Statement #", "Clinic", "Period", "Status"].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
              {["Total", "Due", "Actions"].map((h) => (
                <th key={h} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-indigo-50/30 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{inv.invoice_number}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inv.client_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{fmtPeriod(inv.period_start, inv.period_end)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[inv.status] || STATUS_STYLES.draft}`}>
                    {inv.status === "paid" ? <CheckCircle size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
                    {inv.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">{formatCurrency(inv.total)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-red-600">{formatCurrency(inv.due_amount)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => downloadPdf(inv)}
                      disabled={downloadingId === inv.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-all shadow-sm disabled:opacity-50"
                      title="Download PDF"
                    >
                      <Download size={14} className="text-gray-400" /> {downloadingId === inv.id ? "…" : "PDF"}
                    </button>
                    {inv.due_amount > 0 && (
                      <button className="px-3 py-1.5 bg-[#2a276e] text-white text-xs font-semibold rounded-lg hover:bg-[#1a1548] transition-all shadow-sm" onClick={() => markPaid(inv)}>
                        Mark Paid
                      </button>
                    )}
                    {(inv.status === "draft" || inv.status === "sent") && inv.paid_amount === 0 && (
                      <button onClick={() => voidInvoice(inv)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Void statement">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 2: Clinic Balances ─────────────────────────────────────────────────

function ClinicBalancesTab({ outstanding, invoices, markPaid, onGenerateFor }) {
  const [expanded, setExpanded] = useState(null);          // client_id
  const [casesByClient, setCasesByClient] = useState({});  // { client_id: [cases] }
  const [loadingClient, setLoadingClient] = useState(null);

  const toggle = async (clientId) => {
    if (expanded === clientId) { setExpanded(null); return; }
    setExpanded(clientId);
    if (!casesByClient[clientId]) {
      setLoadingClient(clientId);
      try {
        const data = await api.get(`/billing/clients/${clientId}/unbilled-cases`);
        setCasesByClient((prev) => ({ ...prev, [clientId]: data.cases || [] }));
      } catch {
        setCasesByClient((prev) => ({ ...prev, [clientId]: [] }));
      } finally {
        setLoadingClient(null);
      }
    }
  };

  if (outstanding.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
        <CheckCircle size={48} className="opacity-40 text-emerald-500 mb-4" />
        <h3 className="text-base font-semibold text-gray-900">All clinics settled</h3>
        <p className="text-sm mt-2">No outstanding balances and nothing waiting to be billed.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Billed</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ready to bill</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {outstanding.map((o) => {
            const isOpen = expanded === o.client_id;
            const dueStatements = invoices.filter((i) => i.client_id === o.client_id && i.due_amount > 0);
            return (
              <Fragment key={o.client_id}>
                <tr
                  className="hover:bg-indigo-50/30 transition-colors duration-150 cursor-pointer"
                  onClick={() => toggle(o.client_id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                      <span className="text-sm font-semibold text-gray-900">{o.client_name || `Clinic #${o.client_id}`}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">{formatCurrency(o.total_billed)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-emerald-600">{formatCurrency(o.total_paid)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                    <span className={o.outstanding > 0 ? "text-red-600" : "text-gray-300"}>
                      {o.outstanding > 0 ? formatCurrency(o.outstanding) : "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                    <span className={o.unbilled > 0 ? "text-amber-600" : "text-gray-300"}>
                      {o.unbilled > 0 ? formatCurrency(o.unbilled) : "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {o.unbilled > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onGenerateFor(o.client_id); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a276e] text-white text-xs font-semibold rounded-lg hover:bg-[#1a1548] transition-all shadow-sm"
                      >
                        <Plus size={13} /> Statement
                      </button>
                    )}
                  </td>
                </tr>

                {isOpen && (
                  <tr key={`${o.client_id}-detail`}>
                    <td colSpan={6} className="bg-gray-50/60 px-6 py-5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Unbilled delivered orders */}
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Clock size={13} className="text-amber-500" /> Ready to bill — delivered orders
                          </h4>
                          {loadingClient === o.client_id ? (
                            <p className="text-sm text-gray-400 py-2">Loading orders…</p>
                          ) : (casesByClient[o.client_id] || []).length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">No unbilled delivered orders.</p>
                          ) : (
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Case</th>
                                    <th className="px-3 py-2 text-left font-medium">Patient</th>
                                    <th className="px-3 py-2 text-left font-medium">Delivered</th>
                                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {(casesByClient[o.client_id] || []).map((c) => (
                                    <tr key={c.id}>
                                      <td className="px-3 py-2 font-medium text-[#2a276e]">{c.case_number}</td>
                                      <td className="px-3 py-2 text-gray-700">{c.patient_name || "—"}</td>
                                      <td className="px-3 py-2 text-gray-500">{fmtDate(c.delivered_at)}</td>
                                      <td className="px-3 py-2 text-right font-medium text-gray-900">{formatCurrency(c.total_amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {o.unbilled > 0 && (
                            <button
                              onClick={() => onGenerateFor(o.client_id)}
                              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a276e] text-white text-xs font-semibold rounded-lg hover:bg-[#1a1548] transition-all shadow-sm"
                            >
                              <Plus size={13} /> Generate statement for these
                            </button>
                          )}
                        </div>

                        {/* Statements with balance due */}
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Receipt size={13} className="text-red-500" /> Statements with balance due
                          </h4>
                          {dueStatements.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">No unpaid statements.</p>
                          ) : (
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Statement</th>
                                    <th className="px-3 py-2 text-left font-medium">Period</th>
                                    <th className="px-3 py-2 text-right font-medium">Due</th>
                                    <th className="px-3 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {dueStatements.map((inv) => (
                                    <tr key={inv.id}>
                                      <td className="px-3 py-2 font-medium text-gray-900">{inv.invoice_number}</td>
                                      <td className="px-3 py-2 text-gray-500">{fmtPeriod(inv.period_start, inv.period_end)}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-red-600">{formatCurrency(inv.due_amount)}</td>
                                      <td className="px-3 py-2 text-right">
                                        <button
                                          onClick={() => markPaid(inv)}
                                          className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700 transition-all"
                                        >
                                          Mark Paid
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Generate Statement modal ───────────────────────────────────────────────

function GenerateStatementModal({ presetClientId, onClose, onGenerated }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(presetClientId ? String(presetClientId) : "");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [taxRate, setTaxRate] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/clients").then((d) => setClients(d.clients || [])).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!clientId) return toast.error("Select a clinic");
    setSubmitting(true);
    try {
      const { start, end } = monthBounds(month);
      await api.post("/billing/statements/generate", {
        client_id: Number(clientId),
        period_start: start,
        period_end: end,
        tax_rate: Number(taxRate) || 0,
      });
      toast.success("Statement generated");
      onGenerated();
    } catch (err) {
      toast.error(err.message || "Failed to generate statement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Generate Statement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2a276e] focus:border-[#2a276e]" required>
              <option value="">Select a clinic…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.clinic_name ? ` — ${c.clinic_name}` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2a276e] focus:border-[#2a276e]" required />
            <p className="text-xs text-gray-400 mt-1">Bills delivered cases not yet on a statement for this month.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax rate (%)</label>
            <input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#2a276e] focus:border-[#2a276e]" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors disabled:opacity-50">
              {submitting ? "Generating…" : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
