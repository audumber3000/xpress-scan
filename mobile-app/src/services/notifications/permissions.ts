import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert, Linking } from 'react-native';

export interface NotificationPermissionStatus {
    granted: boolean;
    canAskAgain: boolean;
    status: 'granted' | 'denied' | 'undetermined';
}

/**
 * Check current notification permission status
 */
export async function checkNotificationPermissions(): Promise<NotificationPermissionStatus> {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();

    return {
        granted: status === 'granted',
        canAskAgain,
        status: status as 'granted' | 'denied' | 'undetermined',
    };
}

/**
 * Request notification permissions from the user
 * Shows native permission dialog
 */
export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
    if (!Device.isDevice) {
        console.warn('Notifications require a physical device');
        return {
            granted: false,
            canAskAgain: false,
            status: 'denied',
        };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    // If already granted, return immediately
    if (existingStatus === 'granted') {
        return {
            granted: true,
            canAskAgain: false,
            status: 'granted',
        };
    }

    // Request permissions
    const { status, canAskAgain } = await Notifications.requestPermissionsAsync();

    return {
        granted: status === 'granted',
        canAskAgain,
        status: status as 'granted' | 'denied' | 'undetermined',
    };
}

/**
 * Request permissions with user-friendly error handling
 * Shows alerts if permission is denied
 */
export async function requestNotificationPermissionsWithUI(): Promise<boolean> {
    // Check existing status first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    // If already granted, return immediately
    if (existingStatus === 'granted') {
        console.log('✅ Notification permissions already granted');
        return true;
    }

    // If permanently denied (user selected "Don't ask again")
    if (existingStatus === 'denied') {
        const { canAskAgain } = await Notifications.getPermissionsAsync();

        if (!canAskAgain) {
            Alert.alert(
                'Notifications Disabled',
                'Please enable notifications in your device settings to receive important updates.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                ]
            );
            return false;
        }
    }

    // Request permissions (will show native dialog)
    const { status: newStatus } = await Notifications.requestPermissionsAsync();

    if (newStatus === 'granted') {
        console.log('✅ Notification permissions granted');
        return true;
    }

    // User denied this time
    console.log('⚠️ Notification permissions denied');
    return false;
}

/**
 * Setup Android notification channel
 * Required for Android to show notifications properly
 */
export async function setupAndroidNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
        // Default channel - MAX importance for heads-up notifications
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#4F46E5',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
            enableLights: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // Appointments channel - MAX importance for urgent reminders
        await Notifications.setNotificationChannelAsync('appointments', {
            name: 'Appointments',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#10B981',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
            enableLights: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // Reminders channel - HIGH importance
        await Notifications.setNotificationChannelAsync('reminders', {
            name: 'Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250],
            lightColor: '#F59E0B',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        console.log('✅ Android notification channels configured');
    }
}
