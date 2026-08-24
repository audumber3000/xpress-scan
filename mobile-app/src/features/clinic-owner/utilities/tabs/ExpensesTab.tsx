import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { X, ArrowUpRight, Check } from 'lucide-react-native';
import type { UtilityTabHandle } from '../utilityTab';
import { colors } from '../../../../shared/constants/colors';
import { notify } from '../../../../shared/utils/notify';
import { transactionsApiService, LedgerItem } from '../../../../services/api/transactions.api';
import { utilitiesApiService, Vendor } from '../../../../services/api/utilities.api';
import { getCurrencySymbol } from '../../../../shared/utils/currency';
import { styles } from './sharedStyles';

/**
 * Recording what the clinic spent.
 *
 * The phone could already read an expense and show it in the ledger, but never
 * create one, so the last everyday money task still needed a computer. The
 * endpoint (`POST /ledger/expenses`) has been there all along.
 *
 * ## The categories are the ones already in use
 *
 * Not invented: they are the distinct `category` values the clinics have
 * actually been typing on the web. A free-text box would have produced
 * "Electricity", "electricity" and "Elec. bill" as three separate lines in
 * every expense report, so the common ones are a picker. `Other` keeps the
 * box for anything genuinely new.
 */

const CATEGORIES = [
  'Dental materials',
  'Medicines & pharmacy',
  'Sterilisation supplies',
  'Lab charges',
  'Staff salary',
  'Rent',
  'Electricity',
  'Water',
  'Internet & phone',
  'Housekeeping',
  'Biomedical waste',
  'Software & subscriptions',
  'Professional fees',
  'Other',
];

const METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

const emptyForm = () => ({
  amount: '',
  category: 'Dental materials',
  customCategory: '',
  payment_method: 'Cash',
  notes: '',
  vendorId: null as number | null,
});

/**
 * `LedgerItem.date` arrives ALREADY FORMATTED ("Aug 20, 2026"), not as an ISO
 * string: `transactions.api` formats it during the mapping. Re-parsing it here
 * produced "Invalid Date" on every row, because Hermes does not parse that
 * non-ISO shape. So it is rendered as-is.
 */
const shownDate = (d?: string | null) => (d && d !== 'N/A' ? d : '');

/** The same mapping defaults a missing vendor to the literal string 'N/A',
 *  which is not a name and should not be printed as one. */
const shownVendor = (v?: string | null) => (v && v !== 'N/A' ? v : '');

export const ExpensesTab = forwardRef<UtilityTabHandle>((_props, ref) => {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useImperativeHandle(ref, () => ({ openCreate: () => { setForm(emptyForm()); setShowCreate(true); } }));

  const load = async () => {
    const [ledger, v] = await Promise.all([
      transactionsApiService.getLedger(),
      utilitiesApiService.getVendors(),
    ]);
    // The ledger carries invoices too; this tab is only the money going out.
    setItems(ledger.filter((i) => i.type === 'expense'));
    setVendors(v);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const total = items.reduce((sum, i) => sum + Math.abs(Number(i.amount) || 0), 0);

  const submit = async () => {
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify.reverted('Enter an amount');
      return;
    }
    const category = form.category === 'Other'
      ? (form.customCategory.trim() || 'Other')
      : form.category;

    setSaving(true);
    try {
      await transactionsApiService.createExpense({
        amount,
        category,
        payment_method: form.payment_method,
        notes: form.notes.trim() || undefined,
        vendor_id: form.vendorId ?? undefined,
        date: new Date().toISOString(),
      });
      setShowCreate(false);
      setForm(emptyForm());
      // Reload rather than prepending: the ledger row is a different shape from
      // the created expense, and inventing one here is how a list ends up
      // disagreeing with the server until the next refresh.
      await load();
      notify.done(`${getCurrencySymbol()}${amount.toLocaleString('en-IN')} expense recorded`);
    } catch (e: any) {
      notify.problem(e?.message || 'Could not record the expense');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <>
      <ScrollView
        style={styles.tabScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {items.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {items.length} expense{items.length === 1 ? '' : 's'} · {getCurrencySymbol()}
              {total.toLocaleString('en-IN')} out
            </Text>
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nothing recorded yet</Text>
            <Text style={styles.emptySubtext}>Tap + to record what the clinic spent</Text>
          </View>
        ) : (
          <View style={styles.listBlock}>
            {items.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ExpenseDetails', { expenseId: e.id })}
              >
                <View style={styles.avatarWrap}>
                  <View style={[styles.avatar, { backgroundColor: '#FEE2E2' }]}>
                    <ArrowUpRight size={18} color="#B91C1C" strokeWidth={2.5} />
                  </View>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{e.category || 'Expense'}</Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {[shownDate(e.date), shownVendor(e.entityName), e.payment_method]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text style={[styles.rowTitle, { color: '#B91C1C' }]}>
                  {getCurrencySymbol()}{Math.abs(Number(e.amount) || 0).toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record expense</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)} hitSlop={8}>
                <X size={22} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={(v) => setForm((f) => ({ ...f, amount: v.replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder={`${getCurrencySymbol()}0`}
                placeholderTextColor={colors.gray400}
                autoFocus
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={s.chips}>
                {CATEGORIES.map((c) => {
                  const active = form.category === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setForm((f) => ({ ...f, category: c }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {form.category === 'Other' && (
                <TextInput
                  style={styles.input}
                  value={form.customCategory}
                  onChangeText={(v) => setForm((f) => ({ ...f, customCategory: v }))}
                  placeholder="What was it for?"
                  placeholderTextColor={colors.gray400}
                />
              )}

              <Text style={styles.inputLabel}>Paid by</Text>
              <View style={s.chips}>
                {METHODS.map((m) => {
                  const active = form.payment_method === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setForm((f) => ({ ...f, payment_method: m }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {vendors.length > 0 && (
                <>
                  <Text style={styles.inputLabel}>Vendor (optional)</Text>
                  <View style={s.chips}>
                    {vendors.slice(0, 12).map((v) => {
                      const active = form.vendorId === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[s.chip, active && s.chipActive]}
                          // Tapping the selected vendor clears it. Without this
                          // a vendor picked by mistake cannot be un-picked.
                          onPress={() => setForm((f) => ({ ...f, vendorId: active ? null : v.id }))}
                          activeOpacity={0.75}
                        >
                          {active && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                          <Text style={[s.chipText, active && s.chipTextActive]}>{v.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={styles.input}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Optional"
                placeholderTextColor={colors.gray400}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={submit}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Record expense</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
});

ExpensesTab.displayName = 'ExpensesTab';

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.gray600 },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
});
