import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bell, Calendar, X } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { getAllScheduledNotifications } from '../../../../services/notifications';
import { format } from 'date-fns';

const { width: screenWidth } = Dimensions.get('window');

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  scheduledAt?: string;
  type: 'appointment' | 'reminder' | 'info';
}

interface NotificationsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  visible,
  onClose,
}) => {
  const [slideAnim] = useState(new Animated.Value(screenWidth));
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const scheduled = await getAllScheduledNotifications();
      const items: NotificationItem[] = scheduled.map((req) => {
        const content = req.content;
        const trigger = req.trigger as any;
        let scheduledAt: string | undefined;
        const triggerDate = trigger?.date ?? trigger?.timestamp;
        if (triggerDate) {
          try {
            scheduledAt = format(new Date(triggerDate), 'MMM d, h:mm a');
          } catch {
            scheduledAt = undefined;
          }
        }
        const data = content.data || {};
        const type = data.type === 'appointment_reminder' ? 'appointment' : 'reminder';
        return {
          id: req.identifier,
          title: content.title || 'Notification',
          message: content.body || '',
          scheduledAt,
          type,
        };
      });
      setNotifications(items);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible, loadNotifications]);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        { transform: [{ translateX: slideAnim }] },
      ]}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.contentContainer,
            notifications.length === 0 && !loading && styles.emptyContainer,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {loading ? (
            <View style={styles.loadingState}>
              <View style={styles.loadingDot} />
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Bell size={40} color={colors.gray400} />
              </View>
              <Text style={styles.emptyTitle}>You don't have any notifications</Text>
              <Text style={styles.emptyMessage}>
                Appointment reminders and updates will appear here when scheduled.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={[
                  styles.cardIcon,
                  item.type === 'appointment' && styles.cardIconAppointment,
                ]}>
                  <Calendar size={20} color={colors.primary} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardMessage} numberOfLines={2}>
                    {item.message}
                  </Text>
                  {item.scheduledAt ? (
                    <Text style={styles.cardTime}>{item.scheduledAt}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    zIndex: 1000,
  },
  container: {
    flex: 1,
    width: screenWidth,
    backgroundColor: colors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.primary,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 15,
    color: colors.gray500,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 15,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardIconAppointment: {
    backgroundColor: colors.primaryBg,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 12,
    color: colors.gray400,
  },
});
