# Migration to Firebase Auth and Render PostgreSQL

This document outlines the migration from Supabase to Firebase Auth and Render PostgreSQL.

## Overview

The application has been migrated from:
- **Supabase Database** → **Render PostgreSQL**
- **Supabase Auth** → **Firebase Auth**
- **Supabase Storage** → **Firebase Storage**

## Required Environment Variables

### Backend Environment Variables

#### Database (Render PostgreSQL)
```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
```
- This is provided by Render when you create a PostgreSQL database
- Format: `postgresql://[user]:[password]@[host]:[port]/[dbname]`

#### Firebase Admin SDK (Backend)
You need to provide Firebase Admin SDK credentials. Choose one of the following methods:

**Option 1: Service Account JSON (Recommended)**
```bash
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```
- Get this from Firebase Console → Project Settings → Service Accounts → Generate New Private Key
- The entire JSON should be provided as a single-line string

**Option 2: Service Account File Path**
```bash
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccountKey.json
```
- Path to the service account JSON file on the server

**Option 3: Default Credentials (Google Cloud)**
- If running on Google Cloud Platform, Firebase Admin SDK will use default credentials automatically

#### Firebase Storage
```bash
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```
- Your Firebase Storage bucket name
- Format: `[project-id].appspot.com`

#### JWT Secret (Backend)
```bash
JWT_SECRET=your-secret-key-here
```
- Secret key for signing JWT tokens
- Use a strong, random string in production

### Frontend Environment Variables

#### Firebase Client Configuration
```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```
- Get these from Firebase Console → Project Settings → General → Your apps
- These are safe to expose in client-side code

#### Backend URL
```bash
VITE_BACKEND_URL=http://localhost:8000
```
- URL of your backend API
- Use `https://your-backend.onrender.com` for production

### Desktop App Environment Variables

Same as frontend environment variables:
```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_BACKEND_URL=http://localhost:8000
```

## Setup Instructions

### 1. Create Render PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Configure your database:
   - Name: `xpress-scan-db` (or your preferred name)
   - Region: Choose closest to your backend
   - PostgreSQL Version: Latest stable
   - Plan: Free tier or paid
4. After creation, copy the **Internal Database URL** or **External Database URL**
5. Set this as `DATABASE_URL` in your backend environment variables

### 2. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" or select existing project
3. Follow the setup wizard
4. Enable Authentication:
   - Go to Authentication → Sign-in method
   - Enable "Google" provider
   - Add authorized domains if needed
5. Enable Storage:
   - Go to Storage → Get started
   - Choose "Start in production mode" or "Start in test mode"
   - Select a location for your storage bucket

### 3. Get Firebase Credentials

#### For Frontend/Desktop App:
1. Go to Project Settings → General
2. Scroll to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Register your app
5. Copy the Firebase configuration object
6. Use these values for your environment variables

#### For Backend (Service Account):
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Either:
   - Set `FIREBASE_SERVICE_ACCOUNT_JSON` with the entire JSON as a string, OR
   - Set `FIREBASE_SERVICE_ACCOUNT_PATH` to the file path

### 4. Update Dependencies

#### Backend
```bash
cd backend
pip install -r requirements.txt
```
This will install `firebase-admin` and remove `supabase`.

#### Frontend
```bash
cd frontend
npm install
```
This will install `firebase` and remove `@supabase/supabase-js`.

#### Desktop App
```bash
cd desktop-app
npm install
```
This will install `firebase` and remove `@supabase/supabase-js`.

### 5. Database Migration

If you have existing data in Supabase, you'll need to migrate it:

1. Export data from Supabase PostgreSQL
2. Import to Render PostgreSQL
3. Run any pending migrations:
   ```bash
   cd backend
   python init_db.py  # If needed
   ```

### 6. Update Environment Files

Create or update `.env` files:

**Backend `.env`:**
```env
DATABASE_URL=postgresql://user:password@host:port/dbname
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
JWT_SECRET=your-secret-key
```

**Frontend `.env`:**
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_BACKEND_URL=http://localhost:8000
```

**Desktop App `.env`:**
Same as frontend.

## Key Changes

### Authentication Flow

**Before (Supabase):**
- OAuth redirect flow
- Session stored in Supabase
- Backend verified Supabase tokens

**After (Firebase):**
- OAuth popup flow (Google)
- Session stored in Firebase
- Backend verifies Firebase ID tokens
- Backend issues JWT tokens for API access

### Storage

**Before (Supabase Storage):**
- Files uploaded to Supabase Storage buckets
- Public URLs generated by Supabase

**After (Firebase Storage):**
- Files uploaded to Firebase Storage
- Public URLs generated by Firebase
- Bucket configured in Firebase Console

### Database

**Before (Supabase PostgreSQL):**
- Connection via Supabase connection string
- Managed by Supabase

**After (Render PostgreSQL):**
- Direct PostgreSQL connection
- Managed by Render
- Standard PostgreSQL connection string format

## Testing

1. **Test Authentication:**
   - Try Google sign-in on frontend
   - Verify user creation in database
   - Test JWT token generation

2. **Test Storage:**
   - Generate a report PDF
   - Verify upload to Firebase Storage
   - Check public URL accessibility

3. **Test Database:**
   - Verify connection to Render PostgreSQL
   - Test CRUD operations
   - Check data persistence

## Troubleshooting

### Firebase Auth Issues
- Ensure Google provider is enabled in Firebase Console
- Check authorized domains in Firebase Authentication settings
- Verify Firebase config environment variables are correct

### Storage Issues
- Ensure Firebase Storage is enabled
- Check bucket name matches `FIREBASE_STORAGE_BUCKET`
- Verify service account has Storage Admin permissions

### Database Issues
- Verify `DATABASE_URL` is correct
- Check Render database is running
- Ensure network access is allowed (for external connections)

## Notes

- The `supabase_user_id` field in the User model is kept for backward compatibility but now stores Firebase UID
- Local users (offline mode) still use `local_` prefix
- Password hashing is still used for local users and desktop app access
- Firebase users can set passwords for desktop app access via the settings page



