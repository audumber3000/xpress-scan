import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../../config/api.config';

export interface PushTokenResult {
    token?: string;
    error?: string;
}

const PUSH_TOKEN_KEY = '@molarplus/pushToken';

/**
 * Get Expo Push Token for remote notifications
 * Requires permissions to be granted first
 */
export async function getExpoPushToken(): Promise<PushTokenResult> {
    try {
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
        // Cache locally so we can unregister on logout
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, tokenData.data);
        return { token: tokenData.data };
    } catch (error) {
        console.error('❌ Error getting push token:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Register device token with backend
 */
export async function registerPushTokenWithBackend(token: string): Promise<boolean> {
    try {
        const authToken = await AsyncStorage.getItem('access_token');
        if (!authToken) {
            console.warn('⚠️ No auth token — skipping push token registration');
            return false;
        }

        const baseURL = `${getApiBaseUrl()}/api/v1`;
        const response = await fetch(`${baseURL}/push/register-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                token,
                platform: Platform.OS,
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
 * Unregister push token (call on logout)
 */
export async function unregisterPushToken(): Promise<boolean> {
    try {
        const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
        if (!token) return true;

        const authToken = await AsyncStorage.getItem('access_token');
        if (!authToken) return true;

        const baseURL = `${getApiBaseUrl()}/api/v1`;
        const response = await fetch(`${baseURL}/push/unregister-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            throw new Error('Failed to unregister push token');
        }

        await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
        console.log('✅ Push token unregistered');
        return true;
    } catch (error) {
        console.error('❌ Error unregistering push token:', error);
        return false;
    }
}
