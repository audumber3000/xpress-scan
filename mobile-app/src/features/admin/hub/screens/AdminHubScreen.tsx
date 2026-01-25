import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Briefcase, Calendar, Users, DollarSign, Monitor, Settings, Lock, MapPin, Clock } from 'lucide-react-native';
import { AdminModuleCard } from '../components/AdminModuleCard';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService, ClinicInfo, StaffMember } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { format } from 'date-fns';

interface AdminHubScreenProps {
  navigation: any;
}

export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ navigation }) => {
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [clinicData, staffData] = await Promise.all([
        adminApiService.getClinicInfo(),
        adminApiService.getStaff()
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

  useEffect(() => {
    loadData();
  }, []);

  const isOpen = useMemo(() => {
    if (!clinic?.timings) return true;
    const now = new Date();
    const dayName = format(now, 'EEEE').toLowerCase();
    const hours = clinic.timings[dayName];

    if (!hours || hours.closed) return false;

    const [nowH, nowM] = [now.getHours(), now.getMinutes()];
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);

    const nowTotal = nowH * 60 + nowM;
    const openTotal = openH * 60 + openM;
    const closeTotal = closeH * 60 + closeM;

    return nowTotal >= openTotal && nowTotal <= closeTotal;
  }, [clinic]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <GearLoader text="Opening Admin Hub..." />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[adminColors.gradientStart, adminColors.gradientEnd]}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>System Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.clinicInfo}>
          <View style={styles.clinicTextSection}>
            <Text style={styles.clinicName} numberOfLines={1}>
              {clinic?.name || 'Clinic Profile'}
            </Text>
            <Text style={styles.clinicLocation} numberOfLines={1}>
              <MapPin size={14} color="rgba(255, 255, 255, 0.8)" /> {clinic?.address || 'Address not set'}
            </Text>
            <View style={styles.clinicBadges}>
              <View style={[styles.badge, !isOpen && { backgroundColor: 'rgba(239, 68, 68, 0.25)' }]}>
                <View style={[styles.statusDot, { backgroundColor: isOpen ? '#10B981' : '#EF4444' }]} />
                <Text style={styles.badgeText}>{isOpen ? 'Open' : 'Closed'}</Text>
              </View>
              <View style={styles.badge}>
                <Users size={14} color="#FFFFFF" />
                <Text style={styles.badgeText}>{staffCount} Staff</Text>
              </View>
            </View>
          </View>
          <View style={styles.clinicIconContainer}>
            <View style={styles.clinicIcon}>
              <Briefcase size={28} color="#FFFFFF" />
            </View>
            <View style={[styles.onlineIndicator, { backgroundColor: isOpen ? '#10B981' : '#EF4444' }]} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminColors.primary} />
        }
      >
        {/* Admin Hub Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Main Hub</Text>
            <Text style={styles.sectionSubtitle}>MANAGEMENT</Text>
          </View>

          <View style={styles.modulesGrid}>
            <AdminModuleCard
              icon={Calendar}
              iconColor={adminColors.attendance}
              backgroundColor={adminColors.attendanceBg}
              title="Attendance"
              onPress={() => navigation.navigate('Attendance')}
            />
            <AdminModuleCard
              icon={Users}
              iconColor={adminColors.staff}
              backgroundColor={adminColors.staffBg}
              title="Staff Management"
              onPress={() => navigation.navigate('StaffManagement')}
            />
            <AdminModuleCard
              icon={DollarSign}
              iconColor={adminColors.treatments}
              backgroundColor={adminColors.treatmentsBg}
              title="Treatments & Pricing"
              onPress={() => navigation.navigate('TreatmentsPricing')}
            />
            <AdminModuleCard
              icon={Monitor}
              iconColor={adminColors.subscription}
              backgroundColor={adminColors.subscriptionBg}
              title="Subscription"
              onPress={() => navigation.navigate('Subscription')}
            />
            <AdminModuleCard
              icon={Settings}
              iconColor={adminColors.settings}
              backgroundColor={adminColors.settingsBg}
              title="Clinic Settings"
              onPress={() => navigation.navigate('ClinicSettings')}
            />
            <AdminModuleCard
              icon={Lock}
              iconColor={adminColors.permissions}
              backgroundColor={adminColors.permissionsBg}
              title="Permissions"
              onPress={() => navigation.navigate('Permissions')}
            />
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  clinicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clinicTextSection: {
    flex: 1,
    marginRight: 16,
  },
  clinicName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  clinicLocation: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clinicBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clinicIconContainer: {
    position: 'relative',
  },
  clinicIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
