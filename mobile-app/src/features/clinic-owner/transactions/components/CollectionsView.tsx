import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { ChevronLeft, ChevronRight, Download, ArrowDownLeft, Wallet, TrendingUp, TrendingDown } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { componentRadius } from '../../../../shared/constants/theme';
import { PatientAvatar } from '../../../../shared/components/PatientAvatar';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { showAlert } from '../../../../shared/components/alertService';
import { notify } from '../../../../shared/utils/notify';
import { transactionsApiService, CollectionsResponse, CollectionEntry } from '../../../../services/api/transactions.api';
import { getCurrencySymbol } from '../../../../shared/utils/currency';
import { todayISO, shiftISO, formatDisplayDate, formatTime } from '../../../../shared/utils/datetime';
import { exportDaySheet } from '../../../../shared/utils/export';

interface Props { onOpenInvoice?: (invoiceId: number) => void; }

const money = (n: number) =>
  `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN')}`;

const workLabel = (items?: CollectionEntry['items']) => {
  const list = Array.isArray(items) ? items.filter((i) => i && i.description) : [];
  if (list.length === 0) return '';
  const first = list[0];
  const label = Number(first.quantity) > 1 ? `${first.description} ×${first.quantity}` : first.description;
  return list.length > 1 ? `${label} +${list.length - 1} more` : label;
};

export const CollectionsView: React.FC<Props> = ({ onOpenInvoice }) => {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<CollectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await transactionsApiService.getCollections(date);
      setData(res);
    } catch (e: any) {
      notify.problem(e?.message || "Couldn't load collections");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const isToday = date === todayISO();

  const stepDay = (delta: number) => {
    const next = shiftISO(date, delta);
    if (next > todayISO()) return;
    setDate(next);
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(true);
      await exportDaySheet(transactionsApiService.collectionsExportUrl(date, format), `collections_${date}.${format}`, format);
    } catch (e: any) {
      notify.problem(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const askExport = () => {
    showAlert('Export collections', `Payments for ${formatDisplayDate(date)}`, [
      { text: 'PDF', onPress: () => handleExport('pdf') },
      { text: 'CSV', onPress: () => handleExport('csv') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const entries = data?.entries || [];

  return (
    <View style={styles.container}>
      {/* Day bar: stepper + totals + export, all in one compact band */}
      <View style={styles.dayBar}>
        <View style={styles.dayStepper}>
          <TouchableOpacity onPress={() => stepDay(-1)} style={styles.dayBtn} hitSlop={8}>
            <ChevronLeft size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.dayLabel}>{isToday ? 'Today' : formatDisplayDate(date)}</Text>
          <TouchableOpacity onPress={() => stepDay(1)} style={[styles.dayBtn, isToday && styles.dayBtnOff]} disabled={isToday} hitSlop={8}>
            <ChevronRight size={18} color={isToday ? colors.gray300 : colors.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={askExport} style={styles.exportBtn} disabled={exporting} hitSlop={6}>
          {exporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Download size={16} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      {/* Total collected card */}
      {(() => {
        const total = data?.total || 0;
        const cash = data?.cash || 0;
        const online = data?.online || 0;
        const prev = data?.previous?.total || 0;
        const pct = prev > 0 ? ((total - prev) / prev) * 100 : null;
        const up = (pct ?? 0) >= 0;
        const cashPct = total > 0 ? Math.round((cash / total) * 100) : 0;
        const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0;
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Total Collected</Text>
                <Text style={styles.cardValue}>{money(total)}</Text>
                {pct !== null ? (
                  <View style={styles.trendRow}>
                    {up ? <TrendingUp size={14} color={colors.success} /> : <TrendingDown size={14} color={colors.error} />}
                    <Text style={[styles.trendText, { color: up ? colors.success : colors.error }]}>
                      {Math.abs(pct).toFixed(0)}% from {isToday ? 'yesterday' : 'last week'}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.trendText, { color: colors.textMuted, marginTop: 6 }]}>
                    {isToday ? 'No collection to compare' : ''}
                  </Text>
                )}
              </View>
              <View style={styles.walletCircle}><Wallet size={20} color={colors.primary} /></View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.splitRow}>
              <View style={styles.splitCol}>
                <View style={styles.splitHead}>
                  <Text style={styles.splitLabel}>Cash</Text>
                  <Text style={[styles.splitValue, { color: colors.warning }]}>{money(cash)}</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${cashPct}%`, backgroundColor: colors.warning }]} /></View>
              </View>
              <View style={styles.splitCol}>
                <View style={styles.splitHead}>
                  <Text style={styles.splitLabel}>Online</Text>
                  <Text style={[styles.splitValue, { color: colors.info }]}>{money(online)}</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${onlinePct}%`, backgroundColor: colors.info }]} /></View>
              </View>
            </View>
          </View>
        );
      })()}

      {loading && !refreshing ? (
        <View style={{ paddingTop: 40 }}><GearLoader text="Loading collections…" /></View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyTitle}>{isToday ? 'No payments collected today' : `No payments on ${formatDisplayDate(date)}`}</Text>
              <Text style={styles.emptySubtitle}>Payments you record show up here, part payments included.</Text>
            </View>
          ) : (
            entries.map((e, index) => (
              <View key={e.payment_id}>
                <TouchableOpacity style={styles.rowContent} activeOpacity={0.7} onPress={() => onOpenInvoice?.(e.invoice_id)}>
                  <View style={styles.avatarContainer}>
                    <PatientAvatar name={e.patient_name} size={48} />
                    <View style={[styles.iconIndicator, { backgroundColor: '#10B981' }]}>
                      <ArrowDownLeft size={10} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {e.patient_name || 'Unknown'}
                      {e.patient_display_id ? <Text style={styles.itemId}>  #{e.patient_display_id}</Text> : null}
                    </Text>
                    <Text style={styles.itemSubtitle} numberOfLines={1}>{workLabel(e.items) || e.invoice_number}</Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {e.invoice_number}{e.created_at ? ` · ${formatTime(e.created_at)}` : ''}{e.method ? ` · ${e.method}` : ''}
                    </Text>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={styles.itemAmount}>+{money(e.amount)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: '#E6F9F1' }]}>
                      <Text style={[styles.statusText, { color: '#10B981' }]}>{(e.method || 'PAID').toUpperCase()}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {index < entries.length - 1 && <View style={styles.separator} />}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  dayBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  dayStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryBgLight, alignItems: 'center', justifyContent: 'center' },
  dayBtnOff: { backgroundColor: colors.gray100 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, minWidth: 120, textAlign: 'center' },
  exportBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },

  card: { marginHorizontal: 16, marginTop: 6, marginBottom: 10, padding: 16, backgroundColor: colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: colors.borderColor },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  cardValue: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  trendText: { fontSize: 13, fontWeight: '700' },
  walletCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryBgLight, alignItems: 'center', justifyContent: 'center' },
  cardDivider: { height: 1, backgroundColor: colors.separatorColor, marginVertical: 14 },
  splitRow: { flexDirection: 'row', gap: 16 },
  splitCol: { flex: 1 },
  splitHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  splitLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  splitValue: { fontSize: 15, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.gray100, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },

  list: { flex: 1, backgroundColor: '#FFFFFF' },
  listContent: { flexGrow: 1, paddingBottom: 24 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  rowContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  avatarContainer: { position: 'relative' },
  iconIndicator: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  transactionInfo: { flex: 1, marginLeft: 15 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemId: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  itemSubtitle: { fontSize: 13, color: '#374151', marginTop: 2 },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  transactionRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: componentRadius.pill, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 82 },
});
