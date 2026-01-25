import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, MoreVertical, Plus, Stethoscope, Sparkles, X, Smile, Calendar, IndianRupee, Trash2, Edit3, ChevronRight } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Treatment {
  id: string;
  name: string;
  price: number;
  category: string;
}

export const TreatmentsPricingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Services');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', category: 'General' });
  const [saving, setSaving] = useState(false);

  const categories = ['All Services', 'General', 'Orthodontics', 'Cosmetic'];

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await adminApiService.getTreatmentTypes();
      setTreatments(data);
    } catch (err) {
      console.error('❌ [TREATMENTS] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTreatments = useMemo(() => {
    return treatments.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All Services' || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [treatments, searchQuery, selectedCategory]);

  const groupedTreatments = useMemo(() => {
    return filteredTreatments.reduce((acc: any, t) => {
      const cat = t.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(t);
      return acc;
    }, {});
  }, [filteredTreatments]);

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...formData, price: Number(formData.price) };
      const success = editingTreatment
        ? await adminApiService.updateTreatmentType(editingTreatment.id, payload)
        : await adminApiService.createTreatmentType(payload);

      if (success) {
        setIsModalVisible(false);
        loadData();
      } else {
        Alert.alert('Error', 'Failed to save treatment');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (t: Treatment) => {
    setEditingTreatment(t);
    setFormData({ name: t.name, price: t.price.toString(), category: t.category || 'General' });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Treatment', 'Are you sure you want to remove this service from your catalog?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await adminApiService.deleteTreatmentType(id);
          if (success) loadData();
          else Alert.alert('Error', 'Failed to delete treatment');
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={adminColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Price Catalog</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={loadData}>
          <MoreVertical size={20} color={adminColors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search treatments..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catBtn, selectedCategory === cat && styles.catBtnActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <GearLoader text="Loading catalog..." />
          </View>
        ) : (
          <View style={styles.catalog}>
            {Object.entries(groupedTreatments).map(([category, items]: [string, any]) => (
              <View key={category} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{category.toUpperCase()}</Text>
                  <Text style={styles.itemCount}>{items.length} ITEMS</Text>
                </View>
                <View style={styles.itemList}>
                  {items.map((t: Treatment, idx: number) => (
                    <View key={t.id}>
                      <TouchableOpacity style={styles.itemRow} onPress={() => handleEdit(t)}>
                        <View style={styles.itemInfo}>
                          <View style={styles.iconCircle}>
                            <Stethoscope size={18} color={adminColors.primary} />
                          </View>
                          <View>
                            <Text style={styles.itemName}>{t.name}</Text>
                            <Text style={styles.itemPrice}>₹{t.price}</Text>
                          </View>
                        </View>
                        <View style={styles.itemActions}>
                          <TouchableOpacity onPress={() => handleEdit(t)} style={styles.actionBtn}>
                            <Edit3 size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDelete(t.id)} style={styles.actionBtn}>
                            <Trash2 size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                      {idx < items.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditingTreatment(null);
          setFormData({ name: '', price: '', category: 'General' });
          setIsModalVisible(true);
        }}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={3} />
      </TouchableOpacity>

      {/* Bottom Tray Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.bottomTray}>
            <View style={styles.trayHandle} />
            <View style={styles.trayHeader}>
              <Text style={styles.trayTitle}>{editingTreatment ? 'Edit Treatment' : 'Add Treatment'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>TREATMENT NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Scaling & Polishing"
                  value={formData.name}
                  onChangeText={(val) => setFormData({ ...formData, name: val })}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>PRICE (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={formData.price}
                    onChangeText={(val) => setFormData({ ...formData, price: val })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>CATEGORY</Text>
                  <View style={styles.pickerWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. General"
                      value={formData.category}
                      onChangeText={(val) => setFormData({ ...formData, category: val })}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                disabled={saving}
                onPress={handleSave}
              >
                {saving ? (
                  <GearLoader text="" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingTreatment ? 'UPDATE SERVICE' : 'ADD TO CATALOG'}</Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  menuBtn: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  content: { flex: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', margin: 20, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, color: '#111827' },
  categoryRow: { paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  catBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6' },
  catBtnActive: { backgroundColor: adminColors.primary, borderColor: adminColors.primary },
  catText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catTextActive: { color: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  catalog: { paddingHorizontal: 20 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 1 },
  itemCount: { fontSize: 10, fontWeight: 'bold', color: adminColors.primary },
  itemList: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  itemInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E0F2F2', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 15, fontWeight: '700', color: '#344054' },
  itemPrice: { fontSize: 13, color: adminColors.primary, fontWeight: 'bold', marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#F9FAFB', marginHorizontal: 16 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: adminColors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: adminColors.primary, shadowRadius: 10, shadowOpacity: 0.3, elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomTray: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  trayHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  trayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  trayTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  closeBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
  form: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, fontSize: 15, color: '#111827', borderWidth: 1, borderColor: '#F3F4F6' },
  inputRow: { flexDirection: 'row', gap: 16 },
  pickerWrapper: { flex: 1 },
  saveBtn: { backgroundColor: adminColors.primary, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 12, shadowColor: adminColors.primary, shadowRadius: 8, shadowOpacity: 0.2 },
  saveBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
});
