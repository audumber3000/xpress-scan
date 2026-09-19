import React, { useEffect } from 'react';
import { ShieldAlert, Mail, Phone } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';

/**
 * The account has been suspended, and this is the whole screen.
 *
 * Deliberately built like SessionEndedModal rather than like PlanBlockedModal.
 * A plan that ran out leaves the clinic reading its own records with a modal
 * over the top; a suspension ends the session, so there is nothing behind this
 * to go back to:
 *   · solid backdrop         not a notice on a page — it is the page
 *   · no ✕, no Escape        closing it would only hide the truth
 *   · no dismiss on click    there is nothing underneath to reach
 *
 * **Every word comes from the server.** `core/suspension.py` decides which
 * suspension this is, because "you are running three accounts to keep
 * extending a trial" and "we have paused this while we check something" are
 * not the same message, and a card that guesses would tell a clinic on a
 * routine hold that it broke the rules.
 *
 * **Three ways to reach a person, on the card.** Somebody locked out of the
 * app cannot raise a support ticket inside it, and some of these suspensions
 * will be wrong. The cost of the ones that are is measured in how quickly the
 * clinic can get a human to look again — so WhatsApp, email and a phone number
 * are as prominent as the reason itself.
 */
const AccountSuspendedCard = ({ card, onSignOut }) => {
  useEffect(() => {
    const swallow = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', swallow, true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', swallow, true);
      document.body.style.overflow = previous;
    };
  }, []);

  if (!card) return null;

  const support = card.support || {};
  const emailSubject = encodeURIComponent(
    `Suspended account — ${card.clinic_name || 'my clinic'} (${card.reference || ''})`.trim()
  );
  const emailBody = encodeURIComponent(
    [
      'Hello MolarPlus support,',
      '',
      'Our account has been suspended and we would like it reviewed.',
      card.clinic_name ? `Clinic: ${card.clinic_name}` : null,
      card.reference ? `Reference: ${card.reference}` : null,
      '',
    ].filter((line) => line !== null).join('\n')
  );

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="account-suspended-title"
      className="fixed inset-0 z-[2100] flex items-center justify-center overflow-y-auto bg-[#f8fafc] p-4"
    >
      <div className="my-auto w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-7 shadow-xl animate-scale-in sm:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert size={30} />
        </div>

        <h2
          id="account-suspended-title"
          className="text-center text-xl font-bold text-gray-900"
        >
          {card.title || 'Your account has been suspended'}
        </h2>

        {card.clinic_name ? (
          <p className="mt-1 text-center text-sm font-medium text-gray-500">{card.clinic_name}</p>
        ) : null}

        <p className="mt-4 text-sm leading-relaxed text-gray-600">{card.message}</p>

        {/* What specifically leads here. Naming the behaviour is what turns
            "you broke the rules" into something the reader can answer. */}
        {card.examples?.length ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              What this usually means
            </p>
            <ul className="mt-2 space-y-1.5">
              {card.examples.map((example) => (
                <li key={example} className="flex gap-2 text-sm leading-relaxed text-gray-600">
                  <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                  <span>{example}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* The line support wrote about this clinic in particular. */}
        {card.note ? (
          <div className="mt-4 rounded-xl border-l-4 border-red-200 bg-red-50/60 px-4 py-3">
            <p className="text-sm leading-relaxed text-gray-700">{card.note}</p>
          </div>
        ) : null}

        {card.appeal ? (
          <p className="mt-4 text-sm leading-relaxed text-gray-600">{card.appeal}</p>
        ) : null}

        <div className="mt-6 space-y-2.5">
          {support.whatsapp ? (
            <a
              href={support.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1da851]"
            >
              <WhatsAppIcon size={18} />
              Chat with support on WhatsApp
            </a>
          ) : null}

          <div className="flex flex-col gap-2.5 sm:flex-row">
            {support.email ? (
              <a
                href={`mailto:${support.email}?subject=${emailSubject}&body=${emailBody}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Mail size={16} />
                Email support
              </a>
            ) : null}
            {support.phone ? (
              <a
                href={`tel:${support.phone_raw || support.phone}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Phone size={16} />
                Call {support.phone}
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center gap-1 border-t border-gray-100 pt-4 text-xs text-gray-500">
          {/* The reference is the first thing support asks for, so it is on
              the card rather than something the clinic has to find. */}
          {card.reference ? (
            <p>
              Reference <span className="font-semibold text-gray-700">{card.reference}</span>
              {support.hours ? ` · Support is online ${support.hours}` : ''}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSignOut}
            className="mt-1 font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSuspendedCard;
