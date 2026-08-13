import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import type { UtilityTabHandle } from '../utilityTab';
import { colors } from '../../../../shared/constants/colors';
import { notify } from '../../../../shared/utils/notify';
import { showAlert } from '../../../../shared/components/alertService';
import { utilitiesApiService, MedicationStock } from '../../../../services/api/utilities.api';
import { getCurrencySymbol } from '../../../../shared/utils/currency';
import { styles } from './sharedStyles';
import { SwipeableRow } from './SwipeableRow';
import { getInitials } from './helpers';

export const MedicationTab = forwardRef<UtilityTabHandle>((_props, ref) => {
  const [items, setItems] = useState<MedicationStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', strength: '', form: '', quantity: '', unit: '', min_stock_level: '', price_per_unit: '' });
  useImperativeHandle(ref, () => ({ openCreate: () => setShowCreate(true) }));

  const load = async () => { setItems(await utilitiesApiService.getMedicationStock()); setLoading(false); };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const isLow = (m: MedicationStock) => m.quantity <= (m.min_stock_level || 0);
  const sym = getCurrencySymbol();

  const handleDelete = (id: number) => showAlert('Delete Medication', 'Remove this medicine from stock?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      await utilitiesApiService.deleteMedicationStock(id);
      setItems(p => p.filter(i => i.id !== id));
    }},
  ]);

  const submit = async () => {
    if (!form.name.trim()) { notify.reverted('Enter a medicine name'); return; }
    setSaving(true);
    try {
      const created = await utilitiesApiService.createMedicationStock({
        name: form.name.trim(),
        strength: form.strength.trim() || undefined,
        form: form.form.trim() || undefined,
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit.trim() || undefined,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        price_per_unit: parseFloat(form.price_per_unit) || 0,
      });
      if (created) { setItems(p => [created, ...p]); notify.done('Medicine added'); setShowCreate(false); setForm({ name: '', strength: '', form: '', quantity: '', unit: '', min_stock_level: '', price_per_unit: '' }); }
    } catch (e: any) { notify.problem(e?.message || 'Could not add medicine'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;

  const lowCount = items.filter(isLow).length;

  return (
    <>
      <ScrollView style={styles.tabScroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {items.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>{items.length} medicine{items.length === 1 ? '' : 's'}</Text>
            {lowCount > 0 && <View style={[styles.summaryPill, { backgroundColor: colors.errorLight }]}><Text style={[styles.summaryPillText, { color: colors.error }]}>{lowCount} Low</Text></View>}
          </View>
        )}
        {items.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>No medicines in stock</Text><Text style={styles.emptySubtext}>Tap + to add one</Text></View>
        ) : (
          <View style={styles.listBlock}>
            {items.map((m) => {
              const low = isLow(m);
              return (
                <SwipeableRow key={m.id} onEdit={() => {}} onDelete={() => handleDelete(m.id)}>
                  <View style={styles.row}>
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, low && styles.avatarLow]}><Text style={styles.avatarText}>{getInitials(m.name)}</Text></View>
                      {low && <View style={styles.indicator} />}
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{m.name}{m.strength ? ` ${m.strength}` : ''}</Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {m.form || 'Medicine'} · {m.quantity} {m.unit || 'units'}{low ? ' · Low' : ''}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowValue}>{sym}{Number(m.price_per_unit || 0).toLocaleString('en-IN')}</Text>
                      <View style={[styles.badge, { backgroundColor: low ? colors.errorLight : colors.successBadgeBg }]}>
                        <Text style={[styles.badgeText, { color: low ? colors.error : colors.success }]}>{low ? 'LOW' : 'IN STOCK'}</Text>
                      </View>
                    </View>
                  </View>
                </SwipeableRow>
              );
            })}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add medicine</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)} hitSlop={8}><X size={22} color={colors.gray500} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Amoxicillin" placeholderTextColor={colors.gray400} />
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}><Text style={styles.inputLabel}>Strength</Text><TextInput style={styles.input} value={form.strength} onChangeText={(v) => setForm(f => ({ ...f, strength: v }))} placeholder="500mg" placeholderTextColor={colors.gray400} /></View>
                <View style={styles.inputHalf}><Text style={styles.inputLabel}>Form</Text><TextInput style={styles.input} value={form.form} onChangeText={(v) => setForm(f => ({ ...f, form: v }))} placeholder="Tablet" placeholderTextColor={colors.gray400} /></View>
              </View>
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}><Text style={styles.inputLabel}>Quantity</Text><TextInput style={styles.input} value={form.quantity} onChangeText={(v) => setForm(f => ({ ...f, quantity: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.gray400} /></View>
                <View style={styles.inputHalf}><Text style={styles.inputLabel}>Unit</Text><TextInput style={styles.input} value={form.unit} onChangeText={(v) => setForm(f => ({ ...f, unit: v }))} placeholder="strips" placeholderTextColor={colors.gray400} /></View>
              </View>
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}><Text style={styles.inputLabel}>Min stock</Text><TextInput style={styles.input} value={form.min_stock_level} onChangeText={(v) => setForm(f => ({ ...f, min_stock_level: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.gray400} /></View>
                <View style={styles.inputHalf}><Text style={styles.inputLabel}>Price / unit</Text><TextInput style={styles.input} value={form.price_per_unit} onChangeText={(v) => setForm(f => ({ ...f, price_per_unit: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.gray400} /></View>
              </View>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Add medicine</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
});

MedicationTab.displayName = 'MedicationTab';
