import React, { useState, useEffect, useRef } from "react";
import GearLoader from "../components/GearLoader";
import { toast } from "react-toastify";
import { api } from "../utils/api";
import { useInboxActions } from "../contexts/InboxContext";
import { useAuth } from "../contexts/AuthContext";
import { getWhatsAppSocket } from "../utils/whatsappSocket";
import BulkMessagePanel from "../components/inbox/BulkMessagePanel";
import ScheduleMessagePanel from "../components/inbox/ScheduleMessagePanel";
import ScheduledMessagesListPanel from "../components/inbox/ScheduledMessagesListPanel";
import ChatList from "../components/inbox/ChatList";
import ChatWindow from "../components/inbox/ChatWindow";

const Inbox = () => {
  const { setInboxActions } = useInboxActions();
  const { user } = useAuth();
  const socketRef = useRef(null);
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
  
  // Menu state
  const [showChatMenu, setShowChatMenu] = useState(false);
  
  // Right panel states
  const [showBulkMessagePanel, setShowBulkMessagePanel] = useState(false);
  const [showScheduleMessagePanel, setShowScheduleMessagePanel] = useState(false);
  const [showScheduledMessagesPanel, setShowScheduledMessagesPanel] = useState(false);
  
  // Real chat list and messages
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Pagination state
  const [chatPagination, setChatPagination] = useState({ offset: 0, limit: 50, hasMore: true, loadingMore: false });
  const [messagePagination, setMessagePagination] = useState({ hasMore: true, loadingMore: false, oldestTimestamp: null });
  
  // Refs for scroll detection
  const chatListRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
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

  // Fetch chats from API (with pagination)
  const fetchChats = async (showLoader = false, loadMore = false) => {
    if (status !== "ready") return;
    
    try {
      if (showLoader && !loadMore) {
        setLoadingChats(true);
      }
      if (loadMore) {
        setChatPagination(prev => ({ ...prev, loadingMore: true }));
      }
      
      const offset = loadMore ? chatPagination.offset : 0;
      const response = await api.get(`/whatsapp/inbox/chats?limit=${chatPagination.limit}&offset=${offset}`);
      
      if (response.chats) {
        if (loadMore) {
          // Append new chats to existing list
          setChats(prev => {
            const combined = [...prev, ...response.chats];
            // Remove duplicates based on phone number
            const unique = combined.filter((chat, index, self) => 
              index === self.findIndex(c => c.phone === chat.phone)
            );
            return unique.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          });
          setChatPagination(prev => ({
            ...prev,
            offset: offset + response.chats.length,
            hasMore: response.hasMore || false,
            loadingMore: false
          }));
        } else {
          // Initial load - replace all chats
          setChats(response.chats);
          setFilteredChats(response.chats);
          setChatPagination({
            offset: response.chats.length,
            limit: 20,
            hasMore: response.hasMore || false,
            loadingMore: false
          });
        }
      }
    } catch (err) {
      console.error("Error fetching chats:", err);
      if (loadMore) {
        setChatPagination(prev => ({ ...prev, loadingMore: false }));
      }
    } finally {
      if (showLoader && !loadMore) {
        setLoadingChats(false);
      }
    }
  };
  
  // Load more chats when scrolling to bottom
  useEffect(() => {
    const chatListElement = chatListRef.current;
    if (!chatListElement || !chatPagination.hasMore || chatPagination.loadingMore) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatListElement;
      // Load more when user is within 100px of bottom
      if (scrollHeight - scrollTop - clientHeight < 100) {
        fetchChats(false, true);
      }
    };
    
    chatListElement.addEventListener('scroll', handleScroll);
    return () => chatListElement.removeEventListener('scroll', handleScroll);
  }, [chatPagination.hasMore, chatPagination.loadingMore, status]);

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

  // Fetch messages for selected chat (with pagination)
  const fetchMessages = async (phone, showLoader = false, loadOlder = false, preserveTempMessageId = null) => {
    if (!phone || status !== "ready") return;
    
    try {
      if (showLoader && !loadOlder) {
        setLoadingMessages(true);
      }
      if (loadOlder) {
        setMessagePagination(prev => ({ ...prev, loadingMore: true }));
      }
      
      const beforeTimestamp = loadOlder && messagePagination.oldestTimestamp 
        ? messagePagination.oldestTimestamp 
        : null;
      
      const url = `/whatsapp/inbox/messages/${phone}?limit=50${beforeTimestamp ? `&before=${beforeTimestamp}` : ''}`;
      const response = await api.get(url);
      
      if (response.messages) {
        // Sort messages by timestamp (oldest first) - like WhatsApp
        const sortedMessages = response.messages.sort((a, b) => a.timestamp - b.timestamp);

        if (loadOlder) {
          // Prepend older messages to existing list
          setMessages(prev => {
            const combined = [...sortedMessages, ...prev];
            // Remove duplicates based on message ID, but preserve temp messages
            const unique = combined.filter((msg, index, self) =>
              index === self.findIndex(m => m.id === msg.id)
            );
            return unique.sort((a, b) => a.timestamp - b.timestamp);
          });
          
          // Maintain scroll position when loading older messages
          const container = messagesContainerRef.current;
          if (container) {
            const previousScrollHeight = container.scrollHeight;
            setTimeout(() => {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop = newScrollHeight - previousScrollHeight;
            }, 50);
          }
        } else {
          // Initial load - replace all messages but preserve temp messages and recently sent messages
          setMessages(prev => {
            // If we have a temp message to preserve, keep it
            const tempMessages = preserveTempMessageId ?
              prev.filter(m => m.id === preserveTempMessageId) : [];

            // Also preserve recently sent messages (within last 10 seconds) that might not be on server yet
            const recentSentMessages = prev.filter(m => {
              const isRecent = m.timestamp && (Date.now() - m.timestamp) < 10000; // 10 seconds
              const isSent = m.isSent === true || m.fromName === "You";
              return isRecent && isSent;
            });

            // Merge server messages with temp messages and recent sent messages, remove duplicates
            const combined = [...sortedMessages, ...tempMessages, ...recentSentMessages];
            const unique = combined.filter((msg, index, self) =>
              index === self.findIndex(m => m.id === msg.id)
            );
            return unique.sort((a, b) => a.timestamp - b.timestamp);
          });

          // Auto-scroll to bottom after messages load
          setTimeout(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
          }, 100);
        }
        
        setMessagePagination({
          hasMore: response.hasMore || false,
          loadingMore: false,
          oldestTimestamp: response.oldestTimestamp || null
        });
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      if (showLoader && !loadOlder) {
        toast.error("Failed to load messages");
      }
      if (loadOlder) {
        setMessagePagination(prev => ({ ...prev, loadingMore: false }));
      }
    } finally {
      if (showLoader && !loadOlder) {
        setLoadingMessages(false);
      }
    }
  };
  
  // Load older messages when scrolling to top
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer || !messagePagination.hasMore || messagePagination.loadingMore || !selectedChat) return;
    
    const handleScroll = () => {
      // Load more when user scrolls to top (within 200px)
      if (messagesContainer.scrollTop < 200) {
        fetchMessages(selectedChat.phone, false, true);
      }
    };
    
    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [messagePagination.hasMore, messagePagination.loadingMore, selectedChat]);

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

    // Clear unread count immediately when chat is selected
    setChats(prev => prev.map(c =>
      c.phone === chat.phone ? { ...c, unreadCount: 0 } : c
    ));
    setFilteredChats(prev => prev.map(c =>
      c.phone === chat.phone ? { ...c, unreadCount: 0 } : c
    ));

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
  
  // Socket.IO integration for real-time updates (REPLACES POLLING)
  useEffect(() => {
    if (!user?.id || status !== "ready") {
      // Disconnect socket if status is not ready
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Initialize Socket.IO connection
    const socket = getWhatsAppSocket(user.id.toString());
    socket.connect();
    socketRef.current = socket;

    // Handle real-time message events
    const handleMessage = (data) => {
      const { message: newMessage, chat: chatInfo } = data;
      
      if (!newMessage) return;

      // Update messages if this is for the currently selected chat
      if (selectedChat && newMessage.from === selectedChat.phone) {
        setMessages(prev => {
          // Check if message already exists
          const exists = prev.find(m => m.id === newMessage.id);
          if (exists) return prev;
          
          // Add new message
          const updated = [...prev, newMessage].sort((a, b) => a.timestamp - b.timestamp);
          return updated;
        });

        // Auto-scroll to bottom
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }

      // Update chat list with new message info
      if (chatInfo) {
        setChats(prev => {
          const existingIndex = prev.findIndex(c => c.phone === chatInfo.phone);
          if (existingIndex >= 0) {
            // Update existing chat
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...chatInfo };
            // Sort by lastMessageTime (most recent first)
            updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            return updated;
          } else {
            // Add new chat at the beginning
            const updated = [chatInfo, ...prev];
            updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            return updated;
          }
        });

        setFilteredChats(prev => {
          const existingIndex = prev.findIndex(c => c.phone === chatInfo.phone);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...chatInfo };
            updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            return updated;
          } else {
            const updated = [chatInfo, ...prev];
            updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            return updated;
          }
        });
      }
    };

    // Handle message sent confirmation
    const handleMessageSent = (data) => {
      const { message: sentMessage, chat: chatInfo } = data;
      
      if (!sentMessage) return;

      // Check if this message belongs to the selected chat
      // Sent messages have from = our phone number, but we need to check the chatId or chatInfo
      // Normalize phone numbers for comparison (remove all non-digits) to handle formatting differences
      const normalizePhone = (phone) => phone ? phone.replace(/\D/g, '') : '';
      const selectedPhoneNormalized = normalizePhone(selectedChat?.phone);
      const chatInfoPhoneNormalized = normalizePhone(chatInfo?.phone);
      const chatIdPhoneNormalized = sentMessage.chatId ? normalizePhone(sentMessage.chatId.replace('@c.us', '')) : '';
      
      const isForSelectedChat = selectedChat && selectedPhoneNormalized && (
        chatInfoPhoneNormalized === selectedPhoneNormalized || 
        chatIdPhoneNormalized === selectedPhoneNormalized
      );

      // Update messages in selected chat if this message is for it
      if (isForSelectedChat) {
        setMessages(prev => {
          // Check if message already exists (by ID or by body + timestamp)
          const existingIndex = prev.findIndex(m => 
            m.id === sentMessage.id || 
            (m.body === sentMessage.body && Math.abs(m.timestamp - (sentMessage.timestamp || Date.now())) < 5000)
          );
          
          if (existingIndex >= 0) {
            // Replace existing message (likely temp message) with real one
            const updated = [...prev];
            updated[existingIndex] = sentMessage;
            return updated.sort((a, b) => a.timestamp - b.timestamp);
          } else {
            // Add new message if it doesn't exist
            const updated = [...prev, sentMessage];
            return updated.sort((a, b) => a.timestamp - b.timestamp);
          }
        });

        // Auto-scroll to bottom to show the sent message
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }

      // Update chat list
      if (chatInfo) {
        setChats(prev => {
          const filtered = prev.filter(c => c.phone !== chatInfo.phone);
          const updated = [chatInfo, ...filtered];
          updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          return updated;
        });

        setFilteredChats(prev => {
          const filtered = prev.filter(c => c.phone !== chatInfo.phone);
          const updated = [chatInfo, ...filtered];
          updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          return updated;
        });

        // Update selected chat if it's the same
        if (selectedChat && selectedChat.phone === chatInfo.phone) {
          setSelectedChat(prev => ({ ...prev, ...chatInfo }));
        }
      }
    };

    // Handle message acknowledgment (delivered, read, etc.)
    const handleMessageAck = (data) => {
      const { messageId, status: ackStatus } = data;
      
      // Update message status in the current chat
      if (selectedChat) {
        setMessages(prev => 
          prev.map(m => 
            m.id === messageId ? { ...m, ack: ackStatus, status: ackStatus } : m
          )
        );
      }
    };

    // Handle ready event
    const handleReady = (data) => {
      setStatus("ready");
      setQrCode(null);
      if (data.phoneNumber) {
        setPhoneNumber(data.phoneNumber);
      }
      setError(null);
      toast.success("WhatsApp connected successfully!");
      // Initial fetch of chats
      fetchChats(true);
    };

    // Handle QR code event
    const handleQR = (data) => {
      if (data.qrCode) {
        setStatus("qr_ready");
        setQrCode(data.qrCode);
        setError(null);
      }
    };

    // Handle disconnected event
    const handleDisconnected = () => {
      setStatus("disconnected");
      setQrCode(null);
      setPhoneNumber(null);
      setChats([]);
      setFilteredChats([]);
      setSelectedChat(null);
      setMessages([]);
      toast.info("WhatsApp disconnected");
    };

    // Register event listeners
    socket.on('message', handleMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('message_ack', handleMessageAck);
    socket.on('ready', handleReady);
    socket.on('qr', handleQR);
    socket.on('disconnected', handleDisconnected);

    // Cleanup function
    return () => {
      socket.off('message', handleMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_ack', handleMessageAck);
      socket.off('ready', handleReady);
      socket.off('qr', handleQR);
      socket.off('disconnected', handleDisconnected);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [status, user?.id, selectedChat, phoneNumber]);

  // Load messages when a chat is selected (initial load only, real-time updates via Socket.IO)
  useEffect(() => {
    if (selectedChat && status === "ready") {
      // Only fetch if we don't have messages for this chat yet, or if chat actually changed
      // This prevents overwriting messages when we just update the selectedChat after sending
      const currentChatPhone = selectedChat.phone;
      const hasMessagesForThisChat = messages.length > 0 && 
        messages.some(m => {
          const normalizePhone = (phone) => phone ? phone.replace(/\D/g, '') : '';
          const msgChatId = m.chatId ? normalizePhone(m.chatId.replace('@c.us', '')) : '';
          return msgChatId === normalizePhone(currentChatPhone);
        });
      
      // Only fetch if we don't have messages for this chat
      if (!hasMessagesForThisChat) {
        fetchMessages(selectedChat.phone, true, false);
      }
    }
  }, [selectedChat?.phone, status]); // Only depend on phone, not entire selectedChat object

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
      
      // Disconnect Socket.IO
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      await api.post("/whatsapp/inbox/disconnect");
      setStatus("disconnected");
      setQrCode(null);
      setPhoneNumber(null);
      setError(null);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (messagePollingIntervalRef.current) {
        clearInterval(messagePollingIntervalRef.current);
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
        const messageToSend = sendMessage; // Save before clearing
        setSendMessage("");
        
        // Use messageData from response if available, otherwise create temp message
        const newMessage = response.messageData || {
          id: `temp-${Date.now()}-${Math.random()}`,
          from: phoneNumber || "me",
          fromName: "You",
          body: messageToSend,
          timestamp: Date.now(),
          type: "chat",
          isGroup: false,
          chatId: `${selectedChat.phone}@c.us`,
          hasMedia: false,
          isSent: true,
          status: 'pending',
          ack: 0 // Not acknowledged yet
        };
        
        // Add message immediately to chat (ensure it shows up and persists)
        setMessages(prev => {
          // Check if message already exists (avoid duplicates)
          const exists = prev.find(m => m.id === newMessage.id || (m.body === newMessage.body && Math.abs(m.timestamp - newMessage.timestamp) < 1000));
          if (exists) {
            // Update existing message if needed
            return prev.map(m => m.id === exists.id ? { ...m, ...newMessage } : m);
          }
          const updated = [...prev, newMessage].sort((a, b) => a.timestamp - b.timestamp);
          return updated;
        });

        // Mark this message as pending to avoid replacement
        const tempMessageId = newMessage.id;
        
        // Update chat list - move this chat to top (like WhatsApp)
        if (response.chat) {
          setChats(prev => {
            // Remove chat from current position
            const filtered = prev.filter(c => c.phone !== response.chat.phone);
            // Add updated chat at the top
            const updatedChat = { ...response.chat, unreadCount: 0 }; // Ensure unread count is 0
            const updated = [updatedChat, ...filtered];
            // Sort by lastMessageTime (most recent first)
            updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            return updated;
          });

          // Update filtered chats too
          setFilteredChats(prev => {
            const filtered = prev.filter(c => c.phone !== response.chat.phone);
            const updatedChat = { ...response.chat, unreadCount: 0 }; // Ensure unread count is 0
            const updated = [updatedChat, ...filtered];
            updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            return updated;
          });

          // Update selected chat with latest info
          setSelectedChat(prev => ({ ...prev, ...response.chat, unreadCount: 0 }));
        }
        
        // Auto-scroll to bottom to show the new message
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }, 200);
        
        // Note: Real message will come via Socket.IO message_sent event, so we don't need to poll
        // The temp message will be replaced by the real one when message_sent event arrives
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
          <ChatList
            chats={chats}
            filteredChats={filteredChats}
            selectedChat={selectedChat}
            searchQuery={searchQuery}
            loadingChats={loadingChats}
            chatPagination={chatPagination}
            chatListRef={chatListRef}
            onChatSelect={handleChatSelect}
            onSearchChange={setSearchQuery}
            onNewMessageClick={() => setShowNewMessageModal(true)}
            onBulkMessageClick={() => setShowBulkMessagePanel(true)}
            onScheduleMessageClick={() => setShowScheduleMessagePanel(true)}
            onScheduledListClick={() => setShowScheduledMessagesPanel(true)}
            showChatMenu={showChatMenu}
            setShowChatMenu={setShowChatMenu}
            phoneNumber={phoneNumber}
          />

          {/* Right Panel - Chat Window */}
          <ChatWindow
            selectedChat={selectedChat}
            messages={messages}
            sendMessage={sendMessage}
            sending={sending}
            loadingMessages={loadingMessages}
            messagePagination={messagePagination}
            messagesContainerRef={messagesContainerRef}
            messagesEndRef={messagesEndRef}
            phoneNumber={phoneNumber}
            onSendMessage={handleSendMessage}
            onMessageChange={setSendMessage}
          />
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

      {/* Right Panel Overlays */}
      <BulkMessagePanel
        isOpen={showBulkMessagePanel}
        onClose={() => setShowBulkMessagePanel(false)}
        whatsappStatus={status}
      />

      <ScheduleMessagePanel
        isOpen={showScheduleMessagePanel}
        onClose={() => setShowScheduleMessagePanel(false)}
        onScheduleSuccess={() => {
          // Optionally refresh scheduled messages list or show a toast
          toast.success("Message scheduled successfully!");
        }}
      />

      <ScheduledMessagesListPanel
        isOpen={showScheduledMessagesPanel}
        onClose={() => setShowScheduledMessagesPanel(false)}
      />

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
