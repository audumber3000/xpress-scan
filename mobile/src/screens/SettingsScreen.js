import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { 
  User, 
  Building2, 
  Lock, 
  Bell, 
  ChevronRight,
  LogOut
} from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';

const SettingsItem = ({ icon: Icon, title, subtitle, onPress, showArrow = true }) => {
  return (
    <TouchableOpacity 
      style={styles.settingsItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Icon size={20} color="#6b7280" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle && (
          <Text style={styles.itemSubtitle}>{subtitle}</Text>
        )}
      </View>
      {showArrow && <ChevronRight size={20} color="#9ca3af" />}
    </TouchableOpacity>
  );
};

const NotificationItem = ({ icon: Icon, title, subtitle, value, onValueChange }) => {
  return (
    <View style={styles.settingsItem}>
      <View style={styles.iconContainer}>
        <Icon size={20} color="#6b7280" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle && (
          <Text style={styles.itemSubtitle}>{subtitle}</Text>
        )}
      </View>
      <Switch
        value={Boolean(value)}
        onValueChange={onValueChange}
        trackColor={{ false: '#e5e7eb', true: '#16a34a' }}
        thumbColor={'#ffffff'}
        ios_backgroundColor="#e5e7eb"
      />
    </View>
  );
};

const SettingsScreen = () => {
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [paymentNotifications, setPaymentNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" subtitle="Manage your preferences" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileContent}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>DS</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Dr. John Smith</Text>
              <Text style={styles.profileEmail}>john.smith@example.com</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Settings */}
        <Text style={styles.sectionLabel}>Account Settings</Text>
        <View style={styles.settingsCard}>
          <SettingsItem icon={User} title="Edit Profile" />
          <SettingsItem icon={Building2} title="Clinic Settings" />
          <SettingsItem icon={Lock} title="Change Password" />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.settingsCard}>
          <NotificationItem 
            icon={Bell} 
            title="Appointment Reminders" 
            subtitle="Get notified about upcoming appointments"
            value={appointmentReminders}
            onValueChange={setAppointmentReminders}
          />
          <NotificationItem 
            icon={Bell} 
            title="Payment Notifications" 
            subtitle="Alerts for new payments"
            value={paymentNotifications}
            onValueChange={setPaymentNotifications}
          />
          <NotificationItem 
            icon={Bell} 
            title="Email Notifications" 
            subtitle="Receive updates via email"
            value={emailNotifications}
            onValueChange={setEmailNotifications}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton}>
          <View style={styles.logoutContent}>
            <LogOut size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
    marginTop: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: '#16a34a',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 18,
  },
  profileEmail: {
    color: '#6b7280',
    fontSize: 14,
  },
  editButton: {
    color: '#16a34a',
    fontWeight: '500',
  },
  sectionLabel: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 14,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    color: '#111827',
    fontWeight: '500',
  },
  itemSubtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default SettingsScreen;
