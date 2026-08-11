import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  LifeBuoy,
  Lightbulb,
  Mail,
  MessageCircle,
  Phone,
  PlayCircle,
  Send,
  Star,
  Ticket,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import FeatureRequestsBoard from '../components/support/FeatureRequestsBoard';
// Shared with the header's support card — see constants/support.js. Two copies
// of a phone number is one number that eventually goes stale.
import {
  SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_RAW,
  SUPPORT_WHATSAPP_TEXT as WHATSAPP_TEXT,
} from '../constants/support';

const STATUS_COLORS = {
  open: 'bg-amber-100 text-amber-700 border border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border border-blue-200',
  resolved: 'bg-green-100 text-green-700 border border-green-200',
  closed: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-700 border border-red-200',
  high: 'bg-orange-100 text-orange-700 border border-orange-200',
  normal: 'bg-blue-100 text-blue-600 border border-blue-200',
  low: 'bg-gray-100 text-gray-500 border border-gray-200',
};


const heroVideo = {
  title: 'MolarPlus Demo — Modern Dental Clinic Management Software',
  description:
    'Start here for a full walkthrough of MolarPlus — daily workflows and where to find key features.',
  youtubeId: 'geAX_4K-O9c',
  duration: '',
};

const videoSections = [
  {
    title: 'Download & Install MolarPlus',
    description: 'Get the MolarPlus dental clinic management software set up on your computer.',
    youtubeId: 't1AWTbaKJ_E',
    duration: '',
    tag: 'Setup',
  },
  {
    title: 'Clinic Setup Guide — First Steps After Signup',
    description: 'Configure your clinic in the MolarPlus admin panel right after signing up.',
    youtubeId: 'dRchVyjrVGQ',
    duration: '',
    tag: 'Getting Started',
  },
  {
    title: 'Book Patient Appointments',
    description: 'Learn how to book and manage patient appointments in MolarPlus.',
    youtubeId: '-pW5txU376A',
    duration: '',
    tag: 'Appointments',
  },
  {
    title: 'Create Patient Invoices',
    description: 'Generate and manage patient invoices and billing in MolarPlus.',
    youtubeId: 'mnXGbX9B7ME',
    duration: '',
    tag: 'Billing',
  },
  {
    title: 'Manage Lab Orders',
    description: 'Create and track dental lab orders end-to-end in MolarPlus.',
    youtubeId: 'RoU7z34DxPk',
    duration: '',
    tag: 'Lab',
  },
];

/**
 * Support Center navigation — a flat list, no category headings.
 * Mirrors the Control Center's two-pane shell.
 */
const SUPPORT_NAV = [
  { id: 'account', icon: UserRoundCheck, label: 'My Account Manager' },
  { id: 'videos', icon: PlayCircle, label: 'Video Resources' },
  { id: 'tickets', icon: LifeBuoy, label: 'Support Tickets' },
  { id: 'features', icon: Lightbulb, label: 'Feature Requests' },
  { id: 'rate', icon: Star, label: 'Rate Us' },
];

/**
 * Platform marks, drawn inline.
 *
 * Hotlinking brand assets is how the Cashfree logo ended up 403ing on the
 * checkout page. These are self-contained, so the section cannot break because
 * somebody else's CDN changed its mind.
 */
