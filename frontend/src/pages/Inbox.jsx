import React, { useState, useEffect, useRef } from "react";
import GearLoader from "../components/GearLoader";
import { toast } from "react-toastify";
import { api } from "../utils/api";
import { useInboxActions } from "../contexts/InboxContext";

const Inbox = () => {
  const { setInboxActions } = useInboxActions();
  const [status, setStatus] = useState("disconnected");
  const [qrCode, setQrCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  
  // Send message form
  const [selectedChat, setSelectedChat] = useState(null);
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  // Real chat list and messages
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Search and new message
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [newMessagePhone, setNewMessagePhone] = useState("");
  const [newMessageText, setNewMessageText] = useState("");
  const [sendingNewMessage, setSendingNewMessage] = useState(false);
  
  const pollingIntervalRef = useRef(null);
  const messagePollingIntervalRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Expose actions to Header via context
  useEffect(() => {
    setInboxActions({
      status,
      loading,
      initializing,
      onConnect: initializeSession,
      onDisconnect: disconnect,
      onRefresh: fetchStatus,
    });

    return () => {
      setInboxActions(null);
    };
  }, [status, loading, initializing]);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const response = await api.get("/whatsapp/inbox/status");
      if (response.status === "ready") {
        setStatus("ready");
        setQrCode(null);
        setPhoneNumber(response.phone_number);
        setError(null);
      } else if (response.status === "qr_ready" && response.qr_code) {
        setStatus("qr_ready");
        setQrCode(response.qr_code);
        setError(null);
      } else if (response.status === "error") {
        setStatus("error");
        setError(response.error || "An error occurred");
      } else {
        setStatus("disconnected");
        setQrCode(null);
        setPhoneNumber(null);
      }
    } catch (err) {
      console.error("Error checking status:", err);
      setStatus("disconnected");
    }
  };

  // Initialize WhatsApp session
  const initializeSession = async () => {
    try {
      setInitializing(true);
      setError(null);
      setLoading(true);
      
      const response = await api.post("/whatsapp/inbox/initialize");
      
      if (response.status === "ready") {
        setStatus("ready");
        setQrCode(null);
        setPhoneNumber(response.phone_number);
        setError(null);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        toast.success("WhatsApp connected successfully!");
      } else if (response.status === "qr_ready") {
        setStatus("qr_ready");
        setQrCode(response.qr_code);
        setError(null);
        startPolling();
        toast.info("Scan the QR code with your phone to connect WhatsApp.");
      } else if (response.status === "connecting") {
        setStatus("connecting");
        setError(null);
        // Start polling to check for QR code or ready state
        startPolling();
        toast.info("Initializing WhatsApp... Please wait.");
      } else if (response.status === "error") {
        setStatus("error");
        setError(response.error || "Failed to initialize WhatsApp");
        setQrCode(null);
      }
    } catch (err) {
      let errorMsg = "Failed to initialize WhatsApp";
      
      if (err.message) {
        errorMsg = err.message;
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (typeof err === 'string') {
        errorMsg = err;
      }
      
      setStatus("error");
      setError(errorMsg);
      setQrCode(null);
      toast.error(errorMsg);
      console.error("WhatsApp initialization error:", err);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  // Poll for status updates
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await api.get("/whatsapp/inbox/status");
        
        if (response.status === "ready") {
          setStatus("ready");
          setQrCode(null);
          setPhoneNumber(response.phone_number);
          setError(null);
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          toast.success("WhatsApp connected successfully!");
        } else if (response.status === "qr_ready" && response.qr_code) {
          setStatus("qr_ready");
          setQrCode(response.qr_code);
          setError(null);
        } else if (response.status === "connecting") {
          // Keep polling, status is still connecting
          setStatus("connecting");
          setError(null);
        } else if (response.status === "error") {
          setStatus("error");
          setError(response.error || "An error occurred");
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        } else if (response.status === "disconnected") {
          setStatus("disconnected");
          setQrCode(null);
          setPhoneNumber(null);
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } catch (err) {
        console.error("Error checking status:", err);
        // Don't stop polling on network errors, just log
      }
    }, 3000);
  };

  // Fetch chats from API
  const fetchChats = async (showLoader = false) => {
    if (status !== "ready") return;
    
    try {
      if (showLoader) {
        setLoadingChats(true);
      }
      const response = await api.get("/whatsapp/inbox/chats");
      if (response.chats) {
        // Only update if we got data (avoid clearing on errors)
        setChats(response.chats);
        setFilteredChats(response.chats);
      }
    } catch (err) {
      console.error("Error fetching chats:", err);
      // Don't show error toast for polling, only for manual refreshes
    } finally {
      if (showLoader) {
        setLoadingChats(false);
      }
    }
  };

  // Filter chats based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = chats.filter(chat => 
        (chat.name && chat.name.toLowerCase().includes(query)) ||
        (chat.phone && chat.phone.includes(query)) ||
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(query))
      );
      setFilteredChats(filtered);
    }
  }, [searchQuery, chats]);

  // Handle sending message to new number
  const handleSendNewMessage = async () => {
    if (!newMessagePhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    
    if (!newMessageText.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (status !== "ready") {
      toast.error("WhatsApp is not ready. Please connect first.");
      return;
    }

    setSendingNewMessage(true);
    setError(null);
    
    try {
      const response = await api.post("/whatsapp/inbox/send-message", {
        phone_number: newMessagePhone.replace(/\D/g, ''), // Clean phone number
        message: newMessageText
      });

      if (response.success) {
        const sentPhone = newMessagePhone.replace(/\D/g, ''); // Clean phone number
        const sentMessage = newMessageText; // Save message before clearing
        toast.success(`Message sent to ${newMessagePhone} successfully!`);
        setNewMessagePhone("");
        setNewMessageText("");
        setShowNewMessageModal(false);
        
        // If chat info is returned, add it immediately to the list
        if (response.chat) {
          const newChat = response.chat;
          // Check if chat already exists
          const existingIndex = chats.findIndex(c => c.phone === newChat.phone || c.phone.replace(/\D/g, '') === newChat.phone.replace(/\D/g, ''));
          
          if (existingIndex >= 0) {
            // Update existing chat
            const updatedChats = [...chats];
            updatedChats[existingIndex] = newChat;
            // Sort by last message time
            updatedChats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            setChats(updatedChats);
            setFilteredChats(updatedChats);
            handleChatSelect(newChat);
          } else {
            // Add new chat at the beginning
            const updatedChats = [newChat, ...chats];
            setChats(updatedChats);
            setFilteredChats(updatedChats);
            handleChatSelect(newChat);
          }
        } else {
          // Fallback: refresh chats from server
          await fetchChats();
          
          // Wait a bit and try to find the new chat
          setTimeout(async () => {
            await fetchChats();
            const newChat = chats.find(c => c.phone === sentPhone || c.phone.replace(/\D/g, '') === sentPhone);
            if (newChat) {
              handleChatSelect(newChat);
            }
          }, 1500);
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to send message";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSendingNewMessage(false);
    }
  };

  // Fetch messages for selected chat
  const fetchMessages = async (phone) => {
    if (!phone || status !== "ready") return;
    
    try {
      setLoadingMessages(true);
      const response = await api.get(`/whatsapp/inbox/messages/${phone}`);
      if (response.messages) {
        setMessages(response.messages);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  // Format timestamp to readable time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Handle chat selection
  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.phone);
  };

  // Check existing session on mount
  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (messagePollingIntervalRef.current) {
        clearInterval(messagePollingIntervalRef.current);
      }
    };
  }, []);

  // Fetch chats when status becomes ready
  useEffect(() => {
    if (status === "ready") {
      // Initial load with loader
      fetchChats(true);
    } else {
      // Clear chats when disconnected
      setChats([]);
      setFilteredChats([]);
      setSelectedChat(null);
      setMessages([]);
    }
  }, [status]);
  
  // Poll for chat list updates to catch new incoming messages (silent, no loader)
  useEffect(() => {
    if (status === "ready" && chats.length > 0) {
      // Poll for chat list updates every 3 seconds to catch new messages
      const chatUpdateInterval = setInterval(() => {
        fetchChats(false); // Silent update, no loader
      }, 3000);
      
      return () => clearInterval(chatUpdateInterval);
    }
  }, [status, chats.length]);

  // Poll for new messages when a chat is selected
  useEffect(() => {
    if (selectedChat && status === "ready") {
      // Initial load
      fetchMessages(selectedChat.phone);
      
      // Poll for new messages every 2 seconds (faster for real-time feel)
      messagePollingIntervalRef.current = setInterval(() => {
        fetchMessages(selectedChat.phone);
      }, 2000);
      
      return () => {
        if (messagePollingIntervalRef.current) {
          clearInterval(messagePollingIntervalRef.current);
        }
      };
    }
  }, [selectedChat, status]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Disconnect
  const disconnect = async () => {
    try {
      setLoading(true);
      await api.post("/whatsapp/inbox/disconnect");
      setStatus("disconnected");
      setQrCode(null);
      setPhoneNumber(null);
      setError(null);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      toast.success("WhatsApp disconnected successfully");
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to disconnect";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!selectedChat) {
      toast.error("Please select a chat first");
      return;
    }
    
    if (!sendMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (status !== "ready") {
      toast.error("WhatsApp is not ready. Please connect first.");
      return;
    }

    setSending(true);
    setError(null);
    
    try {
      const response = await api.post("/whatsapp/inbox/send-message", {
        phone_number: selectedChat.phone,
        message: sendMessage
      });

      if (response.success) {
        toast.success(`Message sent to ${selectedChat.name} successfully!`);
        setSendMessage("");
        
        // Add sent message to local state immediately
        const newMessage = {
          id: `temp-${Date.now()}`,
          from: phoneNumber || "me",
          fromName: "You",
          body: sendMessage,
          timestamp: Date.now(),
          type: "chat",
          isGroup: false,
          chatId: `${selectedChat.phone}@c.us`,
          hasMedia: false,
          isSent: true
        };
        setMessages(prev => [...prev, newMessage]);
        
        // Refresh messages and chat list to get the actual message from server
        setTimeout(() => {
          fetchMessages(selectedChat.phone);
          fetchChats(false); // Silent update, no loader
        }, 500);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to send message";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  // WhatsApp-like UI
  return (
    <div className="h-full w-full flex flex-col bg-[#E5DDD5] relative" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'grid\' width=\'100\' height=\'100\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 100 0 L 0 0 0 100\' fill=\'none\' stroke=\'%23f0f0f0\' stroke-width=\'1\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100\' height=\'100\' fill=\'url(%23grid)\'/%3E%3C/svg%3E")' }}>
      {/* QR Code Overlay - Show when QR is ready */}
      {status === "qr_ready" && qrCode && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Scan QR Code</h2>
              <p className="text-gray-600 text-sm">
                Open WhatsApp on your phone, go to Settings → Linked Devices, and scan this QR code
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 flex justify-center mb-4">
              <img 
                src={qrCode} 
                alt="WhatsApp QR Code" 
                className="w-64 h-64"
              />
            </div>
            <p className="text-gray-500 text-xs text-center">
              Waiting for QR code scan... This page will update automatically when connected.
            </p>
            <button
              onClick={() => {
                setQrCode(null);
                setStatus("disconnected");
              }}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && status !== "qr_ready" && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-2 rounded">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main WhatsApp UI - Two Panel Layout */}
      {status === "ready" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Chat List */}
          <div className="w-1/3 border-r border-gray-300 bg-white flex flex-col">
            {/* Chat List Header */}
            <div className="bg-[#F0F2F5] px-4 py-3 border-b border-gray-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">WhatsApp</p>
                    {phoneNumber && (
                      <p className="text-xs text-gray-600">{phoneNumber}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowNewMessageModal(true)}
                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition"
                    title="New Message"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search or start new chat"
                  className="w-full bg-white px-10 py-2 rounded-lg border-none outline-none text-sm focus:ring-2 focus:ring-[#25D366]"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              {loadingChats ? (
                <div className="flex items-center justify-center py-8">
                  <GearLoader size="w-6 h-6" className="text-[#25D366]" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm text-gray-500">No conversations yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {searchQuery ? "No chats match your search" : "Messages will appear here when received"}
                  </p>
                </div>
              ) : (
                filteredChats.map((chat) => (
                  <div
                    key={chat.phone}
                    onClick={() => handleChatSelect(chat)}
                    className={`px-4 py-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${
                      selectedChat?.phone === chat.phone ? 'bg-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-600 font-semibold text-lg">
                          {chat.name?.charAt(0) || chat.phone?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{chat.name || chat.phone}</p>
                          <p className="text-xs text-gray-500">{formatTime(chat.lastMessageTime)}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 truncate">{chat.lastMessage || "No messages"}</p>
                          {chat.unreadCount > 0 && (
                            <span className="bg-[#25D366] text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center flex-shrink-0 px-1.5">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Chat View */}
          <div className="flex-1 flex flex-col bg-[#E5DDD5]">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="bg-[#F0F2F5] px-4 py-3 border-b border-gray-300 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-gray-600 font-semibold">
                        {selectedChat.name.charAt(0)}
                      </span>
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
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                      const isSent = msg.isSent || msg.from === phoneNumber || !msg.fromName || msg.fromName === "You";
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
                            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{msg.body}</p>
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
                      onChange={(e) => setSendMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message"
                      className="flex-1 bg-white px-4 py-2 rounded-full border-none outline-none text-sm"
                    />
                    <button
                      onClick={handleSendMessage}
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
              </>
            ) : (
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
            )}
          </div>
        </div>
      ) : (
        /* Disconnected State - Centered Message */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-14 h-14 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your WhatsApp</h2>
            <p className="text-gray-600 mb-6">
              Click "Connect" in the header to start. You'll need to scan a QR code with your phone.
            </p>
            {status === "connecting" || initializing ? (
              <div className="flex items-center justify-center gap-2 text-[#25D366]">
                <GearLoader size="w-6 h-6" className="text-[#25D366]" />
                <span>Connecting...</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">New Message</h2>
              <button
                onClick={() => {
                  setShowNewMessageModal(false);
                  setNewMessagePhone("");
                  setNewMessageText("");
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number (with country code)
                </label>
                <input
                  type="text"
                  value={newMessagePhone}
                  onChange={(e) => setNewMessagePhone(e.target.value)}
                  placeholder="e.g., 919876543210 or +91 9876543210"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter number with country code (e.g., 91 for India)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowNewMessageModal(false);
                    setNewMessagePhone("");
                    setNewMessageText("");
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendNewMessage}
                  disabled={sendingNewMessage || !newMessagePhone.trim() || !newMessageText.trim()}
                  className="flex-1 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20BA5A] transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingNewMessage ? (
                    <>
                      <GearLoader size="w-4 h-4" className="text-white" />
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
