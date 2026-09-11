import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../utils/api";
import { formatCurrency } from "../../utils/currency";
import {
  Search, Phone, Mail, UserPlus, Edit2, Trash2, Briefcase, Users,
} from "lucide-react";
import toast from "react-hot-toast";
import ClientDrawer from "./ClientDrawer";
import { generateClientAvatar } from "../../utils/avatar";

const PER_PAGE = 10;

// Deterministic avatar tint from the client's name so each row reads distinctly.
const AVATAR_TINTS = [
  "bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700", "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700", "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
];

function initials(name) {
  return (name || "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join("") || "?";
}

function tintFor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function relativeDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  let rel;
  if (days <= 0) rel = "Today";
  else if (days === 1) rel = "Yesterday";
  else if (days < 7) rel = `${days}d ago`;
  else if (days < 30) rel = `${Math.floor(days / 7)}w ago`;
  else if (days < 365) rel = `${Math.floor(days / 30)}mo ago`;
  else rel = `${Math.floor(days / 365)}y ago`;
  const exact = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return { rel, exact };
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active | inactive
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { loadClients(); }, [statusFilter]);

  // Debounce search and reset to first page.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/clients?is_active=${statusFilter === "active"}`);
      setClients(data.clients || []);
    } catch (err) {
      console.error("Error loading clients:", err);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const s = debounced.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter((c) =>
      c.name.toLowerCase().includes(s) ||
      (c.clinic_name && c.clinic_name.toLowerCase().includes(s)) ||
      (c.phone && c.phone.toLowerCase().includes(s))
    );
  }, [clients, debounced]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleCreate = () => { setEditingClient(null); setDrawerOpen(true); };
  const handleEdit = (client) => { setEditingClient(client); setDrawerOpen(true); };

  const handleDeactivate = async (client) => {
    if (!window.confirm(`Deactivate ${client.name}? They'll be hidden from active clients.`)) return;
    setDeletingId(client.id);
    try {
      await api.delete(`/clients/${client.id}`);
      toast.success(`${client.name} deactivated`);
      loadClients();
    } catch (err) {
      toast.error(err.message || "Failed to deactivate");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      {/* Search, Filter & Actions */}
      <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="w-full md:max-w-sm relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search clients, clinics or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
            />
          </div>

          {/* Active / Inactive segmented filter */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {["active", "inactive"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                  statusFilter === s ? "bg-white text-[#2a276e] shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-all shadow-sm whitespace-nowrap"
        >
          <UserPlus size={18} /> Add Client
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden px-6 pb-6 pt-6">
        <div className="h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-[#f8fafc] sticky top-0 z-10">
                <tr>
                  {["Dentist / Clinic", "Contact", "Cases", "Unbilled", "Outstanding", ""].map((h, i) => (
                    <th
                      key={h || "actions"}
                      className={`px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                        i >= 3 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <SkeletonRows />
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <Users className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-3 text-sm font-semibold text-gray-900">No {statusFilter} clients found</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {debounced ? "Try adjusting your search." : "Add your first client to get started."}
                      </p>
                      {!debounced && statusFilter === "active" && (
                        <button
                          onClick={handleCreate}
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm"
                        >
                          <UserPlus size={16} /> Add Client
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((client) => {
                    const last = relativeDate(client.last_case_date);
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-indigo-50/30 transition-colors duration-150 cursor-pointer group"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        {/* Dentist / Clinic with avatar */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 ${tintFor(client.name)}`}>
                              <img
                                src={generateClientAvatar(client.name)}
                                alt={client.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  // Fall back to CSS initials if DiceBear is unreachable.
                                  e.currentTarget.style.display = "none";
                                  e.currentTarget.insertAdjacentText("afterend", initials(client.name));
                                }}
                              />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900 group-hover:text-[#2a276e] flex items-center gap-2">
                                {client.name}
                                {!client.is_active && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">{client.clinic_name || "No clinic"}</div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {client.phone && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <Phone size={13} className="text-gray-400" /> {client.phone}
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                              <Mail size={12} className="text-gray-300" /> {client.email}
                            </div>
                          )}
                          {!client.phone && !client.email && <span className="text-gray-300">—</span>}
                        </td>

                        {/* Cases activity */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5 text-sm text-gray-900">
                            <Briefcase size={13} className="text-gray-400" />
                            <span className="font-medium">{client.case_count}</span>
                            {client.open_case_count > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                {client.open_case_count} open
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{last ? last.rel : "No cases"}</div>
                        </td>

                        {/* Unbilled */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className={client.unbilled > 0 ? "text-gray-900 font-medium" : "text-gray-300"}>
                            {client.unbilled > 0 ? formatCurrency(client.unbilled) : "—"}
                          </span>
                        </td>

                        {/* Outstanding */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                          <span className={client.outstanding_balance > 0 ? "text-red-600" : "text-gray-300"}>
                            {client.outstanding_balance > 0 ? formatCurrency(client.outstanding_balance) : "—"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(client); }}
                              className="p-1.5 text-gray-400 hover:text-[#2a276e] hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                            {client.is_active && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeactivate(client); }}
                                disabled={deletingId === client.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Deactivate"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
              <span>
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 font-medium text-gray-700">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ClientDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        client={editingClient}
        onSuccess={loadClients}
      />
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
              <div className="space-y-2">
                <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </td>
          {Array.from({ length: 5 }).map((__, j) => (
            <td key={j} className="px-6 py-4">
              <div className="h-3 w-16 bg-gray-100 rounded animate-pulse ml-auto" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
