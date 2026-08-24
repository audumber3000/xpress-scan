import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, X, Pencil, Trash2, Tag, Check } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { adminColors } from '../../../../shared/constants/adminColors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { showAlert } from '../../../../shared/components/alertService';
import { notify } from '../../../../shared/utils/notify';
import { getCurrencySymbol } from '../../../../shared/utils/currency';
import { offersApiService, Offer, isOfferLive } from '../../../../services/api/offers.api';

/**
 * Offers and discounts, on the phone.
 *
 * A clinic-defined catalogue of reusable whole-invoice discounts: created here,
 * chosen at billing time. Until now this lived only in the web Control Center,
 * so a receptionist asked to "put the Diwali offer on" had no way to add one
 * from the desk.
 *
 * Applying an offer resolves to an ordinary invoice discount, so nothing about
 * the billing maths changes; this screen only manages the catalogue.
 */

const emptyForm = () => ({
  name: '',
  code: '',
  discount_type: 'percentage',
  value: '',
  valid_from: '',
  valid_to: '',
  min_invoice_amount: '',
  is_active: true,
});

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

/**
 * What the badge on an offer says.
 *
 * Four states, because "scheduled" and "ended" are opposite ends of not-live
 * and collapsing them is actively misleading: an offer whose window closed last
 * week was being labelled SCHEDULED, which reads as "coming up" to anybody
 * scanning the list for what to run next.
 */
const badgeOf = (o: Offer, today = new Date()): { text: string; live: boolean } => {
  if (!o.is_active) return { text: 'OFF', live: false };
  if (isOfferLive(o, today)) return { text: 'LIVE', live: true };
  const day = today.toISOString().slice(0, 10);
  if (o.valid_to && day > o.valid_to) return { text: 'ENDED', live: false };
  return { text: 'SCHEDULED', live: false };
};

/** "12 Aug to 30 Sep", "From 12 Aug", "Until 30 Sep", or "No expiry". */
const windowLabel = (o: Offer): string => {
  const from = fmtDate(o.valid_from);
  const to = fmtDate(o.valid_to);
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return 'No expiry';
};

// YYYY-MM-DD, or empty. Typed rather than picked: a date picker for two
// optional fields on a form this short is more taps than the thing is worth.
const isValidDay = (v: string) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

