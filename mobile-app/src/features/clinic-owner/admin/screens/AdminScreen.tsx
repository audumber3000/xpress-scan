import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Building2,
  Users,
  CalendarCheck,
  CreditCard,
  ShieldCheck,
  Settings2,
  Stethoscope,
  ChevronRight,
  UserRoundPlus,
  LayoutDashboard,
  BellRing
} from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { adminApiService, ClinicInfo, StaffMember } from '../../../../services/api/admin.api';

interface AdminModule {
  id: string;
  title: string;
  icon: any;
  color: string;
  bgColor: string;
  path: string;
}

interface Section {
  title: string;
  modules: AdminModule[];
}

export const AdminScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const adminSections: Section[] = [
    {
      title: 'DAILY OPERATIONS',
      modules: [
        { id: 'attendance', title: 'Attendance', icon: CalendarCheck, color: '#2D9596', bgColor: '#E0F2F2', path: 'Attendance' },
        { id: 'staff', title: 'Staff', icon: Users, color: '#2D9596', bgColor: '#E0F2F2', path: 'StaffManagement' },
        { id: 'clinic', title: 'Clinic Info', icon: Building2, color: '#2D9596', bgColor: '#E0F2F2', path: 'ClinicInfo' },
      ]
    },
    {
      title: 'FINANCE & BILLING',
      modules: [
        { id: 'treatments', title: 'Catalog', icon: Stethoscope, color: '#10B981', bgColor: '#D1FAE5', path: 'TreatmentCatalog' },
        { id: 'subscription', title: 'Billing', icon: CreditCard, color: '#8B5CF6', bgColor: '#EDE9FE', path: 'Subscription' },
      ]
    },
    {
      title: 'COMMUNICATION',
      modules: [
        { id: 'templates', title: 'Templates', icon: BellRing, color: '#2D9596', bgColor: '#E0F2F2', path: 'Templates' },
        { id: 'referrals', title: 'Ref. Docs', icon: UserRoundPlus, color: '#2D9596', bgColor: '#E0F2F2', path: 'Referrals' },
      ]
    },
    {
      title: 'SYSTEM CONTROL',
      modules: [
        { id: 'permissions', title: 'Access', icon: ShieldCheck, color: '#F59E0B', bgColor: '#FEF3C7', path: 'Permissions' },
        { id: 'settings', title: 'Settings', icon: Settings2, color: '#6B7280', bgColor: '#F3F4F6', path: 'Settings' },
      ]
    }
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [info, staffData] = await Promise.all([
        adminApiService.getClinicInfo(),
        adminApiService.getStaff()
      ]);
      setClinic(info);
      setStaff(staffData);
    } catch (err) {
      console.error('❌ [ADMIN] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Clinic Header - Ported Logic from Web */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.infoBlock}>
              <Text style={styles.clinicName}>{clinic?.name || 'My Clinic'}</Text>
              <Text style={styles.address}>📍 {clinic?.address || 'Set clinic address'}</Text>

              <View style={styles.badgeRow}>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(74, 222, 128, 0.2)' }]}>
                  <View style={styles.dot} />
                  <Text style={styles.badgeText}>Open</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
                  <Users size={12} color="#FFFFFF" />
                  <Text style={styles.badgeText}>{staff.length} Staff</Text>
                </View>
              </View>
            </View>

            <View style={styles.profileBox}>
              <View style={styles.avatar}>
                <Building2 size={32} color="#FFFFFF" />
              </View>
              <View style={styles.indicator} />
            </View>
          </View>

          {/* Decorative Pattern */}
          <View style={styles.decorativePattern}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={styles.patternRow}>
                {[...Array(8)].map((_, j) => (
                  <View key={j} style={styles.patternDot} />
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Categories & Modules */}
        <View style={styles.gridContainer}>
          {adminSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.divider} />
              </View>

              <View style={styles.moduleGrid}>
                {section.modules.map((module) => (
                  <TouchableOpacity
                    key={module.id}
                    style={[styles.moduleCard, { backgroundColor: module.bgColor }]}
                    onPress={() => navigation.navigate(module.path)}
                  >
                    <View style={styles.iconWrapper}>
                      <module.icon size={22} color={module.color} strokeWidth={2.5} />
                    </View>
                    <Text style={styles.moduleTitle}>{module.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1B6B72', // Teal gradient base
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  infoBlock: {
    flex: 1,
  },
  clinicName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileBox: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  indicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#1B6B72',
  },
  decorativePattern: {
    position: 'absolute',
    right: -20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    opacity: 0.15,
  },
  patternRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  patternDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  gridContainer: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    marginTop: -20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 1.5,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 12,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moduleCard: {
    width: '30.5%',
    aspectRatio: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  moduleTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4B5563',
    textAlign: 'center',
  },
});
