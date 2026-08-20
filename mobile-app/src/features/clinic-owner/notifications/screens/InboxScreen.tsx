import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ShieldAlert, AlertCircle, Info, Bell, ChevronRight } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../../../../shared/constants/theme';
import { inboxApi, InboxItem, Severity } from '../inbox.api';

/**
 * The staff member's notification inbox — the phone's half of the web bell.
 *
 * Reads the same `/notifications` endpoints, so what is read here is read on
 * the web too. This is NOT the notification settings console; that lives in
 * NotificationsScreen and is about outbound patient messaging.
 */

/** Severity picks the icon and its tint. The row itself stays calm. */
const SEVERITY_ICON: Record<Severity, { Icon: typeof Info; color: string; bg: string }> = {
  critical: { Icon: ShieldAlert, color: colors.error, bg: colors.errorLight },
  action: { Icon: AlertCircle, color: colors.warning, bg: colors.warningLight },
  info: { Icon: Info, color: colors.info, bg: colors.infoLight },
};

/** "3h ago" / "2d ago". The API sends UTC without a marker, so it is pinned. */
const timeAgo = (iso?: string | null): string => {
  if (!iso) return '';
  const stamp = iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`;
  const seconds = Math.max(0, (Date.now() - new Date(stamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return new Date(stamp).toLocaleDateString();
};

interface Props {
  /** Optional: lets a tapped notification take the user where it points. */
  onOpenLink?: (link: string, item: InboxItem) => void;
}

export default function InboxScreen({ onOpenLink }: Props) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    const page = await inboxApi.list();
    setItems(page.notifications);
    setHasMore(page.has_more);
    setNextBeforeId(page.next_before_id);
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const loadMore = useCallback(async () => {
    // Guarded on all three: FlatList fires onEndReached more than once per
    // scroll, and without this the same page is fetched two or three times.
    if (loadingMore || !hasMore || !nextBeforeId) return;
    setLoadingMore(true);
    const page = await inboxApi.list(nextBeforeId);
    setItems((prev) => [...prev, ...page.notifications]);
    setHasMore(page.has_more);
    setNextBeforeId(page.next_before_id);
    setLoadingMore(false);
  }, [loadingMore, hasMore, nextBeforeId]);

  const open = useCallback(
    async (item: InboxItem) => {
      if (!item.read) {
        // Optimistic: the row should stop looking unread the instant it is
        // tapped, not after a round trip. Put back if the server disagrees.
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, read: true } : x)));
        const ok = await inboxApi.markRead(item.id);
        if (!ok) {
          setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, read: false } : x)));
        }
      }
      if (item.link && onOpenLink) onOpenLink(item.link, item);
    },
    [onOpenLink],
  );

  const markAll = useCallback(async () => {
    const snapshot = items;
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    const ok = await inboxApi.markAllRead();
    if (!ok) setItems(snapshot);
  }, [items]);

  const unread = items.filter((i) => !i.read).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {unread > 0 ? `${unread} unread` : 'You are all caught up'}
        </Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing to catch up on</Text>
            <Text style={styles.emptyBody}>
              Online bookings, payments and anything touching your account will appear here.
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null
        }
        renderItem={({ item }) => {
          const { Icon, color, bg } = SEVERITY_ICON[item.severity] || SEVERITY_ICON.info;
          return (
            <TouchableOpacity
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => open(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: bg }]}>
                <Icon size={18} color={color} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.titleLine}>
                  <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.count > 1 && (
                    <View style={styles.countPill}>
                      <Text style={styles.countText}>{item.count}</Text>
                    </View>
                  )}
                </View>
                {!!item.body && (
                  <Text style={styles.body} numberOfLines={2}>
                    {item.body}
                  </Text>
                )}
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
              {!!item.link && <ChevronRight size={16} color={colors.textMuted} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerTitle: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: '600' },
  markAll: { fontSize: typography.size.sm, color: colors.textLink, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  // Unread is a tint, not a badge. Border-only cards elsewhere in the app, so
  // an unread row should read as slightly warmer rather than decorated.
  rowUnread: { backgroundColor: colors.primaryBgLight },
  iconWrap: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  title: { flex: 1, fontSize: typography.size.md, color: colors.textPrimary },
  titleUnread: { fontWeight: '700' },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.borderColor,
  },
  countText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  body: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  time: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: spacing[16], paddingHorizontal: spacing[5], gap: spacing[2] },
  emptyTitle: { fontSize: typography.size.md, fontWeight: '600', color: colors.textSecondary },
  emptyBody: { fontSize: typography.size.sm, color: colors.textMuted, textAlign: 'center' },
  footer: { paddingVertical: spacing[4] },
});
