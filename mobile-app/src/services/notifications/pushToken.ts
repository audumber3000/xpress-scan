import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface PushTokenResult {
    token?: string;
    error?: string;
}

/**
 * Get Expo Push Token for remote notifications
 * Requires permissions to be granted first
 */
export async function getExpoPushToken(): Promise<PushTokenResult> {
    try {
        // Get project ID from app config
        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId;

        if (!projectId) {
            console.warn('No Expo project ID found. Push notifications may not work correctly.');
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
        });

        console.log('✅ Expo Push Token:', tokenData.data);
        return { token: tokenData.data };
    } catch (error) {
        console.error('❌ Error getting push token:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Register device token with your backend
 * Call this after getting the push token
 */
export async function registerPushTokenWithBackend(
    token: string,
    userId: string
): Promise<boolean> {
    try {
        // TODO: Replace with your actual backend endpoint
        const response = await fetch('YOUR_BACKEND_URL/api/push-tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token,
                userId,
                platform: Platform.OS,
                deviceInfo: {
                    os: Platform.OS,
                    version: Platform.Version,
                },
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to register push token');
        }

        console.log('✅ Push token registered with backend');
        return true;
    } catch (error) {
        console.error('❌ Error registering push token:', error);
        return false;
    }
}

/**
 * Unregister push token (e.g., on logout)
 */
export async function unregisterPushToken(token: string): Promise<boolean> {
    try {
        // TODO: Replace with your actual backend endpoint
        const response = await fetch('YOUR_BACKEND_URL/api/push-tokens', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            throw new Error('Failed to unregister push token');
        }

        console.log('✅ Push token unregistered');
        return true;
    } catch (error) {
        console.error('❌ Error unregistering push token:', error);
        return false;
    }
}
