import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  ChevronLeft, ChevronRight, Trash2, X, Download,
  Users, TrendingUp, TrendingDown,
} from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { PatientAvatar } from '../../../../shared/components/PatientAvatar';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { EmptyState } from '../../../../shared/components/EmptyState';
import { showAlert } from '../../../../shared/components/alertService';
import { toast } from '../../../../shared/components/toastService';
import {
  dailyRegisterApiService, DailyRegisterResponse, DailyVisit, DuplicateMatch,
} from '../../../../services/api/dailyRegister.api';
import { todayISO, shiftISO, formatDisplayDate, formatTime } from '../../../../shared/utils/datetime';
import { exportDaySheet } from '../../../../shared/utils/export';

interface Props {
  navigation: any;
  onRegisterNew: (name: string, phone: string) => void;
  refreshKey?: number;
  // Bumped by the parent's header "+" to open the register flow.
  registerSignal?: number;
}

export const TodayPatientsView: React.FC<Props> = ({ navigation, onRegisterNew, refreshKey = 0, registerSignal = 0 }) => {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<DailyRegisterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Header "+" (in the parent screen) opens the register flow.
  useEffect(() => { if (registerSignal > 0) setRegisterOpen(true); }, [registerSignal]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dailyRegisterApiService.getRegister(date);
      setData(res);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't load the register");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const kpis = data?.kpis || { total: 0, new: 0, repeat: 0 };
  const prevKpis = data?.previous?.kpis || { total: 0, new: 0, repeat: 0 };
  const isToday = date === todayISO();

  // vs the same weekday last week (what the backend's `previous` block holds).
  const totalDelta = kpis.total - prevKpis.total;
  const newPct = prevKpis.new > 0 ? Math.round(((kpis.new - prevKpis.new) / prevKpis.new) * 100) : null;
  const repeatPct = prevKpis.repeat > 0 ? Math.round(((kpis.repeat - prevKpis.repeat) / prevKpis.repeat) * 100) : null;

  const entries = data?.entries || [];

  const stepDay = (delta: number) => {
    const next = shiftISO(date, delta);
    if (next > todayISO()) return;
    setDate(next);
  };

  const confirmRemove = (entry: DailyVisit) => {
    if (entry.is_locked) return;
    const attached = entry.invoice_count > 0 || entry.case_paper_count > 0;
    const doRemove = async () => {
      try {
        setRemovingId(entry.id);
        await dailyRegisterApiService.removeEntry(entry.id);
        toast.success('Removed from the register');
        load();
      } catch (e: any) {
        toast.error(e?.message || "Couldn't remove the entry");
      } finally {
        setRemovingId(null);
      }
    };
    if (attached) {
      showAlert(
        'Remove from the register?',
        `${entry.patient_name} has work recorded on this day. That stays; only the register line is removed.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: doRemove }],
      );
    } else {
      doRemove();
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(true);
      await exportDaySheet(dailyRegisterApiService.exportUrl(date, format), `daily-register_${date}.${format}`, format);
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const askExport = () => {
    showAlert('Export day sheet', `Register for ${formatDisplayDate(date)}`, [
      { text: 'PDF', onPress: () => handleExport('pdf') },
      { text: 'CSV', onPress: () => handleExport('csv') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const header = (
    <View>
      {/* Day bar: stepper + export */}
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

      {/* KPI card — total on top, New / Repeat with accent bars below */}
      <View style={styles.kpiCard}>
        <View style={styles.kpiTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kpiTopLabel}>TOTAL PATIENTS</Text>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiTotal}>{kpis.total}</Text>
              {kpis.total > 0 && (
                <View style={styles.kpiTrend}>
                  {totalDelta >= 0 ? <TrendingUp size={14} color={colors.success} /> : <TrendingDown size={14} color={colors.error} />}
                  <Text style={[styles.kpiTrendText, { color: totalDelta >= 0 ? colors.success : colors.error }]}>
                    {totalDelta >= 0 ? '+' : ''}{totalDelta} vs {isToday ? 'last week' : 'prev week'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.kpiIconCircle}><Users size={20} color={colors.info} /></View>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiSplit}>
          <View style={styles.kpiSplitItem}>
            <View style={[styles.kpiBar, { backgroundColor: colors.success }]} />
            <View>
              <Text style={styles.kpiSplitLabel}>New Patients</Text>
              <View style={styles.kpiSplitRow}>
                <Text style={styles.kpiSplitValue}>{String(kpis.new).padStart(2, '0')}</Text>
                {newPct !== null && (
                  <Text style={[styles.kpiSplitPct, { color: newPct >= 0 ? colors.success : colors.error }]}>
                    {newPct >= 0 ? '+' : ''}{newPct}%
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.kpiSplitItem}>
            <View style={[styles.kpiBar, { backgroundColor: colors.info }]} />
            <View>
              <Text style={styles.kpiSplitLabel}>Repeat</Text>
              <View style={styles.kpiSplitRow}>
                <Text style={styles.kpiSplitValue}>{String(kpis.repeat).padStart(2, '0')}</Text>
                <Text style={[styles.kpiSplitPct, { color: colors.textMuted }]}>
                  {repeatPct === null || repeatPct === 0 ? 'Stable' : `${repeatPct > 0 ? '+' : ''}${repeatPct}%`}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Close-of-day nudge */}
      {!!data?.pending && (data.pending.not_billed > 0 || data.pending.no_case_paper > 0) && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            Before you close {isToday ? 'today' : 'this day'}:
            {data.pending.not_billed > 0 ? ` ${data.pending.not_billed} not billed` : ''}
            {data.pending.not_billed > 0 && data.pending.no_case_paper > 0 ? ',' : ''}
            {data.pending.no_case_paper > 0 ? ` ${data.pending.no_case_paper} without a case paper` : ''}.
          </Text>
        </View>
      )}

      <View style={{ height: 8 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={{ flex: 1 }}>{header}<View style={{ paddingTop: 40 }}><GearLoader text="Loading register…" /></View></View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <EntryRow
              entry={item}
              removing={removingId === item.id}
              onPress={() => navigation.navigate('PatientDetails', { patientId: String(item.patient_id) })}
              onRemove={() => confirmRemove(item)}
            />
          )}
          ListEmptyComponent={
            <View style={{ paddingTop: 24 }}>
              <EmptyState
                title={isToday ? 'Nobody registered yet today' : `No patients on ${formatDisplayDate(date)}`}
                description="Register the first patient of the day, or check someone in from the calendar."
              />
            </View>
          }
        />
      )}

      <RegisterPatientModal
        visible={registerOpen}
        date={date}
        onClose={() => setRegisterOpen(false)}
        onRegisterNew={(name, phone) => { setRegisterOpen(false); onRegisterNew(name, phone); }}
        onRegisteredExisting={() => { setRegisterOpen(false); load(); }}
      />
    </View>
  );
};

// ── Entry row — mirrors the All Patients PatientCard layout ─────────────────
const EntryRow: React.FC<{ entry: DailyVisit; removing: boolean; onPress: () => void; onRemove: () => void }> = ({ entry, removing, onPress, onRemove }) => {
  const markers: string[] = [];
  if (entry.case_paper_count === 0) markers.push('No case paper');
  if (entry.invoice_count === 0) markers.push('Not billed');
  const third = entry.reason || (markers.length ? markers.join(' · ') : (entry.created_at ? formatTime(entry.created_at) : ''));

  return (
    <TouchableOpacity style={styles.rowContent} onPress={onPress} activeOpacity={0.7}>
      <PatientAvatar name={entry.patient_name} gender={entry.gender} size={50} style={{ marginRight: 12 }} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{entry.patient_name || 'Unknown'}</Text>
          <View style={[styles.badge, entry.is_repeat ? styles.badgeRepeat : styles.badgeNew]}>
            <Text style={[styles.badgeText, { color: entry.is_repeat ? colors.warning : colors.success }]}>
              {entry.is_repeat ? 'Repeat' : 'New'}
            </Text>
          </View>
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {entry.patient_phone || 'No phone'}{entry.display_id ? `  ·  #${entry.display_id}` : ''}
        </Text>
        {!!third && <Text style={styles.third} numberOfLines={1}>{third}</Text>}
      </View>
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation(); onRemove(); }}
        disabled={entry.is_locked || removing}
        style={styles.removeBtn}
        hitSlop={8}
      >
        {removing ? <ActivityIndicator size="small" color={colors.gray400} /> : <Trash2 size={17} color={entry.is_locked ? colors.gray300 : colors.gray400} />}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

// ── Register modal (unchanged behaviour) ────────────────────────────────────
const RegisterPatientModal: React.FC<{
  visible: boolean;
  date: string;
  onClose: () => void;
  onRegisterNew: (name: string, phone: string) => void;
  onRegisteredExisting: () => void;
}> = ({ visible, date, onClose, onRegisterNew, onRegisteredExisting }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [matches, setMatches] = useState<DuplicateMatch[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setName(''); setPhone(''); setReason(''); setMatches(null); }
  }, [visible]);

  const check = async () => {
    if (!name.trim() && !phone.trim()) { toast.error('Enter a name or phone to look them up'); return; }
    try {
      setBusy(true);
      const found = await dailyRegisterApiService.checkDuplicates(name.trim(), phone.trim());
      if (found.length === 0) onRegisterNew(name.trim(), phone.trim());
      else setMatches(found);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't check existing patients");
    } finally {
      setBusy(false);
    }
  };

  const addExisting = async (p: DuplicateMatch) => {
    try {
      setBusy(true);
      await dailyRegisterApiService.addEntry({ patient_id: p.id, reason: reason.trim() || null, visit_date: date });
      toast.success(`${p.name} added to the register`);
      onRegisteredExisting();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't add this patient");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Register patient</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><X size={22} color={colors.gray500} /></TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Patient name</Text>
          <TextInput style={styles.field} value={name} onChangeText={(v) => { setName(v); setMatches(null); }} placeholder="Full name" placeholderTextColor={colors.gray400} />

          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput style={styles.field} value={phone} onChangeText={(v) => { setPhone(v); setMatches(null); }} placeholder="10-digit number" placeholderTextColor={colors.gray400} keyboardType="phone-pad" />

          <Text style={styles.fieldLabel}>Reason for visit</Text>
          <TextInput style={styles.field} value={reason} onChangeText={setReason} placeholder="Optional" placeholderTextColor={colors.gray400} />

          {matches && matches.length > 0 && (
            <View style={styles.matchBox}>
              <Text style={styles.matchTitle}>{matches.length} patient(s) already on your books</Text>
              <Text style={styles.matchSub}>Pick the same person for a repeat visit, or register a new patient.</Text>
              {matches.map((m) => (
                <TouchableOpacity key={m.id} style={styles.matchRow} onPress={() => addExisting(m)} disabled={busy}>
                  <PatientAvatar name={m.name} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.matchName} numberOfLines={1}>{m.name} <Text style={styles.matchId}>#{m.display_id || '—'}</Text></Text>
                    <Text style={styles.matchMeta} numberOfLines={1}>{m.phone || 'No phone'}{m.village ? ` · ${m.village}` : ''}</Text>
                  </View>
                  <Text style={styles.usePick}>Same →</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => onRegisterNew(name.trim(), phone.trim())} style={{ paddingVertical: 10 }}>
                <Text style={styles.newLink}>None of these — register a new patient</Text>
              </TouchableOpacity>
            </View>
          )}

          {(!matches || matches.length === 0) && (
            <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={check} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Continue</Text>}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },

  dayBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  dayStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryBgLight, alignItems: 'center', justifyContent: 'center' },
  dayBtnOff: { backgroundColor: colors.gray100 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, minWidth: 120, textAlign: 'center' },
  exportBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },

  kpiCard: { marginHorizontal: 16, marginTop: 12, padding: 16, backgroundColor: colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: colors.borderColor },
  kpiTop: { flexDirection: 'row', alignItems: 'flex-start' },
  kpiTopLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 },
  kpiTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  kpiTotal: { fontSize: 30, fontWeight: '800', color: colors.textPrimary },
  kpiTrend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  kpiTrendText: { fontSize: 13, fontWeight: '700' },
  kpiIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.infoLight, alignItems: 'center', justifyContent: 'center' },
  kpiDivider: { height: 1, backgroundColor: colors.separatorColor, marginVertical: 14 },
  kpiSplit: { flexDirection: 'row', gap: 16 },
  kpiSplitItem: { flex: 1, flexDirection: 'row', gap: 10 },
  kpiBar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  kpiSplitLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  kpiSplitRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  kpiSplitValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  kpiSplitPct: { fontSize: 13, fontWeight: '700' },

  pendingBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: colors.warningBadgeBg, borderWidth: 1, borderColor: colors.warningLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pendingText: { fontSize: 12.5, color: '#B45309' },


  // Rows match PatientCard exactly
  rowContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '600', color: '#111827', flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeNew: { backgroundColor: colors.successLight },
  badgeRepeat: { backgroundColor: colors.warningLight },
  badgeText: { fontSize: 11, fontWeight: '700' },
  sub: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  third: { fontSize: 13, color: '#9CA3AF' },
  removeBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 82 },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12, marginBottom: 6 },
  field: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.borderColor, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, color: colors.textPrimary },
  matchBox: { marginTop: 16, borderWidth: 1, borderColor: colors.warningLight, borderRadius: 12, overflow: 'hidden' },
  matchTitle: { fontSize: 13.5, fontWeight: '700', color: '#92400E', paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.warningBadgeBg },
  matchSub: { fontSize: 11.5, color: '#B45309', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: colors.warningBadgeBg },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.separatorColor },
  matchName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  matchId: { fontSize: 11, color: colors.textMuted, fontWeight: '400' },
  matchMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  usePick: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  newLink: { fontSize: 13.5, fontWeight: '700', color: colors.primary, paddingHorizontal: 12 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
