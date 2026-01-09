# Razorpay Subscription Setup Guide

This guide will help you set up Razorpay subscriptions for your Better Clinic application.

## Prerequisites

1. Razorpay account (sign up at https://razorpay.com/)
2. Razorpay API keys (Key ID and Key Secret)
3. Razorpay subscription plans configured in dashboard

## Step 1: Configure Razorpay Plans

1. Log in to your Razorpay Dashboard
2. Go to **Settings** → **Subscriptions** → **Plans**
3. Create two subscription plans:

   **Professional Plan:**
   - Plan Name: Professional Monthly
   - Amount: ₹2999
   - Billing Period: Monthly
   - Billing Cycle: Infinite (999999)
   - Save the Plan ID (e.g., `plan_xxxxxxxxxxxxx`)

   **Enterprise Plan:**
   - Plan Name: Enterprise Monthly
   - Amount: ₹9999
   - Billing Period: Monthly
   - Billing Cycle: Infinite (999999)
   - Save the Plan ID (e.g., `plan_yyyyyyyyyyyyy`)

## Step 2: Set Up Webhook

1. In Razorpay Dashboard, go to **Settings** → **Webhooks**
2. Click **Add New Webhook**
3. Set the webhook URL: `https://your-backend-domain.com/subscriptions/webhook`
4. Select the following events:
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.paused`
   - `subscription.resumed`
   - `subscription.cancelled`
   - `subscription.expired`
   - `invoice.paid`
   - `subscription.charged_failed`
5. Save and copy the **Webhook Secret** (you'll need this for `.env`)

## Step 3: Configure Environment Variables

Add the following to your `backend/.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Optional: If your plan IDs differ from defaults
RAZORPAY_PLAN_PROFESSIONAL=plan_xxxxxxxxxxxxx
RAZORPAY_PLAN_ENTERPRISE=plan_yyyyyyyyyyyyy
```

## Step 4: Install Dependencies

Make sure Razorpay Python SDK is installed:

```bash
cd backend
source venv/bin/activate
pip install razorpay
```

Or reinstall all requirements:

```bash
pip install -r requirements.txt
```

## Step 5: Run Database Migration

Run the migration script to create the subscriptions table:

```bash
cd backend
source venv/bin/activate
python migrate_add_subscriptions.py
```

## Step 6: Restart Backend

Restart your backend server to load the new configuration:

```bash
# Using startup script
./stop-services.sh
./start-services.sh

# Or manually
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

## Step 7: Frontend Configuration (Optional)

If you need to configure Razorpay Checkout on the frontend, you'll need to:

1. Install Razorpay Checkout script (already handled in subscription page)
2. Ensure your frontend can access the subscription API endpoints

## Testing

1. **Test Subscription Creation:**
   - Log in to your application
   - Navigate to `/subscription`
   - Click "Subscribe" on Professional or Enterprise plan
   - Complete the Razorpay payment flow

2. **Test Webhook:**
   - Use Razorpay's webhook testing tool in dashboard
   - Or use a webhook testing service like webhook.site temporarily

3. **Test Subscription Management:**
   - Pause/Resume subscription
   - Cancel subscription
   - Sync subscription status

## API Endpoints

- `GET /subscriptions/plans` - Get available subscription plans
- `GET /subscriptions/` - Get current subscription
- `POST /subscriptions/create` - Create new subscription
- `POST /subscriptions/pause` - Pause subscription
- `POST /subscriptions/resume` - Resume subscription
- `POST /subscriptions/cancel` - Cancel subscription
- `POST /subscriptions/sync` - Sync subscription from Razorpay
- `POST /subscriptions/webhook` - Razorpay webhook handler

## Important Notes

1. **Currency:** All amounts are in INR (Indian Rupees)
2. **Billing:** Subscriptions are set to bill monthly indefinitely (999999 cycles)
3. **Free Plan:** Free plan doesn't require Razorpay subscription
4. **Webhook Security:** Always verify webhook signatures in production
5. **Plan IDs:** Make sure to use the correct plan IDs from Razorpay dashboard

## Troubleshooting

### Subscription creation fails
- Check if Razorpay keys are correct
- Verify plan IDs exist in Razorpay dashboard
- Check backend logs for detailed error messages

### Webhook not working
- Verify webhook URL is accessible from internet
- Check webhook secret is correct
- Ensure webhook events are selected in Razorpay dashboard
- Check backend logs for webhook processing errors

### Subscription status not updating
- Use the "Sync Status" button in subscription page
- Check webhook is properly configured
- Verify webhook events are being received

## Support

For Razorpay-specific issues, refer to:
- Razorpay Documentation: https://razorpay.com/docs/
- Razorpay Support: support@razorpay.com







