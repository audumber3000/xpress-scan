import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { X, Phone } from 'lucide-react-native';
import type { UtilityTabHandle } from '../utilityTab';
import { colors } from '../../../../shared/constants/colors';
import { notify } from '../../../../shared/utils/notify';
import { utilitiesApiService, Vendor } from '../../../../services/api/utilities.api';
import { styles } from './sharedStyles';
import { getInitials } from './helpers';

export const VendorsTab = forwardRef<UtilityTabHandle>((_props, ref) => {
  const [items, setItems] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', contact_name: '', phone: '', email: '', gst_number: '' });
  useImperativeHandle(ref, () => ({ openCreate: () => setShowCreate(true) }));

  const load = async () => { setItems(await utilitiesApiService.getVendors()); setLoading(false); };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submit = async () => {
    if (!form.name.trim()) { notify.reverted('Enter a vendor name'); return; }
    setSaving(true);
    try {
      const created = await utilitiesApiService.createVendor({
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        contact_name: form.contact_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        gst_number: form.gst_number.trim() || undefined,
      });
      if (created) { setItems(p => [created, ...p]); notify.done('Vendor added'); setShowCreate(false); setForm({ name: '', category: '', contact_name: '', phone: '', email: '', gst_number: '' }); }
    } catch (e: any) { notify.problem(e?.message || 'Could not add vendor'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <>
      <ScrollView style={styles.tabScroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {items.length > 0 && <View style={styles.summaryRow}><Text style={styles.summaryText}>{items.length} vendor{items.length === 1 ? '' : 's'}</Text></View>}
        {items.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>No vendors yet</Text><Text style={styles.emptySubtext}>Tap + to add a supplier</Text></View>
        ) : (
          <View style={styles.listBlock}>
            {items.map((v) => (
              <View key={v.id} style={styles.row}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(v.name)}</Text></View>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{v.name}</Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {v.category || 'Supplier'}{v.contact_name ? ` · ${v.contact_name}` : ''}{v.phone ? ` · ${v.phone}` : ''}
                  </Text>
                </View>
                {!!v.phone && (
                  <TouchableOpacity style={styles.rowRight} onPress={() => Linking.openURL(`tel:${v.phone!.replace(/[^0-9+]/g, '')}`)} hitSlop={8}>
                    <Phone size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add vendor</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)} hitSlop={8}><X size={22} color={colors.gray500} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Company name *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm(f => ({ ...f, name: v }))} placeholder="e.g. DentalSource" placeholderTextColor={colors.gray400} />
              <Text style={styles.inputLabel}>Category</Text>
              <TextInput style={styles.input} value={form.category} onChangeText={(v) => setForm(f => ({ ...f, category: v }))} placeholder="Lab / Pharmacy / Equipment" placeholderTextColor={colors.gray400} />
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}><Text style={styles.inputLabel}>Contact</Text><TextInput style={styles.input} value={form.contact_name} onChangeText={(v) => setForm(f => ({ ...f, contact_name: v }))} placeholder="Person" placeholderTextColor={colors.gray400} /></View>
                <View style={styles.inputHalf}><Text style={styles.inputLabel}>Phone</Text><TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="Number" placeholderTextColor={colors.gray400} /></View>
              </View>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="Optional" placeholderTextColor={colors.gray400} />
              <Text style={styles.inputLabel}>GST number</Text>
              <TextInput style={styles.input} value={form.gst_number} onChangeText={(v) => setForm(f => ({ ...f, gst_number: v }))} placeholder="Optional" placeholderTextColor={colors.gray400} />
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Add vendor</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
});

VendorsTab.displayName = 'VendorsTab';
