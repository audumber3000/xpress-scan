import React from "react";
import GearLoader from "../GearLoader";

const ChatWindow = ({
  selectedChat,
  messages,
  sendMessage,
  sending,
  loadingMessages,
  messagePagination,
  messagesContainerRef,
  messagesEndRef,
  phoneNumber,
  onSendMessage,
  onMessageChange
}) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a chat to start messaging</h3>
          <p className="text-gray-500">Choose a conversation from the list to view messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#E5DDD5]">
      {/* Chat Header */}
      <div className="bg-[#F0F2F5] px-4 py-3 border-b border-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            {selectedChat.profilePicUrl ? (
              <img 
                src={selectedChat.profilePicUrl} 
                alt={selectedChat.name}
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const placeholder = e.target.nextElementSibling;
                  if (placeholder) {
                    placeholder.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div 
              className={`w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center ${selectedChat.profilePicUrl ? 'hidden absolute inset-0' : ''}`}
            >
              <span className="text-gray-600 font-semibold">
                {selectedChat.name?.charAt(0)?.toUpperCase() || selectedChat.phone?.charAt(0) || '?'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedChat.name}</p>
            <p className="text-xs text-gray-600">{selectedChat.phone}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messagePagination.loadingMore && (
          <div className="flex justify-center py-2">
            <GearLoader size="w-5 h-5" className="text-[#25D366]" />
          </div>
        )}
        {loadingMessages && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <GearLoader size="w-8 h-8" className="text-[#25D366]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            // Determine if message is sent by us
            const isSent = msg.isSent === true || 
                          msg.fromName === "You" || 
                          (phoneNumber && msg.from === phoneNumber) ||
                          (msg.from && phoneNumber && msg.from.replace(/\D/g, '') === phoneNumber.replace(/\D/g, ''));
            
            // Get message body - ensure we show the actual message text, not phone number
            const messageBody = msg.body || msg.message || (msg.hasMedia ? '[Media]' : '');
            
            return (
              <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg px-3 py-2 max-w-xs shadow-sm ${
                  isSent ? 'bg-[#DCF8C6]' : 'bg-white'
                }`}>
                  {!isSent && (
                    <p className="text-xs font-semibold text-gray-700 mb-1">{msg.fromName || msg.from}</p>
                  )}
                  {msg.hasMedia && msg.mediaUrl ? (
                    <img src={msg.mediaUrl} alt="Media" className="max-w-full rounded mb-1" />
                  ) : null}
                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                    {messageBody || '[Empty message]'}
                  </p>
                  <p className={`text-xs text-gray-500 mt-1 ${isSent ? 'text-right' : ''}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-[#F0F2F5] px-4 py-3 border-t border-gray-300">
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <input
            type="text"
            value={sendMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
            placeholder="Type a message"
            className="flex-1 bg-white px-4 py-2 rounded-full border-none outline-none text-sm"
          />
          <button
            onClick={onSendMessage}
            disabled={sending || !sendMessage.trim()}
            className="p-2 bg-[#25D366] text-white rounded-full hover:bg-[#20BA5A] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <GearLoader size="w-5 h-5" className="text-white" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;



