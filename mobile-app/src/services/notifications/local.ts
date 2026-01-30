import * as Notifications from 'expo-notifications';

export type NotificationChannel = 'default' | 'appointments' | 'reminders';

export interface LocalNotificationOptions {
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: boolean;
    badge?: number;
    channelId?: NotificationChannel;
}

export interface ScheduledNotificationOptions extends LocalNotificationOptions {
    trigger: {
        seconds?: number;
        date?: Date;
        repeats?: boolean;
        channelId?: string;
    };
}

/**
 * Schedule a local notification immediately
 */
export async function sendLocalNotification(
    options: LocalNotificationOptions
): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: options.title,
            body: options.body,
            data: options.data || {},
            sound: options.sound !== false ? 'default' : undefined,
            badge: options.badge,
            priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // null means immediate
    });

    console.log('📬 Local notification sent:', notificationId);
    return notificationId;
}

/**
 * Schedule a notification for a specific time
 */
export async function scheduleNotification(
    options: ScheduledNotificationOptions
): Promise<string> {
    let trigger: any = null;

    if (options.trigger.date) {
        // Schedule for specific date/time
        trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: options.trigger.date,
            channelId: options.trigger.channelId || options.channelId || 'default',
        };
    } else if (options.trigger.seconds) {
        // Schedule after X seconds
        trigger = {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: options.trigger.seconds,
            repeats: options.trigger.repeats || false,
            channelId: options.trigger.channelId || options.channelId || 'default',
        };
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: options.title,
            body: options.body,
            data: options.data || {},
            sound: options.sound !== false ? 'default' : undefined,
            badge: options.badge,
            priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger,
    });

    console.log('⏰ Notification scheduled:', notificationId);
    return notificationId;
}

/**
 * Schedule appointment reminder
 */
export async function scheduleAppointmentReminder(
    patientName: string,
    appointmentDate: Date,
    reminderMinutesBefore: number = 60
): Promise<string> {
    const reminderDate = new Date(appointmentDate.getTime() - reminderMinutesBefore * 60 * 1000);

    return scheduleNotification({
        title: '🦷 Appointment Reminder',
        body: `Appointment with ${patientName} in ${reminderMinutesBefore} minutes`,
        data: {
            type: 'appointment_reminder',
            patientName,
            appointmentDate: appointmentDate.toISOString(),
        },
        channelId: 'appointments',
        trigger: {
            date: reminderDate,
        },
    });
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('🚫 Notification cancelled:', notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🚫 All notifications cancelled');
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Set app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear app badge
 */
export async function clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
}
