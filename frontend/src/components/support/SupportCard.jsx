import React, { useState } from 'react';
import { Phone, Mail, Clock, X } from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import {
  SUPPORT_AGENT, SUPPORT_EMAIL, SUPPORT_PHONE,
  supportGreeting, supportHoursLabel, supportResponseTime, supportWhatsAppLink,
} from '../../constants/support';

/**
 * The support card behind the headset button in the header.
 *
 * Built around a person, not a department. It used to open on the words "Talk
 * to support" over a headset glyph and a list of contact details, which is a
 * directory entry: correct, and the kind of thing you put off using. This
 * opens on Rohit's face, his status, and a line addressed to you by name, so
 * the obvious move is to reply to it.
 *
 * Offline is stated rather than hidden. A card that looks equally available at
 * 3am earns one unanswered message and then never gets trusted again, so the
 * dot goes amber, the greeting changes, and the staffed hours are printed at
 * the bottom.
 */

/**
 * His face, with initials standing in if the avatar service is unreachable.
 * `size` is a Tailwind pair, because the same face appears twice: large in the
 * identity band, small again beside his message.
 */
const AgentAvatar = ({ online, size = 'w-14 h-14', dot = true, ring = 'ring-2 ring-white' }) => {
  const [failed, setFailed] = useState(false);
  const text = size === 'w-14 h-14' ? 'text-lg' : 'text-[11px]';

  return (
    <div className="relative shrink-0">
      {failed ? (
        <div className={`${size} ${ring} rounded-full bg-[#2a276e] text-white flex items-center justify-center ${text} font-bold`}>
          {SUPPORT_AGENT.initials}
        </div>
      ) : (
        <img
          src={SUPPORT_AGENT.avatarUrl}
          alt={SUPPORT_AGENT.name}
          onError={() => setFailed(true)}
          className={`${size} ${ring} rounded-full bg-white object-cover`}
        />
      )}
      {/* The dot sits on the face, the way every messaging app does it, so
          "can I reach him right now" is answered before anything is read. */}
      {dot && (
        <span
          className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-[3px] border-white ${
            online ? 'bg-emerald-500' : 'bg-amber-400'
          }`}
          title={online ? 'Online now' : 'Offline right now'}
        />
      )}
    </div>
  );
};

const SupportCard = ({ user, online, onClose }) => (
  <div className="absolute right-0 mt-2 w-[23rem] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-200 z-20 overflow-hidden">
    {/* Identity band. Tinted so the person reads as the header of the card
        rather than its first list item. */}
    <div className="relative px-5 py-4 bg-gradient-to-br from-[#2a276e] to-[#3b378f]">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 p-1 text-white/60 hover:text-white rounded-lg transition-colors"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-3.5">
        <AgentAvatar online={online} />
        <div className="min-w-0">
          <p className="text-base font-bold text-white leading-tight truncate">
            {SUPPORT_AGENT.name}
          </p>
          <p className="text-xs text-white/70 mt-0.5 truncate">{SUPPORT_AGENT.role}</p>
          <span className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-white/90">
            <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-300'}`} />
            {online ? 'Online now' : `Back at ${supportHoursLabel().split(' to ')[0]}`}
          </span>
        </div>
      </div>
    </div>

    {/* What he says, laid out as a message someone sent you: his face on the
        left, his name over the bubble, the bubble's top-left corner squared off
        into a tail. The bubble used to float on its own under the header, and
        because the text opens with the reader's OWN name ("Hi Audumber"), there
        was nothing to say the sender was Rohit rather than the card labelling
        you. Attribution has to be visible, not inferred. */}
    <div className="px-5 pt-4">
      <div className="flex items-start gap-2.5">
        <div className="animate-avatar-pop">
          <AgentAvatar size="w-8 h-8" dot={false} ring="ring-1 ring-gray-200" />
        </div>
        <div className="min-w-0 flex-1">
          {/* Both scale from top-left, the corner touching his face, so the name
              and the bubble travel together out of the avatar. */}
          <p className="text-[11px] font-bold text-gray-400 mb-1 animate-bubble-pop">
            {SUPPORT_AGENT.name.split(' ')[0]}
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl rounded-tl-sm px-3.5 py-2.5 animate-bubble-pop">
            <p className="text-sm text-gray-700 leading-relaxed">{supportGreeting(user, online)}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="px-5 pt-4 pb-3">
      <a
        href={supportWhatsAppLink(user)}
        target="_blank"
        rel="noreferrer"
        onClick={onClose}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[15px] font-bold transition-colors"
      >
        <WhatsAppIcon size={19} /> Chat with {SUPPORT_AGENT.name.split(' ')[0]}
      </a>

      {/* Call and email are the fallbacks, so they are quieter than the chat
          button rather than three equal choices to weigh up. */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <a
          href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Phone size={15} className="text-gray-400" /> Call
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Mail size={15} className="text-gray-400" /> Email
        </a>
      </div>
    </div>

    {/* Says how long before you would start wondering, not after. */}
    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center gap-2 text-xs text-gray-500">
      <Clock size={14} className="text-gray-400 shrink-0" />
      <span>
        Replies in <span className="font-semibold text-gray-700">{supportResponseTime(online)}</span>
        <span className="text-gray-400"> &middot; {supportHoursLabel()}</span>
      </span>
    </div>
  </div>
);

export default SupportCard;
