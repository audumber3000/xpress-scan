import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Search, Trash2, FileText, Receipt, Pencil, Download } from "lucide-react";
import { api, getFriendlyErrorMessage } from "../../utils/api";
import { clinicToday, formatDate, formatTime } from "../../utils/datetime";
import { getCurrencySymbol } from "../../utils/currency";
import { generatePatientPersona, generateInitialsAvatar } from "../../utils/avatar";
import ConfirmDialog from "../common/ConfirmDialog";
import GearLoader from "../GearLoader";
import { SkeletonTableRows } from "../Skeleton";
import EmptyState from "../common/EmptyState";
import TrendBadge from "../common/TrendBadge";
import { medicalCare } from "../../assets/illustrations";
import DailyRegisterDrawer from "./DailyRegisterDrawer";
import DayExportModal from "../common/DayExportModal";
import DailyRegisterEditDrawer from "./DailyRegisterEditDrawer";
import InvoiceEditor from "../payments/InvoiceEditor";

/**
 * Today's Patients — the clinic's daily register.
 *
 * Laid out like Payments' "Today's Collection": summary cards, then a
 * search/filter/action toolbar, then a full-height table. Returns a fragment so
 * the page's flex column owns the height, exactly as Payments does.
 *
 * @param {function} onRegisterNew - called with { name, phone } to open the
 *   clinic's create-patient drawer; the parent adds the patient to the register
 *   once created, so there is exactly one patient form in the app.
 * @param {number} refreshKey - bumped by the parent after such a creation.
 */
