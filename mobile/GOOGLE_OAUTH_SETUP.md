# Google OAuth Setup for Mobile App

## Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/apis/credentials
2. Select your project: `betterclinic-f1179`
3. Find your **OAuth 2.0 Client ID** (the web client ID: `101419773058-lq31dfucchaiaqcfnovd50dimut6tu2k.apps.googleusercontent.com`)
4. Click **Edit** (pencil icon)

## Step 2: Add Redirect URIs

**IMPORTANT:** Add these to **"Authorized redirect URIs"** section (NOT "Authorized JavaScript origins")

Click **"+ ADD URI"** under "Authorized redirect URIs" and add:

### For Expo Development:
```
exp://localhost:8081/--/auth/callback
```

### For Expo Go (network):
```
exp://192.168.1.1:8081/--/auth/callback
```
(Replace `192.168.1.1` with your actual IP address - check Expo console for the exact URL)

### For Standalone App:
```
xpressscan://auth/callback
```

## Step 3: Check the Console Log

When you click "Continue with Google" in the app, check the console for:
```
🔵 Redirect URI: exp://...
```

**Add that exact URI** to the "Authorized redirect URIs" list.

## Step 4: Save

Click **Save** at the bottom of the page.

## Important Notes:

- ✅ **Authorized redirect URIs** - Can have paths, custom schemes (exp://, xpressscan://)
- ❌ **Authorized JavaScript origins** - Only domains (https://example.com), no paths, no custom schemes

The error you're seeing means you're trying to add it to "Authorized JavaScript origins" instead of "Authorized redirect URIs".

## After Adding:

1. Wait a few seconds for changes to propagate
2. Restart your Expo app
3. Try Google login again

