import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Briefcase, Calendar, Users, DollarSign, Monitor, Settings, Lock, Clock } from 'lucide-react-native';
import { AdminModuleCard } from '../components/AdminModuleCard';
import { adminColors } from '../../../../shared/constants/adminColors';

interface AdminHubScreenProps {
  navigation: any;
}

export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ navigation }) => {
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
          <Text style={styles.headerTitle}>All clinics</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.clinicInfo}>
          <View style={styles.clinicTextSection}>
            <Text style={styles.clinicName}>BrightSmile Clinic</Text>
            <Text style={styles.clinicLocation}>📍 London, Marylebone NW1</Text>
            <View style={styles.clinicBadges}>
              <View style={styles.badge}>
                <View style={styles.greenDot} />
                <Text style={styles.badgeText}>Open</Text>
              </View>
              <View style={styles.badge}>
                <Users size={14} color="#FFFFFF" />
                <Text style={styles.badgeText}>12 Staff</Text>
              </View>
            </View>
          </View>
          <View style={styles.clinicIconContainer}>
            <View style={styles.clinicIcon}>
              <Briefcase size={28} color="#FFFFFF" />
            </View>
            <View style={styles.onlineIndicator} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Admin Hub Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Admin Hub</Text>
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
  },
  clinicName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  clinicLocation: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
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
    gap: 4,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
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
    backgroundColor: '#10B981',
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
