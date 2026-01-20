import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MoreVertical, Building2, Bell, CreditCard, LogOut } from 'lucide-react-native';
import { useAuth } from '../../../../app/AuthContext';
import { ProfileHeader } from '../components/ProfileHeader';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsMenuItem } from '../components/SettingsMenuItem';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Edit profile functionality coming soon!');
  };

  const handleClinicInfo = () => {
    Alert.alert('Clinic Information', 'Clinic information screen coming soon!');
  };

  const handleNotificationSettings = () => {
    Alert.alert('Notification Settings', 'Notification settings coming soon!');
  };

  const handleSubscription = () => {
    Alert.alert('Subscription & Billing', 'Subscription management coming soon!');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const userName = user?.displayName || 'Dr. Aris Thorne';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Settings"
        rightComponent={
          <TouchableOpacity style={styles.menuButton}>
            <MoreVertical size={24} color="#111827" />
          </TouchableOpacity>
        }
      />

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <ProfileHeader
          name={userName}
          role="LEAD DENTIST"
          clinic="Clino Health"
          onEditPress={handleEditProfile}
        />

        {/* Settings Section - Combined */}
        <View style={styles.settingsCard}>
          {/* Clinic Management */}
          <Text style={styles.sectionTitle}>CLINIC MANAGEMENT</Text>
          <SettingsMenuItem
            icon={Building2}
            iconColor={colors.primary}
            iconBgColor={colors.primaryBg}
            title="Clinic Information"
            subtitle="Address, hours & contact"
            onPress={handleClinicInfo}
          />
          <View style={styles.separator} />
          <SettingsMenuItem
            icon={Bell}
            iconColor={colors.primary}
            iconBgColor={colors.primaryBg}
            title="Notification Settings"
            subtitle="Push, Email & SMS alerts"
            onPress={handleNotificationSettings}
          />

          {/* Accounting */}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>ACCOUNTING</Text>
          <SettingsMenuItem
            icon={CreditCard}
            iconColor={colors.primary}
            iconBgColor={colors.primaryBg}
            title="Subscription & Billing"
            subtitle="Manage plans & invoices"
            badge="PRO"
            badgeColor="#10B981"
            onPress={handleSubscription}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>MOLARPLUS DENTAL MANAGEMENT</Text>
          <Text style={styles.footerVersion}>Version 1.0.4 (Build 82)</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 32,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleSpacing: {
    marginTop: 24,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 84,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingVertical: 16,
  },
  footerTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D1D5DB',
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 11,
    color: '#D1D5DB',
  },
});
