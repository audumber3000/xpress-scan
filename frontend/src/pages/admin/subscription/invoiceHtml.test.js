import { describe, it, expect } from 'vitest';
import { buildInvoiceHtml } from './invoiceHtml';

// The page's text, without markup or the stylesheet.
const text = (html) => html
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

const base = { invoice: 'INV-1', date: '19 Sep 2026', status: 'PAID', plan: 'Plus' };

describe('buildInvoiceHtml', () => {
  it('prints an Indian payment as a GST tax invoice paid through Cashfree', () => {
    const t = text(buildInvoiceHtml({ ...base, amount: 470.82, tax_amount: 71.82, currency: 'INR', provider: 'cashfree' }));
    expect(t).toContain('TAX INVOICE');
    expect(t).toContain('GST at 18%');
    expect(t).toContain('Payment: Cashfree');
    expect(t).not.toContain('merchant of record');
  });

  it('prints a dollar payment as a receipt, with Dodo stating the tax and no GST anywhere', () => {
    const t = text(buildInvoiceHtml({ ...base, plan: 'Pro', amount: 8, tax_amount: 1.2, currency: 'USD', provider: 'dodo' }));
    expect(t).toContain('RECEIPT');
    expect(t).not.toContain('TAX INVOICE');
    expect(t).not.toContain('GST');
    expect(t).toContain('Payment: Dodo Payments');
    expect(t).toContain('Local tax, included and collected by Dodo Payments $1.2');
    expect(t).toContain('Dodo Payments is the merchant of record');
  });

  it('names the gateway from the currency when an old row has no provider', () => {
    expect(text(buildInvoiceHtml({ ...base, amount: 399, currency: 'INR' }))).toContain('Payment: Cashfree');
    expect(text(buildInvoiceHtml({ ...base, amount: 4, currency: 'USD' }))).toContain('Payment: Dodo Payments');
  });
});
