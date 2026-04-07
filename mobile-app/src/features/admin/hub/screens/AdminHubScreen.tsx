import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Animated, Dimensions,
  Modal, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Menu, Building2, Users, Settings2, FileText, Bell, CreditCard,
  ChevronDown, ChevronRight, X,
  ClipboardList, Stethoscope, Leaf, TestTube,
  Activity, Pill, DollarSign, Plus, ArrowRight, Briefcase,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminColors } from '../../../../shared/constants/adminColors';
import { colors } from '../../../../shared/constants/colors';
import { adminApiService, ClinicInfo } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { useAuth } from '../../../../app/AuthContext';

const DRAWER_WIDTH = 280;
const SCREEN_WIDTH = Dimensions.get('window').width;

const RECENT_KEY = '@molarplus_admin_recent_screens';

const ADMIN_SCREEN_REGISTRY: Record<string, { label: string; icon: any; bg: string; color: string }> = {
  Team:                 { label: 'Team',             icon: Users,      bg: '#FFE8F0', color: '#FF6B9D' },
  TreatmentsPricing:   { label: 'Treatments',        icon: Stethoscope,bg: '#E0F7F5', color: '#4ECDC4' },
  PracticeSettings:    { label: 'Practice Settings', icon: Settings2,  bg: '#E0F2F2', color: '#2D9596' },
  Templates:           { label: 'Templates',         icon: FileText,   bg: '#E8ECFF', color: '#6B7FFF' },
  NotificationSettings:{ label: 'Notifications',     icon: Bell,       bg: '#FEF3C7', color: '#F59E0B' },
  Subscription:        { label: 'Subscription',      icon: CreditCard, bg: '#EDE9FE', color: '#8B5CF6' },
  ClinicSettings:      { label: 'Clinic Settings',   icon: Settings2,  bg: '#FFF4E6', color: '#FF8C42' },
};

const DEFAULT_RECENT = ['Team', 'NotificationSettings', 'Subscription'];

async function recordAdminVisit(screenName: string) {
  try {
    if (!ADMIN_SCREEN_REGISTRY[screenName]) return;
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const updated = [screenName, ...list.filter(s => s !== screenName)].slice(0, 3);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
}

async function loadRecentScreens(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (list.length === 0) return DEFAULT_RECENT;
    // Pad with defaults if fewer than 3
    const padded = [...list];
    for (const d of DEFAULT_RECENT) {
      if (padded.length >= 3) break;
      if (!padded.includes(d)) padded.push(d);
    }
    return padded.slice(0, 3);
  } catch { return DEFAULT_RECENT; }
}

const PRACTICE_CATEGORIES = [
  { id: 'procedures',          label: 'Procedures',         backendKey: 'procedure',          icon: Stethoscope },
  { id: 'chief-complaints',    label: 'Chief Complaints',   backendKey: 'complaint',           icon: ClipboardList },
  { id: 'medical-history',     label: 'Medical History',    backendKey: 'medical-condition',  icon: Activity },
  { id: 'clinical-advice',     label: 'Clinical Advice',    backendKey: 'advice',              icon: Leaf },
  { id: 'on-examination',      label: 'On Examination',     backendKey: 'finding',             icon: TestTube },
  { id: 'dental-history',      label: 'Dental History',     backendKey: 'dental-history',      icon: Stethoscope },
  { id: 'diagnosis',           label: 'Diagnosis',          backendKey: 'diagnosis',           icon: Activity },
  { id: 'allergies',           label: 'Allergies',          backendKey: 'allergy',             icon: Pill },
  { id: 'ongoing-medication',  label: 'Ongoing Medication', backendKey: 'current-medication',  icon: Pill },
  { id: 'additional-fees',     label: 'Additional Fees',    backendKey: 'additional-fee',      icon: DollarSign },
];

interface AdminHubScreenProps {
  navigation: any;
}

