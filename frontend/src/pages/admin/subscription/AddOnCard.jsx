import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, QrCode, ScanLine, ArrowRight, Check, CheckCircle2, Clock, BellRing } from 'lucide-react';
import WhatsAppIcon from '../../../components/common/WhatsAppIcon';
import { formatPrice } from '../../../utils/plans';
import { formatAddonDate, SERVICE_STEPS, SERVICE_STEP_LABELS } from '../../../utils/addons';
import { api } from '../../../utils/api';
import { SUPPORT_PHONE_RAW } from '../../../constants/support';

/**
 * One add-on, as a card.
 *
 * Laid out like the add-ons block on the pricing page: what it is and one line
 * on what it does at the top, its mark top right, and the price anchored bottom
 * left where the eye lands last. The action sits opposite the price.
 *
 * Every state the server can report has its own face, because "active until",
 * "free until", "included in Pro" and "coming soon" are four different answers
 * to the one question a clinic is asking, which is "do I have this".
 */

const ICONS = {
  whatsapp: { node: <WhatsAppIcon size={22} brand />, tint: 'bg-[#25D366]/10' },
  google_business: { node: <Store size={21} className="text-[#1a73e8]" />, tint: 'bg-[#1a73e8]/10' },
  upi: { node: <QrCode size={21} className="text-[#5f259f]" />, tint: 'bg-[#5f259f]/10' },
  xray: { node: <ScanLine size={21} className="text-[#29828a]" />, tint: 'bg-[#29828a]/10' },
};

const Chip = ({ tone, icon: Icon, children }) => {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    teal: 'bg-[#29828a]/10 text-[#1f6b72] border-[#29828a]/20',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
};

const ServiceSteps = ({ current, managerEmail }) => {
  const at = Math.max(0, SERVICE_STEPS.indexOf(current || 'requested'));
  return (
    <div className="mt-3">
      <ol className="flex items-center gap-1.5">
        {SERVICE_STEPS.map((step, i) => (
          <li key={step} className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={`h-1 rounded-full ${i <= at ? 'bg-[#29828a]' : 'bg-gray-200'}`} />
            <span className={`truncate text-[10px] font-semibold ${i <= at ? 'text-[#1f6b72]' : 'text-gray-400'}`}>
              {SERVICE_STEP_LABELS[step]}
            </span>
          </li>
        ))}
      </ol>
      {at === 0 && (
        <p className="mt-2 text-xs leading-relaxed text-gray-600">
          {managerEmail
            ? <>Add <span className="font-semibold">{managerEmail}</span> as a Manager on your Google Business Profile, and we take it from there.</>
            : 'Our team will message you within one working day with the next step.'}
        </p>
      )}
    </div>
  );
};

