// Manual WhatsApp helpers.
//
// When a clinic turns on "send WhatsApp manually from my own number", patient
// message buttons stop calling the backend (which sends from the MolarPlus/MSG91
// number) and instead open WhatsApp with a prefilled message, so the dentist
// hits send from their own account.
//
// Two things matter for a good experience:
//   1. Web vs installed app — the installed app is a Tauri webview whose
//      wrapper routes unknown URL schemes / external links to the OS. So on
//      desktop we open the native WhatsApp app (whatsapp://); on web we open
//      WhatsApp Web.
//   2. No tab pile-up — on web we reuse ONE named tab; the desktop native app
//      is a single window that just switches chats.

import { getCurrencySymbol } from './currency';

// Calling codes for the markets we serve; default to India.
const CALLING_CODES = { IN: '91', US: '1', GB: '44', AE: '971', AU: '61', CA: '1', SG: '65', NZ: '64' };

/**
 * Normalize a phone number to international digits (no +, spaces or dashes) for
 * WhatsApp. A bare local number (<= 10 digits) gets the clinic country's code.
 */
export function toWhatsAppNumber(phone, countryCode = 'IN') {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  d = d.replace(/^0+/, ''); // drop trunk-prefix zeros before adding a calling code
  const cc = CALLING_CODES[countryCode] || CALLING_CODES.IN;
  if (d.length <= 10) d = cc + d; // longer numbers are assumed to already carry a code
  return d;
}

/** True inside the MolarPlus desktop (Tauri) wrapper. */
export const isDesktopApp = () => typeof window !== 'undefined' && !!window.__MOLARPLUS_DESKTOP__;

// Held reference to the WhatsApp Web tab we opened, so repeat sends reuse it
// instead of piling up tabs. A plain named-window target isn't enough because
// WhatsApp Web's Cross-Origin-Opener-Policy resets the tab name on load.
let waWebWindow = null;

/**
 * True when patient WhatsApp should be sent manually from the clinic's own
 * number. This only applies inside the installed desktop app — on the web the
 * app always uses the automated (MolarPlus/MSG91) send, even if the clinic
 * flag is on.
 */
export const isManualWhatsApp = (user) => isDesktopApp() && !!(user && user.clinic && user.clinic.manual_whatsapp);

/**
 * Open WhatsApp with a prefilled message to `phone`, without piling up tabs.
 * Returns false if the number is unusable.
 */
export function openWhatsApp(phone, text, countryCode = 'IN') {
  const num = toWhatsAppNumber(phone, countryCode);
  if (!num) return false;
  const encoded = encodeURIComponent(text || '');

  if (isDesktopApp()) {
    // Native WhatsApp Desktop app — one window, switches chats, no browser tabs.
    // The wrapper's on_navigation hook hands unknown schemes to the OS handler.
    const appUrl = `whatsapp://send?phone=${num}&text=${encoded}`;
    const a = document.createElement('a');
    a.href = appUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  // Web — reuse the SAME tab across sends. We deliberately open wa.me (not
  // web.whatsapp.com): web.whatsapp.com sends Cross-Origin-Opener-Policy:
  // same-origin, which severs our handle and resets the tab name, forcing a new
  // tab every time. wa.me is COOP: unsafe-none, so both the held reference and
  // the named target survive and the browser reuses the tab.
  const webUrl = `https://wa.me/${num}?text=${encoded}`;
  try {
    if (waWebWindow && !waWebWindow.closed) {
      waWebWindow.location.href = webUrl;
      waWebWindow.focus();
      return true;
    }
  } catch (_) {
    // Reference severed — fall through and open a fresh one.
  }
  waWebWindow = window.open(webUrl, 'molarplus_whatsapp');
  if (waWebWindow) waWebWindow.focus();
  return true;
}

/**
 * Manually share an invoice: download its PDF (to attach in the chat) and open
 * WhatsApp with a prefilled message to the patient. Returns true if WhatsApp
 * opened; throws only on the download step. Callers surface the toast.
 */
export async function shareInvoiceManually(invoice, user) {
  const phone = invoice?.patient_phone;
  if (!phone) return false;
  await downloadAuthedFile(
    `/invoices/${invoice.id}/pdf`,
    `invoice_${invoice.invoice_number || invoice.id}.pdf`
  );
  const clinicName = user?.clinic?.name || 'our clinic';
  const cur = getCurrencySymbol();
  const total = Number(invoice.total || 0).toLocaleString('en-IN');
  const msg = `Hello ${invoice.patient_name || ''}, here is your invoice ${invoice.invoice_number || ''} from ${clinicName} for ${cur}${total}. I've attached the PDF here. Thank you!`;
  return openWhatsApp(phone, msg, user?.clinic?.country || 'IN');
}

/**
 * Download an authed file (e.g. an invoice PDF) to the user's machine, so they
 * can attach it in the manual WhatsApp chat (wa.me can't prefill attachments).
 * `path` is relative to /api/v1 (e.g. `/invoices/12/pdf`).
 */
export async function downloadAuthedFile(path, filename) {
  const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const res = await fetch(`${baseURL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