const MARKS = {
  trustpilot: (
    <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true">
      <path fill="#00b67a" d="M12 1.6l3.2 6.9 7.3.8-5.4 5 1.5 7.4L12 18l-6.6 3.7 1.5-7.4-5.4-5 7.3-.8z" />
    </svg>
  ),
  capterra: (
    // Four brand-coloured bands fanning from one corner, which is what makes
    // the Capterra mark recognisable at this size.
    <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true">
      <path fill="#ff9d28" d="M3 21L10.27 3.44A19 19 0 0 0 3 2Z" />
      <path fill="#68c5ed" d="M3 21L16.44 7.56A19 19 0 0 0 10.27 3.44Z" />
      <path fill="#044d80" d="M3 21L20.56 13.73A19 19 0 0 0 16.44 7.56Z" />
      <path fill="#e54747" d="M3 21L22 21A19 19 0 0 0 20.56 13.73Z" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true">
      <path fill="#00a0ff" d="M3.6 1.3a1.9 1.9 0 00-.5 1.4v18.6c0 .6.2 1.1.5 1.4l.1.1 10.4-10.4v-.2L3.7 1.2z" />
      <path fill="#ffbc00" d="M17.7 16.3l-3.5-3.5v-.3l3.5-3.5.1.1 4.1 2.4c1.2.7 1.2 1.8 0 2.4l-4.1 2.4z" />
      <path fill="#00d562" d="M17.8 16.2l-3.6-3.6L3.6 23.1c.4.4 1.1.5 1.8.1l12.4-7z" />
      <path fill="#ff3a44" d="M17.8 8.9L5.4.8C4.7.4 4 .5 3.6.9l10.6 10.5z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true">
      <path
        fill="#111"
        d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.3-3.2zM14.2 6.2c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3z"
      />
    </svg>
  ),
  microsoft: (
    <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true">
      <path fill="#f25022" d="M2 2h9.4v9.4H2z" />
      <path fill="#7fba00" d="M12.6 2H22v9.4h-9.4z" />
      <path fill="#00a4ef" d="M2 12.6h9.4V22H2z" />
      <path fill="#ffb900" d="M12.6 12.6H22V22h-9.4z" />
    </svg>
  ),
};

/**
 * Where a clinic can say what it thinks in public.
 *
 * Grouped by what the visit costs them: the review sites take a few minutes of
 * writing, the app stores take a tap. Nobody is asked to do all five.
 */
const RATE_PLATFORMS = [
  {
    group: 'Review sites',
    note: 'A few honest lines here is what other clinics read before they trust us.',
    items: [
      {
        id: 'trustpilot',
        name: 'Trustpilot',
        blurb: 'The one most people check first. Open to everyone, no account needed to read it.',
        url: 'https://ie.trustpilot.com/review/molarplus.com',
      },
      {
        id: 'capterra',
        name: 'Capterra',
        blurb: 'Where practices compare clinic software side by side before they shortlist.',
        url: 'https://reviews.capterra.com/products/new/10632a9c-f3f9-48a6-bee3-30b29f7dbb73/?lang=en',
      },
    ],
  },
  {
    group: 'App stores',
    note: 'If you use MolarPlus on a phone or the desktop app, a rating takes one tap.',
    items: [
      {
        id: 'play',
        name: 'Google Play',
        blurb: 'For the Android app.',
        url: 'https://play.google.com/store/apps/details?id=com.molarplus.app&hl=en_IE&pli=1',
      },
      {
        id: 'apple',
        name: 'App Store',
        blurb: 'For iPhone and iPad.',
        url: 'https://apps.apple.com/us/app/molarplus/id6765472713',
      },
      {
        id: 'microsoft',
        name: 'Microsoft Store',
        blurb: 'For the Windows desktop app.',
        url: 'https://apps.microsoft.com/detail/9n78rx7phv9k?hl=en-US&gl=IE',
      },
    ],
  },
];