const AddOnCard = ({ item, cycle, clinicName, isOwner, managerEmail, onBuy }) => {
  const [notified, setNotified] = useState(false);
  const annual = cycle === 'annual';
  const icon = ICONS[item.icon] || ICONS.xray;
  const until = formatAddonDate(item.current_end);
  const { state } = item;

  const priceBlock = () => {
    if (state === 'included') {
      return <p className="text-2xl font-extrabold tracking-tight text-[#1f6b72]">Included</p>;
    }
    // A plan that already covers it is not being sold anything, even while the
    // add-on is still being built.
    if (item.included_by_plan) return null;
    if (!item.priced) {
      return item.included_from_plan
        ? <p className="text-sm font-semibold text-gray-500">Included with {item.included_from_plan}</p>
        : null;
    }
    const amount = annual ? item.annual_total : item.monthly;
    return (
      <div>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-extrabold tracking-tight tabular-nums ${state === 'coming_soon' ? 'text-gray-400' : 'text-gray-900'}`}>
            {formatPrice(amount, item.currency)}
          </span>
          <span className="text-xs font-medium text-gray-500">/ {annual ? 'year' : 'month'}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-gray-400">
          {annual && item.annual_monthly ? `${formatPrice(Math.round(item.annual_monthly), item.currency)} a month, save ${item.annual_pct_off}%` : 'Billed monthly'}
        </p>
      </div>
    );
  };

  const notifyMe = () => {
    setNotified(true);
    // Counted on the feature board, so we can see who is waiting. Best effort:
    // the card already says we heard them.
    api.post('/feature-requests', {
      title: `Add-on: ${item.label}`,
      description: `${clinicName || 'A clinic'} wants to know when ${item.label} is available.`,
    }).catch(() => {});
  };

  const action = () => {
    const ask = (label) => (
      <a
        href={`https://wa.me/${SUPPORT_PHONE_RAW}?text=${encodeURIComponent(`Hi MolarPlus team, I'd like to add ${item.label} for ${clinicName || 'my clinic'}.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[2.5rem] items-center gap-1.5 text-sm font-semibold text-[#29828a] hover:underline"
      >
        {label} <ArrowRight size={14} />
      </a>
    );

    const buy = (label, style = 'solid') => (
      <button
        onClick={() => onBuy(item.key, cycle)}
        disabled={!isOwner}
        title={isOwner ? undefined : 'Only the clinic owner can add this'}
        className={`inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          style === 'solid'
            ? 'bg-[#29828a] text-white hover:bg-[#216b71]'
            : 'border border-[#29828a] text-[#29828a] hover:bg-[#29828a]/5'
        }`}
      >
        {label} <ArrowRight size={14} />
      </button>
    );

    switch (state) {
      case 'not_bought':
        return buy('Add');
      case 'expired':
        return buy('Renew');
      case 'grace':
        return buy('Add now');
      case 'active':
        return buy('Renew early', 'outline');
      case 'included':
        if (item.manage_link) {
          return (
            <Link to={item.manage_link} className="inline-flex min-h-[2.5rem] items-center gap-1.5 text-sm font-semibold text-[#29828a] hover:underline">
              Set it up <ArrowRight size={14} />
            </Link>
          );
        }
        // Included, but a person has to do the work. Without this the clinic
        // is told it has something and given no way to start it.
        return item.fulfilment === 'managed' ? ask('Ask us to start') : null;
      case 'coming_soon':
        return (
          <button
            onClick={notifyMe}
            disabled={notified}
            className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-white disabled:border-emerald-200 disabled:text-emerald-700"
          >
            {notified ? <><Check size={14} /> We'll let you know</> : <><BellRing size={14} /> Notify me</>}
          </button>
        );
      case 'unavailable':
        return ask('Contact us');
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-[14rem] flex-col rounded-2xl border border-[#29828a]/15 bg-[#29828a]/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-snug text-[#1f6b72]">{item.label}</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{item.description}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${icon.tint}`}>
          {icon.node}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {state === 'included' && <Chip tone="teal" icon={CheckCircle2}>In your plan</Chip>}
        {state === 'active' && <Chip tone="green" icon={CheckCircle2}>Active until {until}</Chip>}
        {state === 'grace' && <Chip tone="amber" icon={Clock}>Free until {until}</Chip>}
        {state === 'expired' && <Chip tone="gray">Ended {until}</Chip>}
        {state === 'coming_soon' && <Chip tone="gray">Coming soon</Chip>}
        {state === 'coming_soon' && item.included_from_plan && item.priced && (
          <Chip tone="teal">Included with {item.included_from_plan}</Chip>
        )}
        {state === 'not_bought' && item.included_from_plan && (
          <span className="text-[11px] text-gray-500">Or included when you move to {item.included_from_plan}</span>
        )}
        {state === 'unavailable' && (
          <span className="text-[11px] text-gray-500">Available for clinics in India first. We can set it up for you.</span>
        )}
      </div>

      {item.fulfilment === 'managed' && (state === 'active' || state === 'grace') && (
        <ServiceSteps current={item.service_status} managerEmail={managerEmail} />
      )}

      {item.key === 'own_whatsapp' && (state === 'active' || state === 'grace') && item.manage_link && (
        <Link to={item.manage_link} className="mt-2 text-xs font-semibold text-[#29828a] hover:underline">
          Connect or manage your number
        </Link>
      )}

      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
        {priceBlock()}
        <div className="ml-auto">{action()}</div>
      </div>
    </div>
  );
};

export default AddOnCard;
