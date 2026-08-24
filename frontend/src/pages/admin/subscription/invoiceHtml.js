import { formatPrice } from '../../../utils/plans';

/**
 * A printable invoice for one subscription payment.
 *
 * Lifted out of the Subscription page, where 120 lines of inline CSS sat in the
 * middle of a React component and made the page hard to read for the sake of a
 * button almost nobody presses.
 *
 * Two things it now gets right that the old one did not:
 *
 * 1. The currency comes from the PAYMENT, not from `getCurrencySymbol()`. That
 *    helper returns the currency the clinic bills its patients in, which has
 *    nothing to do with what we charged them. A clinic invoicing patients in
 *    dirhams was shown "AED 899" for a charge that left the account as ₹899.
 * 2. GST is itemised. An Indian clinic can only claim input credit against a
 *    tax invoice that states the tax, so a single inclusive total was not much
 *    use to the people most likely to want the download.
 * 3. A promo discount is shown as its own line, naming the code. A clinic that
 *    was given 20% off should be able to see that it was, and the line sits
 *    ABOVE the tax line because that is the order it was applied in: the
 *    discount reduces the taxable value rather than the tax reducing it.
 */
export function buildInvoiceHtml(inv, clinicName = '') {
  const currency = inv.currency || 'INR';
  const money = (n) => formatPrice(n, currency);

  const total = Number(inv.amount || 0);
  const discount = Number(inv.discount_amount || 0);
  // Older payments predate the tax_amount column. Their split is unknown, and
  // inventing one would put a number on a tax invoice nobody actually charged,
  // so they print as a single line with no tax row.
  const tax = inv.tax_amount == null ? null : Number(inv.tax_amount);
  // What was charged, less tax: the taxable value AFTER any discount.
  const taxable = tax == null ? total : total - tax;
  // The line item has to show the LIST price, because the discount row beneath
  // it then subtracts down to the taxable value. Printing the already-discounted
  // figure and then subtracting again would make the column not add up, which on
  // a tax invoice is the one thing an accountant will notice.
  const listBase = taxable + discount;
  const taxPct = tax && taxable ? Math.round((tax / taxable) * 100) : 0;

  const row = (label, value, bold = false) => `
        <tr${bold ? ' class="total-row"' : ''}>
          <td colspan="2">${label}</td>
          <td style="text-align:right">${value}</td>
        </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${inv.invoice}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a1a; padding: 48px; max-width: 720px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 2px solid #f0f0f0; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 40px; height: 40px; background: #29828a; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .brand-icon svg { width: 22px; height: 22px; }
    .brand-name { font-size: 22px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: #888; margin-top: 1px; }
    .invoice-meta { text-align: right; }
    .invoice-title { font-size: 28px; font-weight: 700; color: #29828a; letter-spacing: -0.5px; }
    .invoice-num { font-size: 13px; color: #888; margin-top: 4px; font-family: monospace; }
    .badges { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
    .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .section { margin-bottom: 36px; }
    .section-label { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .info-card { background: #f9fafb; border-radius: 12px; padding: 16px 20px; }
    .info-card p { font-size: 13px; color: #555; line-height: 1.7; }
    .info-card strong { color: #1a1a1a; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.8px; }
    td { padding: 12px 14px; font-size: 13px; color: #333; border-bottom: 1px solid #f0f0f0; }
    .total-row td { font-weight: 700; font-size: 15px; color: #1a1a1a; background: #f9fafb; border-bottom: none; border-top: 2px solid #e5e7eb; }
    .total-row td:last-child { color: #29828a; font-size: 17px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center; font-size: 11px; color: #bbb; line-height: 1.8; }
    @media print { body { padding: 32px; } }
    @media (max-width: 640px) { body { padding: 20px; } .header, .two-col { display: block; } .invoice-meta { text-align: left; margin-top: 16px; } .badges { justify-content: flex-start; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9z" fill="white" opacity="0.3"/>
          <path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">MolarPlus</div>
        <div class="brand-sub">Dental Practice Software</div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">${tax ? 'TAX INVOICE' : 'INVOICE'}</div>
      <div class="invoice-num">${inv.invoice}</div>
      <div class="badges">
        <span class="badge ${inv.status === 'PAID' ? 'badge-paid' : 'badge-pending'}">${inv.status}</span>
      </div>
    </div>
  </div>

  <div class="section two-col">
    <div>
      <div class="section-label">Billed by</div>
      <div class="info-card">
        <p><strong>MolarPlus Technologies</strong><br/>support@molarplus.com<br/>India</p>
      </div>
    </div>
    <div>
      <div class="section-label">${clinicName ? 'Billed to' : 'Invoice details'}</div>
      <div class="info-card">
        <p>${clinicName ? `<strong>${clinicName}</strong><br/>` : ''}<strong>Invoice Date:</strong> ${inv.date}<br/><strong>Invoice No:</strong> ${inv.invoice}<br/><strong>Payment:</strong> Cashfree</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Summary</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Period</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${inv.plan}</strong><br/><span style="font-size:12px;color:#888">MolarPlus subscription</span></td>
          <td style="color:#888">${inv.date}</td>
          <td style="text-align:right">${money(listBase)}</td>
        </tr>
        ${discount > 0
          ? row(`Discount${inv.coupon_code ? ` (${inv.coupon_code})` : ''}`, `-${money(discount)}`)
          : ''}
        ${tax ? row(`GST at ${taxPct}%`, money(tax)) : ''}
        ${row('Total', money(total), true)}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Thank you for using MolarPlus · This is a computer-generated invoice · No signature required<br/>
    For support: support@molarplus.com
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

/** Open the invoice in a new tab and hand it straight to the print dialog. */
export function openInvoice(inv, clinicName) {
  const blob = new Blob([buildInvoiceHtml(inv, clinicName)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.onafterprint = () => URL.revokeObjectURL(url);
}
