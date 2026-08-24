/**
 * Print a patient's whole file as one sheet.
 *
 * Entirely client-side: every section is built from data the profile page has
 * already loaded, so printing costs no extra requests. Follows the same
 * mechanism as the prescription print in PrescriptionDrawer.jsx (build HTML,
 * blob it, open a window, auto-print, revoke on afterprint) so both sheets come
 * out of the clinic's branding the same way.
 */
import { formatDate, clinicToday } from './datetime';
import { getCurrencySymbol } from './currency';

// Anything interpolated into the sheet is user-entered, so it is escaped. A
// patient named with an angle bracket should print, not become markup.
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// chief_complaint and friends arrive as a JSON *string* ('["Pain"]') as often
// as an array, so rendering one directly prints the brackets and quotes.
const pills = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : [p]; } catch { return [val]; }
  }
  return typeof val === 'string' && val.trim() ? [val] : [];
};

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN')}`;

const row = (label, value) =>
  value ? `<tr><td class="k">${esc(label)}</td><td class="v">${esc(value)}</td></tr>` : '';

export function printPatientFile({ patient, casePapers = [], invoices = [], prescriptions = [], user }) {
  if (!patient) return;

  const clinicName = user?.clinic?.name || 'MolarPlus Dental Clinic';
  const clinicPhone = user?.clinic?.phone || '';
  const clinicAddress = user?.clinic?.address || '';
  const primaryColor = user?.clinic?.primary_color || '#1a2a6c';
  const logoUrl = user?.clinic?.logo_url;
  const printedOn = formatDate(clinicToday());

  // Drafts are not bills yet and cancelled ones are not owed, so neither counts
  // toward what this patient actually owes.
  const billable = invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled');
  const billed = billable.reduce((s, i) => s + Number(i.total || 0), 0);
  const paid = billable.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const due = billable.reduce(
    (s, i) => s + Number(i.due_amount ?? Math.max(0, (i.total || 0) - (i.paid_amount || 0))),
    0
  );

  const visitRows = casePapers.map((p, idx) => {
    const complaint = pills(p.chief_complaint).join(', ') || 'General checkup';
    const dentist = p.dentist_name || (typeof p.dentist === 'string' ? p.dentist : '') || 'Not assigned';
    return `<tr>
      <td>${casePapers.length - idx}</td>
      <td>${esc(formatDate(p.date))}</td>
      <td>${esc(complaint)}</td>
      <td>${esc(p.diagnosis || '')}</td>
      <td>${esc(dentist)}</td>
    </tr>`;
  }).join('');

  const rxRows = prescriptions.map((rx) => {
    const names = (Array.isArray(rx.items) ? rx.items : [])
      .map((i) => i?.medicine_name)
      .filter(Boolean)
      .join(', ');
    if (!names) return '';
    return `<tr><td>${esc(formatDate(rx.created_at))}</td><td>${esc(names)}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Patient File - ${esc(patient.name)}</title>
<style>
  :root { --primary: ${primaryColor}; --muted: #555; --line: #ddd; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; font-size: 13px; margin: 0; line-height: 1.4; }
  .strip { height: 10px; background: var(--primary); }
  .page { padding: 32px 44px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--line); padding-bottom: 14px; margin-bottom: 18px; }
  .head-left { display: flex; align-items: center; gap: 14px; }
  .head h1 { margin: 0; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; font-size: 22px; }
  .head p { margin: 2px 0; font-size: 11px; color: var(--muted); }
  .head-right { text-align: right; font-size: 11px; color: var(--muted); }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); border-bottom: 1px solid var(--line); padding-bottom: 5px; margin: 22px 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #eee; vertical-align: top; }
  th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
  .kv td.k { width: 150px; color: var(--muted); font-weight: 600; }
  .kv td.v { font-weight: 600; }
  .alert { background: #fff8e1; border: 1px solid #ffe08a; border-radius: 5px; padding: 9px 12px; margin: 10px 0; font-weight: 600; }
  .totals { display: flex; gap: 26px; margin-top: 8px; }
  .totals div { font-size: 12px; }
  .totals span { display: block; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  .due { color: #b45309; font-weight: 700; }
  .empty { color: #999; font-style: italic; font-size: 12px; padding: 6px 0; }
  .foot { margin-top: 26px; border-top: 1px solid var(--line); padding-top: 8px; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
  @media print { .strip { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="strip"></div>
<div class="page">
  <div class="head">
    <div class="head-left">
      ${logoUrl ? `<img src="${esc(logoUrl)}" style="width:62px;height:62px;object-fit:contain;" />` : ''}
      <div>
        <h1>${esc(clinicName)}</h1>
        ${clinicAddress ? `<p>${esc(clinicAddress)}</p>` : ''}
        ${clinicPhone ? `<p>${esc(clinicPhone)}</p>` : ''}
      </div>
    </div>
    <div class="head-right">
      <p><strong>Patient File</strong></p>
      <p>Printed ${esc(printedOn)}</p>
    </div>
  </div>

  <h2>Patient</h2>
  <table class="kv">
    ${row('Name', patient.name)}
    ${row('Patient ID', patient.display_id)}
    ${row('Age / Gender', [patient.age ? `${patient.age} yrs` : '', patient.gender].filter(Boolean).join(' / '))}
    ${row('Phone', patient.phone)}
    ${row('Village / City', patient.village)}
    ${row('Blood group', patient.blood_group)}
    ${row('Registered on', patient.registered_on ? formatDate(patient.registered_on) : '')}
    ${row('Referred by', patient.referred_by)}
  </table>
  ${patient.patient_history ? `<div class="alert">Medical alert: ${esc(patient.patient_history)}</div>` : ''}

  <h2>Visit history</h2>
  ${visitRows
    ? `<table><thead><tr><th>Visit</th><th>Date</th><th>Complaint</th><th>Diagnosis</th><th>Dentist</th></tr></thead><tbody>${visitRows}</tbody></table>`
    : '<p class="empty">No case papers recorded.</p>'}

  <h2>Prescriptions</h2>
  ${rxRows
    ? `<table><thead><tr><th>Date</th><th>Medicines</th></tr></thead><tbody>${rxRows}</tbody></table>`
    : '<p class="empty">No prescriptions recorded.</p>'}

  <h2>Billing summary</h2>
  <div class="totals">
    <div><span>Billed</span>${esc(money(billed))}</div>
    <div><span>Paid</span>${esc(money(paid))}</div>
    <div class="${due > 0 ? 'due' : ''}"><span>Outstanding</span>${esc(money(due))}</div>
  </div>

  <div class="foot">
    <span>${esc(clinicName)}</span>
    <span>This is a computer generated record.</span>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.onafterprint = () => URL.revokeObjectURL(url);
  return !!win;
}