const RateUsPanel = ({ onOpenFeatures }) => (
  <>
    {/* The ask, said plainly. This is a favour, not a feature, so it reads like
        one person talking to another rather than a product announcement. */}
    <section className="rounded-2xl border border-[#2a276e]/15 bg-[#2a276e] p-6 md:p-8 text-white">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
        <Star size={12} className="fill-current" />
        A small favour
      </span>
      <h3 className="mt-4 text-xl md:text-2xl font-bold leading-snug max-w-2xl">
        We are a small team, and almost everything MolarPlus does today started with
        a clinic telling us what was missing.
      </h3>
      <p className="mt-3 text-sm md:text-[15px] leading-relaxed text-white/80 max-w-2xl">
        We build late, we ship often, and we read every word you send us. If the app has
        saved you time, saying so in public is the single biggest help you can give us.
        It is how other clinics find us, and it is how we know which parts are worth
        building on. If something still frustrates you, say that too. We would rather
        hear it than not.
      </p>
      <button
        onClick={onOpenFeatures}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#2a276e] transition-colors hover:bg-white/90"
      >
        Tell us what to build next
        <ArrowRight size={15} />
      </button>
    </section>

    {RATE_PLATFORMS.map((section) => (
      <section key={section.group} className="mt-6">
        <h4 className="text-sm font-bold text-gray-900">{section.group}</h4>
        <p className="text-sm text-gray-500 mt-0.5">{section.note}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {section.items.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-[#2a276e]/40"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 flex-shrink-0">{MARKS[p.id]}</span>
                <span className="text-[15px] font-bold text-gray-900">{p.name}</span>
              </div>
              <p className="mt-2.5 flex-1 text-sm leading-6 text-gray-500">{p.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#2a276e]">
                Leave a review
                <ExternalLink size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>
      </section>
    ))}

    <p className="mt-6 text-sm text-gray-500">
      Reviews are public and written by you, so we cannot edit or remove them. If something
      is wrong, raise a ticket first and we will try to fix it before you write.
    </p>
  </>
);

/**
 * AccountManagerCard — the manager assigned to this clinic.
 *
 * Renders strictly from clinic.account_manager_* (set by the support team, not
 * the clinic). When nobody is assigned it shows an empty state and the general
 * support channels — never a placeholder person.
 */
const AccountManagerCard = ({ clinic }) => {
  const name = clinic?.account_manager_name;
  const role = clinic?.account_manager_role;
  const email = clinic?.account_manager_email;
  const phone = clinic?.account_manager_phone;

  if (!name) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2a276e]/5">
          <UserRoundCheck size={22} className="text-[#2a276e]/40" />
        </div>
        <p className="text-sm font-medium text-gray-500">No account manager assigned yet</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-gray-400">
          Your clinic doesn't have a dedicated manager right now. The support team below can help
          with anything you need.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`https://wa.me/${SUPPORT_PHONE_RAW}?text=${WHATSAPP_TEXT}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <MessageCircle size={16} className="text-[#25D366]" /> WhatsApp support
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Mail size={16} className="text-[#2a276e]" /> {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    );
  }

  const phoneRaw = (phone || '').replace(/[^\d]/g, '');
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm max-w-xl">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2a276e] to-[#5b57c4] text-lg font-bold text-white">
          {name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900 truncate">{name}</p>
          {role && <p className="text-sm text-gray-500 truncate">{role}</p>}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {email && (
          <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-[#2a276e]">
            <Mail size={16} className="text-[#2a276e] flex-shrink-0" />
            <span className="truncate">{email}</span>
          </a>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-[#2a276e]">
            <Phone size={16} className="text-[#2a276e] flex-shrink-0" />
            <span>{phone}</span>
          </a>
        )}
      </div>

      {phone && (
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2a276e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1a1548]"
          >
            <Phone size={16} /> Call now
          </a>
          <a
            href={`https://wa.me/${phoneRaw}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <MessageCircle size={16} className="text-[#25D366]" /> WhatsApp
          </a>
        </div>
      )}
    </div>
  );
};

