import React, { useState } from 'react';
import {
  Smartphone, Landmark, Zap, CheckCircle2, Receipt, ShieldCheck, BellRing, Check,
} from 'lucide-react';
import { api } from '../../../utils/api';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Payments tab — announced before it exists, on purpose.
 *
 * The thing being built is collect-and-settle: the patient pays into a virtual
 * account or UPI handle keyed to the clinic, the money lands in the clinic's
 * own bank account on the same day, and a verified webhook carrying the UTR
 * comes back to us so the bill can be marked paid without anybody reading a
 * bank SMS. That last part is the actual product: reconciliation, not a
 * payment button.
 *
 * The rails under it will be one of the collect-and-settle providers we are
 * evaluating (Decentro, Hypto, UroPay, VyaparGateway). Deliberately unnamed in
 * the copy below: none is signed yet, and a clinic that reads a vendor name
 * here will ask about it the day we pick a different one.
 */

const STEPS = [
  {
    icon: Smartphone,
    title: 'Patient pays',
    body: 'UPI, card, or a QR at the front desk. Same bill, one tap.',
    tint: 'bg-[#2a276e]/10 text-[#2a276e]',
  },
  {
    icon: Landmark,
    title: 'Straight to your bank',
    body: 'Money settles into the clinic’s own account. It never sits with us.',
    tint: 'bg-[#29828a]/10 text-[#29828a]',
  },
  {
    icon: Zap,
    title: 'T+0',
    body: 'Same day, not two working days later.',
    tint: 'bg-amber-100 text-amber-600',
  },
  {
    icon: CheckCircle2,
    title: 'Verified status, instantly',
    body: 'The bill marks itself paid the moment the bank confirms it.',
    tint: 'bg-emerald-100 text-emerald-600',
  },
];

const PROOF_POINTS = [
  {
    icon: Receipt,
    title: 'Every payment carries its UTR',
    body: 'The bank reference is stored on the payment, so a bill and a bank statement line can always be matched to each other.',
  },
  {
    icon: ShieldCheck,
    title: 'Confirmed by the bank, not by hand',
    body: 'No more taking a screenshot as proof. The paid status comes from the settlement itself, so nobody has to trust a forwarded message.',
  },
  {
    icon: BellRing,
    title: 'Reconciliation is the point',
    body: 'At close of day the register matches the bank without anybody typing amounts twice or hunting for a missing entry.',
  },
];

const PaymentsPanel = () => {
  const { user } = useAuth();
  const [registered, setRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);

  // At-the-control feedback, not a toast: the button says what happened, in
  // the place the click happened.
  const registerInterest = async () => {
    setRegistering(true);
    try {
      if (user?.role === 'clinic_owner') {
        await api.post('/feature-requests', {
          title: 'Payments: collect and settle',
          description:
            `${user?.clinic?.name || 'A clinic'} asked to be told when direct payment `
            + 'collection with same-day settlement and UTR matching goes live.',
        }).catch(() => {});
      }
      setRegistered(true);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-gray-900">Take payments, settled to your own bank</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wide">
                Launching soon
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-2xl">
              Patient pays, the money settles directly into the clinic&rsquo;s bank account the same
              day, and MolarPlus receives a verified payment status the moment it clears. The bill
              closes itself, with the bank&rsquo;s own reference number attached.
            </p>
          </div>

          <button
            onClick={registerInterest}
            disabled={registering || registered}
            className={`shrink-0 text-xs font-semibold rounded-lg px-4 py-2.5 border transition-colors ${
              registered
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600 cursor-default'
                : 'border-[#29828a] bg-[#29828a] text-white hover:bg-[#216b71] disabled:opacity-50'
            }`}
          >
            {registered
              ? <span className="inline-flex items-center gap-1.5"><Check size={13} /> We&rsquo;ll tell you</span>
              : registering ? 'Saving…' : 'Tell me when it’s live'}
          </button>
        </div>

        {/* The flow, in the order it happens */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mt-6">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative rounded-xl border border-gray-200 p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${step.tint}`}>
                <step.icon size={17} />
              </div>
              <p className="text-sm font-semibold text-gray-900 mt-3">{step.title}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.body}</p>
              <span className="absolute top-4 right-4 text-[10px] font-bold text-gray-300">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Why it matters — the reconciliation story */}
      <div className="grid gap-4 sm:grid-cols-3 mt-6">
        {PROOF_POINTS.map((point) => (
          <div key={point.title} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
              <point.icon size={17} />
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-3">{point.title}</p>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{point.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white/60 p-5">
        <h3 className="text-sm font-semibold text-gray-900">Until then</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Keep recording payments the way you do now, in Billing. Nothing you record today gets
          lost when this arrives: the settlement feed attaches to the same bills and payments,
          it does not replace them.
        </p>
      </div>
    </div>
  );
};

export default PaymentsPanel;
