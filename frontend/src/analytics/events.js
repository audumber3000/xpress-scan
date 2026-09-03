// Single catalog of PostHog event names. Import from here instead of typing
// raw strings so names stay consistent across the app and are easy to audit.
export const EVENTS = {
  // ── Activation funnel ──────────────────────────────────────────────
  SIGNUP_COMPLETED: 'signup_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // ── Onboarding, step by step ───────────────────────────────────────
  // Until these existed we could see that 40% of new owners never finished
  // the wizard and had no way at all to see which screen lost them. Every
  // event below carries { step, step_name } so the funnel reads in order.
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_STEP_BACK: 'onboarding_step_back',
  // Fired from the exit-intent nudge, so "left on purpose" is distinguishable
  // from "closed the tab", which is the difference between a copy problem and
  // a friction problem.
  ONBOARDING_EXIT_INTENT: 'onboarding_exit_intent',
  ONBOARDING_ABANDONED: 'onboarding_abandoned',
  ONBOARDING_SUBMIT_FAILED: 'onboarding_submit_failed',
  // Address: did the map actually save them typing?
  ONBOARDING_ADDRESS_PICKED: 'onboarding_address_picked',
  ONBOARDING_ADDRESS_MANUAL: 'onboarding_address_manual',
  // Verification, the step that blocks the end of signup.
  ONBOARDING_OTP_SENT: 'onboarding_otp_sent',
  ONBOARDING_OTP_SEND_FAILED: 'onboarding_otp_send_failed',
  ONBOARDING_OTP_RESENT: 'onboarding_otp_resent',
  ONBOARDING_OTP_WRONG: 'onboarding_otp_wrong',
  ONBOARDING_OTP_VERIFIED: 'onboarding_otp_verified',
  ONBOARDING_CONTACTS_EDITED: 'onboarding_contacts_edited',
  ONBOARDING_SUPPORT_CLICKED: 'onboarding_support_clicked',
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
