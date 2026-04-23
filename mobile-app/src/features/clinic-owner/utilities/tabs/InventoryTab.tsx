import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { toast } from '../../../../shared/components/toastService';
import { showAlert } from '../../../../shared/components/alertService';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, X, AlertTriangle } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import {
  utilitiesApiService,
  InventoryItem, InventoryItemCreate,
} from '../../../../services/api/utilities.api';
import { styles } from './sharedStyles';
import { SwipeableRow } from './SwipeableRow';
import { getInitials } from './helpers';

const EmptyState = () => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyText}>No inventory items found</Text>
    <Text style={styles.emptySubtext}>Tap + to add one</Text>
  </View>
);

export const InventoryTab: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [actionItem, setActionItem] = useState<InventoryItem | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [form, setForm] = useState<Partial<InventoryItemCreate>>({
    name: '', category: '', unit: '', quantity: 0, min_stock_level: 0, price_per_unit: 0,
  });
  const [editForm, setEditForm] = useState<Partial<InventoryItemCreate>>({});
  const [filterBy, setFilterBy] = useState<'low' | 'ok' | null>(null);

  const load = async () => {
    const d = await utilitiesApiService.getInventory();
    setItems(d);
    setLoading(false);
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const isLow = (item: InventoryItem) => item.quantity <= item.min_stock_level;

  const handleDelete = (id: number) => showAlert('Delete Item', 'Remove this item?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      await utilitiesApiService.deleteInventoryItem(id);
      setItems(p => p.filter(i => i.id !== id));
      toast.success('Item deleted');
    }},
  ]);

  const handleRestock = async () => {
    if (!actionItem) return;
    const add = parseFloat(restockQty) || 0;
    if (add <= 0) { toast.warning('Enter a quantity greater than 0'); return; }
    setSaving(true);
    const updated = await utilitiesApiService.updateInventoryItem(actionItem.id, { quantity: actionItem.quantity + add });
    setSaving(false);
    if (updated) {
      setItems(p => p.map(i => i.id === actionItem.id ? updated : i));
      setActionItem(updated);
      setRestockQty('');
      toast.success('Stock updated');
    }
  };

  const handleCreate = async () => {
    if (!form.name?.trim()) { toast.warning('Item name is required'); return; }
    setSaving(true);
    const created = await utilitiesApiService.createInventoryItem(form as InventoryItemCreate);
    setSaving(false);
    if (created) {
      setItems(p => [created, ...p]);
      setShowCreate(false);
      setForm({ name: '', category: '', unit: '', quantity: 0, min_stock_level: 0, price_per_unit: 0 });
      toast.success('Inventory item created');
    } else {
      toast.error('Failed to create item.');
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    setSaving(true);
    const updated = await utilitiesApiService.updateInventoryItem(editItem.id, editForm);
    setSaving(false);
    if (updated) {
      setItems(p => p.map(i => i.id === editItem.id ? updated : i));
      setEditItem(null);
      toast.success('Inventory item updated');
    } else {
      toast.error('Failed to update item.');
    }
  };

  const lowCount = items.filter(isLow).length;
  if (loading) return <ActivityIndicator style={styles.loader} color={colors.primary} />;

  return (
    <>
      <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {lowCount > 0 && (
          <View style={styles.alertBanner}>
            <AlertTriangle size={15} color="#92400E" />
            <Text style={styles.alertText}>{lowCount} item{lowCount > 1 ? 's' : ''} below minimum stock level</Text>
          </View>
        )}

        {items.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
            {lowCount > 0 && (
              <TouchableOpacity
                style={[styles.summaryPill, { backgroundColor: '#FEE2E2' }, filterBy === 'low' && { borderWidth: 1.5, borderColor: '#B91C1C' }]}
                onPress={() => setFilterBy(filterBy === 'low' ? null : 'low')}
                activeOpacity={0.7}
              >
                <Text style={[styles.summaryPillText, { color: '#B91C1C' }, filterBy === 'low' && { fontWeight: '700' }]}>{lowCount} Low Stock</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.summaryPill, { backgroundColor: '#E6F9F1' }, filterBy === 'ok' && { borderWidth: 1.5, borderColor: '#10B981' }]}
              onPress={() => setFilterBy(filterBy === 'ok' ? null : 'ok')}
              activeOpacity={0.7}
            >
              <Text style={[styles.summaryPillText, { color: '#10B981' }, filterBy === 'ok' && { fontWeight: '700' }]}>{items.length - lowCount} OK</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.listBlock}>
          {items.length === 0 ? <EmptyState /> : (() => {
            const visible = filterBy === null ? items : items.filter(i => filterBy === 'low' ? isLow(i) : !isLow(i));
            if (visible.length === 0) return (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No {filterBy === 'low' ? 'low stock' : 'in-stock'} items</Text>
                <Text style={styles.emptySubtext}>Tap the pill again to clear the filter</Text>
              </View>
            );
            return visible.map((item, index) => {
            const low = isLow(item);
            return (
              <View key={item.id}>
                <SwipeableRow
                  onEdit={() => {
                    setEditForm({
                      name: item.name, category: item.category,
                      quantity: item.quantity, unit: item.unit,
                      min_stock_level: item.min_stock_level, price_per_unit: item.price_per_unit,
                    });
                    setEditItem(item);
                  }}
                  onDelete={() => handleDelete(item.id)}
                >
                  <TouchableOpacity style={styles.row} activeOpacity={0.7}
                    onPress={() => { setRestockQty(''); setActionItem(item); }}>
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, low && styles.avatarLow]}>
                        <Text style={[styles.avatarText, low && { color: '#B91C1C' }]}>{getInitials(item.name)}</Text>
                      </View>
                      <View style={[styles.indicator, { backgroundColor: low ? '#EF4444' : '#10B981' }]} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {item.category || 'General'} • {item.quantity} {item.unit || 'pcs'}{low ? '  ⚠ Low' : ''}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowValue}>₹{item.price_per_unit}</Text>
                      <View style={[styles.badge, { backgroundColor: low ? '#FEE2E2' : '#E6F9F1' }]}>
                        <Text style={[styles.badgeText, { color: low ? '#B91C1C' : '#10B981' }]}>
                          {low ? 'LOW STOCK' : 'IN STOCK'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </SwipeableRow>
                {index < visible.length - 1 && <View style={styles.separator} />}
              </View>
            );
          });
          })()}
        </View>

        {items.length > 0 && (
          <Text style={styles.hintText}>← Swipe left to edit or delete  •  Tap for stock details</Text>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Action tray: stock details + restock ── */}
      <Modal visible={!!actionItem} animationType="slide" transparent onRequestClose={() => setActionItem(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionItem(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.actionSheet}>
              <View style={styles.actionSheetHandle} />
              <View style={styles.actionSheetHeader}>
                <Text style={styles.actionSheetTitle}>{actionItem?.name}</Text>
                <Text style={styles.actionSheetSubtitle}>{actionItem?.category || 'General'}</Text>
              </View>
              <View style={styles.inventoryTrayStats}>
                <View style={styles.inventoryTrayStat}>
                  <Text style={styles.inventoryTrayStatLabel}>IN STOCK</Text>
                  <Text style={[styles.inventoryTrayStatValue, actionItem && isLow(actionItem) && { color: '#EF4444' }]}>
                    {actionItem?.quantity} {actionItem?.unit || 'pcs'}
                  </Text>
                </View>
                <View style={styles.inventoryTrayStat}>
                  <Text style={styles.inventoryTrayStatLabel}>MIN LEVEL</Text>
                  <Text style={styles.inventoryTrayStatValue}>{actionItem?.min_stock_level} {actionItem?.unit || 'pcs'}</Text>
                </View>
                <View style={styles.inventoryTrayStat}>
                  <Text style={styles.inventoryTrayStatLabel}>PRICE / UNIT</Text>
                  <Text style={styles.inventoryTrayStatValue}>₹{actionItem?.price_per_unit}</Text>
                </View>
              </View>
              <Text style={styles.actionSheetSectionLabel}>Quick Restock</Text>
              <View style={styles.restockRow}>
                <TextInput style={styles.restockInput} placeholder="Add qty…" keyboardType="decimal-pad"
                  value={restockQty} onChangeText={setRestockQty} />
                <TouchableOpacity style={[styles.restockBtn, saving && { opacity: 0.6 }]} onPress={handleRestock} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.restockBtnText}>Add Stock</Text>}
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.actionSheetCloseBtn} onPress={() => setActionItem(null)}>
                <Text style={styles.actionSheetCloseTxt}>Close</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit modal ── */}
      <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput style={styles.input} value={editForm.name || ''} onChangeText={v => setEditForm(p => ({ ...p, name: v }))} />
              <Text style={styles.inputLabel}>Category</Text>
              <TextInput style={styles.input} value={editForm.category || ''} onChangeText={v => setEditForm(p => ({ ...p, category: v }))} />
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" value={editForm.quantity?.toString() || ''} onChangeText={v => setEditForm(p => ({ ...p, quantity: parseFloat(v) || 0 }))} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <TextInput style={styles.input} value={editForm.unit || ''} onChangeText={v => setEditForm(p => ({ ...p, unit: v }))} />
                </View>
              </View>
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Min Stock</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" value={editForm.min_stock_level?.toString() || ''} onChangeText={v => setEditForm(p => ({ ...p, min_stock_level: parseFloat(v) || 0 }))} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Price / Unit (₹)</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" value={editForm.price_per_unit?.toString() || ''} onChangeText={v => setEditForm(p => ({ ...p, price_per_unit: parseFloat(v) || 0 }))} />
                </View>
              </View>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleUpdate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Create modal ── */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Inventory Item</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Gloves, Composite Resin" value={form.name || ''} onChangeText={v => setForm(p => ({ ...p, name: v }))} />
              <Text style={styles.inputLabel}>Category</Text>
              <TextInput style={styles.input} placeholder="e.g. Consumables, Equipment" value={form.category || ''} onChangeText={v => setForm(p => ({ ...p, category: v }))} />
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0" value={form.quantity?.toString() || ''} onChangeText={v => setForm(p => ({ ...p, quantity: parseFloat(v) || 0 }))} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <TextInput style={styles.input} placeholder="pcs, ml…" value={form.unit || ''} onChangeText={v => setForm(p => ({ ...p, unit: v }))} />
                </View>
              </View>
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Min Stock</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0" value={form.min_stock_level?.toString() || ''} onChangeText={v => setForm(p => ({ ...p, min_stock_level: parseFloat(v) || 0 }))} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Price / Unit (₹)</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="0.00" value={form.price_per_unit?.toString() || ''} onChangeText={v => setForm(p => ({ ...p, price_per_unit: parseFloat(v) || 0 }))} />
                </View>
              </View>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Add Item</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};
