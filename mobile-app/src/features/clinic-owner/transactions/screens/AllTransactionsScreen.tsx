import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownLeft, ArrowUpRight, Receipt, X } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../app/AppNavigator';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { PatientAvatar } from '../../../../shared/components/PatientAvatar';
import { colors } from '../../../../shared/constants/colors';
import { componentRadius } from '../../../../shared/constants/theme';
import { transactionsApiService, Transaction, LedgerItem } from '../../../../services/api/transactions.api';
import { getCurrencySymbol } from '../../../../shared/utils/currency';
import { CollectionsView } from '../components/CollectionsView';

interface AllTransactionsScreenProps {}

type Tab = 'collections' | 'payments' | 'ledger';

/**
 * What each tab can be narrowed to.
 *
 * `unpaid` is the one that matters most: it is where the Outstanding tile on
 * the dashboard lands. That tile used to open this screen on Today's Collection
 * with no filter at all, so tapping a figure of ₹68,430 showed today's takings
 * instead of the twenty invoices that make up the debt. The number you tapped
 * has to be the list you get.
 */
const FILTERS: Record<Exclude<Tab, 'collections'>, { id: string; label: string }[]> = {
  payments: [
    { id: 'all', label: 'All' },
    { id: 'unpaid', label: 'Unpaid' },
    { id: 'paid', label: 'Paid' },
  ],
  ledger: [
    { id: 'all', label: 'All' },
    { id: 'invoice', label: 'Income' },
    { id: 'expense', label: 'Expenses' },
  ],
};

const isUnpaid = (t: Transaction) => {
  const status = String(t.status || '').toLowerCase();
  return status === 'pending' || t.type === 'pending';
};

