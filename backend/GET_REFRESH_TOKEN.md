# How to Get Zoho Refresh Token - Step by Step Guide

## Prerequisites
- Your Client ID: `1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU`
- Your Client Secret: `a640fee5aa22c20413e751672e2d390a4f827fa154`
- Access to the Zoho account that owns `notification@betterclinic.app`

## Step 1: Generate Authorization Code

1. **First, check your Zoho OAuth app configuration:**
   - Go to https://api-console.zoho.com/
   - Find your application (Client ID: `1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU`)
   - Check what "Authorized Redirect URIs" are configured
   - If `http://localhost` is not listed, add it and save
   - **OR** use one of the existing redirect URIs (see alternative URLs below)

2. **Open this URL in your browser** (using `http://localhost`):
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=http://localhost
   ```
   
   **If that doesn't work, try with `https://localhost` instead:**
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=https://localhost
   ```
   
   **Or use the exact redirect URI from your Zoho app configuration** (replace `YOUR_REDIRECT_URI`):
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=YOUR_REDIRECT_URI
   ```

2. **Log in** to your Zoho account (the one that owns notification@betterclinic.app)

3. **Log in** to your Zoho account (the one that owns notification@betterclinic.app)

4. **Authorize the application** by clicking "Accept" or "Allow"

5. **After authorization**, you'll be redirected to a URL that looks like:
   ```
   http://localhost?code=1000.abc123def456ghi789...
   ```
   (or whatever redirect URI you used)

6. **Copy the code value** from the URL (the part after `code=`). It will be a long string starting with `1000.`

## Step 2: Exchange Code for Refresh Token

Once you have the authorization code, run this command in your terminal:

**For EU accounts (if your redirect URL showed location=eu):**
```bash
curl -X POST https://accounts.zoho.eu/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU" \
  -d "client_secret=a640fee5aa22c20413e751672e2d390a4f827fa154" \
  -d "redirect_uri=http://localhost" \
  -d "code=PASTE_YOUR_CODE_HERE"
```

**For non-EU accounts:**
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU" \
  -d "client_secret=a640fee5aa22c20413e751672e2d390a4f827fa154" \
  -d "redirect_uri=http://localhost/" \
  -d "code=PASTE_YOUR_CODE_HERE"
```

**If you used a different redirect URI, replace `http://localhost` with your actual redirect URI:**
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU" \
  -d "client_secret=a640fee5aa22c20413e751672e2d390a4f827fa154" \
  -d "redirect_uri=YOUR_ACTUAL_REDIRECT_URI" \
  -d "code=PASTE_YOUR_CODE_HERE"
```

Replace `PASTE_YOUR_CODE_HERE` with the code you copied from Step 1, and `YOUR_ACTUAL_REDIRECT_URI` with the redirect URI you used (must match exactly).

## Step 3: Extract Refresh Token

After running the curl command, you'll get a JSON response that looks like:

```json
{
  "access_token": "1000.abc123...",
  "refresh_token": "1000.xyz789...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Copy the `refresh_token` value** (it starts with `1000.` and is usually quite long).

## Step 4: Add to .env File

Add the refresh token to your `.env` file in the `backend` directory:

```env
ZOHO_CLIENT_ID=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU
ZOHO_CLIENT_SECRET=a640fee5aa22c20413e751672e2d390a4f827fa154
ZOHO_REFRESH_TOKEN=1000.YOUR_REFRESH_TOKEN_HERE
ZOHO_FROM_EMAIL=notification@betterclinic.app
```

Replace `1000.YOUR_REFRESH_TOKEN_HERE` with the refresh token you copied in Step 3.

## Troubleshooting

### "Invalid redirect URI" or "Redirect URI passed does not match with the one configured"
- **Check your Zoho OAuth app configuration:**
  1. Go to https://api-console.zoho.com/
  2. Open your application
  3. Check the "Authorized Redirect URIs" field
  4. Either add `http://localhost` to the list, OR use one of the existing URIs
- The redirect URI in the authorization URL must match one of the URIs configured in your Zoho app
- The redirect URI must match exactly in both Step 1 (authorization) and Step 2 (token exchange)
- Common redirect URIs: `http://localhost`, `https://localhost`, `http://127.0.0.1`, or a custom domain

### "Invalid client"
- Double-check that your Client ID and Client Secret are correct
- Make sure you're using the account that created the OAuth application

### "Code expired"
- Authorization codes expire quickly (usually within 1-10 minutes)
- If you see this error, go back to Step 1 and generate a new code

### Can't find the code in the redirect URL
- After authorization, the browser might show an error page instead of redirecting
- Check the browser's address bar for the full URL - the code parameter might still be there even if the page shows an error
- If you're redirected to a page that can't load (like `http://localhost`), that's fine - just copy the code from the URL bar

## Quick Copy-Paste Commands

### Step 1: Authorization URL
**For EU accounts (accounts.zoho.eu), use this URL:**
```
https://accounts.zoho.eu/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=http://localhost
```

**For non-EU accounts, use this URL:**
```
https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=http://localhost/
```

**Option A - Using http://localhost (if configured in your Zoho app):**
```
https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=http://localhost
```

**Option B - Using https://localhost (if configured):**
```
https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=https://localhost
```

**Option C - Replace with your actual redirect URI from Zoho app:**
```
https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=YOUR_REDIRECT_URI
```

### Step 2: Token Exchange (replace CODE_HERE with your code)
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token -d "grant_type=authorization_code" -d "client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU" -d "client_secret=a640fee5aa22c20413e751672e2d390a4f827fa154" -d "redirect_uri=http://localhost" -d "code=CODE_HERE"
```

## Done!

Once you've added the refresh token to your `.env` file, restart your backend server and the email service will automatically use it to send emails.

