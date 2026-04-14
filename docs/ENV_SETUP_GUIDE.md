# Environment Variables Setup Guide

## Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

### ✅ Already Provided:

```bash
# Database (Render PostgreSQL)
DATABASE_URL=postgresql://betterclinic_database_postgress_user:7byBz3uvw6UMByh003wgMx9188dmBerR@dpg-d59h1eer433s73frfod0-a.oregon-postgres.render.com/betterclinic_database_postgress

# Cloudflare R2 Storage
R2_ACCESS_KEY_ID=69c97471316237db15c41fcfbe79e398
R2_SECRET_ACCESS_KEY=247a872b826b51c0cf0c24ee12e266611c7d282151c570306ce9dddb4d9353d4
R2_ENDPOINT_URL=https://8d19e4189ab25d9511db91eb129362b5.r2.cloudflarestorage.com
```

### ❓ Need to Add:

1. **R2_BUCKET_NAME** - Your Cloudflare R2 bucket name
   - **Where to find:** Cloudflare Dashboard → R2 → Your bucket name
   - The bucket name you created in Cloudflare R2

2. **FIREBASE_SERVICE_ACCOUNT_JSON** - Firebase service account JSON
   - **You mentioned:** "in download i have json for backend"
   - **How to use:** 
     - Option A: Copy the entire JSON content and put it as a single-line string:
       ```bash
       FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"betterclinic-f1179",...entire JSON here...}'
       ```
     - Option B: Put the JSON file in the backend folder and use:
       ```bash
       FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
       ```
   - **File location:** The JSON file you downloaded from Firebase Console

3. **JWT_SECRET** - Secret key for JWT token signing
   - Generate a strong random string
   - Example: `openssl rand -hex 32`
   - **Important:** Keep this secret and use a different one in production

### Optional (R2 Public URL):

If you've configured a custom domain for your R2 bucket, add:
```bash
R2_PUBLIC_URL=https://your-custom-domain.com
```

If not using a custom domain, files will use the R2 endpoint URL format.

---

## Frontend Environment Variables

Create a `.env` file in the `frontend/` directory with the following:

### ❓ Need to Get from Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **betterclinic-f1179**
3. Click the gear icon ⚙️ → **Project Settings**
4. Scroll down to **"Your apps"** section
5. Click on the **Web app** icon `</>` (or create one if it doesn't exist)
6. Copy the **firebaseConfig** values:

```bash
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=betterclinic-f1179.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=betterclinic-f1179
VITE_FIREBASE_STORAGE_BUCKET=betterclinic-f1179.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Backend URL
VITE_BACKEND_URL=http://localhost:8000
# For production, change to your backend URL:
# VITE_BACKEND_URL=https://your-backend-url.com
```

### How to Find Firebase Config:

1. In Firebase Console → Project Settings → Your apps
2. If you see a web app already, click on it
3. You'll see a code snippet like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "betterclinic-f1179.firebaseapp.com",
     projectId: "betterclinic-f1179",
     storageBucket: "betterclinic-f1179.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
4. Copy each value to the corresponding `.env` variable

---

## Desktop App Environment Variables

Create a `.env` file in the `desktop-app/` directory with the **same values as frontend**:

```bash
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=betterclinic-f1179.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=betterclinic-f1179
VITE_FIREBASE_STORAGE_BUCKET=betterclinic-f1179.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

VITE_BACKEND_URL=http://localhost:8000
```

---

## Summary of What You Need to Provide:

### Backend `.env`:
- ✅ DATABASE_URL (provided)
- ✅ R2_ACCESS_KEY_ID (provided)
- ✅ R2_SECRET_ACCESS_KEY (provided)
- ✅ R2_ENDPOINT_URL (provided)
- ❓ **R2_BUCKET_NAME** - Your R2 bucket name
- ❓ **FIREBASE_SERVICE_ACCOUNT_JSON** - The JSON file you downloaded
- ❓ **JWT_SECRET** - Generate a random string

### Frontend `.env`:
- ❓ **VITE_FIREBASE_API_KEY** - From Firebase Console
- ❓ **VITE_FIREBASE_AUTH_DOMAIN** - From Firebase Console
- ❓ **VITE_FIREBASE_PROJECT_ID** - From Firebase Console (should be: betterclinic-f1179)
- ❓ **VITE_FIREBASE_STORAGE_BUCKET** - From Firebase Console
- ❓ **VITE_FIREBASE_MESSAGING_SENDER_ID** - From Firebase Console
- ❓ **VITE_FIREBASE_APP_ID** - From Firebase Console
- ❓ **VITE_BACKEND_URL** - Your backend URL (localhost:8000 for dev)

### Desktop App `.env`:
- Same as Frontend

---

## Quick Checklist:

- [ ] Create `.env` file in `backend/` folder
- [ ] Add all backend environment variables
- [ ] Get R2 bucket name from Cloudflare Dashboard
- [ ] Add Firebase service account JSON to backend `.env`
- [ ] Generate JWT_SECRET (use `openssl rand -hex 32`)
- [ ] Create `.env` file in `frontend/` folder
- [ ] Get Firebase web app config from Firebase Console
- [ ] Add all frontend environment variables
- [ ] Create `.env` file in `desktop-app/` folder
- [ ] Copy frontend env vars to desktop-app `.env`

---

## Where to Find Missing Information:

1. **R2_BUCKET_NAME**: 
   - Cloudflare Dashboard → R2 → Your buckets list
   - The name you gave when creating the bucket

2. **Firebase Service Account JSON**:
   - Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - You mentioned you already have this downloaded

3. **Firebase Web App Config**:
   - Firebase Console → Project Settings → General
   - Scroll to "Your apps" section
   - Click web app icon `</>` to view config

4. **JWT_SECRET**:
   - Generate using: `openssl rand -hex 32`
   - Or use any strong random string (at least 32 characters)







