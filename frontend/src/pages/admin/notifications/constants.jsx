import { MessageCircle } from 'lucide-react';

export const WhatsAppIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#25D366" d="M4.868 43.303l2.694-9.835a19.5 19.5 0 01-2.612-9.768C4.953 13.001 13.954 4 25.003 4a19.45 19.45 0 0113.832 5.727A19.4 19.4 0 0144.56 23.51c-.005 10.745-8.734 19.5-19.557 19.5a19.55 19.55 0 01-9.352-2.38z" />
    <path fill="#fff" d="M31.07 27.32c-.51-.255-3.016-1.487-3.485-1.658-.47-.17-.81-.255-1.15.255-.34.51-1.32 1.658-1.617 2-.297.34-.595.383-1.105.128-.51-.256-2.152-.793-4.097-2.53-1.515-1.35-2.54-3.015-2.835-3.525-.297-.51-.032-.787.223-1.04.23-.23.51-.596.765-.893.255-.298.34-.51.51-.85.17-.34.085-.638-.043-.893-.128-.255-1.15-2.77-1.575-3.79-.414-.992-.837-.858-1.15-.874-.297-.013-.638-.016-.978-.016-.34 0-.893.128-1.36.638-.467.51-1.79 1.745-1.79 4.258 0 2.514 1.832 4.942 2.088 5.283.255.34 3.604 5.498 8.732 7.712 1.22.527 2.172.84 2.914 1.076 1.224.389 2.338.334 3.218.202.982-.146 3.016-1.232 3.443-2.42.427-1.19.427-2.21.298-2.42-.127-.212-.467-.34-.978-.595z" />
  </svg>
);

export const GmailIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 75.6 75.6" width={size} height={size}>
    <path d="M3.6 75.6h14.5V37.8L0 26.5v45.5c0 2 1.6 3.6 3.6 3.6z" fill="#4285F4" />
    <path d="M57.5 75.6H72c2 0 3.6-1.6 3.6-3.6V26.5L57.5 37.8z" fill="#34A853" />
    <path d="M57.5 3.6v34.2L75.6 26.5V7.2c0-4.4-5-6.9-8.5-4.3z" fill="#FBBC04" />
    <path d="M18.1 37.8V3.6l19.7 14.8 19.7-14.8v34.2L37.8 52.6z" fill="#EA4335" />
    <path d="M0 7.2v19.3l18.1 11.3V3.6L8.5.3C5-.5 0 1.5 0 7.2z" fill="#C5221F" />
  </svg>
);

export const EVENT_AUDIENCE = {
  appointment_booked:          'patient',
  appointment_confirmation:    'patient',
  checked_in:                  'patient',
  invoice_notification:        'patient',
  prescription_notification:   'patient',
  appointment_reminder:        'patient',
  google_review:               'patient',
  consent_form:                'patient',
  daily_summary:               'doctor',
  molarplus_app_welcome:              'owner',
  molarplus_subscription_confirmed:   'owner',
  molarplus_topup_success:            'owner',
  molarplus_weekly_report_mk:         'owner',
  molarplus_monthly_report_mk:        'owner',
  molarplus_review_report_mk:         'owner',
  molarplus_lab_due_tomorrow_mk:      'owner',
  molarplus_trial_started_mk:         'owner',
  molarplus_trial_mid_mk:             'owner',
  molarplus_trial_ending_mk:          'owner',
  molarplus_trial_ended_mk:           'owner',
};

export const EVENT_LABELS = {
  appointment_booked:       'Appointment Booked',
  appointment_confirmation: 'Appointment Confirmed',
  checked_in:               'Patient Checked In',
  invoice_notification:     'Invoice Sent',
  prescription_notification:'Prescription Sent',
  appointment_reminder:     'Appointment Reminder',
  google_review:            'Google Review Request',
  consent_form:             'Consent Form Notification',
  daily_summary:            'Doctor Daily Summary',
  molarplus_app_welcome:              'Welcome Message',
  molarplus_subscription_confirmed:   'Subscription Confirmed',
  molarplus_topup_success:            'Wallet Top-up Success',
  molarplus_weekly_report_mk:         'Weekly Report',
  molarplus_monthly_report_mk:        'Monthly Report',
  molarplus_review_report_mk:         'Monthly Review Reminder',
  molarplus_lab_due_tomorrow_mk:      'Lab Order Due Tomorrow',
  molarplus_trial_started_mk:         'Trial Started',
  molarplus_trial_mid_mk:             'Trial — Day 4 Nudge',
  molarplus_trial_ending_mk:          'Trial Ending Soon',
  molarplus_trial_ended_mk:           'Trial Ended',
};

export const MARKETING_EVENTS = new Set([
  'google_review', 'molarplus_weekly_report_mk', 'molarplus_monthly_report_mk',
  'molarplus_review_report_mk', 'molarplus_trial_started_mk', 'molarplus_trial_mid_mk',
  'molarplus_trial_ending_mk', 'molarplus_trial_ended_mk',
]);

export const getChannelCost = (channel, eventType = '') => {
  if (channel === 'whatsapp') return MARKETING_EVENTS.has(eventType) ? 0.8631 : 0.115;
  if (channel === 'email') return 0.02;
  if (channel === 'sms') return 0.15;
  return 0;
};

export const CHANNEL_META = {
  whatsapp: { label: 'WhatsApp', color: 'text-green-600',  bg: 'bg-white',      badge: 'bg-green-100 text-green-700',   icon: WhatsAppIcon,  priceLabel: '₹0.115 utility / ₹0.8631 marketing' },
  email:    { label: 'Email',    color: 'text-blue-600',   bg: 'bg-white',      badge: 'bg-blue-100 text-blue-700',     icon: GmailIcon,     priceLabel: '~₹0.02 / Mail' },
  sms:      { label: 'SMS',      color: 'text-purple-600', bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700', icon: MessageCircle, priceLabel: '~₹0.15 / SMS' },
};
