import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
    requestNotificationPermissions,
    setupAndroidNotificationChannel,
} from '../services/notifications/permissions';
import { getExpoPushToken, registerPushTokenWithBackend } from '../services/notifications/pushToken';

export interface PushNotificationState {
    expoPushToken?: string;
    notification?: Notifications.Notification;
    permissionGranted: boolean;
    /** In-app path from the most recently tapped push, if it carried one. */
    pendingLink?: string;
    /** Clears pendingLink once the app has navigated, so it fires only once. */
    consumePendingLink: () => void;
}

export function usePushNotifications(): PushNotificationState {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<Notifications.Notification | undefined>();
    // Set when a push is tapped; the app shell reads it, navigates, and clears
    // it with consumePendingLink().
    const [pendingLink, setPendingLink] = useState<string | undefined>();
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
                // Get push token and register with backend
                const tokenResult = await getExpoPushToken();
                if (tokenResult.token) {
                    setExpoPushToken(tokenResult.token);
                    await registerPushTokenWithBackend(tokenResult.token);
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
            const data = response.notification.request.content.data as { link?: string } | undefined;

            // The notification centre stamps an in-app path onto every push it
            // sends (`{"link": "/appointments"}`), so a tap can land on the
            // thing the notification is about rather than just opening the app.
            // Surfaced as state instead of navigating here: this hook has no
            // navigator, and grabbing one would tie a notifications concern to
            // whatever the navigation library happens to be this month.
            if (data?.link) setPendingLink(data.link);
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
        pendingLink,
        consumePendingLink: () => setPendingLink(undefined),
    };
}
