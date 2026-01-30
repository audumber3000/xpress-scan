import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
    requestNotificationPermissions,
    setupAndroidNotificationChannel,
} from '../services/notifications/permissions';
import { getExpoPushToken } from '../services/notifications/pushToken';

export interface PushNotificationState {
    expoPushToken?: string;
    notification?: Notifications.Notification;
    permissionGranted: boolean;
}

export function usePushNotifications(): PushNotificationState {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<Notifications.Notification | undefined>();
    const [permissionGranted, setPermissionGranted] = useState(false);

    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    useEffect(() => {
        // Initialize notifications
        const initializeNotifications = async () => {
            // Setup Android channels first
            await setupAndroidNotificationChannel();

            // Request permissions
            const permissionResult = await requestNotificationPermissions();
            setPermissionGranted(permissionResult.granted);

            if (permissionResult.granted) {
                // Get push token
                const tokenResult = await getExpoPushToken();
                if (tokenResult.token) {
                    setExpoPushToken(tokenResult.token);
                    // TODO: Send token to your backend
                    // await registerPushTokenWithBackend(tokenResult.token, userId);
                }
            } else {
                console.log('⚠️ Notification permissions not granted');
            }
        };

        initializeNotifications();

        // Listen for incoming notifications while app is foregrounded
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
            console.log('📬 Notification Received:', notification);
        });

        // Listen for user interaction with notification (tapping it)
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('👆 Notification Tapped:', response);
            // Here you can navigate to a specific screen based on response.notification.request.content.data
            const data = response.notification.request.content.data;

            // Example: Navigate based on notification type
            if (data?.type === 'appointment_reminder') {
                // navigation.navigate('AppointmentDetails', { id: data.appointmentId });
            }
        });

        return () => {
            notificationListener.current && notificationListener.current.remove();
            responseListener.current && responseListener.current.remove();
        };
    }, []);

    return {
        expoPushToken,
        notification,
        permissionGranted,
    };
}
