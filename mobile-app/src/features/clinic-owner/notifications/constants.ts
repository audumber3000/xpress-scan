import { Mail, MessageSquare, Smartphone } from 'lucide-react-native';

/**
 * Shared constants for the mobile Notification Center — ported 1:1 from the web
 * (frontend/src/pages/admin/notifications/constants.jsx) so labels, audiences and
 * per-message costs stay identical across platforms.
 */

export const EVENT_AUDIENCE: Record<string, 'patient' | 'doctor' | 'owner'> = {
  appointment_booked: 'patient',
  appointment_confirmation: 'patient',
  checked_in: 'patient',
  invoice_notification: 'patient',
  prescription_notification: 'patient',
  appointment_reminder: 'patient',
  google_review: 'patient',
  consent_form: 'patient',
  daily_summary: 'doctor',
  daily_report: 'doctor',
  molarplus_app_welcome: 'owner',
  molarplus_subscription_confirmed: 'owner',
  molarplus_topup_success: 'owner',
  molarplus_weekly_report_mk: 'owner',
  molarplus_monthly_report_mk: 'owner',
  molarplus_review_report_mk: 'owner',
  molarplus_lab_due_tomorrow_mk: 'owner',
  molarplus_trial_started_mk: 'owner',
  molarplus_trial_mid_mk: 'owner',
  molarplus_trial_ending_mk: 'owner',
  molarplus_trial_ended_mk: 'owner',
};

export const EVENT_LABELS: Record<string, string> = {
  appointment_booked: 'Appointment Booked',
  appointment_confirmation: 'Appointment Confirmed',
  checked_in: 'Patient Checked In',
  invoice_notification: 'Invoice Sent',
  prescription_notification: 'Prescription Sent',
  appointment_reminder: 'Appointment Reminder',
  google_review: 'Google Review Request',
  consent_form: 'Consent Form Notification',
  daily_summary: 'Doctor Daily Summary',
  daily_report: 'Daily Report',
  molarplus_app_welcome: 'Welcome Message',
  molarplus_subscription_confirmed: 'Subscription Confirmed',
  molarplus_topup_success: 'Wallet Top-up Success',
  molarplus_weekly_report_mk: 'Weekly Report',
  molarplus_monthly_report_mk: 'Monthly Report',
  molarplus_review_report_mk: 'Monthly Review Reminder',
  molarplus_lab_due_tomorrow_mk: 'Lab Order Due Tomorrow',
  molarplus_trial_started_mk: 'Trial Started',
  molarplus_trial_mid_mk: 'Trial — Day 4 Nudge',
  molarplus_trial_ending_mk: 'Trial Ending Soon',
  molarplus_trial_ended_mk: 'Trial Ended',
};

/** System-sent owner messages — preview + test only, no channel toggles. */
export const AUTOMATED_EVENTS: { event_type: string; channels: string[] }[] = [
  { event_type: 'molarplus_app_welcome', channels: ['whatsapp', 'email'] },
  { event_type: 'molarplus_subscription_confirmed', channels: ['whatsapp', 'email'] },
  { event_type: 'molarplus_topup_success', channels: ['whatsapp', 'email'] },
  { event_type: 'molarplus_weekly_report_mk', channels: ['whatsapp'] },
  { event_type: 'molarplus_monthly_report_mk', channels: ['whatsapp'] },
  { event_type: 'molarplus_review_report_mk', channels: ['whatsapp'] },
  { event_type: 'molarplus_lab_due_tomorrow_mk', channels: ['whatsapp'] },
  { event_type: 'molarplus_trial_started_mk', channels: ['whatsapp'] },
  { event_type: 'molarplus_trial_mid_mk', channels: ['whatsapp'] },
  { event_type: 'molarplus_trial_ending_mk', channels: ['whatsapp'] },
  { event_type: 'molarplus_trial_ended_mk', channels: ['whatsapp'] },
];

export const MARKETING_EVENTS = new Set<string>([
  'google_review', 'molarplus_weekly_report_mk', 'molarplus_monthly_report_mk',
  'molarplus_review_report_mk', 'molarplus_trial_started_mk', 'molarplus_trial_mid_mk',
  'molarplus_trial_ending_mk', 'molarplus_trial_ended_mk',
]);

/** Per-message wallet cost — matches the backend wallet_service.get_cost. */
export const getChannelCost = (channel: string, eventType = ''): number => {
  if (channel === 'whatsapp') return MARKETING_EVENTS.has(eventType) ? 0.8631 : 0.115;
  if (channel === 'email') return 0.02;
  if (channel === 'sms') return 0.15;
  return 0;
};

export type ChannelKey = 'whatsapp' | 'email' | 'sms';

export const CHANNELS: ChannelKey[] = ['whatsapp', 'email', 'sms'];

export const CHANNEL_META: Record<ChannelKey, {
  label: string;
  color: string;
  bg: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}> = {
  whatsapp: { label: 'WhatsApp', color: '#25D366', bg: '#E8FFF1', Icon: Smartphone },
  email:    { label: 'Email',    color: '#0EA5E9', bg: '#E0F2FE', Icon: Mail },
  sms:      { label: 'SMS',      color: '#F59E0B', bg: '#FEF3C7', Icon: MessageSquare },
};

/** Sample values used to render a template preview in the test sheet. */
export const previewRender = (content: string, currencySymbol: string): string =>
  content
    .replace(/\{\{?patient_name\}?\}/g, 'Rahul Sharma')
    .replace(/\{\{?doctor_name\}?\}/g, 'Dr. Mehta')
    .replace(/\{\{?clinic_name\}?\}/g, 'Your Clinic')
    .replace(/\{\{?appointment_date\}?\}/g, 'Tomorrow, 10:30 AM')
    .replace(/\{\{?appointment_time\}?\}/g, '10:30 AM')
    .replace(/\{\{?invoice_amount\}?\}/g, `${currencySymbol}850`)
    .replace(/\{\{?invoice_number\}?\}/g, 'INV-001')
    .replace(/\{\{?review_link\}?\}/g, 'https://g.page/r/example')
    .replace(/\{\{?consent_link\}?\}/g, 'https://molarplus.com/consent/demo')
    .replace(/\{\{?report_date\}?\}/g, 'Today');
