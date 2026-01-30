# Notification System Documentation

## Overview
The notification system is organized into modular, clean files for easy maintenance and scalability.

## File Structure

```
src/services/notifications/
├── index.ts              # Main entry point, exports all utilities
├── permissions.ts        # Permission management
├── pushToken.ts          # Remote push token handling
└── local.ts             # Local notification scheduling

src/hooks/
└── usePushNotifications.tsx  # React hook for app-wide notification setup
```

## Features

### ✅ Permission Management (`permissions.ts`)
- **Automatic permission requests** on app launch
- **User-friendly dialogs** when permissions are denied
- **Settings redirect** for users who need to enable notifications manually
- **Android notification channels** (Default, Appointments, Reminders)

### ✅ Local Notifications (`local.ts`)
- Send immediate notifications
- Schedule notifications for specific times
- Schedule appointment reminders
- Cancel notifications
- Manage app badge count

### ✅ Remote Push Notifications (`pushToken.ts`)
- Get Expo Push Token
- Register token with backend
- Unregister token on logout

### ✅ React Hook (`usePushNotifications.tsx`)
- Auto-initialization on app launch
- Permission handling
- Token registration
- Notification listeners (foreground & tap events)

## Usage Examples

### 1. Send Immediate Local Notification

```typescript
import { sendLocalNotification } from '@/services/notifications';

await sendLocalNotification({
  title: '🦷 Appointment Reminder',
  body: 'You have an appointment in 30 minutes',
  data: { appointmentId: '123' },
});
```

### 2. Schedule Future Notification

```typescript
import { scheduleNotification } from '@/services/notifications';

// Schedule for 1 hour from now
await scheduleNotification({
  title: 'Follow-up Reminder',
  body: 'Time for your follow-up appointment',
  trigger: {
    seconds: 3600, // 1 hour
  },
});

// Schedule for specific date/time
const appointmentDate = new Date('2026-01-28T10:00:00');
await scheduleNotification({
  title: 'Appointment Today',
  body: 'Your appointment is scheduled for 10:00 AM',
  trigger: {
    date: appointmentDate,
  },
  channelId: 'appointments',
});
```

### 3. Schedule Appointment Reminder

```typescript
import { scheduleAppointmentReminder } from '@/services/notifications';

const appointmentDate = new Date('2026-01-28T14:00:00');
await scheduleAppointmentReminder(
  'John Doe',
  appointmentDate,
  60 // Remind 60 minutes before
);
```

### 4. Check/Request Permissions Manually

```typescript
import { 
  checkNotificationPermissions,
  requestNotificationPermissionsWithUI 
} from '@/services/notifications';

// Check current status
const status = await checkNotificationPermissions();
console.log('Granted:', status.granted);

// Request with UI feedback
const granted = await requestNotificationPermissionsWithUI();
if (granted) {
  // Proceed with notifications
}
```

### 5. Access Push Token in Components

```typescript
import { usePushNotifications } from '@/hooks/usePushNotifications';

function MyComponent() {
  const { expoPushToken, permissionGranted } = usePushNotifications();
  
  useEffect(() => {
    if (expoPushToken) {
      console.log('Push token:', expoPushToken);
      // Send to your backend
    }
  }, [expoPushToken]);
}
```

## Permission Flow

1. **App Launch**: `usePushNotifications` hook runs
2. **Android Channels**: Created automatically
3. **Permission Request**: Native dialog shown to user
4. **If Granted**: Push token retrieved and logged
5. **If Denied**: Warning logged, local notifications still work

## Testing

### Test Button Location
**Profile Tab → Developer Tools → Test Local Notification**

### What It Does
1. Checks/requests notification permissions
2. Shows permission dialog if needed
3. Sends immediate test notification
4. Shows success/error alert

### Expected Behavior
- **First time**: Permission dialog appears
- **After granting**: Notification appears in system tray
- **If denied**: Alert with option to open settings

## Android Notification Channels

| Channel ID | Name | Importance | Use Case |
|------------|------|------------|----------|
| `default` | Default | MAX | General notifications |
| `appointments` | Appointments | HIGH | Appointment reminders |
| `reminders` | Reminders | DEFAULT | Follow-up reminders |

## Backend Integration

### Sending Push Notifications

Once you have the Expo Push Token, send it to your backend:

```typescript
// In your backend
POST https://exp.host/--/api/v2/push/send
Content-Type: application/json

{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Appointment Reminder",
  "body": "You have an appointment in 1 hour",
  "data": { "appointmentId": "123" }
}
```

### Register Token Endpoint (TODO)

Update `pushToken.ts` with your backend URL:

```typescript
const response = await fetch('YOUR_BACKEND_URL/api/push-tokens', {
  method: 'POST',
  body: JSON.stringify({ token, userId }),
});
```

## Troubleshooting

### "Cannot find native module 'ExpoDevice'"
**Solution**: Rebuild the app
```bash
rm -rf android/build android/app/build
npx expo run:android
```

### Notifications not appearing
1. Check permissions: Settings → Apps → MolarPlus → Notifications
2. Verify Android channel is created (check logs)
3. Test on physical device (emulators can be unreliable)

### Push token not generated
1. Ensure you're on a physical device
2. Check for Expo project ID in `app.json`
3. Verify permissions are granted

## Best Practices

1. **Always check permissions** before sending notifications
2. **Use appropriate channels** for different notification types
3. **Include meaningful data** for tap handling
4. **Test on physical devices** for push notifications
5. **Handle permission denials gracefully** with UI feedback

## Next Steps

- [ ] Add backend endpoint for token registration
- [ ] Implement notification tap navigation
- [ ] Add notification preferences screen
- [ ] Schedule automatic appointment reminders
- [ ] Add notification history/logs