const Chip = ({ label, colorMap }) => (
  <span
    className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
      colorMap[label] || 'bg-gray-100 text-gray-500 border border-gray-200'
    }`}
  >
    {label?.replace('_', ' ')}
  </span>
);

const VideoEmbedCard = ({
  title,
  description,
  youtubeId,
  duration,
  badge,
  featured = false,
  cardless = false,
}) => {
  const hasVideo = Boolean(youtubeId);
  const embedUrl = hasVideo
    ? `https://www.youtube.com/embed/${youtubeId}`
    : null;

  return (
    <div
      className={`${
        cardless
          ? ''
          : `bg-white border border-gray-200 ${
              featured ? 'rounded-2xl p-5 md:p-6 shadow-sm' : 'rounded-xl p-4 shadow-sm'
            }`
      }`}
    >
      <div
        className={`overflow-hidden bg-gray-950 aspect-video ${
          cardless ? 'rounded-2xl border border-gray-200 shadow-sm' : 'rounded-xl border border-gray-200'
        }`}
      >
        {hasVideo ? (
          <iframe
            className="h-full w-full"
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <div className="relative flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,186,124,0.18),transparent_45%),linear-gradient(135deg,#19163f,#2a276e)]">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="relative text-center px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/12 backdrop-blur-sm">
                <PlayCircle size={32} className="text-white" />
              </div>
              <p className="text-base font-semibold text-white">YouTube video placeholder</p>
              <p className="mt-1 text-sm text-white/70">
                Add the YouTube video ID in this page when the video is ready.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`${cardless ? 'mt-4 px-1' : 'mt-4'}`}>
        <div className="flex flex-wrap items-center gap-2">
          {badge && (
            <span className="inline-flex rounded-full bg-[#2a276e]/5 px-2.5 py-1 text-xs font-semibold text-[#2a276e]">
              {badge}
            </span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              <Clock3 size={12} />
              {duration}
            </span>
          )}
        </div>
        <h2 className={`${featured ? 'text-2xl' : 'text-lg'} mt-3 font-bold text-gray-900`}>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
      </div>
    </div>
  );
};

const VideoTableRow = ({ section, index }) => {
  const hasVideo = Boolean(section.youtubeId);
  const youtubeUrl = hasVideo ? `https://www.youtube.com/watch?v=${section.youtubeId}` : null;

  return (
    <tr className="transition-colors hover:bg-gray-50">
      <td className="px-4 py-4 text-sm font-semibold text-gray-900">{String(index + 1).padStart(2, '0')}</td>
      <td className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#2a276e]/8 text-[#2a276e]">
            <PlayCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{section.title}</p>
            <p className="mt-1 text-sm leading-6 text-gray-500">{section.description}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="inline-flex rounded-full bg-[#2a276e]/5 px-2.5 py-1 text-xs font-semibold text-[#2a276e]">
          {section.tag}
        </span>
      </td>
      <td className="px-4 py-4 text-right">
        {hasVideo ? (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            View
            <ExternalLink size={14} />
          </a>
        ) : (
          <span className="inline-flex rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-400">
            Pending
          </span>
        )}
      </td>
    </tr>
  );
};

