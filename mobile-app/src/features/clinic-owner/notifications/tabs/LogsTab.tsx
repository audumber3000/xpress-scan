import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { RefreshCw, FileText, Clock, Send, CheckCircle2, Eye, XCircle, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { getCurrencySymbol } from '../../../../shared/utils/currency';
import { CHANNEL_META, EVENT_LABELS, ChannelKey } from '../constants';
import { notificationsApi, NotifLog } from '../notifications.api';

const PER_PAGE = 20;
const CHANNEL_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' }, { key: 'whatsapp', label: 'WhatsApp' }, { key: 'email', label: 'Email' }, { key: 'sms', label: 'SMS' },
];
const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' }, { key: 'queued', label: 'Queued' }, { key: 'sent', label: 'Sent' },
  { key: 'delivered', label: 'Delivered' }, { key: 'read', label: 'Read' }, { key: 'failed', label: 'Failed' },
];

const STATUS_CFG: Record<string, { bg: string; fg: string; Icon: any; label: string }> = {
  queued:    { bg: '#F3F4F6', fg: '#6B7280', Icon: Clock, label: 'Queued' },
  sent:      { bg: '#EFF6FF', fg: '#2563EB', Icon: Send, label: 'Sent' },
  delivered: { bg: '#ECFDF5', fg: '#059669', Icon: CheckCircle2, label: 'Delivered' },
  read:      { bg: '#F5F3FF', fg: '#7C3AED', Icon: Eye, label: 'Read' },
  failed:    { bg: '#FEF2F2', fg: '#DC2626', Icon: XCircle, label: 'Failed' },
};

export const LogsTab: React.FC = () => {
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const cur = getCurrencySymbol();

  const load = useCallback(async (p: number, ch: string, st: string) => {
    setLoading(true);
    const { logs: rows, total: t } = await notificationsApi.getLogs(p, { channel: ch, status: st });
    setLogs(rows);
    setTotal(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(page, channel, status); }, [page, channel, status, load]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Message Logs</Text>
          <Text style={styles.sub}>{total} total messages</Text>
        </View>
        <TouchableOpacity onPress={() => load(page, channel, status)} style={styles.refreshBtn}>
          <RefreshCw size={14} color={colors.gray600} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {CHANNEL_FILTERS.map((f) => (
          <TouchableOpacity key={`c-${f.key}`} onPress={() => { setPage(1); setChannel(f.key); }}
            style={[styles.filterChip, channel === f.key && styles.filterChipOn]}>
            <Text style={[styles.filterChipText, channel === f.key && styles.filterChipTextOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.filterDivider} />
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity key={`s-${f.key}`} onPress={() => { setPage(1); setStatus(f.key); }}
            style={[styles.filterChip, status === f.key && styles.filterChipOn]}>
            <Text style={[styles.filterChipText, status === f.key && styles.filterChipTextOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : logs.length === 0 ? (
        <View style={styles.center}>
          <FileText size={26} color={colors.gray300} />
          <Text style={styles.emptyText}>No messages sent yet.</Text>
        </View>
      ) : (
        logs.map((log) => {
          const meta = CHANNEL_META[log.channel as ChannelKey];
          const cfg = STATUS_CFG[log.status] || { bg: '#F3F4F6', fg: '#6B7280', Icon: Clock, label: log.status };
          return (
            <View key={log.id} style={styles.logRow}>
              <View style={styles.logLeft}>
                {meta && (
                  <View style={[styles.logChannelIcon, { backgroundColor: meta.bg }]}>
                    <meta.Icon size={13} color={meta.color} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.logRecipient} numberOfLines={1}>{log.recipient}</Text>
                  <Text style={styles.logEvent} numberOfLines={1}>
                    {EVENT_LABELS[log.event_type || ''] || log.event_type || '—'}
                    {log.created_at ? `  ·  ${new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.logRight}>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <cfg.Icon size={10} color={cfg.fg} />
                  <Text style={[styles.statusPillText, { color: cfg.fg }]}>{cfg.label}</Text>
                </View>
                {!!log.cost && log.cost > 0 && <Text style={styles.logCost}>{cur}{log.cost.toFixed(4)}</Text>}
              </View>
            </View>
          );
        })
      )}

      {/* Pagination */}
      {total > PER_PAGE && (
        <View style={styles.pager}>
          <TouchableOpacity disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={[styles.pagerBtn, page <= 1 && styles.pagerBtnOff]}>
            <ChevronLeft size={16} color={page <= 1 ? colors.gray300 : colors.gray700} />
          </TouchableOpacity>
          <Text style={styles.pagerText}>Page {page} of {totalPages}</Text>
          <TouchableOpacity disabled={page >= totalPages} onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnOff]}>
            <ChevronRight size={16} color={page >= totalPages ? colors.gray300 : colors.gray700} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: colors.gray400, marginTop: 1 },
  refreshBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },

  filterScroll: { marginBottom: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  filterChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.gray500 },
  filterChipTextOn: { color: colors.primary },
  filterDivider: { width: 1, height: 20, backgroundColor: '#E5E7EB', marginHorizontal: 4 },

  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 36 },
  emptyText: { fontSize: 13, color: colors.gray400 },

  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  logLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logChannelIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logRecipient: { fontSize: 13, fontWeight: '600', color: colors.gray800 },
  logEvent: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  logRight: { alignItems: 'flex-end', gap: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  logCost: { fontSize: 10, color: colors.gray500, fontWeight: '600' },

  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pagerBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  pagerBtnOff: { backgroundColor: '#FAFAFA' },
  pagerText: { fontSize: 12, fontWeight: '600', color: colors.gray600 },
});
