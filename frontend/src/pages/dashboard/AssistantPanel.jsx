import React, { useState } from 'react';

const ToothGlyph = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C10.34 2 9 3.34 9 5C9 5.87 9.32 6.67 9.84 7.28C8.78 8.13 8 9.46 8 11C8 11.7 8.13 12.36 8.37 12.97C7.55 13.23 6.87 13.77 6.42 14.47C5.97 15.17 5.76 16 5.76 16.84C5.76 18.58 7.18 20 8.92 20C10.2 20 11.3 19.23 11.78 18.13C11.92 18.21 12.07 18.26 12.22 18.26C12.37 18.26 12.52 18.21 12.66 18.13C13.14 19.23 14.24 20 15.52 20C17.26 20 18.68 18.58 18.68 16.84C18.68 16 18.47 15.17 18.02 14.47C17.57 13.77 16.89 13.23 16.07 12.97C16.31 12.36 16.44 11.7 16.44 11C16.44 9.46 15.66 8.13 14.6 7.28C15.12 6.67 15.44 5.87 15.44 5C15.44 3.34 14.1 2 12.44 2H12Z" />
  </svg>
);

const GREETING = {
  id: 1,
  type: 'bot',
  content: "Hi! I'm your AI dental assistant. How can I help you today?",
  timestamp: new Date(),
};

const AssistantPanel = ({ open, onClose }) => {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  if (!open) return null;

  const send = () => {
    if (!input.trim()) return;
    const userMessage = { id: Date.now(), type: 'user', content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        type: 'bot',
        content: "I'm still learning! Full AI answers about your clinic data are coming soon.",
        timestamp: new Date(),
      }]);
      setIsTyping(false);
    }, 1200);
  };

  const onKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-[#9B8CFF]/10 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-[#2a276e] to-[#9B8CFF] rounded-full flex items-center justify-center">
              <ToothGlyph className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Dental Assistant</h3>
              <p className="text-xs text-gray-600">Beta · answers coming soon</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${m.type === 'user' ? 'bg-gradient-to-r from-[#2a276e] to-[#9B8CFF] text-white' : 'bg-gray-100 text-gray-900'}`}>
                <p className="text-sm">{m.content}</p>
                <p className={`text-xs mt-1 ${m.type === 'user' ? 'text-white/80' : 'text-gray-500'}`}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2 rounded-2xl flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder="Ask about treatments or clinic data…"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-[#2a276e] focus:border-transparent"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="px-4 py-2 bg-gradient-to-r from-[#2a276e] to-[#9B8CFF] text-white rounded-full hover:from-[#1a1548] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssistantPanel;
