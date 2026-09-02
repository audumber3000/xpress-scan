import React from 'react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { LifeBuoy, Mail, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_RAW,
  isSupportOnline,
  supportResponseTime,
} from '../../constants/support';
import { formatPrice, billingCurrency } from '../../utils/plans';

/**
 * "If anything goes wrong, we will sort it out."
 *
 * Money leaving an account is the most anxious moment in the product, and the
 * old checkout said nothing about what happens if it fails. This block sits
 * under the pay button on purpose: the reassurance has to be visible *before*
 * someone commits, not only on an error screen they may never reach.
 *
 * The WhatsApp message is seeded with the clinic, plan and amount so nobody has
 * to explain their situation twice, and the desk can look the payment up before
 * replying. Availability and response time come from constants/support.js, the
 * same source the header's support card uses, so the two can never disagree.
 */

const WhatsAppGlyph = ({ size = 16 }) => (
  <WhatsAppIcon size={16} />
);

const PaymentHelp = ({ amount = 0, currency = billingCurrency(), plan = 'Plus', compact = false }) => {
  const { user } = useAuth();
  const online = isSupportOnline();

  const message = encodeURIComponent(
    [
      'Hi MolarPlus support, I need help with a payment.',
      user?.clinic?.name ? `Clinic: ${user.clinic.name}` : null,
      `Plan: ${plan}`,
      amount ? `Amount: ${formatPrice(amount, currency)}` : null,
    ].filter(Boolean).join('\n')
  );
  const waLink = `https://wa.me/${SUPPORT_PHONE_RAW}?text=${message}`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#9B8CFF]/12 text-[#2a276e] grid place-items-center flex-shrink-0">
          <LifeBuoy size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900">Payment trouble? We will sort it out</h3>
          <p className="text-xs text-gray-500 leading-relaxed mt-1">
            If a payment fails, gets stuck, or the money leaves your account without the plan
            activating, message us and we will fix it. Nothing is lost and you will not be
            charged twice.
          </p>

          {/* Live availability rather than a generic promise. Both values come
              from constants/support.js, which knows the desk sits in IST. */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${online ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="text-[11px] text-gray-500">
              {online ? 'Team is online now' : 'Team is offline right now'}
              {', typically replies in '}
              <b className="text-gray-700">{supportResponseTime(online)}</b>
            </span>
          </div>

          <div className={`flex ${compact ? 'flex-col' : 'flex-col sm:flex-row'} gap-2 mt-3.5`}>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[2.75rem] rounded-lg bg-[#25D366] hover:bg-[#1ebe57] text-white text-sm font-bold transition-colors"
            >
              <WhatsAppGlyph /> Chat on WhatsApp
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Payment help')}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[2.75rem] rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:border-gray-300 transition-colors"
            >
              <Mail size={15} /> Email us
            </a>
          </div>

          {/* The same help exists inside the app, so nobody has to keep this
              page open or hunt for the number later. */}
          <p className="text-[11px] text-gray-400 mt-3 flex items-start gap-1.5 leading-relaxed">
            <MessageCircle size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              You can reach the same team any time from <b className="text-gray-600">Support Center</b> in
              the app sidebar, so you do not need to keep this page open.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentHelp;