export const OffersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setOffers(await offersApiService.list());
    setLoading(false);
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); };

  const openEdit = (o: Offer) => {
    setEditing(o);
    setForm({
      name: o.name,
      code: o.code || '',
      discount_type: o.discount_type,
      value: String(o.value ?? ''),
      valid_from: o.valid_from || '',
      valid_to: o.valid_to || '',
      min_invoice_amount: o.min_invoice_amount != null ? String(o.min_invoice_amount) : '',
      is_active: o.is_active,
    });
    setShowForm(true);
  };

  const submit = async () => {
    const value = parseFloat(form.value);
    if (!form.name.trim()) { notify.reverted('Give the offer a name'); return; }
    if (!Number.isFinite(value) || value <= 0) { notify.reverted('Enter a discount value'); return; }
    if (form.discount_type === 'percentage' && value > 100) {
      notify.reverted('A percentage cannot be over 100');
      return;
    }
    if (!isValidDay(form.valid_from) || !isValidDay(form.valid_to)) {
      notify.reverted('Dates must be YYYY-MM-DD');
      return;
    }
    if (form.valid_from && form.valid_to && form.valid_from > form.valid_to) {
      notify.reverted('The end date is before the start date');
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase() || null,
      discount_type: form.discount_type,
      value,
      valid_from: form.valid_from.trim() || null,
      valid_to: form.valid_to.trim() || null,
      min_invoice_amount: form.min_invoice_amount.trim()
        ? parseFloat(form.min_invoice_amount)
        : null,
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (editing) {
        await offersApiService.update(editing.id, payload);
        notify.done('Offer updated');
      } else {
        await offersApiService.create(payload);
        notify.done('Offer created');
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      notify.problem(e?.message || 'Could not save the offer');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (o: Offer) => {
    showAlert(
      `Delete "${o.name}"?`,
      'Invoices that already used it keep their discount. Only the offer itself goes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await offersApiService.remove(o.id);
            if (ok) { setOffers((p) => p.filter((x) => x.id !== o.id)); notify.done('Offer deleted'); }
            else notify.problem('Could not delete the offer');
          },
        },
      ],
    );
  };

  const cur = getCurrencySymbol();
  const amountOf = (o: Offer) =>
    o.discount_type === 'percentage' ? `${o.value}% off` : `${cur}${o.value.toLocaleString('en-IN')} off`;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* The admin ScreenHeader is white, so the status bar needs dark icons.
          light-content painted them white on white and made the clock vanish. */}
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScreenHeader
        title="Offers"
        variant="admin"
        onBackPress={() => navigation.goBack()}
        rightComponent={
          // Teal on a tinted circle. The admin header is WHITE, so the white
          // plus this started with was invisible against it.
          <TouchableOpacity onPress={openNew} style={s.addBtn} activeOpacity={0.75}>
            <Plus color={adminColors.primary} size={22} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={adminColors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminColors.primary} />}
        >
          <Text style={s.lede}>
            Whole-invoice discounts your team can apply at billing. Create one here,
            then pick it when raising an invoice.
          </Text>

          {offers.length === 0 ? (
            <View style={s.empty}>
              <Tag size={30} color={colors.gray300} />
              <Text style={s.emptyTitle}>No offers yet</Text>
              <Text style={s.emptyText}>Tap + to create your first one.</Text>
            </View>
          ) : (
            offers.map((o) => {
              // Live means active AND inside its dates, the same tests the
              // server applies. A card claiming otherwise sends somebody to
              // apply a discount that billing will then refuse.
              const badge = badgeOf(o);
              return (
                <View key={o.id} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={s.nameRow}>
                        <Text style={s.name} numberOfLines={1}>{o.name}</Text>
                        <View style={[s.pill, badge.live ? s.pillLive : s.pillOff]}>
                          <Text style={[s.pillText, badge.live ? s.pillTextLive : s.pillTextOff]}>
                            {badge.text}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.meta} numberOfLines={1}>
                        {windowLabel(o)}
                        {o.min_invoice_amount ? ` · over ${cur}${o.min_invoice_amount.toLocaleString('en-IN')}` : ''}
                      </Text>
                    </View>
                    <Text style={s.amount}>{amountOf(o)}</Text>
                  </View>

                  <View style={s.cardFoot}>
                    {!!o.code && (
                      <View style={s.codeChip}>
                        <Text style={s.codeText}>{o.code}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(o)} hitSlop={8}>
                      <Pencil size={15} color={adminColors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.iconBtn} onPress={() => confirmDelete(o)} hitSlop={8}>
                      <Trash2 size={15} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{editing ? 'Edit offer' : 'New offer'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={8}>
                <X size={22} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Name *</Text>
              <TextInput
                style={s.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Diwali cleaning offer"
                placeholderTextColor={colors.gray400}
              />

              <Text style={s.label}>Discount *</Text>
              <View style={s.typeRow}>
                {(['percentage', 'amount'] as const).map((t) => {
                  const active = form.discount_type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[s.typeBtn, active && s.typeBtnActive]}
                      onPress={() => setForm((f) => ({ ...f, discount_type: t }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.typeText, active && s.typeTextActive]}>
                        {t === 'percentage' ? '% off' : `${cur} off`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TextInput
                  style={[s.input, s.valueInput]}
                  value={form.value}
                  onChangeText={(v) => setForm((f) => ({ ...f, value: v.replace(/[^0-9.]/g, '') }))}
                  keyboardType="decimal-pad"
                  placeholder={form.discount_type === 'percentage' ? '10' : '500'}
                  placeholderTextColor={colors.gray400}
                />
              </View>

              <Text style={s.label}>Code (optional)</Text>
              <TextInput
                style={s.input}
                value={form.code}
                onChangeText={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))}
                autoCapitalize="characters"
                placeholder="DIWALI25"
                placeholderTextColor={colors.gray400}
              />

              <View style={s.row}>
                <View style={s.half}>
                  <Text style={s.label}>Valid from</Text>
                  <TextInput
                    style={s.input}
                    value={form.valid_from}
                    onChangeText={(v) => setForm((f) => ({ ...f, valid_from: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.gray400}
                  />
                </View>
                <View style={s.half}>
                  <Text style={s.label}>Valid to</Text>
                  <TextInput
                    style={s.input}
                    value={form.valid_to}
                    onChangeText={(v) => setForm((f) => ({ ...f, valid_to: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.gray400}
                  />
                </View>
              </View>
              <Text style={s.hint}>Leave both empty and the offer never expires.</Text>

              <Text style={s.label}>Minimum invoice (optional)</Text>
              <TextInput
                style={s.input}
                value={form.min_invoice_amount}
                onChangeText={(v) => setForm((f) => ({ ...f, min_invoice_amount: v.replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder={`${cur}0`}
                placeholderTextColor={colors.gray400}
              />

              <TouchableOpacity
                style={s.toggleRow}
                onPress={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                activeOpacity={0.75}
              >
                <View style={[s.checkbox, form.is_active && s.checkboxOn]}>
                  {form.is_active && <Check size={12} color="#FFFFFF" strokeWidth={3.5} />}
                </View>
                <Text style={s.toggleText}>Available to apply at billing</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={submit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={s.saveText}>{editing ? 'Save changes' : 'Create offer'}</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  lede: { fontSize: 13, lineHeight: 19, color: colors.gray500, marginBottom: 14 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: adminColors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.gray700 },
  emptyText: { fontSize: 13, color: colors.gray500 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: colors.gray200,
    padding: 14, marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: colors.gray900 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  pillLive: { backgroundColor: '#D1FAE5' },
  pillOff: { backgroundColor: colors.gray100 },
  pillText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.4 },
  pillTextLive: { color: '#065F46' },
  pillTextOff: { color: colors.gray500 },
  meta: { fontSize: 11.5, color: colors.gray500, marginTop: 3, fontWeight: '600' },
  amount: { fontSize: 15, fontWeight: '800', color: adminColors.primary },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  codeChip: {
    backgroundColor: colors.gray100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  codeText: { fontSize: 11, fontWeight: '800', color: colors.gray700, letterSpacing: 0.6 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 9, borderWidth: 1, borderColor: colors.gray200,
    alignItems: 'center', justifyContent: 'center',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, maxHeight: '88%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900 },

  label: { fontSize: 12, fontWeight: '700', color: colors.gray500, marginTop: 12, marginBottom: 5 },
  input: {
    backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 15, color: colors.gray900,
  },
  hint: { fontSize: 11, color: colors.gray400, marginTop: 5 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBtn: {
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 11,
    borderWidth: 1, borderColor: colors.gray200, backgroundColor: '#FFFFFF',
  },
  typeBtnActive: { backgroundColor: adminColors.primary, borderColor: adminColors.primary },
  typeText: { fontSize: 13, fontWeight: '700', color: colors.gray600 },
  typeTextActive: { color: '#FFFFFF' },
  valueInput: { flex: 1 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  checkbox: {
    width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: adminColors.primary, borderColor: adminColors.primary },
  toggleText: { fontSize: 13.5, fontWeight: '600', color: colors.gray700 },

  saveBtn: {
    backgroundColor: adminColors.primary, borderRadius: 13, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
