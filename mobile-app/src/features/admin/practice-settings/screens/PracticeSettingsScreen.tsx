import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, Plus, Pencil, Trash2, X, Check, Search,
  Stethoscope, ClipboardList, Activity, Leaf, TestTube, Pill, DollarSign,
} from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { colors } from '../../../../shared/constants/colors';
import { adminApiService } from '../../../../services/api/admin.api';

const CATEGORY_META: Record<string, { icon: any; color: string; bg: string }> = {
  'procedures':         { icon: Stethoscope,   color: '#2D9596', bg: '#E0F2F2' },
  'chief-complaints':   { icon: ClipboardList, color: '#FF6B9D', bg: '#FFE8F0' },
  'medical-history':    { icon: Activity,      color: '#5DADE2', bg: '#E8F4F9' },
  'clinical-advice':    { icon: Leaf,          color: '#10B981', bg: '#D1FAE5' },
  'on-examination':     { icon: TestTube,      color: '#6B7FFF', bg: '#E8ECFF' },
  'dental-history':     { icon: Stethoscope,   color: '#FF8C42', bg: '#FFF4E6' },
  'diagnosis':          { icon: Activity,      color: '#F59E0B', bg: '#FEF3C7' },
  'allergies':          { icon: Pill,          color: '#EF4444', bg: '#FEE2E2' },
  'ongoing-medication': { icon: Pill,          color: '#8B5CF6', bg: '#EDE9FE' },
  'additional-fees':    { icon: DollarSign,    color: '#4ECDC4', bg: '#E0F7F5' },
};

interface PracticeSettingsScreenProps {
  navigation: any;
  route: { params: { category: string; backendKey: string; label: string } };
}

interface SettingItem {
  id: string;
  name: string;
  description?: string;
  cost?: number;
  category: string;
}

export const PracticeSettingsScreen: React.FC<PracticeSettingsScreenProps> = ({ navigation, route }) => {
  const { category, backendKey, label } = route.params;
  const meta = CATEGORY_META[category] || { icon: ClipboardList, color: adminColors.primary, bg: '#E0F2F2' };

  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<SettingItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCost, setFormCost] = useState('');
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await adminApiService.getPracticeSettings(backendKey);
      setItems(data);
    } catch (e) {
      console.error('❌ [PracticeSettings] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backendKey]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const openAdd = () => {
    setEditItem(null);
    setFormName('');
    setFormDesc('');
    setFormCost('');
    setModalVisible(true);
  };

  const openEdit = (item: SettingItem) => {
    setEditItem(item);
    setFormName(item.name);
    setFormDesc(item.description || '');
    setFormCost(item.cost != null ? String(item.cost) : '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Required', 'Name is required'); return; }
    setSaving(true);
    const payload: any = { name: formName.trim(), category: backendKey };
    if (formDesc.trim()) payload.description = formDesc.trim();
    if (formCost.trim() && !isNaN(Number(formCost))) payload.cost = Number(formCost);

    if (editItem) {
      const ok = await adminApiService.updatePracticeSetting(editItem.id, payload);
      if (ok) {
        setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...payload } : i));
        setModalVisible(false);
      } else Alert.alert('Error', 'Failed to update. Try again.');
    } else {
      const created = await adminApiService.createPracticeSetting(payload);
      if (created) {
        setItems(prev => [...prev, created]);
        setModalVisible(false);
      } else Alert.alert('Error', 'Failed to create. Try again.');
    }
    setSaving(false);
  };

  const handleDelete = (item: SettingItem) => {
    Alert.alert('Delete', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const ok = await adminApiService.deletePracticeSetting(item.id, category);
          if (ok) setItems(prev => prev.filter(i => i.id !== item.id));
          else Alert.alert('Error', 'Failed to delete.');
        },
      },
    ]);
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const isAdditionalFees = category === 'additional-fees';
  const IconComp = meta.icon;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={adminColors.gradientStart} />
      <SafeAreaView style={{ backgroundColor: adminColors.gradientStart }} edges={['top']}>
        <LinearGradient colors={[adminColors.gradientStart, adminColors.gradientEnd]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.headerIcon, { backgroundColor: meta.bg + 'CC' }]}>
              <IconComp size={20} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{label}</Text>
              <Text style={styles.headerSub}>Practice Settings</Text>
            </View>
            <TouchableOpacity style={styles.addHeaderBtn} onPress={openAdd}>
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={16} color={colors.gray400} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${label}...`}
          placeholderTextColor={colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={adminColors.primary} />
          <Text style={styles.loadingText}>Loading {label}...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          onRefresh={() => { setRefreshing(true); loadItems(); }}
          refreshing={refreshing}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: meta.bg }]}>
                <IconComp size={32} color={meta.color} />
              </View>
              <Text style={styles.emptyTitle}>No {label} yet</Text>
              <Text style={styles.emptySub}>Tap + to add your first entry</Text>
              <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: meta.color }]} onPress={openAdd}>
                <Plus size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Add {label}</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={[styles.itemDot, { backgroundColor: meta.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                {isAdditionalFees && item.cost != null ? (
                  <Text style={[styles.itemCost, { color: meta.color }]}>₹{item.cost.toFixed(2)}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Pencil size={15} color={adminColors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Trash2 size={15} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem ? `Edit ${label}` : `Add ${label}`}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={`Enter ${label} name`}
                placeholderTextColor={colors.gray400}
                value={formName}
                onChangeText={setFormName}
                autoFocus
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldMultiline]}
                placeholder="Add a description..."
                placeholderTextColor={colors.gray400}
                value={formDesc}
                onChangeText={setFormDesc}
                multiline
                numberOfLines={3}
              />
            </View>

            {isAdditionalFees && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Cost (₹)</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.gray400}
                  value={formCost}
                  onChangeText={setFormCost}
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: meta.color }, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>{editItem ? 'Update' : 'Add'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F9FAFB' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:  { fontSize: 14, color: colors.gray500 },

  // Header
  header:       { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerIcon:   { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  addHeaderBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // Search
  searchWrap:   { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  searchInput:  { flex: 1, fontSize: 14, color: colors.gray900 },

  // List
  itemCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1, gap: 10 },
  itemDot:      { width: 8, height: 8, borderRadius: 4 },
  itemName:     { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  itemDesc:     { fontSize: 12, color: colors.gray500, marginTop: 2 },
  itemCost:     { fontSize: 13, fontWeight: '700', marginTop: 3 },
  editBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: '#E0F2F2', justifyContent: 'center', alignItems: 'center' },
  deleteBtn:    { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },

  // Empty
  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon:    { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: colors.gray700 },
  emptySub:     { fontSize: 13, color: colors.gray400 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  field:        { marginBottom: 16 },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: colors.gray500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput:   { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.gray900 },
  fieldMultiline: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn:    { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelBtnText:{ fontSize: 14, fontWeight: '600', color: colors.gray600 },
  saveBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10 },
  saveBtnText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
});
