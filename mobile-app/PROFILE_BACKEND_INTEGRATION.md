# Profile Screen Backend Integration

## Summary
Successfully integrated the ProfileScreen with the backend API to fetch and display real user data.

## Changes Made

### 1. API Service Updates (`src/services/api/apiService.ts`)

#### Added Dependencies
- Imported `@react-native-async-storage/async-storage` for token storage

#### Implemented Methods

**`getAuthHeaders()`**
- Private method to retrieve stored access token
- Adds Authorization header to API requests

**`getUserInfo()`**
- Retrieves stored user data from AsyncStorage
- Returns cached user information

**`getCurrentUser()`**
- Fetches current user profile from `/auth/mobile/me` endpoint
- Transforms backend response to match `BackendUser` interface
- Stores user data locally in AsyncStorage
- Returns user profile with clinic information

**`oauthLogin(idToken: string)`**
- Authenticates user with Firebase ID token
- Calls `/auth/mobile/oauth` endpoint
- Stores access and refresh tokens
- Registers device information
- Returns authenticated user data

**`getProfileStats()`**
- Fetches user statistics from `/dashboard/metrics` endpoint
- Returns patient count, appointment count, and rating
- Used to populate profile statistics cards

**`clearTokens()`**
- Clears all stored authentication tokens
- Removes access_token, refresh_token, and backend_user from AsyncStorage

### 2. ProfileScreen Updates (`src/screens/ClinicOwner/ProfileScreen.tsx`)

#### State Management
- Added `stats` state to store profile statistics
- Fetches both user data and statistics in parallel using `Promise.all()`

#### Data Display
- Profile name from backend user data
- Email from backend user data
- Phone number from backend user data (with fallback)
- Clinic name from backend clinic data (with fallback)
- Clinic address from backend clinic data (with fallback)
- Patient count from dashboard metrics
- Appointment count from dashboard metrics (formatted with locale)
- Rating from dashboard metrics

#### Loading State
- Shows loading spinner while fetching data
- Gracefully handles API failures with fallback values

## Backend Endpoints Used

1. **`GET /auth/mobile/me`**
   - Returns current user profile with clinic details
   - Requires: Authorization Bearer token
   - Response includes: id, email, name, role, phone, clinic info

2. **`GET /dashboard/metrics`**
   - Returns dashboard statistics
   - Requires: Authorization Bearer token
   - Response includes: total_patients, appointments_today, chair_capacity

## Authentication Flow

1. User logs in with Firebase (Google Sign-In)
2. Firebase ID token is sent to backend via `oauthLogin()`
3. Backend validates token and returns access/refresh tokens
4. Tokens are stored in AsyncStorage
5. Subsequent API calls include access token in Authorization header
6. Profile data is fetched and displayed

## Data Flow

```
Firebase Auth → oauthLogin() → Backend OAuth Endpoint
                    ↓
              Store Tokens in AsyncStorage
                    ↓
getCurrentUser() → Backend /me Endpoint → Display Profile
                    ↓
getProfileStats() → Backend /metrics Endpoint → Display Stats
```

## Error Handling

- All API methods include try-catch blocks
- Errors are logged to console
- Methods return null on failure
- UI shows fallback values when backend data unavailable
- Loading states prevent UI flashing

## Security

- Tokens stored securely in AsyncStorage
- Authorization headers added automatically
- Tokens cleared on logout
- Device information tracked for security

## Next Steps

To fully utilize the backend integration:

1. Ensure backend is running at `https://xpress-scan-backend-test-env.onrender.com`
2. Test login flow with Firebase authentication
3. Verify token storage and retrieval
4. Test profile data loading
5. Implement token refresh mechanism for expired tokens
6. Add pull-to-refresh functionality
7. Implement profile editing capabilities

## Configuration

Backend URL is configured in `apiService.ts`:
```typescript
private baseURL = 'https://xpress-scan-backend-test-env.onrender.com';
```

Update this URL if your backend is hosted elsewhere.
