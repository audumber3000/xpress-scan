# Notification System Setup Guide

The notification system uses `expo-notifications` and is compatible with both Managed and Bare workflows.

## 1. Google Services (Android) Setup

**Required for Remote Push Notifications on Android.**

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project or select an existing one.
3. Add an Android app with the package name: `com.xpressscan.app`.
4. Download the `google-services.json` file.
5. Place strings `google-services.json` in the `mobile-app` root directory (next to `app.json`).
6. **Rebuild your app** (local or EAS build) to apply changes.

## 2. iOS Setup

**Required for Remote Push Notifications on iOS.**

1. Ensure you have a paid Apple Developer Account.
2. If using EAS Build, run `eas credentials` to automatically set up the Push Notification key.
3. If building locally/manually, ensure your Provisioning Profile includes the "Push Notifications" capability.

## 3. Usage

### Local Notifications
Use the helper function to schedule notifications immediately or in the future:

```typescript
import { scheduleLocalNotification } from './src/services/notifications';

// Schedule immediate
await scheduleLocalNotification('Title', 'Body text');

// Schedule for 5 seconds later
await scheduleLocalNotification('Reminder', 'Check your appointment', 5);
```

### Remote Notifications
The App automatically registers for push tokens on launch.
- The token is available via the `usePushNotifications` hook.
- You can send this token to your backend API to target specific users.

## 4. Testing

- **Local**: Call `scheduleLocalNotification` from a button press.
- **Remote**:
    1. Run the app on a **Physical Device**.
    2. Copy the `Expo Push Token` printed in the console.
    3. Go to [Expo Push Notification Tool](https://expo.dev/notifications).
    4. Paste the token and send a test message.