export const AllTransactionsScreen: React.FC<AllTransactionsScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AllTransactions'>>();

  // Arriving from a dashboard tile: open the tab it belongs to, already
  // narrowed. Defaults are unchanged for anyone opening the screen normally.
  const [activeTab, setActiveTab] = useState<Tab>(route.params?.tab || 'collections');
  const [filter, setFilter] = useState<string>(route.params?.filter || 'all');
  // Set only when the screen was opened pre-filtered, so the banner explaining
  // why the list is short can be shown once and dismissed.
  const [cameFiltered, setCameFiltered] = useState<boolean>(!!route.params?.filter);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    // The collections tab loads its own data inside CollectionsView.
    if (activeTab === 'collections') { setLoading(false); return; }
    setLoading(true);
    try {
      if (activeTab === 'payments') {
        const data = await transactionsApiService.getTransactions();
        setTransactions(data);
      } else {
        const data = await transactionsApiService.getLedger();
        setLedgerItems(data);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      showAlert('Error', `Failed to load data: ${err.message}`);
      if (activeTab === 'payments') setTransactions([]);
      else setLedgerItems([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'payments') {
        const data = await transactionsApiService.getTransactions();
        setTransactions(data);
      } else {
        const data = await transactionsApiService.getLedger();
        setLedgerItems(data);
      }
    } catch (err: any) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const names = name.trim().split(/\s+/);
    if (names.length > 1 && names[0][0] && names[1][0]) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return (name || '??').substring(0, 2).toUpperCase();
  };

  const handleItemPress = (item: Transaction | LedgerItem) => {
    if ('type' in item && item.type === 'expense') {
      navigation.navigate('ExpenseDetails', { expenseId: item.id });
    } else {
      navigation.navigate('InvoiceDetails', { invoiceId: item.id });
    }
  };

  // What the list actually shows. Kept separate from the loaded data so the
  // counts on the chips can describe the whole set while the list shows a slice.
  const visibleTransactions = transactions.filter((t) => {
    if (filter === 'unpaid') return isUnpaid(t);
    if (filter === 'paid') return !isUnpaid(t);
    return true;
  });

  const visibleLedger = ledgerItems.filter((i) =>
    filter === 'all' ? true : i.type === filter
  );

  const countFor = (id: string): number => {
    if (activeTab === 'payments') {
      if (id === 'unpaid') return transactions.filter(isUnpaid).length;
      if (id === 'paid') return transactions.filter((t) => !isUnpaid(t)).length;
      return transactions.length;
    }
    if (id === 'all') return ledgerItems.length;
    return ledgerItems.filter((i) => i.type === id).length;
  };

  const activeFilterLabel =
    activeTab === 'collections' || filter === 'all'
      ? null
      : FILTERS[activeTab].find((f) => f.id === filter)?.label || null;

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    // Filters do not carry across tabs: "unpaid" means nothing on the ledger,
    // and a stale selection would silently hide rows on arrival.
    setFilter('all');
    setCameFiltered(false);
  };

  const renderTab = (tab: Tab, label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => selectTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {label}
      </Text>
      {activeTab === tab && <View style={styles.activeTabIndicator} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        topInset
        title="All Transactions"
        titleIcon={<Receipt size={22} />}
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />


      {/* Tabs */}
      <View style={styles.tabContainer}>
        {renderTab('collections', "Today's Collection")}
        {renderTab('payments', 'Payments')}
        {renderTab('ledger', 'Ledger')}
      </View>

      {/* Filter chips. Each carries its count, so the size of what you are not
          looking at is visible without switching to it. */}
      {activeTab !== 'collections' && !loading && (
        <View style={styles.filterBar}>
          {FILTERS[activeTab].map((f) => {
            const active = filter === f.id;
            const count = countFor(f.id);
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => { setFilter(f.id); setCameFiltered(false); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Says out loud that the list was narrowed before they got here, with a
          way out. Landing on a filtered list with no explanation is how people
          conclude their data is missing. */}
      {cameFiltered && !!activeFilterLabel && (
        <View style={styles.appliedBar}>
          <Text style={styles.appliedText} numberOfLines={1}>
            Showing {activeFilterLabel.toLowerCase()} only, from your dashboard
          </Text>
          <TouchableOpacity
            onPress={() => { setFilter('all'); setCameFiltered(false); }}
            style={styles.appliedClear}
            activeOpacity={0.7}
          >
            <Text style={styles.appliedClearText}>Show all</Text>
            <X size={12} color={colors.primary} strokeWidth={3} />
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'collections' ? (
        <CollectionsView onOpenInvoice={(invoiceId) => navigation.navigate('InvoiceDetails', { invoiceId: String(invoiceId) })} />
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <GearLoader text={`Loading ${activeTab}...`} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
            {activeTab === 'payments' ? (
              visibleTransactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🧾</Text>
                  <Text style={styles.emptyTitle}>
                    {activeFilterLabel ? `Nothing ${activeFilterLabel.toLowerCase()}` : 'No transactions found'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {activeFilterLabel
                      ? 'Every invoice in this period is settled. Tap All to see them.'
                      : 'Patient payments will appear here once invoices are created.'}
                  </Text>
                </View>
              ) : (
                visibleTransactions.map((transaction, index) => {
                  const s = transaction.status.toLowerCase();
                  // Paid is paid — no user-facing "verification" distinction.
                  const isPaid = s === 'completed' || s === 'success';
                  const statusBgColor = isPaid ? '#E6F9F1' : '#FFFBEB';
                  const statusTextColor = isPaid ? '#10B981' : '#F59E0B';
                  const statusLabel = isPaid ? 'PAID' : 'PENDING';
                  return (
                    <View key={transaction.id}>
                      <TouchableOpacity style={styles.rowContent} activeOpacity={0.7} onPress={() => handleItemPress(transaction)}>
                        <View style={styles.avatarContainer}>
                          <PatientAvatar name={transaction.patientName} size={48} />
                          <View style={[styles.iconIndicator, { backgroundColor: '#10B981' }]}>
                            <ArrowDownLeft size={10} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        </View>
                        <View style={styles.transactionInfo}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {transaction.patientName}
                            {transaction.patientDisplayId ? <Text style={styles.itemId}>  #{transaction.patientDisplayId}</Text> : null}
                          </Text>
                          <Text style={styles.itemSubtitle} numberOfLines={1}>{transaction.workDone || transaction.treatment || 'Treatment'}</Text>
                          <Text style={styles.itemMeta} numberOfLines={1}>
                            {transaction.invoiceNumber ? `${transaction.invoiceNumber} · ` : ''}{transaction.time || ''}
                          </Text>
                        </View>
                        <View style={styles.transactionRight}>
                          <Text style={styles.itemAmount}>{getCurrencySymbol()}{transaction.amount.toLocaleString()}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                            <Text style={[styles.statusText, { color: statusTextColor }]}>{statusLabel}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      {index < transactions.length - 1 && <View style={styles.separator} />}
                    </View>
                  );
                })
              )
            ) : (
              visibleLedger.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyTitle}>No ledger entries found</Text>
                  <Text style={styles.emptySubtitle}>All income and expenses will appear here.</Text>
                </View>
              ) : (
                visibleLedger.map((item, index) => {
                  const isExpense = item.type === 'expense';
                  const indicatorColor = isExpense ? '#EF4444' : '#10B981';
                  const initials = getInitials(item.entityName || '??');
                  return (
                    <View key={`${item.type}-${item.id}`}>
                      <TouchableOpacity style={styles.rowContent} activeOpacity={0.7} onPress={() => handleItemPress(item)}>
                        <View style={styles.avatarContainer}>
                          {isExpense ? (
                            <View style={styles.avatar}>
                              <Text style={styles.avatarText}>{initials}</Text>
                            </View>
                          ) : (
                            <PatientAvatar name={item.entityName} size={48} />
                          )}
                          <View style={[styles.iconIndicator, { backgroundColor: indicatorColor }]}>
                            {isExpense ? <ArrowUpRight size={10} color="#FFFFFF" strokeWidth={3} /> : <ArrowDownLeft size={10} color="#FFFFFF" strokeWidth={3} />}
                          </View>
                        </View>
                        <View style={styles.transactionInfo}>
                          <Text style={styles.itemTitle} numberOfLines={1}>{item.entityName || 'General'}</Text>
                          <Text style={styles.itemSubtitle} numberOfLines={1}>{item.date} • {item.category}</Text>
                        </View>
                        <View style={styles.transactionRight}>
                          <Text style={[styles.itemAmount, { color: isExpense ? '#B91C1C' : '#10B981' }]}>{isExpense ? '-' : '+'}{getCurrencySymbol()}{item.amount.toLocaleString()}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: isExpense ? '#FEE2E2' : '#E0F2FE' }]}>
                            <Text style={[styles.statusText, { color: isExpense ? '#B91C1C' : '#0369A1' }]}>{item.type.toUpperCase()}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      {index < ledgerItems.length - 1 && <View style={styles.separator} />}
                    </View>
                  );
                })
              )
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    height: 60,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  backButton: { width: 40, alignItems: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },

  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: componentRadius.pill,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12.5, fontWeight: '700', color: '#4B5563' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: componentRadius.pill,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.24)' },
  filterCountText: { fontSize: 10.5, fontWeight: '800', color: '#6B7280' },
  filterCountTextActive: { color: '#FFFFFF' },

  appliedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: colors.primaryBg,
  },
  appliedText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.primary },
  appliedClear: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  appliedClearText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', position: 'relative' },
  activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  activeTabText: { color: colors.primary, fontWeight: '600' },
  activeTabIndicator: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  listContent: { flexGrow: 1, paddingBottom: 24 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  itemContainer: { paddingVertical: 12 },
  rowContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  iconIndicator: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  transactionInfo: { flex: 1, marginLeft: 15 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemId: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  itemSubtitle: { fontSize: 13, color: '#374151', marginTop: 2 },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  transactionRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: componentRadius.pill, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 82 },
});
