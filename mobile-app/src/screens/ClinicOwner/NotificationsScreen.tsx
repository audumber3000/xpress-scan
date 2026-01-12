import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { SafeAreaView as SafeAreaViewInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Bell, CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';
import { colors } from '../../constants/colors';

const { width: screenWidth } = Dimensions.get('window');

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data - replace with actual API call
  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const data = await apiService.getNotifications();
      
      // Mock data for demonstration
      const mockNotifications: Notification[] = [
        {
          id: '1',
          title: 'New Patient Registered',
          message: 'John Doe has been successfully registered in your clinic.',
          timestamp: '2 minutes ago',
          type: 'success',
          read: false,
        },
        {
          id: '2',
          title: 'Appointment Reminder',
          message: 'You have an appointment with Sarah Smith in 30 minutes.',
          timestamp: '25 minutes ago',
          type: 'info',
          read: false,
        },
        {
          id: '3',
          title: 'Payment Received',
          message: 'Payment of ₹2000 received from Michael Johnson.',
          timestamp: '1 hour ago',
          type: 'success',
          read: true,
        },
        {
          id: '4',
          title: 'System Update',
          message: 'New features have been added to your clinic dashboard.',
          timestamp: '3 hours ago',
          type: 'info',
          read: true,
        },
      ];

      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      // Slide in animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide out animation
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} color={colors.success} />;
      case 'warning':
        return <AlertCircle size={20} color={colors.warning} />;
      case 'error':
        return <AlertCircle size={20} color={colors.error} />;
      default:
        return <Info size={20} color={colors.primary} />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return colors.successLight;
      case 'warning':
        return colors.warningLight;
      case 'error':
        return colors.errorLight;
      default:
        return colors.primaryLight;
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <SafeAreaViewInsets style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={colors.gray700} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={24} color={colors.gray700} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Bell size={48} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyMessage}>
                You'll see your notifications here when they arrive
              </Text>
            </View>
          ) : (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.unreadCard,
                ]}
                onPress={() => markAsRead(notification.id)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationIcon}>
                  {getNotificationIcon(notification.type)}
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text
                      style={[
                        styles.notificationTitle,
                        !notification.read && styles.unreadTitle,
                      ]}
                    >
                      {notification.title}
                    </Text>
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.notificationMessage,
                      !notification.read && styles.unreadMessage,
                    ]}
                  >
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTimestamp}>
                    {notification.timestamp}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaViewInsets>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
    width: screenWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray500,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.gray700,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 24,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  unreadCard: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    flex: 1,
  },
  unreadTitle: {
    color: colors.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: 4,
  },
  unreadMessage: {
    color: colors.gray700,
  },
  notificationTimestamp: {
    fontSize: 12,
    color: colors.gray400,
  },
});
