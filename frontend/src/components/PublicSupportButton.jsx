import React from 'react';
import WhatsAppIcon from './common/WhatsAppIcon';
import { SUPPORT_WHATSAPP } from '../pages/dashboard/icons';

/**
 * Floating "Chat with us on WhatsApp" button for pre-login pages
 * (login / signup / forgot-password / reset-password). Unlike the dashboard
 * support menu, there's no logged-in account yet, so this is a single
 * WhatsApp action — the tutorials/AI options need auth and don't apply here.
 */
const PublicSupportButton = ({ message = 'Hi, I need help with MolarPlus.' }) => {
  const openWhatsApp = () =>
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');

  return (
    <button
      onClick={openWhatsApp}
      title="Chat with us on WhatsApp"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-40 bg-[#25D366] hover:bg-[#1ebe57] text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
    >
      <WhatsAppIcon size={24} />
    </button>
  );
};

export default PublicSupportButton;
