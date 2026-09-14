import React from 'react';
import { ArrowRight, Store, CheckCircle2 } from 'lucide-react';
import WhatsAppIcon from '../../../components/common/WhatsAppIcon';
import { formatPrice } from '../../../utils/plans';
import { useAddonCatalogue } from '../../../utils/addons';

/**
 * A glimpse of the add-ons, under the plans.
 *
 * Deliberately quiet. It sits after the plan cards and the reassurance, where a
 * clinic has already made its plan decision, and it is labelled optional,
 * because extra prices beside ₹399 at the moment of choosing make the whole
 * thing feel dearer than it is and stall the one decision this page is for.
 * Two small tiles for what can be added today, one line for what is coming,
 * and a way through to the full Add-on Features tab.
 */

const ICONS = {
  whatsapp: <WhatsAppIcon size={16} brand />,
  google_business: <Store size={15} className="text-[#1a73e8]" />,
};

const AddOnsStrip = ({ onSeeAll }) => {
  const { catalogue } = useAddonCatalogue();
  const live = catalogue.addons.filter((a) => a.availability === 'live');
  const coming = catalogue.addons.filter((a) => a.availability === 'coming_soon');
  if (!live.length && !coming.length) return null;

  const tileNote = (a) => {
    if (a.state === 'included') return <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={11} /> In your plan</span>;
    if (a.state === 'active' || a.state === 'grace') return <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={11} /> Active</span>;
    if (a.priced && a.monthly) return <>from {formatPrice(a.monthly, a.currency)}/month</>;
    return 'Contact us';
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Optional add-ons for your clinic</h3>
          <p className="mt-0.5 text-xs text-gray-400">Not needed to use MolarPlus. Add them any time.</p>
        </div>
        <button
          onClick={onSeeAll}
          className="inline-flex min-h-[2.25rem] items-center gap-1 text-sm font-semibold text-[#29828a] hover:underline"
        >
          See all add-ons <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {live.map((a) => (
          <button
            key={a.key}
            onClick={onSeeAll}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#29828a]/40"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50">
              {ICONS[a.icon] || null}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-gray-800">{a.label}</span>
              <span className="block text-xs text-gray-500">{tileNote(a)}</span>
            </span>
          </button>
        ))}
      </div>

      {coming.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Coming soon: {coming.map((a) => a.label).join(' and ')}.
        </p>
      )}
    </section>
  );
};

export default AddOnsStrip;
