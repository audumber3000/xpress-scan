import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MoreVertical, Building2, Bell, CreditCard, LogOut, BellRing, User } from 'lucide-react-native';
import { useAuth } from '../../../../app/AuthContext';
import {
  sendLocalNotification,
  requestNotificationPermissionsWithUI
} from '../../../../services/notifications';
import { ProfileHeader } from '../components/ProfileHeader';
import { EditProfileModal } from '../components/EditProfileModal';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsMenuItem } from '../components/SettingsMenuItem';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { AppSkeleton } from '../../../../shared/components/Skeleton';
import { ClinicSwitcherSheet } from '../../../../shared/components/ClinicSwitcherSheet';
import { resolveUserPhoto } from '../../../../shared/utils/avatar';
import { ClinicInfo } from '../../../../services/api/admin.api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { planBadge } from '../../../../shared/utils/planBadge';
import { usePostHog } from 'posthog-react-native';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const posthog = usePostHog();
  const { user, backendUser, logout, isLoading, switchBranch, refreshBackendUser } = useAuth();
  const subBadge = planBadge(backendUser?.clinic);
  const [showClinicSwitcher, setShowClinicSwitcher] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const handleEditProfile = () => {
    setShowEditProfile(true);
  };

  const handleClinicInfo = () => {
    navigation.navigate('ClinicInformation');
  };

  const handleNotificationSettings = () => {
    navigation.navigate('NotificationSettings');
  };

  const handleSubscription = () => {
    posthog.capture('Subscription Button Clicked', { source: 'Mobile Profile' });
    navigation.navigate('Admin');
    navigation.navigate('Subscription');
  };

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleClinicSelected = async (clinic: ClinicInfo) => {
    try {
      await switchBranch(clinic.id);
      setShowClinicSwitcher(false);
    } catch (error) {
      console.error('Error switching clinic:', error);
    }
  };

  const handleTestNotification = async () => {
    try {
      console.log('🔔 Test notification button pressed');

      // First check/request permissions
      const hasPermission = await requestNotificationPermissionsWithUI();
      console.log('📋 Permission result:', hasPermission);

      if (!hasPermission) {
        console.log('❌ Permission denied, aborting notification');
        return; // User denied or needs to enable in settings
      }

      console.log('📤 Sending notification...');

      // Send the notification
      const notificationId = await sendLocalNotification({
        title: '🦷 Test Notification',
        body: 'This is a test local notification from MolarPlus!',
        data: { type: 'test' },
      });

      console.log('✅ Notification sent with ID:', notificationId);
      showAlert('Success', 'Notification sent! Check your notification tray.');
    } catch (error) {
      console.error('❌ Notification error:', error);
      showAlert('Error', `Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Prefer the backend name so an in-app profile edit reflects immediately
  // (Firebase displayName isn't updated by our PATCH /auth/me).
  const userName = backendUser?.name || user?.displayName || 'Dr. Aris Thorne';

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        topInset
        title="Settings"
        titleIcon={<User size={22} />}
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity style={styles.menuButtonPrimary}>
            <MoreVertical size={24} color={colors.white} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <AppSkeleton show={isLoading} width="100%" height={200} radius={0}>
          <ProfileHeader
            name={userName}
            role={backendUser?.role?.toUpperCase() || "LEAD DENTIST"}
            clinic={backendUser?.clinic?.name || ""}
            photoURL={resolveUserPhoto(backendUser, user)}
            avatarSeed={user?.email || backendUser?.email}
            onEditPress={handleEditProfile}
          />
        </AppSkeleton>

        {/* Settings Section - Combined */}
        {isLoading ? (
          <View style={{ padding: 20 }}>
            <AppSkeleton show={true} width="100%" height={60} radius={12} />
            <View style={{ height: 12 }} />
            <AppSkeleton show={true} width="100%" height={60} radius={12} />
            <View style={{ height: 12 }} />
            <AppSkeleton show={true} width="100%" height={60} radius={12} />
          </View>
        ) : (
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
              icon={Building2}
              iconColor={colors.primary}
              iconBgColor={colors.primaryBg}
              title="Switch Branch"
              subtitle={`Current: ${backendUser?.clinic?.name || 'Main'}`}
              onPress={() => setShowClinicSwitcher(true)}
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

            {/* Shown on both platforms. It used to be hidden on iOS entirely,
                which left that build unable to answer "which plan am I on?" —
                account information Apple has never objected to. What the screen
                behind it does NOT do is sell anything, on either platform.

                The badge used to read PRO or FREE off a literal comparison, so
                every Plus clinic — every paying customer — was labelled FREE.
                It now comes from planBadge, the same answer the Control Center
                and the home header show. */}
            <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>ACCOUNTING</Text>
            <SettingsMenuItem
              icon={CreditCard}
              iconColor={colors.primary}
              iconBgColor={colors.primaryBg}
              title="Subscription & Billing"
              subtitle="Your plan and what it includes"
              badge={subBadge.label.toUpperCase()}
              badgeColor={subBadge.fg}
              onPress={handleSubscription}
            />
          </View>
        )}

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

      <ClinicSwitcherSheet
        isVisible={showClinicSwitcher}
        onClose={() => setShowClinicSwitcher(false)}
        onClinicSelected={handleClinicSelected}
      />

      <EditProfileModal
        visible={showEditProfile}
        user={backendUser}
        onClose={() => setShowEditProfile(false)}
        onSaved={() => refreshBackendUser()}
      />
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
  menuButtonPrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
    borderRadius: 10,
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
