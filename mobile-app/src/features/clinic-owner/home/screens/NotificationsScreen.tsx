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
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bell as BellIcon, Calendar, X } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { getAllScheduledNotifications } from '../../../../services/notifications';
import { format } from 'date-fns';

const { width: screenWidth } = Dimensions.get('window');
const VIOLET = '#2E2A85';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  scheduledAt?: string;
  type: 'appointment' | 'reminder' | 'info';
}

interface NotificationsScreenProps {
  visible?: boolean;
  onClose?: () => void;
  navigation?: any;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  visible = true,
  onClose,
  navigation,
}) => {
  const isNav = !!navigation;
  const [slideAnim] = useState(new Animated.Value(isNav ? 0 : screenWidth));
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
    if (!isNav) {
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
    }
  }, [visible, isNav]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleClose = () => {
    if (isNav) {
      navigation.goBack();
    } else {
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 250,
        useNativeDriver: true,
      }).start(() => onClose?.());
    }
  };

  if (!visible && !isNav) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        !isNav && { transform: [{ translateX: slideAnim }] },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={VIOLET} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerButton} />
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
              tintColor={VIOLET}
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
                <BellIcon size={40} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyMessage}>
                Your clinic updates and reminders will appear here.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={[
                  styles.cardIcon,
                  item.type === 'appointment' && styles.cardIconAppointment,
                ]}>
                  <Calendar size={20} color={VIOLET} />
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: VIOLET,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: VIOLET,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748B',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 100,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardIconAppointment: {
    backgroundColor: '#F5F3FF',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
