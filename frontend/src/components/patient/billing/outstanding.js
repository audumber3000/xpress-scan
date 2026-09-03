/**
 * Which of this patient's bills can still take a payment, oldest first.
 *
 * Extracted because two screens now offer Record payment for the same patient,
 * the billing tab and the overview's financial summary, and they have to agree
 * on the answer. If one of them thought a draft could take money and the other
 * did not, the same click would do two different things depending on which tab
 * you happened to be looking at.
 *
 * Drafts and cancelled bills are excluded: an unissued invoice is not money
 * anybody owes, which is how the rest of the app counts it too.
 *
 * Oldest first, because that is the bill a clinic chasing money means.
 */
export const owingInvoices = (invoices = []) => invoices
  .filter((i) => Number(i.due_amount || 0) > 0
    && !['draft', 'cancelled'].includes(String(i.status || '').toLowerCase()))
  .sort((a, b) => new Date(a.finalized_at || a.created_at || 0)
    - new Date(b.finalized_at || b.created_at || 0));

export default owingInvoices;
