import React from 'react';

/**
 * Accepted payment marks, drawn inline.
 *
 * Every mark is local SVG. The page this replaces hotlinked Cashfree's logo
 * from cashfree.com, which returns 403, so the trust badge on the payment step
 * rendered as a broken image. Nothing on a checkout should depend on a third
 * party's asset host being reachable and willing.
 *
 * These are the accepted-here marks a card network expects a merchant to show.
 * The geometric ones (Mastercard's interlocking circles, the UPI chevrons) are
 * drawn to shape; the wordmarks are set in the brand's colour rather than
 * traced letterform by letterform, which is accurate enough to be recognised at
 * 20px and avoids shipping a traced trademark.
 */

const Frame = ({ children, title, w = 40 }) => (
  <span
    title={title}
    aria-label={title}
    role="img"
    className="inline-flex items-center justify-center h-7 bg-white border border-gray-200 rounded"
    style={{ width: w }}
  >
    {children}
  </span>
);

export const VisaMark = () => (
  <Frame title="Visa">
    <svg viewBox="0 0 40 14" className="w-[30px]" aria-hidden="true">
      <text
        x="20" y="11" textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="12" fontStyle="italic" fontWeight="700"
        letterSpacing="-0.3" fill="#1A1F71"
      >VISA</text>
    </svg>
  </Frame>
);

export const MastercardMark = () => (
  <Frame title="Mastercard">
    <svg viewBox="0 0 40 24" className="w-[30px]" aria-hidden="true">
      <circle cx="16" cy="12" r="7.5" fill="#EB001B" />
      <circle cx="24" cy="12" r="7.5" fill="#F79E1B" />
      {/* The overlap is the whole identity of the mark. */}
      <path
        d="M20 6.2a7.48 7.48 0 000 11.6 7.48 7.48 0 000-11.6z"
        fill="#FF5F00"
      />
    </svg>
  </Frame>
);

export const RuPayMark = () => (
  <Frame title="RuPay">
    <svg viewBox="0 0 44 14" className="w-[34px]" aria-hidden="true">
      <text
        x="0" y="11"
        fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="800"
        letterSpacing="-0.4" fill="#097DC6"
      >Ru</text>
      <text
        x="17" y="11"
        fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="800"
        letterSpacing="-0.4" fill="#F26F21"
      >Pay</text>
    </svg>
  </Frame>
);

export const UpiMark = () => (
  <Frame title="UPI" w={46}>
    <svg viewBox="0 0 52 14" className="w-[40px]" aria-hidden="true">
      <path d="M0 1h4.6l-3 12H-3z" fill="#097939" transform="translate(4)" />
      <path d="M5.5 1h4.6l-3 12H2.5z" fill="#ED752E" transform="translate(4)" />
      <text
        x="20" y="11"
        fontFamily="system-ui, sans-serif" fontSize="10" fontWeight="800"
        letterSpacing="0.2" fill="#0F3B57"
      >UPI</text>
    </svg>
  </Frame>
);

export const AmexMark = () => (
  <Frame title="American Express">
    <svg viewBox="0 0 40 24" className="w-[30px]" aria-hidden="true">
      <rect width="40" height="24" rx="2" fill="#2E77BC" />
      <text
        x="20" y="15" textAnchor="middle"
        fontFamily="system-ui, sans-serif" fontSize="7.5" fontWeight="800"
        letterSpacing="0.2" fill="#fff"
      >AMEX</text>
    </svg>
  </Frame>
);

export const NetbankingMark = () => (
  <Frame title="Netbanking" w={46}>
    <svg viewBox="0 0 24 20" className="w-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 8l10-5 10 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 8v8M9 8v8M15 8v8M20 8v8M2 18h20" strokeLinecap="round" />
    </svg>
  </Frame>
);

/**
 * The row shown under the payment method.
 *
 * Order is deliberate: UPI first because it is how most Indian clinics will
 * pay, then the card networks, then netbanking. Wraps rather than scrolls, so
 * nothing is hidden off the edge on a phone.
 */
const PaymentMarks = ({ className = '' }) => (
  <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
    <UpiMark />
    <VisaMark />
    <MastercardMark />
    <RuPayMark />
    <AmexMark />
    <NetbankingMark />
  </div>
);

export default PaymentMarks;
