# Environment Setup Guide

## Quick Setup for Local Development

The mobile app is now configured to use your local backend at `http://localhost:8000`.

### Configuration Files Created

1. **`src/config/api.config.ts`** - Main API configuration
2. **`.env.example`** - Example environment file (template)

### Current Configuration

The app is currently set to use: **`http://localhost:8000`**

You can change this in `/src/config/api.config.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000',  // ← Change this
  // ...
};
```

### Platform-Specific URLs

Depending on where you're running the app, you may need different URLs:

| Platform | URL | When to Use |
|----------|-----|-------------|
| **iOS Simulator** | `http://localhost:8000` | Running on Mac iOS Simulator |
| **Android Emulator** | `http://10.0.2.2:8000` | Running on Android Emulator |
| **Physical Device** | `http://192.168.x.x:8000` | Running on real phone (use your computer's IP) |
| **Production** | `https://xpress-scan.onrender.com` | Deployed backend |

### How to Change the Backend URL

**Option 1: Edit the config file (Recommended)**

Open `/src/config/api.config.ts` and change the `BASE_URL`:

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://10.0.2.2:8000',  // For Android Emulator
  // or
  BASE_URL: 'http://192.168.1.100:8000',  // For physical device
};
```

**Option 2: Create a `.env` file (Optional)**

If you want to use environment variables:

1. Create a file named `.env` in the `mobile-app` folder
2. Add this line:
   ```
   API_BASE_URL=http://localhost:8000
   ```
3. Install `react-native-dotenv` package (if not already installed)
4. Update the config to read from environment variables

### Finding Your Computer's IP Address

**On Mac:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**
```bash
ipconfig
```

Look for your local IP address (usually starts with `192.168.x.x` or `10.0.x.x`)

### Testing the Connection

1. Make sure your backend is running at `http://localhost:8000`
2. Start the mobile app:
   ```bash
   npm start
   ```
3. The app will now connect to your local backend
4. Check the console for any connection errors

### Troubleshooting

**Issue: "Network request failed"**
- ✅ Ensure backend is running on port 8000
- ✅ Check if you're using the correct URL for your platform
- ✅ For Android Emulator, use `http://10.0.2.2:8000`
- ✅ For physical device, ensure phone and computer are on same WiFi

**Issue: "CORS errors"**
- ✅ Check backend CORS settings allow your mobile app origin
- ✅ Verify backend is configured to accept requests from mobile

**Issue: "Connection timeout"**
- ✅ Check firewall settings
- ✅ Ensure backend is accessible from your network
- ✅ Try pinging the backend URL from your device

### Backend Endpoints Being Used

The mobile app connects to these endpoints:

- `POST /auth/mobile/oauth` - User authentication
- `GET /auth/mobile/me` - Get current user profile
- `GET /dashboard/metrics` - Get profile statistics
- `GET /patients` - Get patients list
- `GET /appointments` - Get appointments

Make sure your backend at `http://localhost:8000` has these endpoints available.

### Switching to Production

When ready to use the production backend:

```typescript
// In src/config/api.config.ts
export const API_CONFIG = {
  BASE_URL: 'https://xpress-scan.onrender.com',
};
```

---

**Current Status:** ✅ Configured to use `http://localhost:8000`