export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ navigation }) => {
  const { backendUser } = useAuth();
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [practiceExpanded, setPracticeExpanded] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [addBranchVisible, setAddBranchVisible] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAddr, setBranchAddrField] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchEmail, setBranchEmail] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [recentScreenKeys, setRecentScreenKeys] = useState<string[]>(DEFAULT_RECENT);

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0.5, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  const navigateTo = (screen: string, params?: any) => {
    recordAdminVisit(screen);
    closeDrawer();
    setTimeout(() => navigation.navigate(screen, params), 260);
  };

  const openAddBranch = () => {
    setBranchName('');
    setBranchAddrField('');
    setBranchPhone('');
    setBranchEmail('');
    setAddBranchVisible(true);
  };

  const handleAddBranch = async () => {
    if (!branchName.trim()) return;
    setAddingBranch(true);
    try {
      const result = await adminApiService.ownerAddClinic({
        name: branchName.trim(),
        address: branchAddr.trim() || undefined,
        phone: branchPhone.trim() || undefined,
        email: branchEmail.trim() || undefined,
      });
      if (result) {
        setAddBranchVisible(false);
        loadData();
      }
    } finally {
      setAddingBranch(false);
    }
  };

  const loadData = async () => {
    try {
      const [clinicData, staffData] = await Promise.all([
        adminApiService.getClinicInfo(),
        adminApiService.getStaff(),
      ]);
      setClinic(clinicData);
      setStaffCount(staffData.length);
    } catch (err) {
      console.error('❌ [ADMIN HUB] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (StatusBar.setBackgroundColor) StatusBar.setBackgroundColor(adminColors.gradientStart);
      loadRecentScreens().then(setRecentScreenKeys);
    }, [])
  );

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={adminColors.gradientStart} />
        <GearLoader text="Opening Admin Hub..." />
      </View>
    );
  }

  const branches = backendUser?.clinics?.length ? backendUser.clinics : (backendUser?.clinic ? [backendUser.clinic] : []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={adminColors.gradientStart} />
      <SafeAreaView style={{ backgroundColor: adminColors.gradientStart }} edges={['top']}>
        {/* ── Header ── */}
        <LinearGradient colors={[adminColors.gradientStart, adminColors.gradientEnd]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.menuBtn} onPress={openDrawer}>
              <Menu size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Admin Hub</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.clinicRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clinicName} numberOfLines={1}>{clinic?.name || 'My Clinic'}</Text>
              <Text style={styles.clinicSub} numberOfLines={1}>📍 {clinic?.address || 'Address not set'}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <View style={[styles.dot, { backgroundColor: '#4ade80' }]} />
                  <Text style={styles.badgeText}>Open</Text>
                </View>
                <View style={styles.badge}>
                  <Users size={12} color="#fff" />
                  <Text style={styles.badgeText}>{staffCount} Staff</Text>
                </View>
              </View>
            </View>
            <View style={styles.clinicAvatar}>
              <Briefcase size={28} color="#fff" />
              <View style={styles.onlineDot} />
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* ── Main Content ── */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminColors.primary} />}
      >
        <View style={styles.quickGrid}>
          <Text style={styles.sectionLabel}>RECENTLY ACCESSED</Text>
          <View style={styles.grid}>
            {recentScreenKeys.map((key) => {
              const meta = ADMIN_SCREEN_REGISTRY[key];
              if (!meta) return null;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.gridCard, { backgroundColor: meta.bg }]}
                  onPress={() => navigateTo(key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.gridIcon, { backgroundColor: meta.color + '22' }]}>
                    <meta.icon size={22} color={meta.color} strokeWidth={2} />
                  </View>
                  <Text style={[styles.gridLabel, { color: meta.color }]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Add Branch Modal ── */}
      <Modal visible={addBranchVisible} animationType="slide" transparent onRequestClose={() => setAddBranchVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add New Branch</Text>
            {[{ label: 'Branch Name *', value: branchName, setter: setBranchName, placeholder: 'e.g. Downtown Clinic' },
              { label: 'Address', value: branchAddr, setter: setBranchAddrField, placeholder: 'Street address' },
              { label: 'Phone', value: branchPhone, setter: setBranchPhone, placeholder: '+91 XXXXX XXXXX' },
              { label: 'Email', value: branchEmail, setter: setBranchEmail, placeholder: 'branch@clinic.com' },
            ].map(f => (
              <View key={f.label} style={styles.mField}>
                <Text style={styles.mLabel}>{f.label}</Text>
                <TextInput style={styles.mInput} placeholder={f.placeholder} placeholderTextColor="#9CA3AF"
                  value={f.value} onChangeText={f.setter} />
              </View>
            ))}
            <View style={styles.mActions}>
              <TouchableOpacity style={styles.mCancel} onPress={() => setAddBranchVisible(false)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mSave, !branchName.trim() && { opacity: 0.5 }]}
                onPress={handleAddBranch} disabled={!branchName.trim() || addingBranch}>
                {addingBranch ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Add Branch</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Drawer Overlay ── */}
      {drawerOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} pointerEvents="box-only">
          <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} activeOpacity={1} />
        </Animated.View>
      )}

      {/* ── Drawer Panel ── */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Drawer header */}
          <LinearGradient colors={[adminColors.gradientStart, adminColors.gradientEnd]} style={styles.drawerHeader}>
            <View style={styles.drawerHeaderRow}>
              <View>
                <Text style={styles.drawerTitle}>Admin Hub</Text>
                <Text style={styles.drawerSub}>Configuration</Text>
              </View>
              <TouchableOpacity onPress={closeDrawer} style={styles.drawerClose}>
                <X size={18} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.drawerBody} showsVerticalScrollIndicator={false}>
            {/* Branches */}
            <DrawerItem icon={Building2} label="Branches" onPress={() => { closeDrawer(); }} active />
            <View style={styles.drawerSubList}>
              {branches.map((b: any, idx: number) => (
                <Text key={b.id || idx} style={[styles.drawerSubItem, b.id === backendUser?.clinic?.id && styles.drawerSubItemActive]}>
                  {b.name}
                </Text>
              ))}
              <TouchableOpacity onPress={openAddBranch} style={styles.drawerSubAdd}>
                <Plus size={13} color={adminColors.primary} />
                <Text style={styles.drawerSubAddText}>Add New Branch</Text>
              </TouchableOpacity>
            </View>

            {/* Team (Staff / Attendance / Permissions) */}
            <DrawerItem icon={Users} label="Staff" onPress={() => navigateTo('Team', { initialTab: 'staff' })} hasArrow />

            {/* Practice Settings */}
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => setPracticeExpanded(p => !p)}
            >
              <View style={styles.drawerItemLeft}>
                <View style={styles.drawerIconWrap}>
                  <Settings2 size={18} color={adminColors.primary} />
                </View>
                <Text style={styles.drawerItemLabel}>Practice Settings</Text>
              </View>
              {practiceExpanded
                ? <ChevronDown size={16} color={colors.gray400} />
                : <ChevronRight size={16} color={colors.gray400} />}
            </TouchableOpacity>
            {practiceExpanded && (
              <View style={styles.drawerSubList}>
                {PRACTICE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.drawerPracticeSub}
                    onPress={() => navigateTo('PracticeSettings', { category: cat.id, backendKey: cat.backendKey, label: cat.label })}
                  >
                    <cat.icon size={13} color={adminColors.primary} />
                    <Text style={styles.drawerSubItem}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Templates */}
            <DrawerItem icon={FileText} label="Templates" onPress={() => navigateTo('Templates')} hasArrow />

            {/* Notifications */}
            <DrawerItem icon={Bell} label="Notifications" onPress={() => navigateTo('NotificationSettings')} hasArrow />

            {/* Subscription */}
            <DrawerItem icon={CreditCard} label="Subscription" onPress={() => navigateTo('Subscription')} hasArrow />

            {/* Clinic Settings */}
            <DrawerItem icon={Settings2} label="Clinic Settings" onPress={() => navigateTo('ClinicSettings')} hasArrow />
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

// ── Reusable drawer list item ──────────────────────────────
const DrawerItem: React.FC<{
  icon: any; label: string; onPress: () => void; active?: boolean; hasArrow?: boolean;
}> = ({ icon: Icon, label, onPress, active, hasArrow }) => (
  <TouchableOpacity
    style={[styles.drawerItem, active && styles.drawerItemActive]}
    onPress={onPress}
  >
    <View style={styles.drawerItemLeft}>
      <View style={[styles.drawerIconWrap, active && styles.drawerIconActive]}>
        <Icon size={18} color={active ? adminColors.primary : colors.gray500} />
      </View>
      <Text style={[styles.drawerItemLabel, active && styles.drawerItemLabelActive]}>{label}</Text>
    </View>
    {hasArrow && <ArrowRight size={15} color={colors.gray300} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F9FAFB' },
  center:      { justifyContent: 'center', alignItems: 'center' },
  content:     { flex: 1 },

  // ── Header ──
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  menuBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  clinicRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clinicName:  { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 3 },
  clinicSub:   { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 10 },
  badgeRow:    { flexDirection: 'row', gap: 8 },
  badge:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5 },
  dot:         { width: 7, height: 7, borderRadius: 4 },
  badgeText:   { fontSize: 11, fontWeight: '600', color: '#fff' },
  clinicAvatar:{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  onlineDot:   { position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#fff' },

  // ── Quick grid ──
  quickGrid:   { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel:{ fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 12 },
  grid:        { flexDirection: 'row', gap: 10 },
  gridCard:    { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8 },
  gridIcon:    { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  gridLabel:   { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // ── Branches quick card ──
  branchCard:  { marginHorizontal: 16, marginTop: 20, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  branchHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  branchTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E0F2F2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addBtnText:  { fontSize: 12, fontWeight: '600', color: '#2D9596' },
  emptyText:   { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 10 },
  branchItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  branchDot:   { width: 10, height: 10, borderRadius: 5 },
  branchName:  { fontSize: 14, fontWeight: '600', color: '#111827' },
  branchAddr:  { fontSize: 12, color: '#6B7280', marginTop: 1 },
  activeBadge: { backgroundColor: '#E0F2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: '#2D9596' },

  // ── Overlay ──
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 10 },

  // ── Drawer ──
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: '#fff', zIndex: 20, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 4, height: 0 }, elevation: 16 },
  drawerHeader:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  drawerHeaderRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  drawerTitle:       { fontSize: 18, fontWeight: '700', color: '#fff' },
  drawerSub:         { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  drawerClose:       { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  drawerBody:        { flex: 1, paddingTop: 8 },
  drawerItem:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  drawerItemActive:  { backgroundColor: '#F0FAFA', borderLeftWidth: 3, borderLeftColor: '#2D9596' },
  drawerItemLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  drawerIconWrap:    { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  drawerIconActive:  { backgroundColor: '#E0F2F2' },
  drawerItemLabel:   { fontSize: 14, fontWeight: '500', color: '#374151' },
  drawerItemLabelActive: { color: '#2D9596', fontWeight: '700' },
  drawerSubList:     { paddingLeft: 20, paddingRight: 16, paddingBottom: 6, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  drawerSubItem:     { fontSize: 13, color: '#4B5563', paddingVertical: 7, paddingLeft: 8 },
  drawerSubItemActive: { color: '#2D9596', fontWeight: '600' },
  drawerSubAdd:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingLeft: 8 },
  drawerSubAddText:  { fontSize: 13, color: '#2D9596', fontWeight: '600' },
  drawerPracticeSub: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingLeft: 4 },

  // ── Add Branch Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 20 },
  mField:       { marginBottom: 14 },
  mLabel:       { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  mInput:       { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827' },
  mActions:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  mCancel:      { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  mSave:        { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#2D9596', alignItems: 'center', justifyContent: 'center' },
});
