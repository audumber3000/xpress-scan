// Single catalog of PostHog event names. Import from here instead of typing
// raw strings so names stay consistent across the app and are easy to audit.
export const EVENTS = {
  // ── Activation funnel ──────────────────────────────────────────────
  SIGNUP_COMPLETED: 'signup_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PATIENT_CREATED: 'patient_created',
  APPOINTMENT_BOOKED: 'appointment_booked',
  INVOICE_FINALIZED: 'invoice_finalized',
  WHATSAPP_MESSAGE_SENT: 'whatsapp_message_sent',

  // ── Monetization ───────────────────────────────────────────────────
  FREE_TRIAL_STARTED: 'free_trial_started',
  SUBSCRIPTION_CTA_CLICKED: 'subscription_cta_clicked',
  PAYMENT_BUTTON_CLICKED: 'payment_button_clicked',
  SUBSCRIPTION_DOWNGRADED: 'subscription_downgraded',
  TRIAL_ENDED: 'trial_ended',

  // ── Engagement ─────────────────────────────────────────────────────
  SETTINGS_UPDATED: 'settings_updated',
  FEATURE_REQUEST_SUBMITTED: 'feature_request_submitted',
  WAREACH_CONNECTED: 'wareach_connected',
};
