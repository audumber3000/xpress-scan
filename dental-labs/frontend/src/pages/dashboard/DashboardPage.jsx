/**
 * DashboardPage — lab overview. Metrics drill into filtered views, a live
 * "Needs attention" panel surfaces overdue / due-today cases, and the whole
 * board auto-refreshes so it feels alive.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../utils/api";
import { formatCurrency } from "../../utils/currency";
import MetricCard from "../../components/MetricCard";
import {
  Briefcase, Clock, AlertTriangle, CheckCircle2,
  TrendingUp, Users, Package, PieChart as PieChartIcon,
  RefreshCw, ChevronRight, PartyPopper,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { STATUS_CONFIG } from "../../utils/constants";

const REFRESH_MS = 60000;

export default function DashboardPage() {
  const { lab, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [dueToday, setDueToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const firstLoad = useRef(true);

  const loadData = useCallback(async () => {
    if (!firstLoad.current) setRefreshing(true);
    try {
      const [statsRes, trendRes, clientsRes, overdueRes, dueRes] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/dashboard/case-trend"),
        api.get("/dashboard/top-clients"),
        api.get("/cases", { params: { overdue: true } }),
        api.get("/cases", { params: { due_today: true } }),
      ]);
      setStats(statsRes.stats);
      setTrend(trendRes.trend || []);
      setTopClients(clientsRes.clients || []);
      setOverdue(overdueRes.cases || []);
      setDueToday(dueRes.cases || []);
      setUpdatedAt(Date.now());
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      firstLoad.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const poll = setInterval(loadData, REFRESH_MS);
    const ticker = setInterval(() => setNow(Date.now()), 15000);
    return () => { clearInterval(poll); clearInterval(ticker); };
  }, [loadData]);

  const s = stats || {};

  const chartData = trend
    .filter((t) => t.count > 0)
    .map((t) => ({
      name: STATUS_CONFIG[t.status]?.label || t.status,
      value: t.count,
      color: STATUS_CONFIG[t.status]?.color || "#9CA3AF",
    }));

  const updatedLabel = () => {
    if (!updatedAt) return "";
    const secs = Math.round((now - updatedAt) / 1000);
    if (secs < 5) return "Updated just now";
    if (secs < 60) return `Updated ${secs}s ago`;
    return `Updated ${Math.round(secs / 60)}m ago`;
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Greeting + live status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name || "Team"}! 👋</h1>
          <p className="text-sm text-gray-500">Here's what's happening at {lab?.name || "your lab"} today.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {updatedLabel()}
          </span>
          <button
            onClick={loadData}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#2a276e] hover:border-indigo-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Metrics */}
      {loading ? (
        <SkeletonMetrics />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <MetricCard icon={Briefcase} label="Received Today" value={s.cases_received_today || 0} color="#3B82F6" onClick={() => navigate("/cases")} />
          <MetricCard icon={Package} label="In Production" value={s.cases_in_production || 0} color="#F59E0B" onClick={() => navigate("/cases?tab=in_production")} />
          <MetricCard icon={Clock} label="Due Today" value={s.cases_due_today || 0} color="#6366F1" onClick={() => navigate("/cases?tab=due_today")} />
          <MetricCard icon={AlertTriangle} label="Overdue" value={s.cases_overdue || 0} color="#EF4444" onClick={() => navigate("/cases?tab=overdue")} />
          <MetricCard icon={CheckCircle2} label="Delivered (Month)" value={s.cases_delivered_month || 0} color="#059669" onClick={() => navigate("/cases?tab=delivered")} />
          <MetricCard icon={TrendingUp} label="Revenue (Month)" value={s.revenue_month || 0} format={(v) => formatCurrency(v)} color="#6C4CF3" onClick={() => navigate("/billing")} />
          <MetricCard icon={Users} label="Active Clients" value={s.active_clients || 0} color="#14B8A6" onClick={() => navigate("/clients")} />
        </div>
      )}

      {/* Needs attention */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Needs attention</h3>
          <span className="text-xs text-gray-400">{overdue.length + dueToday.length} cases</span>
        </div>
        {loading ? (
          <SkeletonList />
        ) : overdue.length === 0 && dueToday.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <PartyPopper size={40} className="text-emerald-500 mb-3" />
            <p className="text-sm font-semibold text-gray-900">All caught up</p>
            <p className="text-xs mt-1">Nothing overdue or due today. Nice.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AttentionColumn
              title="Overdue"
              accent="text-red-600"
              cases={overdue}
              onSeeAll={() => navigate("/cases?tab=overdue")}
              onPick={(id) => navigate(`/cases/${id}`)}
            />
            <AttentionColumn
              title="Due today"
              accent="text-amber-600"
              cases={dueToday}
              onSeeAll={() => navigate("/cases?tab=due_today")}
              onPick={(id) => navigate(`/cases/${id}`)}
            />
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">Cases by Status</h3>
          {loading ? (
            <div className="h-[260px] bg-gray-50 rounded-lg animate-pulse" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <PieChartIcon size={48} className="opacity-40 text-[#2a276e] mb-4" />
              <p className="text-sm font-semibold text-gray-900">No cases yet</p>
              <p className="text-xs mt-1">Start adding cases to see stats</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Top Clients</h3>
            <span className="text-xs text-gray-400">All time · by revenue</span>
          </div>
          {loading ? (
            <SkeletonList />
          ) : topClients.length > 0 ? (
            <div className="flex flex-col gap-3">
              {topClients.slice(0, 5).map((c, i) => (
                <button
                  key={c.client_id}
                  onClick={() => navigate(`/clients/${c.client_id}`)}
                  className="flex items-center justify-between rounded-lg -mx-2 px-2 py-1.5 hover:bg-indigo-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-50 text-[#2a276e] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{c.client_name}</div>
                      <div className="text-xs text-gray-400">{c.case_count} cases</div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-[#2a276e]">{formatCurrency(c.total_revenue)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <p className="text-sm">No delivered cases yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttentionColumn({ title, accent, cases, onSeeAll, onPick }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className={`text-xs font-bold uppercase tracking-wider ${accent}`}>{title} · {cases.length}</div>
        {cases.length > 5 && (
          <button onClick={onSeeAll} className="text-xs text-gray-400 hover:text-[#2a276e]">See all</button>
        )}
      </div>
      {cases.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">None 🎉</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {cases.slice(0, 5).map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="w-full flex items-center justify-between py-2.5 group text-left"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {c.case_number}
                  {c.priority === "rush" && <span className="ml-2 text-[10px] font-bold text-red-600 uppercase">Rush</span>}
                </div>
                <div className="text-xs text-gray-500 truncate">{c.client_name} · {c.patient_name || "—"}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">{c.due_date ? format(new Date(c.due_date), "dd MMM") : "—"}</span>
                <ChevronRight size={15} className="text-gray-300 group-hover:text-[#2a276e] transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gray-100 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-28 bg-gray-100 rounded animate-pulse" />
              <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-3.5 w-12 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
