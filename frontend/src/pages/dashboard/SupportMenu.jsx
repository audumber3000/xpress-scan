import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AISparkleIcon, SUPPORT_WHATSAPP } from './icons';

const SupportMenu = ({ onOpenAssistant }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = [
    {
      title: 'Chat with Support',
      desc: 'Talk to our team on WhatsApp',
      bg: 'bg-[#25D366]/10',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#25D366">
          <path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12 2a10 10 0 00-8.6 15.05L2 22l5.05-1.32A10 10 0 1012 2z" />
        </svg>
      ),
      onClick: () => window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Hi, I need help with MolarPlus.')}`, '_blank'),
    },
    {
      title: 'Watch Tutorials',
      desc: 'Learn MolarPlus step by step',
      bg: 'bg-red-50',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#EF4444">
          <path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
        </svg>
      ),
      onClick: () => navigate('/support-tickets'),
    },
    {
      title: 'Ask AI Assistant',
      desc: 'Get answers about your data',
      bg: 'bg-[#2a276e]/10',
      icon: <AISparkleIcon className="w-5 h-5" />,
      onClick: () => onOpenAssistant(),
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <>
          <div className="fixed inset-0 z-0" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-3 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-10">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">How can we help?</p>
              <p className="text-xs text-gray-500 mt-0.5">Choose an option below</p>
            </div>
            {items.map((it) => (
              <button
                key={it.title}
                onClick={() => { setOpen(false); it.onClick(); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`w-9 h-9 rounded-full ${it.bg} flex items-center justify-center flex-shrink-0`}>
                  {it.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{it.title}</p>
                  <p className="text-xs text-gray-500">{it.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((s) => !s)}
        className="relative bg-gradient-to-r from-[#2a276e] to-[#403bb1] hover:from-[#1a1548] hover:to-[#2a276e] text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 z-10"
        title="Help & Support"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default SupportMenu;
