import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Phone, Mail, Building2, Clock } from 'lucide-react-native';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { adminApiService, ClinicInfo } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { colors } from '../../../../shared/constants/colors';

interface ClinicInformationScreenProps {
  navigation: any;
}

export const ClinicInformationScreen: React.FC<ClinicInformationScreenProps> = ({ navigation }) => {
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClinic = async () => {
    try {
      const data = await adminApiService.getClinicInfo();
      setClinic(data);
    } catch (err) {
      console.error('❌ [CLINIC_INFO] Load error:', err);
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
        <ScreenHeader title="Clinic Information" onBackPress={() => navigation.goBack()} />
        <View style={styles.center}>
          <GearLoader text="Loading clinic details..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Clinic Information" onBackPress={() => navigation.goBack()} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Clinic Name Card */}
        <View style={styles.heroCard}>
          <View style={styles.logoCircle}>
            <Building2 size={32} color={colors.white} />
          </View>
          <Text style={styles.clinicName}>{clinic?.name || 'Clinic Name'}</Text>
          {clinic?.email ? (
            <Text style={styles.clinicEmail}>{clinic.email}</Text>
          ) : null}
        </View>

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ADDRESS & CONTACT</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.iconWrap}>
                <MapPin size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.label}>Address</Text>
                <Text style={styles.value}>{clinic?.address || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.iconWrap}>
                <Phone size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{clinic?.phone || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.iconWrap}>
                <Mail size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{clinic?.email || 'Not set'}</Text>
              </View>
            </View>
            {clinic?.gst_number ? (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.iconWrap}>
                    <Building2 size={18} color={colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.label}>GST Number</Text>
                    <Text style={styles.value}>{clinic.gst_number}</Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Operating Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OPERATING HOURS</Text>
          <View style={styles.card}>
            {clinic?.timings && Object.keys(clinic.timings).length > 0 ? (
              Object.entries(clinic.timings).map(([day, time]: [string, any]) => (
                <View key={day} style={styles.hoursRow}>
                  <Text style={styles.dayLabel}>{day}</Text>
                  {time?.closed ? (
                    <Text style={styles.closedText}>Closed</Text>
                  ) : (
                    <Text style={styles.hoursText}>
                      {time?.open || '—'} – {time?.close || '—'}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.noHours}>Hours not configured</Text>
            )}
          </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  clinicName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  clinicEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 54,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  hoursText: {
    fontSize: 14,
    color: '#6B7280',
  },
  closedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  noHours: {
    textAlign: 'center',
    padding: 20,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
