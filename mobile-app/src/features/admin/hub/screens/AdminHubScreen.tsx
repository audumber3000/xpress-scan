import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar,
  Modal, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MapPin, CheckCircle2, Building2, Users, Settings2, FileText, Bell,
  ChevronRight, ChevronDown, Plus,
  ClipboardList, Stethoscope, Leaf, TestTube, Activity, Pill, DollarSign,
  CalendarClock, Shield, CreditCard, ScrollText, ShieldCheck, LogIn } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { colors } from '../../../../shared/constants/colors';
import { componentRadius } from '../../../../shared/constants/theme';
import { adminApiService, ClinicInfo } from '../../../../services/api/admin.api';
import { SetupProgressRing, SetupStatus } from '../components/SetupProgressRing';
import { SupportCard } from '../components/SupportCard';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { notify } from '../../../../shared/utils/notify';
import { useAuth } from '../../../../app/AuthContext';
import { IS_PURCHASE_UI_ENABLED } from '../../../../shared/constants/platform';

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

const initialsOf = (name?: string) => {
  if (!name) return 'CL';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'CL';
};

interface AdminHubScreenProps {
  navigation: any;
}

export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ navigation }) => {
  const { backendUser, switchBranch } = useAuth();
  // The audit endpoint is owner-only, so hide the row rather than show one that
  // always comes back empty.
  const isOwner = backendUser?.role === 'clinic_owner';
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [practiceExpanded, setPracticeExpanded] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const [addBranchVisible, setAddBranchVisible] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAddr, setBranchAddr] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchEmail, setBranchEmail] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);

  const loadData = async () => {
    try {
      const [clinicData, staffData, setup] = await Promise.all([
        adminApiService.getClinicInfo(),
        adminApiService.getStaff(),
        adminApiService.getSetupStatus(),
      ]);
      setClinic(clinicData);
      setStaffCount(staffData.length);
      setSetupStatus(setup);
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
    }, [])
  );

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const openAddBranch = () => {
    // Free plans get the upgrade path instead of the create-branch form.
    if (!isPro) {
      if (IS_PURCHASE_UI_ENABLED) {
        navigation.navigate('Purchase');
      } else {
        notify.done('Running multiple branches is a premium upgrade. Manage your plan from your clinic account on the website.');
      }
      return;
    }
    setBranchName(''); setBranchAddr(''); setBranchPhone(''); setBranchEmail('');
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
      if (result) { setAddBranchVisible(false); loadData(); }
    } catch (e: any) {
      // Backend enforces the multi-branch gate too (403 for free plans).
      notify.problem(e?.response?.data?.detail || 'Could not add branch. Adding more branches requires an upgrade.');
    } finally {
      setAddingBranch(false);
    }
  };

  const handleSwitchBranch = async (b: any) => {
    if (b.id === backendUser?.clinic?.id || switchingId) return;
    setSwitchingId(b.id);
    try {
      await switchBranch(String(b.id));
      notify.done(`Switched to ${b.name}`);
      loadData();
    } catch {
      notify.problem('Failed to switch branch');
    } finally {
      setSwitchingId(null);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={adminColors.gradientStart} />
        <GearLoader text="Opening Control Center..." />
      </View>
    );
  }

  const activeClinic: any = backendUser?.clinic;
  const branches: any[] = backendUser?.clinics?.length ? backendUser.clinics : (activeClinic ? [activeClinic] : []);
  const clinicName = activeClinic?.name || clinic?.name || 'My Clinic';
  const clinicAddr = activeClinic?.address || clinic?.address || 'Address not set';

  // Subscription strip (hidden on iOS — App Store purchase-UI guideline)
  const isTrial = activeClinic?.is_trial;
  const daysLeft = activeClinic?.trial_days_remaining;
  const plan = activeClinic?.subscription_plan;
  // Multi-branch is the only premium capability — a single clinic is fully free.
  const isPro = plan === 'professional' || plan === 'professional_annual';
  const subText = isTrial
    ? `Trial — ${typeof daysLeft === 'number' ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'active'}`
    : plan === 'professional' ? 'Professional plan' : 'Free plan';
  const showUpgrade = IS_PURCHASE_UI_ENABLED && plan !== 'professional';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={adminColors.gradientStart} />
      <SafeAreaView style={{ backgroundColor: adminColors.gradientStart }} edges={['top']}>
        {/* ── Header ── */}
        <LinearGradient colors={[adminColors.gradientStart, adminColors.gradientEnd]} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Control Center</Text>
              <View style={styles.locationRow}>
                <MapPin size={13} color="rgba(255,255,255,0.8)" />
                <Text style={styles.locationText} numberOfLines={1}>{clinicName}</Text>
              </View>
            </View>
            {setupStatus && setupStatus.percent < 100 ? (
              <SetupProgressRing
                status={setupStatus}
                onNavigate={(screen) => navigation.navigate(screen as never)}
                onRefresh={loadData}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(clinicName)}</Text>
              </View>
            )}
          </View>

          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <CheckCircle2 size={13} color="#fff" />
              <Text style={styles.chipText}>Open</Text>
            </View>
            <View style={styles.chip}>
              <Building2 size={13} color="#fff" />
              <Text style={styles.chipText}>{branches.length} branch{branches.length === 1 ? '' : 'es'}</Text>
            </View>
          </View>

          {IS_PURCHASE_UI_ENABLED && (
            <TouchableOpacity
              style={styles.subStrip}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Subscription')}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.subLabel}>Subscription</Text>
                <Text style={styles.subValue} numberOfLines={1}>{subText}</Text>
              </View>
              {showUpgrade && (
                <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.85} onPress={() => navigation.navigate('Purchase')}>
                  <Text style={styles.upgradeText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        </LinearGradient>
      </SafeAreaView>

      {/* ── Content ── */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminColors.primary} />}
      >
        {/* Branches */}
        <Text style={styles.sectionLabel}>BRANCHES</Text>
        <View style={styles.card}>
          {branches.map((b, idx) => {
            const active = b.id === activeClinic?.id;
            return (
              <TouchableOpacity
                key={b.id || idx}
                style={[styles.branchRow, active && styles.branchRowActive]}
                activeOpacity={active ? 1 : 0.7}
                disabled={active}
                onPress={() => handleSwitchBranch(b)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.branchName}>{b.name}</Text>
                  <Text style={styles.branchSub} numberOfLines={1}>{b.address || `Branch ${idx + 1}`}</Text>
                </View>
                {switchingId === b.id ? (
                  <ActivityIndicator size="small" color={adminColors.primary} />
                ) : active ? (
                  <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>
                ) : (
                  <ChevronRight size={18} color={colors.gray400} />
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.addBranchRow} onPress={openAddBranch} activeOpacity={0.7}>
            <Plus size={18} color={adminColors.primary} />
            <Text style={styles.addBranchText}>Add new branch</Text>
            {!isPro && (
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>PRO</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Team & access */}
        <Text style={styles.sectionLabel}>TEAM &amp; ACCESS</Text>
        <View style={styles.card}>
          <ConfigRow
            icon={Users} iconBg="#EEF0FF" iconColor="#6366F1"
            title="Staff" subtitle={`${staffCount} member${staffCount === 1 ? '' : 's'} · roles & access`}
            onPress={() => navigation.navigate('Team', { initialTab: 'staff' })}
          />
          <View style={styles.rowDivider} />
          <ConfigRow
            icon={CalendarClock} iconBg="#FFF4E6" iconColor="#FF8C42"
            title="Attendance" subtitle="Daily staff check-in & leave"
            onPress={() => navigation.navigate('Attendance')}
          />
          <ConfigRow
            icon={LogIn} iconBg="#D1FAE5" iconColor="#059669"
            title="My shift" subtitle="Clock in and out from the clinic"
            onPress={() => navigation.navigate('ClockIn')}
          />
          <View style={styles.rowDivider} />
          <ConfigRow
            icon={Shield} iconBg="#E8F4F9" iconColor="#5DADE2"
            title="Permissions" subtitle="What each role can access"
            onPress={() => navigation.navigate('Permissions')}
          />
        </View>

        {/* Clinical */}
        <Text style={styles.sectionLabel}>CLINICAL</Text>
        <View style={styles.card}>
          <ConfigRow
            icon={Settings2} iconBg="#E6F7EF" iconColor="#10B981"
            title="Practice settings" subtitle="Complaints, findings, diagnoses…"
            chevron={practiceExpanded ? 'down' : 'right'}
            onPress={() => setPracticeExpanded(p => !p)}
          />
          {practiceExpanded && (
            <View style={styles.subItems}>
              {PRACTICE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.subItem}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('PracticeSettings', { category: cat.id, backendKey: cat.backendKey, label: cat.label })}
                >
                  <cat.icon size={15} color={adminColors.primary} />
                  <Text style={styles.subItemText}>{cat.label}</Text>
                  <ChevronRight size={15} color={colors.gray300} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.rowDivider} />
          <ConfigRow
            icon={Stethoscope} iconBg="#E0F7F5" iconColor="#4ECDC4"
            title="Treatments & pricing" subtitle="Your service catalogue & fees"
            onPress={() => navigation.navigate('TreatmentsPricing')}
          />
        </View>

        {/* Communication */}
        <Text style={styles.sectionLabel}>COMMUNICATION</Text>
        <View style={styles.card}>
          <ConfigRow
            icon={FileText} iconBg="#FEF3C7" iconColor="#F59E0B"
            title="Templates" subtitle="Invoice, prescription layouts"
            onPress={() => navigation.navigate('Templates')}
          />
          <View style={styles.rowDivider} />
          <ConfigRow
            icon={Bell} iconBg="#F3E8FF" iconColor="#A855F7"
            title="Notifications" subtitle="WhatsApp, push, reminders"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
        </View>

        {/* Clinic & plan */}
        <Text style={styles.sectionLabel}>CLINIC &amp; PLAN</Text>
        <View style={styles.card}>
          <ConfigRow
            icon={Building2} iconBg="#E0F2F2" iconColor="#2D9596"
            title="Clinic settings" subtitle="Name, logo, address"
            onPress={() => navigation.navigate('ClinicSettings')}
          />
          <View style={styles.rowDivider} />
          <ConfigRow
            icon={CreditCard} iconBg="#E8ECFF" iconColor="#6B7FFF"
            title="Subscription" subtitle="Plan, branches & billing"
            onPress={() => navigation.navigate('Subscription')}
          />
        </View>

        {/* Security — owner-only; the backend returns nothing for anyone else. */}
        {isOwner && (
          <>
            <Text style={styles.sectionLabel}>SECURITY</Text>
            <View style={styles.card}>
              {/* First in the section on purpose: the master password lives here,
                  and a clinic still on 123456 needs to meet this before it needs
                  the audit log. */}
              <ConfigRow
                icon={ShieldCheck} iconBg="#D1FAE5" iconColor="#059669"
                title="Verification" subtitle="Recovery contact & master password"
                onPress={() => navigation.navigate('Verification')}
              />
              <ConfigRow
                icon={ScrollText} iconBg="#FEE2E2" iconColor="#EF4444"
                title="Audit log" subtitle="Who deleted or changed what"
                onPress={() => navigation.navigate('AuditLog')}
              />
            </View>
          </>
        )}

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <SupportCard clinicName={clinicName} />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Add Branch Modal ── */}
      <Modal visible={addBranchVisible} animationType="slide" transparent onRequestClose={() => setAddBranchVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add new branch</Text>
            {[{ label: 'Branch Name *', value: branchName, setter: setBranchName, placeholder: 'e.g. Downtown Clinic' },
              { label: 'Address', value: branchAddr, setter: setBranchAddr, placeholder: 'Street address' },
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
    </View>
  );
};

// ── Config list row ────────────────────────────────────────
const ConfigRow: React.FC<{
  icon: any; iconBg: string; iconColor: string;
  title: string; subtitle: string;
  chevron?: 'right' | 'down';
  onPress: () => void;
}> = ({ icon: Icon, iconBg, iconColor, title, subtitle, chevron = 'right', onPress }) => (
  <TouchableOpacity style={styles.configRow} activeOpacity={0.7} onPress={onPress}>
    <View style={[styles.configIcon, { backgroundColor: iconBg }]}>
      <Icon size={20} color={iconColor} strokeWidth={2} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.configTitle}>{title}</Text>
      <Text style={styles.configSub}>{subtitle}</Text>
    </View>
    {chevron === 'down'
      ? <ChevronDown size={18} color={colors.gray400} />
      : <ChevronRight size={18} color={colors.gray400} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center:    { justifyContent: 'center', alignItems: 'center' },
  content:   { flex: 1 },

  // ── Header ──
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  locationText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  chipRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: componentRadius.pill },
  chipText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  subStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: componentRadius.carouselCard, padding: 14, marginTop: 16 },
  subLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  subValue: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 2 },
  upgradeBtn: { backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: componentRadius.button },
  upgradeText: { fontSize: 14, fontWeight: '700', color: adminColors.gradientStart },

  // ── Sections ──
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginTop: 22, marginBottom: 10, marginHorizontal: 20 },
  card: { backgroundColor: '#fff', borderRadius: componentRadius.carouselCard, marginHorizontal: 16, borderWidth: 1, borderColor: '#EEF0F2', overflow: 'hidden' },

  // ── Branches ──
  branchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, margin: 6, borderRadius: componentRadius.statCard, backgroundColor: '#F9FAFB' },
  branchRowActive: { backgroundColor: '#E7F6EE' },
  branchName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  branchSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  activeBadge: { backgroundColor: adminColors.gradientStart, paddingHorizontal: 12, paddingVertical: 6, borderRadius: componentRadius.pill },
  activeBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  addBranchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F3F5' },
  addBranchText: { fontSize: 15, fontWeight: '700', color: adminColors.primary },
  proPill: { marginLeft: 'auto', backgroundColor: adminColors.primary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  proPillText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // ── Config ──
  configRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  configIcon: { width: 44, height: 44, borderRadius: componentRadius.statCard, justifyContent: 'center', alignItems: 'center' },
  configTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  configSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  rowDivider: { height: 1, backgroundColor: '#F1F3F5', marginLeft: 74 },
  subItems: { backgroundColor: '#FAFAFA', paddingVertical: 4, paddingLeft: 74, paddingRight: 16 },
  subItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  subItemText: { fontSize: 14, color: '#374151' },

  // ── Add Branch Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 20 },
  mField:       { marginBottom: 14 },
  mLabel:       { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  mInput:       { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: componentRadius.button, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827' },
  mActions:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  mCancel:      { flex: 1, paddingVertical: 13, borderRadius: componentRadius.button, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  mSave:        { flex: 1, paddingVertical: 13, borderRadius: componentRadius.button, backgroundColor: adminColors.primary, alignItems: 'center', justifyContent: 'center' },
});
