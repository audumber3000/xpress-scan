import React from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STORE_BADGES } from './registry';
import AnnouncementArt from './AnnouncementArt';

/** Registry fields may be a value or a function of the device context. */
const resolve = (value, ctx) => (typeof value === 'function' ? value(ctx) : value);

const BUTTON_CLASS = {
  primary: 'flex items-center justify-center gap-2 w-full px-5 py-3 bg-[#2a276e] text-white rounded-xl font-semibold hover:bg-[#1a1548] transition-colors',
  secondary: 'flex items-center justify-center gap-2 w-full px-5 py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors',
  ghost: 'text-gray-500 hover:text-gray-700 transition-colors',
  quiet: 'text-gray-400 hover:text-gray-600 transition-colors',
};

/**
 * One announcement, centred over a dimmed page.
 *
 * A modal rather than a drawer because none of these is a flow: it is a thing
 * being said, with a yes and a no.
 *
 * The header has three fallbacks, in order: a real `image` if the entry has one,
 * otherwise the drawn `art` scene for that entry, otherwise the plain brand
 * gradient with an icon. Every current entry names an `art`, so nothing ships
 * looking like a placeholder while it waits for a screenshot.
 */
const AnnouncementModal = ({ announcement, ctx, onResolve }) => {
  const navigate = useNavigate();
  const Icon = announcement.icon;

  const act = (action) => {
    const to = resolve(action.to, ctx);
    onResolve(action.resolve || 'dismiss');
    if (to) navigate(to);
  };

  const footnote = resolve(announcement.footnote, ctx);
  const primaryActions = (announcement.actions || []).filter((a) => a.kind === 'primary' || a.kind === 'secondary');
  const closers = (announcement.actions || []).filter((a) => a.kind === 'ghost' || a.kind === 'quiet');

  const renderAction = (action, i) => {
    const label = resolve(action.label, ctx);
    const href = resolve(action.href, ctx);
    const className = BUTTON_CLASS[action.kind] || BUTTON_CLASS.secondary;

    // target="_blank" matters inside the desktop wrapper: its click handler
    // turns an external _blank link into a top-level navigation, which is what
    // sends the URL to the system browser instead of stranding it in a webview.
    if (href) {
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          onClick={() => onResolve(action.resolve || 'acted')}
        >
          {label}
        </a>
      );
    }
    return (
      <button key={i} onClick={() => act(action)} className={className}>
        {label}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={() => onResolve('dismiss')}
      role="dialog"
      aria-modal="true"
      aria-label={resolve(announcement.title, ctx)}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onResolve('dismiss')}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/80 transition-colors z-10"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {announcement.image ? (
          <img
            src={announcement.image}
            alt=""
            className="w-full aspect-[16/9] object-cover bg-gray-100"
          />
        ) : announcement.art ? (
          <div className="relative">
            <AnnouncementArt name={announcement.art} />
            {/* The words sit under a drawn header the same way they sit under a
                photograph, so both paths read identically. */}
          </div>
        ) : (
          <div className="relative bg-gradient-to-br from-[#2a276e] to-[#1a1548] px-8 pt-10 pb-8 text-center text-white overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="absolute -bottom-12 -left-10 w-40 h-40 bg-white/5 rounded-full" />
            <div className="relative inline-flex items-center justify-center mb-4">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                {Icon && <Icon className="w-10 h-10 text-[#2a276e]" strokeWidth={1.8} />}
              </div>
            </div>
            {announcement.eyebrow && (
              <p className="relative text-[11px] font-bold uppercase tracking-[0.15em] text-white/60 mb-2">
                {announcement.eyebrow}
              </p>
            )}
            <h2 className="relative text-2xl font-bold mb-2">{resolve(announcement.title, ctx)}</h2>
            <p className="relative text-sm text-white/80 leading-relaxed">
              {resolve(announcement.body, ctx)}
            </p>
          </div>
        )}

        <div className="px-8 py-6">
          {/* With a picture or a drawing above, the words have not been said
              yet, so they go here. */}
          {(announcement.image || announcement.art) && (
            <div className="mb-5 text-center">
              {announcement.eyebrow && (
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#29828a] mb-2">
                  {announcement.eyebrow}
                </p>
              )}
              <h2 className="text-xl font-bold text-gray-900 mb-2">{resolve(announcement.title, ctx)}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{resolve(announcement.body, ctx)}</p>
            </div>
          )}

          {announcement.highlights?.length > 0 && (
            <ul className="mb-5 space-y-2">
              {announcement.highlights.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#29828a] shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          )}

          {announcement.stores && (
            <div className="flex gap-3 items-center justify-center mb-4">
              {STORE_BADGES.map((badge) => (
                <a
                  key={badge.href}
                  href={badge.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={badge.alt}
                  onClick={() => onResolve('acted')}
                  className="hover:opacity-80 transition-opacity"
                >
                  <img src={badge.src} alt={badge.alt} className={badge.className} />
                </a>
              ))}
            </div>
          )}

          {primaryActions.length > 0 && (
            <div className="space-y-3">{primaryActions.map(renderAction)}</div>
          )}

          {footnote && (
            <p className="text-xs text-gray-400 text-center mt-3">
              {footnote.to ? (
                <button
                  onClick={() => { onResolve('dismiss'); navigate(footnote.to); }}
                  className="underline underline-offset-2 hover:text-gray-600"
                >
                  {footnote.text}
                </button>
              ) : footnote.text}
            </p>
          )}

          {closers.length > 0 && (
            <div className={`mt-6 flex items-center text-xs ${closers.length > 1 ? 'justify-between' : 'justify-center'}`}>
              {closers.map((action, i) => (
                <button
                  key={i}
                  onClick={() => act(action)}
                  className={BUTTON_CLASS[action.kind]}
                >
                  {resolve(action.label, ctx)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