const DailyRegisterTab = ({ onRegisterNew, refreshKey = 0 }) => {
  const navigate = useNavigate();

  const [date, setDate] = useState(clinicToday());
  const [data, setData] = useState({ kpis: { total: 0, new: 0, repeat: 0 }, entries: [], is_today: true });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  // Billing opens right here rather than navigating away, so a row doesn't
  // dead-end in the patient profile just to raise a bill.
  const [billingPatientId, setBillingPatientId] = useState(null);

  const fetchRegister = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/daily-register", { params: { date } });
      setData(res || { kpis: { total: 0, new: 0, repeat: 0 }, entries: [] });
    } catch (e) {
      console.error("Error loading the daily register:", e);
      toast.error(getFriendlyErrorMessage(e, "Couldn't load today's register."));
      setData({ kpis: { total: 0, new: 0, repeat: 0 }, entries: [] });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchRegister(); }, [fetchRegister, refreshKey]);

  useEffect(() => {
    api.get("/clinic-users")
      .then((res) => setDoctors((res || []).filter(u => u.role === "doctor" || u.role === "clinic_owner")))
      .catch(() => setDoctors([]));
  }, []);

  const kpis = data.kpis || { total: 0, new: 0, repeat: 0 };
  const prevKpis = data.previous?.kpis || { total: 0, new: 0, repeat: 0 };

  // "last Saturday" etc — the weekday of the day being compared against, so the
  // percentage on each card is never an unexplained number.
  const comparedTo = useMemo(() => {
    const prevDate = data.previous?.date;
    if (!prevDate) return "last week";
    const [y, m, d] = prevDate.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
    return `last ${weekday} (${formatDate(prevDate)})`;
  }, [data.previous?.date]);

  // The day's list is small enough to filter in the browser — no request per keystroke.
  const entries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const all = data.entries || [];
    if (!q) return all;
    return all.filter((e) =>
      (e.patient_name || "").toLowerCase().includes(q) ||
      (e.patient_phone || "").toLowerCase().includes(q) ||
      (e.display_id || "").toLowerCase().includes(q)
    );
  }, [data.entries, searchTerm]);

  const lookupPatients = ({ name, phone }) =>
    api.get("/patients/check-duplicates", { params: { name: name || undefined, phone: phone || undefined } });

  const addExisting = async (patient, { reason, doctor_id }) => {
    await api.post("/daily-register", {
      patient_id: patient.id,
      reason,
      doctor_id,
      visit_date: date,
    });
    toast.success(`${patient.name} added to the register`);
    setDrawerOpen(false);
    fetchRegister();
  };

  const createNew = ({ name, phone }) => {
    setDrawerOpen(false);
    onRegisterNew({ name, phone });
  };

  // A case paper needs the patient's chart around it, so it jumps to the profile
  // with the action pre-armed. Billing and editing are self-contained, so they
  // open in place. Either way the row leads somewhere useful.
  const startCasePaper = (entry) =>
    navigate(`/patient-profile/${entry.patient_id}?tab=case-papers&action=new-case-paper`);

  const saveEntry = async (entryId, patch) => {
    await api.put(`/daily-register/${entryId}`, patch);
    toast.success("Entry updated");
    setEditingEntry(null);
    fetchRegister();
  };

  // Money makes an entry permanent: a paid or part-paid bill is proof the visit
  // happened, so removing it would leave the day sheet disagreeing with the
  // billing records. `is_locked` is the server's own verdict — the same test it
  // enforces on delete — so the two can't drift apart. The fallbacks cover a
  // response from a backend that predates the field.
  const isLocked = (entry) =>
    entry.is_locked === true ||
    Number(entry.collected_amount || 0) > 0 ||
    Number(entry.paid_invoice_count || 0) > 0;

  // Nothing collected, but a bill or a case paper exists — worth a confirm
  // rather than a block, since reception genuinely does add the wrong person.
  const needsConfirm = (entry) =>
    !isLocked(entry) && (entry.invoice_count > 0 || entry.case_paper_count > 0);

  const requestRemove = (entry) => {
    if (isLocked(entry)) return;
    if (needsConfirm(entry)) {
      setRemoveTarget(entry);
      return;
    }
    handleRemove(entry);
  };

  const handleRemove = async (entry) => {
    try {
      setRemovingId(entry.id);
      await api.delete(`/daily-register/${entry.id}`);
      toast.success("Removed from the register");
      setRemoveTarget(null);
      fetchRegister();
    } catch (e) {
      console.error("Error removing the register entry:", e);
      // The server's reason is specific (names the amount collected), so show it.
      toast.error(getFriendlyErrorMessage(e, "Couldn't remove this entry."));
      setRemoveTarget(null);
    } finally {
      setRemovingId(null);
    }
  };

  const dayLabel = data.is_today ? "today" : formatDate(date);

  const money = (n) =>
    `${getCurrencySymbol()}${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      {/* Summary Cards Section */}
      <div className="px-6 pt-6 pb-2">
        <div className="grid gap-6 mb-8 grid-cols-1 sm:grid-cols-3">

          {/* Card 1: Total */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
            <div className="p-3 rounded-lg bg-[#2a276e]/10 text-[#2a276e] mr-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-500">Total Patients</p>
                <TrendBadge current={kpis.total} previous={prevKpis.total} comparedTo={comparedTo} loading={loading} />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mt-1">{loading ? "..." : kpis.total}</h4>
            </div>
          </div>

          {/* Card 2: New */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
            <div className="p-3 rounded-lg bg-green-50 text-green-600 mr-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-500">New Patients</p>
                <TrendBadge current={kpis.new} previous={prevKpis.new} comparedTo={comparedTo} loading={loading} />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mt-1">{loading ? "..." : kpis.new}</h4>
            </div>
          </div>

          {/* Card 3: Repeat */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex items-center">
            <div className="p-3 rounded-lg bg-amber-50 text-amber-600 mr-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-500">Repeat Patients</p>
                <TrendBadge current={kpis.repeat} previous={prevKpis.repeat} comparedTo={comparedTo} loading={loading} />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mt-1">{loading ? "..." : kpis.repeat}</h4>
            </div>
          </div>

        </div>

        {/* Search, Filters & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="w-full sm:max-w-sm relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search today's patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
              />
            </div>
            <input
              type="date"
              value={date}
              max={clinicToday()}
              onChange={(e) => setDate(e.target.value || clinicToday())}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
            />
          </div>
          <div className="w-full sm:w-auto flex space-x-3">
            <button
              onClick={() => setExportOpen(true)}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a276e] transition-colors"
            >
              <Download className="mr-2 h-5 w-5 text-[#2a276e]" />
              Export
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#2a276e] hover:bg-[#1e1c4f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2a276e] transition-colors"
            >
              <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Register Patient
            </button>
          </div>
        </div>
      </div>

      {/* Close-of-day nudge — only when something is actually outstanding. */}
      {!loading && (data.pending?.not_billed > 0 || data.pending?.no_case_paper > 0) && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5">
            <span className="text-sm text-amber-900">
              Before you close {data.is_today ? "today" : "this day"}:
              {data.pending.not_billed > 0 && (
                <span className="font-semibold"> {data.pending.not_billed} not billed</span>
              )}
              {data.pending.not_billed > 0 && data.pending.no_case_paper > 0 && <span>,</span>}
              {data.pending.no_case_paper > 0 && (
                <span className="font-semibold"> {data.pending.no_case_paper} without a case paper</span>
              )}
              .
            </span>
          </div>
        </div>
      )}

      {/* Register Table Container */}
      <div className="flex-1 overflow-hidden px-6 pb-4">
        <div className="h-full overflow-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full">
            <thead className="bg-[#f8fafc] border-b border-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Doctor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            {loading ? (
              <SkeletonTableRows rows={8} />
            ) : (
              <tbody className="divide-y divide-gray-100">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8">
                      <EmptyState
                        image={medicalCare}
                        title={searchTerm ? "No matching patients" : `No patients registered ${dayLabel}`}
                        subtitle={
                          searchTerm
                            ? "Try a different name or phone number."
                            : "Register the first patient of the day, or check someone in from the calendar."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  entries.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => navigate(`/patient-profile/${e.patient_id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-[#2a276e]">
                          {e.display_id || "—"}
                        </span>
                      </td>

                      {/* Avatar, then name over contact number */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img
                            src={generatePatientPersona({ id: e.patient_id, name: e.patient_name, gender: e.gender }, 80)}
                            onError={(ev) => { ev.target.onerror = null; ev.target.src = generateInitialsAvatar(e.patient_name || "Patient"); }}
                            alt={e.patient_name || "Patient"}
                            className="w-9 h-9 rounded-full flex-shrink-0 object-cover border border-gray-100"
                          />
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{e.patient_name || "Unknown"}</div>
                            <div className="text-xs text-gray-400">{e.patient_phone || "No phone"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          e.is_repeat ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                        }`}>
                          {e.is_repeat ? "Repeat" : "New"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{e.reason || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.doctor_name || "-"}</td>

                      {/* Close-of-day check: was anything recorded, was anything charged. */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {e.case_paper_count === 0 && (
                            <span
                              title="No case paper recorded for this visit"
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"
                            >
                              No case paper
                            </span>
                          )}
                          {e.invoice_count === 0 && (
                            <span
                              title="No bill raised for this visit"
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600"
                            >
                              Not billed
                            </span>
                          )}
                          {e.case_paper_count > 0 && e.invoice_count > 0 && (
                            <span className="text-sm text-gray-400">All done</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{e.created_at ? formatTime(e.created_at) : "-"}</div>
                        {e.source === "check_in" && <div className="text-xs text-gray-400">from calendar</div>}
                        {e.source === "case_paper" && <div className="text-xs text-gray-400">from case paper</div>}
                        {e.source === "invoice" && <div className="text-xs text-gray-400">from billing</div>}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(ev) => { ev.stopPropagation(); startCasePaper(e); }}
                            title="Start a case paper"
                            className="p-1.5 text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5 rounded-lg transition-colors inline-flex"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); setBillingPatientId(e.patient_id); }}
                            title="Create an invoice"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors inline-flex"
                          >
                            <Receipt size={15} />
                          </button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); setEditingEntry(e); }}
                            title="Edit this entry"
                            className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors inline-flex"
                          >
                            <Pencil size={15} />
                          </button>
                          <span className="w-px h-5 bg-gray-200 mx-1" />
                          <button
                            onClick={(ev) => { ev.stopPropagation(); requestRemove(e); }}
                            disabled={removingId === e.id || isLocked(e)}
                            title={
                              isLocked(e)
                                ? (Number(e.collected_amount || 0) > 0
                                    ? `Paid ${money(e.collected_amount)} on this day, so this entry can't be removed`
                                    : "Has a paid or part-paid invoice from this day, so this entry can't be removed")
                                : "Remove from the register"
                            }
                            className={`p-1.5 rounded-lg transition-colors inline-flex ${
                              isLocked(e)
                                ? "text-gray-200 cursor-not-allowed"
                                : "text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                            }`}
                          >
                            {removingId === e.id ? <GearLoader size="w-4 h-4" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <DailyRegisterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onLookup={lookupPatients}
        onPickExisting={addExisting}
        onCreateNew={createNew}
        doctors={doctors}
        dateLabel={data.is_today ? "today" : formatDate(date)}
      />

      <DayExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        date={date}
        endpoint="/daily-register/export"
        dateParam="date"
        fileTag="daily-register"
        title="Export day sheet"
        subtitle="The day's register, with new and repeat counts"
      />

      {/* Nothing was collected, but there is work attached to this visit — worth
          a beat before the row disappears. */}
      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => removingId === null && setRemoveTarget(null)}
        tone="danger"
        title="Remove from the register?"
        message={
          removeTarget ? (
            <>
              <span className="font-semibold text-gray-700">{removeTarget.patient_name}</span> has
              {removeTarget.invoice_count > 0 && (
                <> {removeTarget.invoice_count} invoice{removeTarget.invoice_count === 1 ? "" : "s"}</>
              )}
              {removeTarget.invoice_count > 0 && removeTarget.case_paper_count > 0 && <> and</>}
              {removeTarget.case_paper_count > 0 && (
                <> {removeTarget.case_paper_count} case paper{removeTarget.case_paper_count === 1 ? "" : "s"}</>
              )}
              {" "}on this day. Those stay exactly as they are, only the register line is removed.
            </>
          ) : null
        }
        actions={[
          {
            label: removingId ? "Removing…" : "Remove from register",
            variant: "danger",
            onClick: () => handleRemove(removeTarget),
            disabled: removingId !== null,
          },
        ]}
      />

      <DailyRegisterEditDrawer
        open={!!editingEntry}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={saveEntry}
        doctors={doctors}
      />

      {/* Billing in place. Refetch on close so the row's "Not billed" marker
          clears as soon as the invoice exists. */}
      {billingPatientId && (
        <InvoiceEditor
          invoiceId="new"
          prefill={{ patientId: billingPatientId }}
          onClose={() => { setBillingPatientId(null); fetchRegister(); }}
          onSave={fetchRegister}
        />
      )}
    </>
  );
};

export default DailyRegisterTab;
