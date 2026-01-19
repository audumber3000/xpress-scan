import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Mail, Phone, MapPin, ChevronRight, Monitor, Smartphone } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';

interface ClinicSettingsScreenProps {
  navigation: any;
}

export const ClinicSettingsScreen: React.FC<ClinicSettingsScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Clinic Settings"
        onBackPress={() => navigation.goBack()}
        variant="admin"
        rightComponent={
          <TouchableOpacity>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Clinic Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>🏥</Text>
            </View>
            <View style={styles.cameraButton}>
              <Camera size={18} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.clinicName}>HealthFirst Clinic</Text>
          <Text style={styles.clinicLocation}>San Francisco, CA</Text>
          <TouchableOpacity style={styles.updateLogoButton}>
            <Text style={styles.updateLogoText}>Update Logo</Text>
          </TouchableOpacity>
        </View>

        {/* Clinic Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLINIC PROFILE</Text>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>CLINIC NAME</Text>
            <Text style={styles.infoValue}>HealthFirst Clinic</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>CLINIC ID</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>HF-9921-SF</Text>
              <TouchableOpacity style={styles.infoButton}>
                <View style={styles.infoDot} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Contact Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT DETAILS</Text>
          
          <TouchableOpacity style={styles.contactItem}>
            <View style={[styles.contactIcon, { backgroundColor: '#E0F2F2' }]}>
              <Mail size={20} color={adminColors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>EMAIL ADDRESS</Text>
              <Text style={styles.contactValue}>admin@healthfirst.com</Text>
            </View>
            <ChevronRight size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactItem}>
            <View style={[styles.contactIcon, { backgroundColor: '#E0F2F2' }]}>
              <Phone size={20} color={adminColors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>PHONE NUMBER</Text>
              <Text style={styles.contactValue}>+1(555) 0123-4567</Text>
            </View>
            <ChevronRight size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactItem}>
            <View style={[styles.contactIcon, { backgroundColor: '#E0F2F2' }]}>
              <MapPin size={20} color={adminColors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>PHYSICAL ADDRESS</Text>
              <Text style={styles.contactValue}>221B Baker St, San Francisco</Text>
            </View>
            <ChevronRight size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* Business Hours */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>BUSINESS HOURS</Text>
            <TouchableOpacity>
              <Text style={styles.editButton}>EDIT SCHEDULE</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.hoursCard}>
            <View style={styles.hourRow}>
              <Text style={styles.dayText}>Mon — Fri</Text>
              <Text style={styles.timeText}>09:00 AM — 06:00 PM</Text>
            </View>
            <View style={styles.hourRow}>
              <Text style={styles.dayText}>Saturday</Text>
              <Text style={styles.timeText}>10:00 AM — 02:00 PM</Text>
            </View>
            <View style={styles.hourRow}>
              <Text style={[styles.dayText, { color: '#EF4444' }]}>Sunday</Text>
              <Text style={[styles.timeText, { color: '#9CA3AF' }]}>Closed</Text>
            </View>
          </View>
        </View>

        {/* Device Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEVICE MANAGEMENT</Text>

          <View style={styles.deviceCard}>
            <View style={[styles.deviceIcon, { backgroundColor: '#E0F2F2' }]}>
              <Monitor size={24} color={adminColors.primary} />
            </View>
            <View style={styles.deviceInfo}>
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceName}>Admin Desktop...</Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
              <Text style={styles.deviceLocation}>San Francisco, CA • 192.168.1.1</Text>
              <Text style={styles.deviceStatus}>• ONLINE</Text>
            </View>
            <TouchableOpacity style={styles.revokeButton}>
              <Text style={styles.revokeText}>REVOKE</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.deviceCard}>
            <View style={[styles.deviceIcon, { backgroundColor: '#E0F2F2' }]}>
              <Smartphone size={24} color={adminColors.primary} />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>iPhone 15 Pro Max</Text>
              <Text style={styles.deviceLocation}>Los Angeles, CA • 172.20.10.4</Text>
              <Text style={styles.deviceLastSeen}>LAST: YESTERDAY, 4:30 PM</Text>
            </View>
            <TouchableOpacity style={styles.revokeButton}>
              <Text style={styles.revokeText}>REVOKE</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutAllButton}>
            <Text style={styles.logoutAllText}>🚪 Logout from all devices</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>VERSION 2.4.0 (BUILD 847)</Text>

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
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: adminColors.primary,
  },
  content: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: adminColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: adminColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  clinicName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  clinicLocation: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  updateLogoButton: {
    backgroundColor: adminColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  updateLogoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editButton: {
    fontSize: 12,
    fontWeight: '600',
    color: adminColors.primary,
    letterSpacing: 0.5,
  },
  infoItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  hoursCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  deviceLocation: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: adminColors.primary,
  },
  deviceLastSeen: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  revokeButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  revokeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  logoutAllButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  logoutAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  versionText: {
    fontSize: 11,
    color: '#D1D5DB',
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 0.5,
  },
});
