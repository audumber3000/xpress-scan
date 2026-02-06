import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageSquare, Bell, Mail, ChevronRight } from 'lucide-react-native';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { showAlert } from '../../../../shared/components/alertService';
import { checkNotificationPermissions } from '../../../../services/notifications/permissions';
import { colors } from '../../../../shared/constants/colors';

const NOTIFICATION_EMAIL_KEY = '@molarplus_notification_email';

interface NotificationSettingsScreenProps {
  navigation: any;
}

export const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({
  navigation,
}) => {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkNotificationPermissions().then((s) => setPushEnabled(s.granted));
    }, [])
  );

  const loadPreferences = async () => {
    try {
      const [pushStatus, storedEmail] = await Promise.all([
        checkNotificationPermissions(),
        AsyncStorage.getItem(NOTIFICATION_EMAIL_KEY),
      ]);
      setPushEnabled(pushStatus.granted);
      setEmailEnabled(storedEmail === null ? true : storedEmail === 'true');
    } catch (err) {
      console.error('Load notification prefs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePushToggle = () => {
    Linking.openSettings();
  };

  const handleEmailToggle = async (value: boolean) => {
    setEmailEnabled(value);
    await AsyncStorage.setItem(NOTIFICATION_EMAIL_KEY, String(value));
  };

  const handleSmsToggle = (value: boolean) => {
    showAlert('Coming Soon', 'SMS notifications will be available in a future update.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Notification Settings"
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Choose how you want to receive appointment reminders and updates.
        </Text>

        {/* Push Notifications */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
              <Bell size={22} color={colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Push Notifications</Text>
              <Text style={styles.rowSubtitle}>
                App alerts on your device
              </Text>
            </View>
            <TouchableOpacity
              onPress={handlePushToggle}
              style={styles.touchTarget}
              activeOpacity={0.7}
            >
              <Switch
                value={pushEnabled}
                onValueChange={handlePushToggle}
                trackColor={{ false: '#E5E7EB', true: colors.primaryBg }}
                thumbColor={pushEnabled ? colors.primary : '#9CA3AF'}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.settingsLink}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.settingsLinkText}>Open device settings</Text>
            <ChevronRight size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Email Notifications */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: '#E0F2F2' }]}>
              <Mail size={22} color={colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Email Notifications</Text>
              <Text style={styles.rowSubtitle}>
                Receive updates via email
              </Text>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={handleEmailToggle}
              trackColor={{ false: '#E5E7EB', true: colors.primaryBg }}
              thumbColor={emailEnabled ? colors.primary : '#9CA3AF'}
            />
          </View>
        </View>

        {/* SMS Notifications */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: '#FEF3C7' }]}>
              <MessageSquare size={22} color="#F59E0B" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>SMS Notifications</Text>
              <Text style={[styles.rowSubtitle, { color: '#F59E0B' }]}>
                Coming soon
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleSmsToggle(true)}
              style={styles.touchTarget}
              activeOpacity={0.7}
            >
              <Switch
                value={smsEnabled}
                onValueChange={handleSmsToggle}
                trackColor={{ false: '#E5E7EB', true: '#FEF3C7' }}
                thumbColor={smsEnabled ? '#F59E0B' : '#9CA3AF'}
              />
            </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  touchTarget: {
    padding: 4,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 4,
  },
  settingsLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
