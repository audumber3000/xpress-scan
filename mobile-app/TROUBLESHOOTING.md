# API Connection Troubleshooting Guide

## Current Issue: "Failed to load profile"

The app now has detailed logging enabled. Follow these steps to diagnose the issue:

## Step 1: Check Console Logs

When you run the app, look for these log messages in your terminal:

```
🔍 [API] Fetching current user from: http://localhost:8000/auth/mobile/me
🔑 [API] Headers: {...}
📡 [API] Response status: XXX
```

### What to Look For:

**✅ Success (Status 200):**
```
✅ [API] User data received: {...}
💾 [API] User data stored locally
```

**❌ Network Error:**
```
❌ [API] Error fetching current user: TypeError: Network request failed
```
→ **Solution**: Backend not reachable

**❌ 401 Unauthorized:**
```
📡 [API] Response status: 401
❌ [API] Error response: {"detail":"Not authenticated"}
```
→ **Solution**: No valid access token

**❌ 404 Not Found:**
```
📡 [API] Response status: 404
```
→ **Solution**: Endpoint doesn't exist on backend

## Step 2: Common Issues & Solutions

### Issue 1: Network Request Failed

**Symptoms:**
- Error: "Network request failed"
- Can't connect to backend

**Causes & Solutions:**

1. **Backend not running**
   ```bash
   # Check if backend is running
   curl http://localhost:8000/
   ```
   If this fails, start your backend:
   ```bash
   cd backend
   python main.py  # or uvicorn main:app --reload
   ```

2. **Wrong URL for platform**
   - **iOS Simulator**: Use `http://localhost:8000` ✅
   - **Android Emulator**: Use `http://10.0.2.2:8000`
   - **Physical Device**: Use your computer's IP (e.g., `http://192.168.1.100:8000`)
   
   Update in `/src/config/api.config.ts`:
   ```typescript
   BASE_URL: 'http://10.0.2.2:8000',  // For Android
   ```

3. **Firewall blocking connection**
   - Disable firewall temporarily to test
   - Or allow port 8000 in firewall settings

### Issue 2: 401 Unauthorized

**Symptoms:**
- Response status: 401
- Error: "Not authenticated"

**Cause:** No access token or invalid token

**Solution:**

The app needs to authenticate first. The `/auth/mobile/me` endpoint requires authentication.

**Option A: Test without authentication first**

Check if your backend has a test endpoint that doesn't require auth:
```bash
curl http://localhost:8000/
# or
curl http://localhost:8000/health
```

**Option B: Login first**

The user needs to login via Firebase OAuth before accessing the profile. Make sure:
1. User is logged in with Google Sign-In
2. OAuth token is obtained and stored
3. Access token is present in AsyncStorage

**Check token in app:**
```typescript
// Add this temporarily to ProfileScreen to debug
const checkToken = async () => {
  const token = await AsyncStorage.getItem('access_token');
  console.log('🔑 Stored token:', token);
};
```

### Issue 3: CORS Error

**Symptoms:**
- CORS policy error in logs
- Preflight request failed

**Solution:**

Update backend CORS settings to allow mobile app:

```python
# In backend/main.py
origins = [
    "http://localhost:8000",
    "http://localhost:3000",
    "http://10.0.2.2:8000",  # Android emulator
    # Add your mobile app origin
]
```

### Issue 4: Endpoint Not Found (404)

**Symptoms:**
- Response status: 404
- Endpoint doesn't exist

**Solution:**

Verify the endpoint exists on your backend:
```bash
# Test the endpoint directly
curl http://localhost:8000/auth/mobile/me
```

If it returns 404, check:
1. Is the route registered in `main.py`?
2. Is the `auth_mobile` router included?
3. Is the endpoint path correct?

## Step 3: Test Backend Directly

Before testing via mobile app, verify backend works:

```bash
# 1. Check backend is running
curl http://localhost:8000/

# 2. Test OAuth endpoint (requires Firebase token)
curl -X POST http://localhost:8000/auth/mobile/oauth \
  -H "Content-Type: application/json" \
  -d '{"id_token":"YOUR_FIREBASE_TOKEN"}'

# 3. Test /me endpoint (requires access token)
curl http://localhost:8000/auth/mobile/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. Test dashboard metrics
curl http://localhost:8000/dashboard/metrics \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Step 4: Authentication Flow

The correct flow should be:

1. **User logs in with Google** → Firebase ID token obtained
2. **App calls `oauthLogin()`** → Sends Firebase token to backend
3. **Backend validates token** → Returns access token + user data
4. **Access token stored** → In AsyncStorage
5. **Profile loads** → Uses access token to fetch user data

**Check if authentication is working:**

Look for these logs during login:
```
🔐 [AUTH] Firebase user logged in
🔑 [API] OAuth login successful
💾 [API] Tokens stored
```

## Step 5: Quick Fixes

### Fix 1: Skip Authentication (Testing Only)

Temporarily modify the backend to allow unauthenticated access:

```python
# In backend/routes/auth_mobile.py
@router.get("/me")
async def get_mobile_user_info(
    request: Request, 
    db: Session = Depends(get_db)
    # Remove: current_user = Depends(get_current_user)
):
    # Return mock data for testing
    return {
        "id": 1,
        "email": "test@example.com",
        "name": "Test User",
        "role": "clinic_owner"
    }
```

### Fix 2: Use Mock Data (App Side)

Temporarily return mock data in `getCurrentUser()`:

```typescript
async getCurrentUser(): Promise<BackendUser | null> {
  // TEMPORARY: Return mock data
  return {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'clinic_owner',
  };
}
```

## Step 6: Platform-Specific Issues

### iOS Simulator
- Should work with `http://localhost:8000`
- Check iOS simulator network settings
- Try restarting simulator

### Android Emulator
- Must use `http://10.0.2.2:8000` (not localhost)
- Check emulator has internet access
- Try: Settings → Network & Internet → Check connection

### Physical Device
- Device and computer must be on same WiFi
- Use computer's IP address (not localhost)
- Find IP: `ifconfig` (Mac) or `ipconfig` (Windows)
- Update config: `BASE_URL: 'http://192.168.1.XXX:8000'`

## Step 7: Enable Remote Debugging

To see detailed logs:

**React Native Debugger:**
```bash
# Install if not already installed
brew install --cask react-native-debugger

# Start debugger
open "rndebugger://set-debugger-loc?host=localhost&port=8081"
```

**Chrome DevTools:**
1. Shake device or press Cmd+D (iOS) / Cmd+M (Android)
2. Select "Debug"
3. Open Chrome DevTools
4. Check Console tab for logs

## Next Steps

1. **Run the app** and check console for log messages
2. **Copy the error logs** you see
3. **Share the logs** so we can identify the exact issue
4. **Test backend directly** using curl commands above

The detailed logging will show exactly where the connection is failing!
