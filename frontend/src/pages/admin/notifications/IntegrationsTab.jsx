import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { toast } from 'react-toastify';

const PROVIDERS = [
  {
    id: 'msg91',
    name: 'MSG91',
    tagline: "India's leading CPaaS platform",
    description: "Send WhatsApp, SMS, and transactional emails with high deliverability through India's most popular messaging API.",
    channels: ['whatsapp', 'sms', 'email'],
    color: 'bg-violet-600',
    textColor: 'text-violet-600',
    bgLight: 'bg-violet-50',
    docsUrl: 'https://docs.msg91.com',
    fields: [
      { key: 'auth_key', label: 'Auth Key', placeholder: 'Enter MSG91 Auth Key', type: 'password' },
      { key: 'sender_id', label: 'SMS Sender ID', placeholder: 'e.g. MOLARPLUS', type: 'text' },
      { key: 'whatsapp_sender', label: 'WhatsApp Number', placeholder: 'e.g. 919876543210', type: 'text' },
    ],
    initials: 'M9',
  },
  {
    id: 'fast2sms',
    name: 'Fast2SMS',
    tagline: 'Affordable bulk messaging for India',
    description: 'Budget-friendly SMS, WhatsApp, and email notifications for Indian businesses with simple REST API integration.',
    channels: ['whatsapp', 'sms', 'email'],
    color: 'bg-blue-600',
    textColor: 'text-blue-600',
    bgLight: 'bg-blue-50',
    docsUrl: 'https://www.fast2sms.com/docs',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Enter Fast2SMS API Key', type: 'password' },
      { key: 'sender_id', label: 'Sender ID', placeholder: 'e.g. FSTSMS', type: 'text' },
    ],
    initials: 'F2',
  },
  {
    id: 'kaleyra',
    name: 'Kaleyra',
    tagline: 'Enterprise-grade cloud communications',
    description: 'Trusted by 3000+ enterprises globally for WhatsApp Business API, SMS, and email at scale with carrier-grade reliability.',
    channels: ['whatsapp', 'sms', 'email'],
    color: 'bg-teal-600',
    textColor: 'text-teal-600',
    bgLight: 'bg-teal-50',
    docsUrl: 'https://developers.kaleyra.io',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Enter Kaleyra API Key', type: 'password' },
      { key: 'sid', label: 'Account SID', placeholder: 'Enter Account SID', type: 'text' },
      { key: 'sender', label: 'Sender Number / ID', placeholder: 'e.g. +919876543210', type: 'text' },
    ],
    initials: 'KL',
  },
  {
    id: 'wareach',
    name: 'WA Reach',
    tagline: 'Free WhatsApp notifications',
    description: "Send WhatsApp notifications for free using the official WhatsApp Cloud API. No per-message charges for business-initiated messages under Meta's free tier.",
    channels: ['whatsapp'],
    color: 'bg-green-600',
    textColor: 'text-green-600',
    bgLight: 'bg-green-50',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
    fields: [
      { key: 'access_token', label: 'Meta Access Token', placeholder: 'Enter Meta Access Token', type: 'password' },
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: 'Enter Phone Number ID', type: 'text' },
      { key: 'waba_id', label: 'WhatsApp Business Account ID', placeholder: 'Enter WABA ID', type: 'text' },
    ],
    initials: 'WA',
    badge: 'Free',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    tagline: 'Global cloud communications leader',
    description: "Send and receive SMS, WhatsApp messages, and emails globally with Twilio's programmable communications platform.",
    channels: ['whatsapp', 'sms', 'email'],
    color: 'bg-red-600',
    textColor: 'text-red-600',
    bgLight: 'bg-red-50',
    docsUrl: 'https://www.twilio.com/docs',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
      { key: 'auth_token', label: 'Auth Token', placeholder: 'Enter Auth Token', type: 'password' },
      { key: 'from_number', label: 'From Number / Sender', placeholder: 'e.g. +15005550006', type: 'text' },
    ],
    initials: 'TW',
  },
  {
    id: 'gupshup',
    name: 'Gupshup',
    tagline: 'Conversational AI & messaging',
    description: "Build conversational experiences on WhatsApp, SMS, and more with Gupshup's AI-powered messaging platform.",
    channels: ['whatsapp', 'sms', 'email'],
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    bgLight: 'bg-orange-50',
    docsUrl: 'https://docs.gupshup.io',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Enter Gupshup API Key', type: 'password' },
      { key: 'app_name', label: 'App Name', placeholder: 'Enter your Gupshup App name', type: 'text' },
      { key: 'source_number', label: 'Source Number', placeholder: 'e.g. 917834811114', type: 'text' },
    ],
    initials: 'GS',
  },
  {
    id: 'aws',
    name: 'AWS',
    tagline: 'SNS for SMS · SES for Email',
    description: 'Use Amazon SNS for reliable transactional SMS and Amazon SES for high-volume email delivery at enterprise scale.',
    channels: ['sms', 'email'],
    color: 'bg-[#FF9900]',
    textColor: 'text-[#FF9900]',
    bgLight: 'bg-amber-50',
    docsUrl: 'https://docs.aws.amazon.com',
    fields: [
      { key: 'access_key_id', label: 'AWS Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE', type: 'text' },
      { key: 'secret_access_key', label: 'Secret Access Key', placeholder: 'Enter Secret Access Key', type: 'password' },
      { key: 'region', label: 'AWS Region', placeholder: 'e.g. ap-south-1', type: 'text' },
      { key: 'ses_from_email', label: 'SES From Email', placeholder: 'noreply@yourdomain.com', type: 'text' },
    ],
    initials: 'AWS',
  },
];

