import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Mail, Phone, MapPin, ChevronRight, Monitor, Smartphone, Building2, Briefcase, Info, Clock, IndianRupee } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { adminApiService, ClinicInfo } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { colors } from '../../../../shared/constants/colors';

interface ClinicSettingsScreenProps {
  navigation: any;
}

export const ClinicSettingsScreen: React.FC<ClinicSettingsScreenProps> = ({ navigation }) => {
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClinic = async () => {
    setLoading(true);
    try {
      const data = await adminApiService.getClinicInfo();
      setClinic(data);
    } catch (err) {
      console.error('❌ [CLINIC] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadClinic();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadClinic();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Clinic Info" onBackPress={() => navigation.goBack()} variant="admin" />
        <View style={styles.center}>
          <GearLoader text="Retrieving clinic profile..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Clinic Profile"
        onBackPress={() => navigation.goBack()}
        variant="admin"
        rightComponent={
          <TouchableOpacity onPress={() => Alert.alert('Edit Mode', 'Use the web portal to edit clinic master records.')}>
            <Text style={styles.saveButton}>Edit</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Clinic Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.logoWrapper}>
            <View style={styles.logo}>
              <Building2 size={40} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View style={styles.cameraBtn}>
              <Camera size={14} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.clinicNameMain}>{clinic?.name || 'Clinic Name'}</Text>
          <Text style={styles.clinicEmailSub}>{clinic?.email || 'No email set'}</Text>
        </View>

        {/* Vital Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Info size={14} color="#9CA3AF" />
            <Text style={styles.sectionTitleCap}>CORE DETAILS</Text>
          </View>

          <View style={styles.infoGroup}>
            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Building2 size={18} color={adminColors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.labelSmall}>OFFICIAL NAME</Text>
                <Text style={styles.valueLarge}>{clinic?.name}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <MapPin size={18} color={adminColors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.labelSmall}>ADDRESS</Text>
                <Text style={styles.valueLarge} numberOfLines={2}>{clinic?.address || 'Address not provided'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <IndianRupee size={18} color={adminColors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.labelSmall}>GST NUMBER</Text>
                <Text style={styles.valueLarge}>{clinic?.gst_number || 'N/A'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Communication Channels */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Phone size={14} color="#9CA3AF" />
            <Text style={styles.sectionTitleCap}>CONNECTIVITY</Text>
          </View>

          <View style={styles.infoGroup}>
            <TouchableOpacity style={styles.channelRow}>
              <View style={[styles.channelIcon, { backgroundColor: '#E0F2F2' }]}>
                <Mail size={20} color={adminColors.primary} />
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.labelSmall}>ADMIN EMAIL</Text>
                <Text style={styles.valueLarge}>{clinic?.email}</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.channelRow}>
              <View style={[styles.channelIcon, { backgroundColor: '#E0F2F2' }]}>
                <Phone size={20} color={adminColors.primary} />
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.labelSmall}>CONTACT PHONE</Text>
                <Text style={styles.valueLarge}>{clinic?.phone}</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Operating Hours - Professional List */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Clock size={14} color="#9CA3AF" />
            <Text style={styles.sectionTitleCap}>OPERATING HOURS</Text>
          </View>

          <View style={styles.hoursPlate}>
            {clinic?.timings ? (
              Object.entries(clinic.timings).map(([day, time]: [string, any]) => (
                <View key={day} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{day.toUpperCase()}</Text>
                  <View style={styles.timeCluster}>
                    {time.closed ? (
                      <Text style={styles.closedText}>CLOSED</Text>
                    ) : (
                      <Text style={styles.timeText}>{time.open} - {time.close}</Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noHours}>Hours not configured.</Text>
            )}
          </View>
        </View>

        <View style={{ height: 60 }} />
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: adminColors.primary,
  },
  content: {
    flex: 1,
  },
  identityCard: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logoWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: adminColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: adminColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  clinicNameMain: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  clinicEmailSub: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleCap: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  infoGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  valueLarge: {
    fontSize: 15,
    fontWeight: '600',
    color: '#344054',
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfo: {
    flex: 1,
  },
  hoursPlate: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
    width: 100,
  },
  timeCluster: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
  },
  closedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  noHours: {
    textAlign: 'center',
    padding: 20,
    color: '#9CA3AF',
    fontStyle: 'italic',
  }
});
