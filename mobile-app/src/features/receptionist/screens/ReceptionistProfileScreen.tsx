import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, StyleSheet, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Clock, DollarSign, Mail, Phone, MapPin, Building2 } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/AppNavigator';
import { useAuth } from '../../../app/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceptionistProfile'>;

type Tab = 'Profile' | 'Attendance' | 'Salary';

const VIOLET      = '#2E2A85';
const VIOLET_LIGHT = '#F3F2F9';
const VIOLET_MID  = '#e8e7f5';

export const ReceptionistProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { backendUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Profile');

  const initials = (backendUser?.name || 'R')
    .split(' ').map((w: string) => w[0] || '').join('').toUpperCase().slice(0, 2);

  const TABS: Tab[] = ['Profile', 'Attendance', 'Salary'];

  const renderProfileTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Avatar card */}
      <View style={styles.avatarCard}>
        <View style={styles.bigAvatar}>
          <Text style={styles.bigAvatarText}>{initials}</Text>
        </View>
        <Text style={styles.profileName}>{backendUser?.name || 'Receptionist'}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText}>Receptionist</Text>
        </View>
      </View>

      {/* Info rows */}
      <View style={styles.infoCard}>
        <InfoRow icon={<Mail size={16} color={VIOLET} strokeWidth={2} />} label="Email" value={backendUser?.email || '—'} />
        <InfoRow icon={<Phone size={16} color={VIOLET} strokeWidth={2} />} label="Phone" value={backendUser?.phone || '—'} />
        <InfoRow icon={<Building2 size={16} color={VIOLET} strokeWidth={2} />} label="Clinic" value={backendUser?.clinic?.name || '—'} last />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAttendanceTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.statRow}>
        <StatCard label="Present" value="22" color="#10B981" bg="#E6F9F1" />
        <StatCard label="Absent"  value="2"  color="#EF4444" bg="#FEE2E2" />
        <StatCard label="Late"    value="3"  color="#F59E0B" bg="#FEF3C7" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>This Month</Text>
      </View>

      {['Mon 1 Apr', 'Tue 2 Apr', 'Wed 3 Apr', 'Thu 4 Apr', 'Fri 5 Apr', 'Mon 8 Apr'].map((day, i) => {
        const statuses = ['Present', 'Present', 'Late', 'Present', 'Absent', 'Present'];
        const status = statuses[i];
        const color = status === 'Present' ? '#10B981' : status === 'Late' ? '#F59E0B' : '#EF4444';
        const bg    = status === 'Present' ? '#E6F9F1' : status === 'Late' ? '#FEF3C7' : '#FEE2E2';
        return (
          <View key={day} style={styles.attendanceRow}>
            <View style={styles.attendanceDot} />
            <Text style={styles.attendanceDay}>{day}</Text>
            <View style={[styles.statusPill, { backgroundColor: bg }]}>
              <Text style={[styles.statusPillText, { color }]}>{status.toUpperCase()}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderSalaryTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.salaryHero}>
        <Text style={styles.salaryHeroLabel}>Current Month Net Pay</Text>
        <Text style={styles.salaryHeroValue}>₹18,500</Text>
        <View style={[styles.statusPill, { backgroundColor: '#E6F9F1', alignSelf: 'center', marginTop: 8 }]}>
          <Text style={[styles.statusPillText, { color: '#10B981' }]}>PAID</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Breakdown</Text>
      </View>

      <View style={styles.infoCard}>
        <SalaryRow label="Base Salary"   value="₹20,000" />
        <SalaryRow label="Deductions"    value="− ₹1,500" valueColor="#EF4444" />
        <SalaryRow label="Net Pay"       value="₹18,500"  valueColor={VIOLET} bold last />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>History</Text>
      </View>
      <View style={styles.infoCard}>
        <SalaryRow label="March 2025"    value="₹18,200" />
        <SalaryRow label="February 2025" value="₹18,500" last />
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={VIOLET} translucent />

      {/* Header */}
      <LinearGradient colors={['#2E2A85', '#393399']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            {navigation.canGoBack() ? (
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            ) : (
                <View style={{ width: 40 }} />
            )}
            <Text style={styles.headerTitle}>My Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                {activeTab === tab && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'Profile'    && renderProfileTab()}
        {activeTab === 'Attendance' && renderAttendanceTab()}
        {activeTab === 'Salary'     && renderSalaryTab()}
      </View>
    </View>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string; last?: boolean }> = ({ icon, label, value, last }) => (
  <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
    <View style={styles.infoRowIcon}>{icon}</View>
    <Text style={styles.infoRowLabel}>{label}</Text>
    <Text style={styles.infoRowValue} numberOfLines={1}>{value}</Text>
  </View>
);

const StatCard: React.FC<{ label: string; value: string; color: string; bg: string }> = ({ label, value, color, bg }) => (
  <View style={[styles.statCard, { backgroundColor: bg }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, { color }]}>{label}</Text>
  </View>
);

const SalaryRow: React.FC<{ label: string; value: string; valueColor?: string; bold?: boolean; last?: boolean }> = ({ label, value, valueColor = '#111827', bold, last }) => (
  <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
    <Text style={[styles.infoRowLabel, { flex: 1 }]}>{label}</Text>
    <Text style={[styles.infoRowValue, { color: valueColor, fontWeight: bold ? '700' : '600' }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {},
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  tabTextActive: { color: '#FFFFFF' },
  tabIndicator: { position: 'absolute', bottom: 0, width: '50%', height: 3, backgroundColor: '#FFFFFF', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  avatarCard: {
    alignItems: 'center', paddingVertical: 28,
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 20,
    borderRadius: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  bigAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: VIOLET_LIGHT, borderWidth: 3, borderColor: VIOLET, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  bigAvatarText: { fontSize: 26, fontWeight: '700', color: VIOLET },
  profileName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 6 },
  rolePill: { backgroundColor: VIOLET_LIGHT, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: VIOLET_MID },
  rolePillText: { fontSize: 12, fontWeight: '700', color: VIOLET, letterSpacing: 0.3 },
  infoCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 14, borderRadius: 16, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 } }) },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoRowIcon: { width: 32, alignItems: 'center' },
  infoRowLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', width: 80 },
  infoRowValue: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600', textAlign: 'right' },
  logoutBtn: { marginHorizontal: 16, marginTop: 24, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 } }) },
  statValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  sectionHeader: { paddingHorizontal: 4, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase' },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 13, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 } }) },
  attendanceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: VIOLET, marginRight: 12 },
  attendanceDay: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  salaryHero: { backgroundColor: VIOLET, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 4, ...Platform.select({ ios: { shadowColor: VIOLET, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 6 } }) },
  salaryHeroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 0.4, marginBottom: 6 },
  salaryHeroValue: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
});