const CHANNEL_BADGE = {
  whatsapp: { label: 'WhatsApp', cls: 'bg-green-50 text-green-700 border border-green-100' },
  email:    { label: 'Email',    cls: 'bg-blue-50 text-blue-700 border border-blue-100'   },
  sms:      { label: 'SMS',      cls: 'bg-purple-50 text-purple-700 border border-purple-100' },
};

const IntegrationsTab = ({ drawerProvider, setDrawerProvider }) => (
  <>
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-900">Choose your notification provider</h3>
      <p className="text-xs text-gray-400 mt-0.5">Click any provider to configure API credentials. Currently using MolarPlus global keys.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {PROVIDERS.map(provider => (
        <div
          key={provider.id}
          onClick={() => setDrawerProvider(provider)}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-[#29828a]/40 hover:shadow-md transition-all group relative"
        >
          {provider.badge && (
            <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
              {provider.badge}
            </span>
          )}
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-11 h-11 rounded-xl ${provider.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {provider.initials}
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-gray-900 text-[15px] group-hover:text-[#29828a] transition-colors">{provider.name}</h4>
              <p className="text-[11px] text-gray-400">{provider.tagline}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{provider.description}</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {provider.channels.map(ch => (
              <span key={ch} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_BADGE[ch].cls}`}>
                {CHANNEL_BADGE[ch].label}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-50">
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#29828a] transition-colors"
            >
              <ExternalLink size={11} /> API Docs
            </a>
            <span className="text-xs font-semibold text-[#29828a] group-hover:underline">Configure →</span>
          </div>
        </div>
      ))}
    </div>

    {drawerProvider && (
      <>
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
          onClick={() => setDrawerProvider(null)}
        />
        <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
          <div className={`p-6 ${drawerProvider.bgLight} border-b border-gray-100`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${drawerProvider.color} flex items-center justify-center text-white font-bold text-sm`}>
                  {drawerProvider.initials}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{drawerProvider.name}</h3>
                  <p className="text-xs text-gray-500">{drawerProvider.tagline}</p>
                </div>
              </div>
              <button
                onClick={() => setDrawerProvider(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-white/60 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {drawerProvider.channels.map(ch => (
                <span key={ch} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${CHANNEL_BADGE[ch].cls}`}>
                  {CHANNEL_BADGE[ch].label}
                </span>
              ))}
              {drawerProvider.badge && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                  {drawerProvider.badge}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">{drawerProvider.description}</p>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
              <strong>Note:</strong> Per-clinic credential storage is coming soon. These credentials will apply globally to your MolarPlus account.
            </div>
            <div className="space-y-3">
              {drawerProvider.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#29828a]/20 focus:border-[#29828a] outline-none transition-all placeholder:text-gray-300"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-2">
            <button
              onClick={() => {
                toast.info('Per-clinic provider configuration coming soon!');
                setDrawerProvider(null);
              }}
              className="w-full py-2.5 bg-[#29828a] hover:bg-[#1f6b72] text-white font-semibold rounded-lg text-sm transition-all"
            >
              Save Configuration
            </button>
            <a
              href={drawerProvider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-[#29828a] transition-colors"
            >
              <ExternalLink size={12} /> View {drawerProvider.name} API Documentation
            </a>
          </div>
        </div>
      </>
    )}
  </>
);

export default IntegrationsTab;
