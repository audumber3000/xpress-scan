import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, Modal, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, Search, SlidersHorizontal, Smartphone, Monitor, Globe, X, Check, ScrollText,
} from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { EmptyState } from '../../../../shared/components/EmptyState';

/**
 * Audit Log — the consequential things people did in this clinic.
 *
 * Read-only, matching the web build: no edit, no delete, because a trail
 * somebody can tidy up isn't evidence of anything. Owner-only, enforced by the
 * backend (require_clinic_owner), so a non-owner simply sees an empty list
 * rather than a screen that half-works.
 *
 * CSV export is deliberately web-only: a file download has nowhere useful to go
 * on a phone, and the same filters are available there.
 */

const PER_PAGE = 25;

// Coloured by how much the action can cost you, not by which module it came
// from — same rule as the web table.
const toneFor = (action: string) => {
  if (/\.deleted$|\.removed$|deactivated/.test(action)) return { bg: '#FEF2F2', fg: '#B91C1C' };
  if (/permissions|security|clinic\./.test(action)) return { bg: '#FFFBEB', fg: '#B45309' };
  if (/discount/.test(action)) return { bg: '#F5F3FF', fg: '#6D28D9' };
  return { bg: '#F3F4F6', fg: '#4B5563' };
};

const deviceOf = (ua = '') => {
  if (/iphone|android.*mobile/i.test(ua)) return { Icon: Smartphone, label: 'Phone' };
  if (/ipad|tablet/i.test(ua)) return { Icon: Smartphone, label: 'Tablet' };
  if (/molarplus|electron|tauri/i.test(ua)) return { Icon: Monitor, label: 'Desktop app' };
  if (/mozilla|chrome|safari|firefox/i.test(ua)) return { Icon: Globe, label: 'Browser' };
  return { Icon: Globe, label: '—' };
};

const when = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

interface LogRow {
  id: number;
  action: string;
  action_label: string;
  summary: string;
  actor_name: string;
  actor_role?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
}

export const AuditLogScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [actions, setActions] = useState<{ value: string; label: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [action, setAction] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async (targetPage: number, replace: boolean) => {
    const data = await adminApiService.getAuditLog({
      page: targetPage,
      per_page: PER_PAGE,
      ...(action ? { action } : {}),
      ...(debounced.trim().length >= 2 ? { search: debounced.trim() } : {}),
    });
    const rows: LogRow[] = data?.logs || [];
    setTotal(Number(data?.total) || 0);
    if (data?.actions?.length) setActions(data.actions);
    // Appended, not replaced, when paging — otherwise "load more" would jump
    // the list back to the top on every page.
    setLogs(prev => (replace ? rows : [...prev, ...rows]));
  }, [action, debounced]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPage(1);
    fetchPage(1, true).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchPage]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await fetchPage(1, true);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || logs.length >= total) return;
    setLoadingMore(true);
    const next = page + 1;
    await fetchPage(next, false);
    setPage(next);
    setLoadingMore(false);
  };

  const activeLabel = actions.find(a => a.value === action)?.label;

  const renderRow = ({ item }: { item: LogRow }) => {
    const tone = toneFor(item.action);
    const dev = deviceOf(item.user_agent || '');
    return (
      <View style={styles.row}>
        <View style={styles.rowTop}>
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.badgeText, { color: tone.fg }]}>{item.action_label}</Text>
          </View>
          <Text style={styles.when}>{when(item.created_at)}</Text>
        </View>

        <Text style={styles.summary}>{item.summary}</Text>

        <View style={styles.rowFoot}>
          <Text style={styles.actor} numberOfLines={1}>
            {item.actor_name}
            {item.actor_role ? ` · ${item.actor_role.replace(/_/g, ' ')}` : ''}
          </Text>
          <View style={styles.devWrap}>
            <dev.Icon size={12} color="#9CA3AF" />
            <Text style={styles.devText}>{dev.label}</Text>
            {!!item.ip_address && <Text style={styles.ip}>{item.ip_address}</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Audit Log</Text>
          <Text style={styles.subtitle}>
            {total} {total === 1 ? 'entry' : 'entries'}
            {activeLabel ? ` · ${activeLabel}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search person or change…"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, !!action && styles.filterBtnOn]}
          onPress={() => setFilterOpen(true)}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={16} color={action ? adminColors.primary : '#6B7280'} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><GearLoader /></View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderRow}
          contentContainerStyle={logs.length === 0 ? { flexGrow: 1 } : { padding: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon={ScrollText}
              title={action || debounced ? 'Nothing matches those filters' : 'Nothing logged yet'}
              description={action || debounced
                ? 'Try a different action or clear the search.'
                : 'Deletions and settings changes appear here as they happen.'}
            />
          }
        />
      )}

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filter by action</Text>
            <TouchableOpacity onPress={() => setFilterOpen(false)} style={{ padding: 6 }}>
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {[{ value: '', label: 'All actions' }, ...actions].map(a => (
              <TouchableOpacity
                key={a.value || 'all'}
                style={styles.optRow}
                onPress={() => { setAction(a.value); setFilterOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.optText, action === a.value && styles.optTextOn]}>{a.label}</Text>
                {action === a.value && <Check size={17} color={adminColors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, backgroundColor: '#fff' },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 1 },

  toolbar: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  filterBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  filterBtnOn: { borderColor: adminColors.primary, backgroundColor: '#F0FDFA' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  row: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  when: { fontSize: 11.5, color: '#9CA3AF' },
  summary: { fontSize: 13.5, color: '#374151', marginTop: 8, lineHeight: 19 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  actor: { flex: 1, fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'capitalize' },
  devWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  devText: { fontSize: 11, color: '#9CA3AF' },
  ip: { fontSize: 11, color: '#C0C6CF' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sheetTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#111827' },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  optText: { fontSize: 14.5, color: '#374151' },
  optTextOn: { fontWeight: '700', color: adminColors.primary },
});
