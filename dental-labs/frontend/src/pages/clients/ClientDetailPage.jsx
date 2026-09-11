/**
 * ClientDetailPage — client profile, live case history, and financial snapshot.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { api } from "../../utils/api";
import { formatCurrency } from "../../utils/currency";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import { ArrowLeft, Edit2, MapPin, Phone, Mail, Building, Briefcase, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import ClientDrawer from "./ClientDrawer";

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clientRes, casesRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get("/cases", { params: { client_id: id } }).catch(() => ({ cases: [] })),
      ]);
      setClient(clientRes.client);
      setCases(casesRes.cases || []);
    } catch {
      toast.error("Failed to load client details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const active = cases.filter((c) => c.status !== "delivered" && c.status !== "cancelled").length;
    const delivered = cases.filter((c) => c.status === "delivered").length;
    return { total: cases.length, active, delivered };
  }, [cases]);

  const recentCases = useMemo(
    () => [...cases].sort((a, b) => new Date(b.received_date) - new Date(a.received_date)).slice(0, 6),
    [cases]
  );

  if (loading) {
    return <div className="p-6 md:p-8 max-w-7xl mx-auto"><LoadingSpinner /></div>;
  }

  if (!client) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <Link to="/clients" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2">
          <ArrowLeft size={16} /> Back to clients
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center text-gray-500">Client not found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      <Link to="/clients" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2">
        <ArrowLeft size={16} /> Back to clients
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6">
          {/* Profile */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
                  {client.clinic_name && <p className="text-gray-500 text-sm font-medium mt-1">{client.clinic_name}</p>}
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors shadow-sm h-fit"
              >
                <Edit2 size={16} /> Edit Profile
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Phone size={16} className="text-gray-400 flex-shrink-0" />
                    <span>{client.phone || "No phone provided"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Mail size={16} className="text-gray-400 flex-shrink-0" />
                    <span>{client.email || "No email provided"}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Location & Tax</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-sm text-gray-700">
                    <MapPin size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{client.address || "No address provided"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Building size={16} className="text-gray-400 flex-shrink-0" />
                    <span>GST / Tax ID: <span className="font-medium">{client.tax_id || "Not provided"}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent cases — live */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recent Cases <span className="text-gray-400 font-medium text-base">· {cases.length}</span></h2>
              {cases.length > 0 && (
                <Link to={`/cases?client=${client.id}`} className="text-sm text-indigo-600 font-semibold hover:text-indigo-800">View all</Link>
              )}
            </div>
            {cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <Briefcase size={32} className="text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-600">No cases from this client yet</p>
                <button onClick={() => navigate("/cases")} className="mt-3 text-sm font-semibold text-[#2a276e] hover:underline">Create a case</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentCases.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/cases/${c.id}`)} className="w-full flex items-center justify-between py-3 group text-left">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#2a276e]">{c.case_number}</span>
                        {c.priority === "rush" && <span className="text-[10px] font-bold text-red-600 uppercase">Rush</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {c.patient_name || "—"} · {c.items?.map((i) => i.product_name).join(", ") || "No items"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400">{format(parseISO(c.received_date), "dd MMM")}</span>
                      <StatusBadge status={c.status} />
                      <span className="text-sm font-semibold text-gray-900 w-20 text-right">{formatCurrency(c.total_amount)}</span>
                      <ChevronRight size={15} className="text-gray-300 group-hover:text-[#2a276e] transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Outstanding Balance</h3>
            <div className={`text-3xl font-bold mb-1 ${client.outstanding_balance > 0 ? "text-red-600" : "text-gray-900"}`}>
              {formatCurrency(client.outstanding_balance)}
            </div>
            {client.unbilled > 0 && (
              <p className="text-xs text-amber-600 mb-4">+ {formatCurrency(client.unbilled)} delivered, not yet billed</p>
            )}
            <div className="pt-4 border-t border-gray-100">
              <Link to="/billing" className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 text-sm font-semibold rounded-lg hover:bg-indigo-100 transition-colors">
                View Statements <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Case Summary</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-400 mt-1">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{stats.active}</div>
                <div className="text-xs text-gray-400 mt-1">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{stats.delivered}</div>
                <div className="text-xs text-gray-400 mt-1">Delivered</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ClientDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} client={client} onSuccess={load} />
    </div>
  );
}
