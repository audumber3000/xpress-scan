# BetterClinic Mobile App

React Native mobile app for BetterClinic dental clinic management system.

## Tech Stack

- **React Native** with **Expo** (SDK 54)
- **NativeWind** (TailwindCSS for React Native)
- **React Navigation** (Bottom Tabs)
- **Lucide React Native** (Icons)
- **Expo Secure Store** (Token storage)

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

### Installation

```bash
cd mobile
npm install
```

### Running the App

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### Environment Variables

Create a `.env` file in the mobile folder:

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

For production, update this to your deployed backend URL.

## Project Structure

```
mobile/
├── App.js                 # Entry point
├── src/
│   ├── components/        # Reusable components
│   │   ├── ScreenHeader.js
│   │   ├── StatCard.js
│   │   └── AppointmentCard.js
│   ├── screens/           # Screen components
│   │   ├── HomeScreen.js
│   │   ├── PatientsScreen.js
│   │   ├── CalendarScreen.js
│   │   ├── PaymentsScreen.js
│   │   └── SettingsScreen.js
│   ├── navigation/        # Navigation config
│   │   └── TabNavigator.js
│   └── utils/             # Utilities
│       └── api.js         # API client
├── tailwind.config.js     # Tailwind/NativeWind config
├── metro.config.js        # Metro bundler config
└── babel.config.js        # Babel config
```

## Theme Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Green | `#16a34a` | Buttons, active states |
| Teal | `#1d8a99` | Charts, accents |
| Gray 900 | `#111827` | Primary text |
| Gray 500 | `#6b7280` | Secondary text |

## API Integration

The mobile app uses the same backend API as the web app. The API client is configured in `src/utils/api.js` and handles:

- JWT token storage (Expo SecureStore)
- Authenticated requests
- Error handling

## Building for Production

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

See [Expo EAS Build docs](https://docs.expo.dev/build/introduction/) for more details.
