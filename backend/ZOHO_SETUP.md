# Zoho Mail API Setup Guide

## Configuration Required

Add these environment variables to your `.env` file in the `backend` directory:

```env
ZOHO_CLIENT_ID=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU
ZOHO_CLIENT_SECRET=a640fee5aa22c20413e751672e2d390a4f827fa154
ZOHO_REFRESH_TOKEN=your_refresh_token_here
ZOHO_FROM_EMAIL=notification@betterclinic.app
```

**Note:** The Client ID, Client Secret, and From Email are already provided. You only need to:
1. Generate a Refresh Token (see instructions below)

## Generating Refresh Token

Zoho Mail API requires a refresh token for OAuth authentication. To generate one:

1. **Create a Zoho OAuth application:**
   - Go to https://api-console.zoho.com/
   - Create a new application
   - Set redirect URI (can be `http://localhost` for testing)
   - Copy your Client ID and Client Secret (already provided)

2. **Generate Refresh Token:**
   - Visit this URL (already filled with your Client ID):
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ&client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU&response_type=code&access_type=offline&redirect_uri=http://localhost
   ```
   - Authorize the application
   - Copy the `code` parameter from the redirect URL (it will look like: `http://localhost?code=xxxxx`)

3. **Exchange code for refresh token:**
   ```bash
   curl -X POST https://accounts.zoho.com/oauth/v2/token \
     -d "grant_type=authorization_code" \
     -d "client_id=1000.KT64LY2DPP4AG3O9U24204FCUY7ZBU" \
     -d "client_secret=a640fee5aa22c20413e751672e2d390a4f827fa154" \
     -d "redirect_uri=http://localhost" \
     -d "code=CODE_FROM_STEP_2"
   ```
   - Copy the `refresh_token` from the response
   - Add it to your `.env` file as `ZOHO_REFRESH_TOKEN`

## Alternative: Using Zoho SMTP

If the REST API proves complex, you can also use Zoho's SMTP server:

- SMTP Host: `smtp.zoho.com`
- SMTP Port: `587` (TLS) or `465` (SSL)
- Username: Your Zoho email address
- Password: Your Zoho email password or app-specific password

This would require modifying the `EmailService` to use SMTP instead of REST API.

## Testing

Once configured, the email service will automatically:
- Generate access tokens as needed
- Send emails for all configured use cases
- Handle token refresh automatically

## Notes

- Access tokens expire after 1 hour and are automatically refreshed
- Make sure your Zoho Mail account has API access enabled
- The `ZOHO_FROM_EMAIL` (notification@betterclinic.app) must be a verified email address in your Zoho account
- All emails will be sent from: **notification@betterclinic.app**

