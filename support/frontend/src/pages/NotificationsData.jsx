import React, { useEffect, useState, useCallback } from 'react';
import { Bell, Wallet, MessageSquare, TrendingDown, Smartphone, Mail, MessageCircle, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, StatCard, Card, CardHeader, Badge, StatusBadge, Pagination, FilterSelect, TabBar, Spinner, fmt } from '../components/ui';

const CHANNEL_MAP = { whatsapp: 'emerald', email: 'sky', sms: 'amber' };
const CHANNEL_ICONS = { whatsapp: Smartphone, email: Mail, sms: MessageCircle };
const CHANNEL_COLORS = {
  whatsapp: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  email:    { bg: 'bg-sky-50',     text: 'text-sky-700',     bar: 'bg-sky-500' },
  sms:      { bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-500' },
};
const STATUS_BAR = { sent: 'bg-emerald-500', delivered: 'bg-sky-500', failed: 'bg-rose-500', pending: 'bg-amber-400' };
const TABS = [
  { id: 'logs', label: 'Message Logs' },
  { id: 'wallets', label: 'Wallets' },
  { id: 'transactions', label: 'Transactions' },
];
const PER_PAGE = 100;

function ChannelCard({ data, totalLogs }) {
  const ch = data.channel || 'unknown';
  const Icon = CHANNEL_ICONS[ch] || Bell;
  const c = CHANNEL_COLORS[ch] || { bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-400' };
  const pct = totalLogs > 0 ? Math.round((data.count / totalLogs) * 100) : 0;
  const costPerMsg = data.count > 0 ? (data.spend / data.count).toFixed(3) : '0';

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg} flex-shrink-0`}>
          <Icon size={18} className={c.text} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{ch}</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{fmt.num(data.count)}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">{fmt.inr(data.spend)} spend</span>
            <span className="text-xs text-slate-400">₹{costPerMsg}/msg</span>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{pct}%</span>
      </div>
      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

export default function NotificationsData() {
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [s, w] = await Promise.all([
        api.get('/notifications-data/summary'),
        api.get('/notifications-data/wallets'),
      ]);
      setSummary(s);
      setWallets(w);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    setTabLoading(true);
    try {
      const l = await api.get(`/notifications-data/logs?page=${logsPage}&per_page=${PER_PAGE}${channelFilter ? `&channel=${channelFilter}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}`);
      setLogs(l.logs);
      setLogsTotal(l.total);
    } catch (e) { console.error(e); }
    finally { setTabLoading(false); }
  }, [logsPage, channelFilter, statusFilter]);

  const loadTransactions = useCallback(async () => {
    setTabLoading(true);
    try {
      const t = await api.get(`/notifications-data/transactions?page=${txPage}&per_page=${PER_PAGE}${txTypeFilter ? `&transaction_type=${txTypeFilter}` : ''}`);
      setTransactions(t.transactions);
      setTxTotal(t.total);
    } catch (e) { console.error(e); }
    finally { setTabLoading(false); }
  }, [txPage, txTypeFilter]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab, loadLogs]);
  useEffect(() => { if (tab === 'transactions') loadTransactions(); }, [tab, loadTransactions]);

  const totalLogs = summary?.total_logs || 0;
  const failedCount = summary?.by_status?.failed || 0;
  const failRate = totalLogs > 0 ? ((failedCount / totalLogs) * 100).toFixed(1) : '0';
  const totalWalletBalance = wallets.reduce((s, w) => s + (w.balance || 0), 0);

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <PageHeader title="Notifications" subtitle="Message logs, wallet balances, and spend analytics" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Messages Sent" value={fmt.num(totalLogs)} icon={MessageSquare} color="brand" />
        <StatCard label="Total Spend" value={fmt.inr(summary?.total_spend || 0)} icon={TrendingDown} color="rose" />
        <StatCard label="Wallet Balance" value={fmt.inr(totalWalletBalance)} icon={Wallet} color="emerald" sub={`${wallets.length} wallets`} />
        <StatCard label="Failed" value={fmt.num(failedCount)} icon={AlertCircle} color="amber" sub={`${failRate}% of total`} />
      </div>

      {/* Channel Health Cards */}
      {summary?.by_channel?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summary.by_channel.map(c => (
            <ChannelCard key={c.channel} data={c} totalLogs={totalLogs} />
          ))}
        </div>
      )}

      {/* Status breakdown + Wallet leaderboard */}
      {(summary || wallets.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary && (
            <Card>
              <CardHeader title="Delivery Status Breakdown" />
              <div className="space-y-3">
                {Object.entries(summary.by_status || {}).map(([status, count]) => {
                  const pct = totalLogs > 0 ? Math.round((count / totalLogs) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <StatusBadge status={status} />
                        <span className="text-xs font-semibold text-slate-700">
                          {fmt.num(count)} <span className="text-slate-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${STATUS_BAR[status] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {wallets.length > 0 && (
            <Card>
              <CardHeader title={`Top Wallet Balances (${wallets.length})`} />
              <div className="space-y-2.5">
                {wallets.slice(0, 7).map((w, i) => {
                  const pct = totalWalletBalance > 0 ? (w.balance / totalWalletBalance) * 100 : 0;
                  return (
                    <div key={w.id} className="flex items-center gap-3">
                      <span className="text-xs text-slate-300 w-4 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-700 truncate">{w.clinic}</span>
                          <span className={`text-xs font-bold ml-2 shrink-0 ${w.balance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{fmt.inr(w.balance)}</span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tabs */}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* Message Logs */}
      {tab === 'logs' && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-800 flex-1">Logs ({fmt.num(logsTotal)})</span>
            <FilterSelect value={channelFilter} onChange={v => { setChannelFilter(v); setLogsPage(1); }}
              options={['whatsapp', 'email', 'sms']} placeholder="All Channels" />
            <FilterSelect value={statusFilter} onChange={v => { setStatusFilter(v); setLogsPage(1); }}
              options={['sent', 'delivered', 'failed']} placeholder="All Statuses" />
          </div>
          {tabLoading ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[820px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Clinic', 'Channel', 'Recipient', 'Event', 'Status', 'Cost', 'Error', 'Time'].map(h => (
                      <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map(log => (
                    <tr key={log.id} className={`hover:bg-slate-50/60 transition-colors ${log.status === 'failed' ? 'bg-rose-50/30' : ''}`}>
                      <td className="py-2.5 px-4 font-medium text-slate-800 truncate max-w-[120px]">{log.clinic}</td>
                      <td className="py-2.5 px-4"><Badge color={CHANNEL_MAP[log.channel] || 'slate'}>{log.channel}</Badge></td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 truncate max-w-[130px]">{log.recipient}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 capitalize max-w-[120px] truncate">{(log.event_type || '—').replace(/_/g, ' ')}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={log.status} /></td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">{log.cost ? fmt.inr(log.cost) : '—'}</td>
                      <td className="py-2.5 px-4 text-xs text-rose-500 truncate max-w-[160px]" title={log.error_message || ''}>{log.error_message || '—'}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-400 whitespace-nowrap">{fmt.datetime(log.created_at)}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">No logs found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={logsPage} total={logsTotal} perPage={PER_PAGE} onPageChange={setLogsPage} />
        </Card>
      )}

      {/* Wallets */}
      {tab === 'wallets' && (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['#', 'Clinic', 'Balance', 'Last Top-up'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {wallets.map((w, i) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-400 w-8">{i + 1}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{w.clinic}</td>
                    <td className="py-3 px-4">
                      <span className={`text-sm font-bold ${w.balance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{fmt.inr(w.balance)}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">{w.last_topup_at ? fmt.datetime(w.last_topup_at) : 'Never'}</td>
                  </tr>
                ))}
                {wallets.length === 0 && (
                  <tr><td colSpan={4} className="py-16 text-center text-sm text-slate-400">No wallets found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-800 flex-1">Transactions ({fmt.num(txTotal)})</span>
            <FilterSelect value={txTypeFilter} onChange={v => { setTxTypeFilter(v); setTxPage(1); }}
              options={[{ value: 'credit', label: 'Credit' }, { value: 'debit', label: 'Debit' }]} placeholder="All Types" />
          </div>
          {tabLoading ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Clinic', 'Type', 'Amount', 'Description', 'Order ID', 'Status', 'Date'].map(h => (
                      <th key={h} className="py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-800 truncate max-w-[130px]">{t.clinic}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {t.transaction_type === 'credit'
                            ? <ArrowUpRight size={14} className="text-emerald-500 shrink-0" />
                            : <ArrowDownLeft size={14} className="text-rose-500 shrink-0" />}
                          <Badge color={t.transaction_type === 'credit' ? 'emerald' : 'rose'}>{t.transaction_type}</Badge>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`text-sm font-bold ${t.transaction_type === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {t.transaction_type === 'credit' ? '+' : '−'}{fmt.inr(Math.abs(t.amount))}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 truncate max-w-[160px]">{t.description || '—'}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[130px]">{t.order_id || '—'}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={t.status} /></td>
                      <td className="py-2.5 px-4 text-xs text-slate-400 whitespace-nowrap">{fmt.datetime(t.created_at)}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-400">No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={txPage} total={txTotal} perPage={PER_PAGE} onPageChange={setTxPage} />
        </Card>
      )}
    </div>
  );
}
