import * as Notifications from 'expo-notifications';

// Configure how notifications should handle when the app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,  // Enable sound for heads-up notifications
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Re-export all notification utilities
export * from './permissions';
export * from './pushToken';
export * from './local';

// Legacy exports for backward compatibility
export { sendLocalNotification as scheduleLocalNotification } from './local';
export { cancelAllNotifications, setBadgeCount } from './local';