export default function SupportTickets() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  // Mobile only: false = show the nav, true = show the chosen section.
  // Ignored on md+, where both panes render side by side.
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'setup',
    priority: 'normal',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/support-tickets');
      setTickets(res.tickets || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadDetail = async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await api.get(`/support-tickets/${id}`);
      setDetail(res);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    setReplySending(true);
    try {
      await api.post(`/support-tickets/${selectedId}/messages`, { body: reply });
      setReply('');
      loadDetail(selectedId);
    } catch (e) {
      console.error(e);
    } finally {
      setReplySending(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/support-tickets', form);
      setForm({ title: '', description: '', category: 'setup', priority: 'normal' });
      await loadTickets();
      loadDetail(res.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const go = (id) => { setActiveTab(id); setMobileShowContent(true); };

  return (
    // h-full, not min-h-full: this renders inside <main>, already below the header.
    <div className="flex h-full w-full bg-[#f8fafc] overflow-hidden">
      {/* Left nav — flat list, no category headings.
          Two panes only from lg. At 768 the app sidebar plus this 18rem nav left
          the content about 224px wide, which squeezed every tab on the page into
          a column two or three words across. Below lg the nav is the first
          screen and picking an entry opens it full width. */}
      <div className={`${mobileShowContent ? 'hidden lg:flex' : 'flex'} w-full lg:w-72 bg-white border-r border-gray-200 flex-col h-full shrink-0 shadow-sm z-10`}>
        <div className="p-6 border-b border-gray-100/80">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <LifeBuoy size={22} className="text-[#2a276e]" />
            Support Center
          </h2>
          <p className="text-sm text-gray-500 mt-1 ml-8">Select an option below</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {SUPPORT_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 mb-0.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#2a276e]/10 to-transparent border-l-4 border-[#2a276e] text-[#2a276e] font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent hover:border-gray-200'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={20} className={isActive ? 'text-[#2a276e]' : 'text-gray-500'} />
                  <span className="font-medium tracking-wide text-[14px]">{item.label}</span>
                </span>
                {isActive && <ChevronRight size={16} className="text-[#2a276e]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content pane */}
      <div className={`${mobileShowContent ? 'flex' : 'hidden lg:flex'} flex-1 flex-col h-full overflow-hidden`}>
        <button
          onClick={() => setMobileShowContent(false)}
          className="lg:hidden flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-[#2a276e] bg-white border-b border-gray-200 shrink-0"
        >
          <ChevronDown size={18} className="rotate-90" />
          Support Center menu
        </button>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 lg:p-8">
        {activeTab === 'account' && (
          <>
            <div className="mb-5">
              <h3 className="text-lg font-bold text-gray-900">My Account Manager</h3>
              <p className="text-sm text-gray-500 mt-0.5">Feel free to reach out for any queries</p>
            </div>
            <AccountManagerCard clinic={user?.clinic} />
          </>
        )}

        {activeTab === 'features' && <FeatureRequestsBoard />}

        {activeTab === 'rate' && <RateUsPanel onOpenFeatures={() => go('features')} />}

        {activeTab === 'videos' && (
        <>
        <section className="rounded-3xl border border-[#2a276e]/10 bg-white shadow-sm overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-5 md:p-6 lg:p-7">
              <VideoEmbedCard
                title={heroVideo.title}
                description={heroVideo.description}
                youtubeId={heroVideo.youtubeId}
                duration={heroVideo.duration}
                badge="Hero video"
                featured
                cardless
              />
            </div>

            <div className="border-t border-gray-200 bg-[linear-gradient(180deg,#f7f8fc_0%,#eef7f4_100%)] p-5 md:p-6 lg:border-l lg:border-t-0">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900">Direct support</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  For urgent questions, reach the team directly. For tracked issues, create a
                  support ticket below.
                </p>

                <div className="mt-5 space-y-3">
                  <a
                    href={`https://web.whatsapp.com/send?phone=${SUPPORT_PHONE_RAW}&text=${WHATSAPP_TEXT}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl bg-[#00ba7c] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#009e6a]"
                  >
                    <span className="flex items-center gap-3">
                      <MessageCircle size={18} />
                      WhatsApp Support
                    </span>
                    <ExternalLink size={16} />
                  </a>

                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-3">
                      <Mail size={18} className="text-[#2a276e]" />
                      Email Support
                    </span>
                    <ExternalLink size={16} className="text-gray-400" />
                  </a>
                </div>

                <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Contact details
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <MessageCircle size={16} className="text-[#00ba7c]" />
                      {SUPPORT_PHONE}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <Mail size={16} className="text-[#2a276e]" />
                      {SUPPORT_EMAIL}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-2xl font-bold text-gray-900">Section-wise tutorials</h2>
                <p className="mt-1 text-sm text-gray-500">
                  A clean list of all tutorial videos by workflow area.
                </p>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Video Topic
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Section
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Link
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {videoSections.map((section, index) => (
                      <VideoTableRow key={section.title} section={section} index={index} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 md:hidden">
                {videoSections.map((section, index) => {
                  const hasVideo = Boolean(section.youtubeId);
                  const youtubeUrl = hasVideo
                    ? `https://www.youtube.com/watch?v=${section.youtubeId}`
                    : null;

                  return (
                    <div key={section.title} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-400">
                            {String(index + 1).padStart(2, '0')}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{section.title}</p>
                        </div>
                        <span className="inline-flex rounded-full bg-[#2a276e]/5 px-2.5 py-1 text-xs font-semibold text-[#2a276e]">
                          {section.tag}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-500">{section.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-gray-500">{section.duration}</span>
                        {hasVideo ? (
                          <a
                            href={youtubeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700"
                          >
                            View
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="inline-flex rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-400">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        </>
        )}

        {activeTab === 'tickets' && (
        <>
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Still need help?</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Send a tracked request to the MolarPlus support team.
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-[#00ba7c]/10 px-3 py-1 text-xs font-semibold text-[#00ba7c]">
                  {total} open history
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Briefly describe the issue"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
                    >
                      <option value="setup">Setup</option>
                      <option value="billing">Billing</option>
                      <option value="bug">Bug</option>
                      <option value="feature">Feature Request</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={5}
                    placeholder="Tell us what happened, what you expected, and what you need help with."
                    className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
                  />
                </div>

                <button
                  onClick={handleCreate}
                  disabled={submitting || !form.title.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2a276e] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a1548] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Submitting ticket...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Submit support ticket
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Recent tickets</h2>
                  <p className="mt-1 text-sm text-gray-500">Review your latest support requests.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setDetail(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <Ticket size={15} />
                  Clear selection
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-7 w-7 rounded-full border-4 border-[#2a276e] border-t-transparent animate-spin" />
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                    <Ticket size={28} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No tickets yet</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Use the form above if you want our team to review an issue.
                    </p>
                  </div>
                ) : (
                  tickets.slice(0, 5).map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => {
                        loadDetail(ticket.id);
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                        selectedId === ticket.id
                          ? 'border-[#2a276e]/30 bg-[#2a276e]/5'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {ticket.title}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">#{ticket.id}</p>
                        </div>
                        <ArrowRight size={16} className="mt-0.5 flex-shrink-0 text-gray-300" />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Chip label={ticket.status} colorMap={STATUS_COLORS} />
                        <Chip label={ticket.priority} colorMap={PRIORITY_COLORS} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {(detailLoading || detail) && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {detailLoading ? 'Loading ticket...' : detail?.ticket?.title}
                  </h2>
                  {!detailLoading && detail?.ticket && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Chip label={detail.ticket.status} colorMap={STATUS_COLORS} />
                      <Chip label={detail.ticket.priority} colorMap={PRIORITY_COLORS} />
                      <span className="text-xs text-gray-400 capitalize">{detail.ticket.category}</span>
                      <span className="text-xs text-gray-400">#{detail.ticket.id}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedId(null);
                    setDetail(null);
                    setReply('');
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>

              {!detailLoading && detail?.ticket?.description && (
                <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                  {detail.ticket.description}
                </p>
              )}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-7 w-7 rounded-full border-4 border-[#2a276e] border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                <div className="max-h-[420px] space-y-4 overflow-y-auto p-6">
                  {detail?.messages?.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                      <p className="text-sm text-gray-500">No replies yet. Our team will respond soon.</p>
                    </div>
                  )}

                  {detail?.messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.is_staff ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          message.is_staff
                            ? 'bg-[#2a276e]/10 text-[#2a276e]'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {message.is_staff ? 'MP' : message.sender_name?.[0] || 'U'}
                      </div>

                      <div
                        className={`flex max-w-[80%] flex-col gap-1 ${
                          message.is_staff ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-700">
                            {message.sender_name}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {message.created_at?.slice(0, 16).replace('T', ' ')}
                          </span>
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                            message.is_staff
                              ? 'rounded-tr-sm bg-[#2a276e] text-white'
                              : 'rounded-tl-sm bg-gray-100 text-gray-800'
                          }`}
                        >
                          {message.body}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {detail?.ticket?.status !== 'closed' && (
                  <div className="border-t border-gray-200 p-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply();
                        }}
                        rows={3}
                        placeholder="Add a reply... (Ctrl+Enter to send)"
                        className="min-h-[92px] flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20"
                      />
                      <button
                        onClick={handleReply}
                        disabled={replySending || !reply.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2a276e] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1548] disabled:opacity-50"
                      >
                        {replySending ? (
                          <>
                            <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            Send reply
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        </>
        )}
        </div>
      </div>
    </div>
  );
}
