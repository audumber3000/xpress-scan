import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  Mail,
  MessageCircle,
  PlayCircle,
  Send,
  Ticket,
  X,
} from 'lucide-react';
import { api } from '../utils/api';

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

const SUPPORT_EMAIL = 'support@molarplus.com';
const SUPPORT_PHONE = '+91 9594078777';
const SUPPORT_PHONE_RAW = '919594078777';
const WHATSAPP_TEXT = encodeURIComponent(
  'Hi MolarPlus support team, I need help with the app.'
);

const heroVideo = {
  title: 'Welcome to MolarPlus Learning',
  description:
    'Start here for a quick walkthrough of the platform, daily workflows, and where to find key features.',
  youtubeId: '',
  duration: '3-5 min',
};

const videoSections = [
  {
    title: 'Getting Started',
    description: 'Clinic setup, onboarding, and first-day essentials for your team.',
    youtubeId: '',
    duration: '4 min',
    tag: 'Setup',
  },
  {
    title: 'Appointments & Calendar',
    description: 'Learn how to book, manage, and track appointments smoothly.',
    youtubeId: '',
    duration: '5 min',
    tag: 'Workflow',
  },
  {
    title: 'Patients & Clinical Records',
    description: 'Organize patient profiles, treatment notes, and files with confidence.',
    youtubeId: '',
    duration: '6 min',
    tag: 'Patients',
  },
  {
    title: 'Billing & Payments',
    description: 'Handle invoices, transactions, and payment tracking in one place.',
    youtubeId: '',
    duration: '4 min',
    tag: 'Finance',
  },
  {
    title: 'Reports & Insights',
    description: 'Use reports to stay on top of practice performance and decisions.',
    youtubeId: '',
    duration: '5 min',
    tag: 'Analytics',
  },
  {
    title: 'Admin & Team Settings',
    description: 'Manage users, permissions, templates, and practice-level configuration.',
    youtubeId: '',
    duration: '4 min',
    tag: 'Admin',
  },
];

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
      <td className="px-4 py-4 text-sm text-gray-500">{section.duration}</td>
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

  return (
    <div className="min-h-full bg-[#f7f8fc]">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
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

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.22fr_0.78fr]">
          <div>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="text-2xl font-bold text-gray-900">Section-wise tutorials</h2>
                <p className="mt-1 text-sm text-gray-500">
                  A clean list of all tutorial videos by workflow area.
                </p>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
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
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Duration
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
      </div>
    </div>
  );
}
