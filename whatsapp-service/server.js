/**
 * WhatsApp Service using whatsapp-web.js
 * Separate Node.js service for WhatsApp automation
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Store WhatsApp clients per user
const clients = new Map();

// Track initialization in progress to prevent duplicates
const initializing = new Set();

// Store messages per user (in-memory storage)
// Structure: { userId: { messages: [...], chats: [...] } }
const userMessages = new Map();

// Helper function to generate QR code image
async function generateQRCode(qrString) {
  try {
    const qrImage = await qrcode.toDataURL(qrString);
    return qrImage;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Initialize WhatsApp client for a user
app.post('/api/initialize/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
    // Prevent multiple simultaneous initializations
    if (initializing.has(userId)) {
      console.log(`[${userId}] Initialization already in progress, returning current status...`);
      const existingData = clients.get(userId);
      if (existingData && existingData.qrCode) {
        return res.json({
          status: 'qr_ready',
          qr_code: existingData.qrCode,
          message: 'Scan QR code with your phone'
        });
      }
      if (existingData && existingData.isReady && existingData.client.info) {
        return res.json({
          status: 'ready',
          phone_number: existingData.client.info.wid.user,
          message: 'WhatsApp is ready'
        });
      }
      return res.json({
        status: 'connecting',
        message: 'Initialization in progress...'
      });
    }
    
    // Check if client already exists
    if (clients.has(userId)) {
      const clientData = clients.get(userId);
      const client = clientData.client;
      
      // Check if client is ready
      if (client.info && clientData.isReady) {
        return res.json({
          status: 'ready',
          phone_number: client.info.wid.user,
          message: 'WhatsApp is already connected'
        });
      }
      
      // If QR is available, return it
      if (clientData.qrCode) {
        return res.json({
          status: 'qr_ready',
          qr_code: clientData.qrCode,
          message: 'Scan QR code with your phone'
        });
      }
      
      // If there's an error, clean up and recreate
      if (clientData.error) {
        console.log(`[${userId}] Cleaning up failed client and recreating...`);
        try {
          await client.destroy().catch(() => {});
        } catch (e) {
          // Ignore destroy errors
        }
        clients.delete(userId);
        // Continue to create new client below
      } else {
        // If connecting for too long (more than 30 seconds), force recreate
        const clientAge = Date.now() - (clientData.createdAt || 0);
        if (clientAge > 30000 && !clientData.qrCode && !clientData.isReady) {
          console.log(`[${userId}] Client stuck in connecting state for ${clientAge}ms, recreating...`);
          try {
            await client.destroy().catch(() => {});
          } catch (e) {
            // Ignore destroy errors
          }
          clients.delete(userId);
          // Continue to create new client below
        } else {
          // If connecting, wait a bit and check again
          console.log(`[${userId}] Client exists but not ready, waiting for status...`);
          let attempts = 0;
          while (attempts < 5) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            
            const updatedData = clients.get(userId);
            if (!updatedData) break;
            
            if (updatedData.isReady && client.info) {
              return res.json({
                status: 'ready',
                phone_number: client.info.wid.user,
                message: 'WhatsApp is ready'
              });
            }
            
            if (updatedData.qrCode) {
              return res.json({
                status: 'qr_ready',
                qr_code: updatedData.qrCode,
                message: 'Scan QR code with your phone'
              });
            }
          }
          
          // Still connecting
          return res.json({
            status: 'connecting',
            message: 'Initializing WhatsApp... Please wait'
          });
        }
      }
    }
    
    console.log(`[${userId}] Starting fresh initialization...`);
    initializing.add(userId);
    
    // Kill any existing browser processes for this user first
    try {
      const { exec } = require('child_process');
      exec(`pkill -f "session-user-${userId}"`, () => {
        // Ignore errors, just try to clean up
      });
      // Small delay to ensure processes are killed
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log(`[${userId}] Could not kill existing processes:`, e.message);
    }
    
    // Create new client with LocalAuth for session persistence
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: `user-${userId}`
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding'
        ],
        timeout: 120000, // 120 second timeout (2 minutes)
        ignoreHTTPSErrors: true
      }
      // Removed webVersionCache as it might be causing issues
    });
    
    let qrCodeData = null;
    let isReady = false;
    
    // IMPORTANT: Register event handlers BEFORE calling initialize()
    console.log(`[${userId}] Registering event handlers...`);
    
    // QR code event
    client.on('qr', async (qr) => {
      console.log(`[${userId}] ✅ QR code received!`);
      try {
        qrCodeData = await generateQRCode(qr);
        console.log(`[${userId}] QR code generated, length: ${qrCodeData ? qrCodeData.length : 0}`);
        if (clients.has(userId)) {
          const clientData = clients.get(userId);
          clientData.qrCode = qrCodeData;
          console.log(`[${userId}] ✅ QR code stored successfully in client data`);
        } else {
          console.error(`[${userId}] ❌ Client data not found when storing QR code!`);
        }
      } catch (error) {
        console.error(`[${userId}] ❌ Error generating QR code:`, error);
      }
    });
    
    // Ready event
    client.on('ready', async () => {
      console.log(`Client ${userId} is ready!`);
      isReady = true;
      if (clients.has(userId)) {
        clients.get(userId).qrCode = null;
        clients.get(userId).isReady = true;
      }
      
      // Initialize message storage for this user
      if (!userMessages.has(userId)) {
        userMessages.set(userId, {
          messages: [],
          chats: new Map() // Map of phone -> chat info
        });
      }
      
      // Fetch existing chats from WhatsApp
      try {
        console.log(`[${userId}] Fetching existing chats...`);
        const chats = await client.getChats();
        const userData = userMessages.get(userId);
        
        console.log(`[${userId}] Found ${chats.length} total chats`);
        let processedCount = 0;
        let errorCount = 0;
        
        for (const chat of chats) {
          try {
            // Skip groups for now (can add later)
            if (chat.isGroup) {
              continue;
            }
            
            // Clean phone number to ensure consistency
            const phoneNumber = (chat.id.user || '').replace(/\D/g, '');
            if (!phoneNumber) {
              console.log(`[${userId}] Skipping chat with invalid phone number: ${chat.id.user}`);
              continue;
            }
            
            // Try to get contact info, but handle errors gracefully
            let contactName = phoneNumber;
            try {
              const contact = await chat.getContact();
              contactName = contact.pushname || contact.name || contact.number || phoneNumber;
            } catch (contactError) {
              // If contact fetch fails, use phone number or try alternative method
              console.log(`[${userId}] Could not fetch contact for ${phoneNumber}, using phone number`);
              try {
                // Try alternative: get name from chat object directly
                contactName = chat.name || chat.contact?.name || phoneNumber;
              } catch (e) {
                // Just use phone number
                contactName = phoneNumber;
              }
            }
            
            // Get last message
            let lastMessage = null;
            try {
              const messages = await chat.fetchMessages({ limit: 1 });
              lastMessage = messages.length > 0 ? messages[0] : null;
            } catch (msgError) {
              console.log(`[${userId}] Could not fetch last message for ${phoneNumber}:`, msgError.message);
            }
            
            // Always update chat info (even if it exists, to refresh data)
            const chatInfo = {
              phone: phoneNumber,
              name: contactName,
              lastMessage: lastMessage ? (lastMessage.body || '[Media]') : '',
              lastMessageTime: lastMessage ? (lastMessage.timestamp * 1000) : Date.now(),
              unreadCount: chat.unreadCount || 0
            };
            
            userData.chats.set(phoneNumber, chatInfo);
            processedCount++;
            
            // Fetch recent messages for this chat (last 100) - but don't block on errors
            // Always try to fetch messages, not just if lastMessage exists
            try {
              const recentMessages = await chat.fetchMessages({ limit: 100 });
                for (const msg of recentMessages) {
                  // Check if message already exists
                  const existingMsg = userData.messages.find(m => 
                    (m.id === msg.id._serialized || m.id === msg.id.id) && 
                    (m.chatId === chat.id._serialized || m.from === phoneNumber)
                  );
                  
                  if (!existingMsg) {
                    let msgContactName = phoneNumber;
                    try {
                      const msgContact = await msg.getContact();
                      msgContactName = msgContact.pushname || msgContact.name || msgContact.number || phoneNumber;
                    } catch (e) {
                      // If contact fetch fails, try to get name from message object
                      try {
                        msgContactName = msg.notifyName || msg._data?.notifyName || contactName || phoneNumber;
                      } catch (e2) {
                        // Just use phone number or contact name we already have
                        msgContactName = contactName || phoneNumber;
                      }
                    }
                    
                    // Extract phone from message if it's not from me
                    let msgFrom = phoneNumber;
                    if (!msg.fromMe && msg.from) {
                      msgFrom = msg.from.replace('@c.us', '').replace(/\D/g, '') || phoneNumber;
                    }
                    
                    const msgData = {
                      id: msg.id._serialized || msg.id.id,
                      from: msgFrom,
                      fromName: msg.fromMe ? "You" : msgContactName,
                      body: msg.body || '[Media]',
                      timestamp: msg.timestamp * 1000,
                      type: msg.type,
                      isGroup: false,
                      chatId: chat.id._serialized,
                      hasMedia: msg.hasMedia,
                      mediaUrl: null,
                      isSent: msg.fromMe || false
                    };
                    
                    // Handle media if present (but don't block on errors)
                    if (msg.hasMedia) {
                      try {
                        const media = await msg.downloadMedia();
                        if (media) {
                          msgData.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
                        }
                      } catch (mediaError) {
                        // Silently skip media if download fails
                      }
                    }
                    
                    userData.messages.push(msgData);
                  }
                }
                console.log(`[${userId}] Loaded ${recentMessages.length} messages for ${phoneNumber}`);
              } catch (msgFetchError) {
                console.log(`[${userId}] Could not fetch messages for ${phoneNumber}:`, msgFetchError.message);
                // Continue with other chats even if this one fails
              }
          } catch (chatError) {
            errorCount++;
            console.error(`[${userId}] Error processing chat:`, chatError.message);
            // Continue with next chat
          }
        }
        
        // Sort messages by timestamp
        userData.messages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Keep only last 2000 messages per user (to prevent memory issues)
        if (userData.messages.length > 2000) {
          userData.messages = userData.messages.slice(-2000);
        }
        
        const totalChats = userData.chats.size;
        console.log(`[${userId}] Loaded ${processedCount} chats (${errorCount} errors), total chats: ${totalChats}, messages: ${userData.messages.length}`);
      } catch (error) {
        console.error(`[${userId}] Error fetching existing chats:`, error);
      }
    });
    
    // Listen for incoming messages
    client.on('message', async (message) => {
      try {
        console.log(`[${userId}] Incoming message from ${message.from}: ${message.body}`);
        
        // Get chat first
        const chat = await message.getChat();
        
        // Extract phone number (remove @c.us suffix)
        const phoneNumber = message.from.replace('@c.us', '').replace(/\D/g, '');
        
        // Get contact info, but handle errors gracefully
        let contactName = phoneNumber;
        try {
          const contact = await message.getContact();
          contactName = contact.pushname || contact.name || phoneNumber;
        } catch (contactError) {
          // Try alternative methods
          try {
            contactName = message.notifyName || message._data?.notifyName || chat.name || phoneNumber;
          } catch (e) {
            contactName = phoneNumber;
          }
        }
        
        // Create message object
        const messageData = {
          id: message.id._serialized || message.id.id,
          from: phoneNumber,
          fromName: contactName,
          body: message.body,
          timestamp: message.timestamp * 1000, // Convert to milliseconds
          type: message.type,
          isGroup: message.from.includes('@g.us'),
          chatId: message.from,
          hasMedia: message.hasMedia,
          mediaUrl: null
        };
        
        // Handle media if present
        if (message.hasMedia) {
          try {
            const media = await message.downloadMedia();
            if (media) {
              messageData.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
            }
          } catch (mediaError) {
            console.error(`[${userId}] Error downloading media:`, mediaError);
          }
        }
        
        // Store message
        if (!userMessages.has(userId)) {
          userMessages.set(userId, {
            messages: [],
            chats: new Map()
          });
        }
        
        const userData = userMessages.get(userId);
        userData.messages.push(messageData);
        
        // Update chat info - always update to ensure it's in the list and sorted properly
        const existingChat = userData.chats.get(phoneNumber);
        if (existingChat) {
          existingChat.lastMessage = message.body;
          existingChat.lastMessageTime = messageData.timestamp;
          existingChat.unreadCount = (existingChat.unreadCount || 0) + 1;
          existingChat.name = contactName; // Update name in case it changed
        } else {
          // Create new chat entry for incoming message
          userData.chats.set(phoneNumber, {
            phone: phoneNumber,
            name: contactName,
            lastMessage: message.body,
            lastMessageTime: messageData.timestamp,
            unreadCount: 1
          });
        }
        
        console.log(`[${userId}] 📨 Incoming message - Chat updated for ${phoneNumber}`);
        
        // Keep only last 1000 messages per user (to prevent memory issues)
        if (userData.messages.length > 1000) {
          userData.messages = userData.messages.slice(-1000);
        }
        
        console.log(`[${userId}] Message stored. Total messages: ${userData.messages.length}`);
      } catch (error) {
        console.error(`[${userId}] Error handling incoming message:`, error);
      }
    });
    
    // Authentication event
    client.on('authenticated', () => {
      console.log(`Client ${userId} authenticated!`);
    });
    
    // Authentication failure
    client.on('auth_failure', (msg) => {
      console.error(`Authentication failure for user ${userId}:`, msg);
      if (clients.has(userId)) {
        clients.get(userId).error = `Authentication failed: ${msg}`;
      }
    });
    
    // Error event
    client.on('error', (error) => {
      console.error(`[${userId}] ❌ Client error:`, error.message || error);
      if (clients.has(userId)) {
        clients.get(userId).error = error.message || 'Unknown error';
      }
    });
    
    // Disconnected event - handle browser crashes
    client.on('disconnected', (reason) => {
      console.log(`[${userId}] ⚠️ Client disconnected:`, reason);
      if (clients.has(userId)) {
        const clientData = clients.get(userId);
        clientData.isReady = false;
        if (reason === 'NAVIGATION' || reason === 'close' || reason === 'CONNECTION_CLOSED') {
          console.log(`[${userId}] Browser was closed/crashed, will need to reconnect`);
          clientData.error = 'Browser connection lost. Please try again.';
        } else {
          clientData.error = `Disconnected: ${reason}`;
        }
      }
    });
    
    // Store client data with timestamp
    clients.set(userId, {
      client,
      qrCode: null,
      isReady: false,
      error: null,
      createdAt: Date.now() // Track when client was created
    });
    
    // Initialize message storage if not exists
    if (!userMessages.has(userId)) {
      userMessages.set(userId, {
        messages: [],
        chats: new Map()
      });
    }
    
    // Initialize client - this should trigger QR code event
    console.log(`[${userId}] Starting client initialization...`);
    
    // Initialize immediately (handlers are already registered)
    client.initialize().then(() => {
      console.log(`[${userId}] ✅ Client initialize() promise resolved`);
      initializing.delete(userId);
    }).catch(error => {
      console.error(`[${userId}] ❌ Error initializing client:`, error.message || error);
      initializing.delete(userId);
      if (clients.has(userId)) {
        const clientData = clients.get(userId);
        clientData.error = error.message || 'Failed to initialize';
        console.error(`[${userId}] Full error:`, error);
      }
    });
    
    // Wait longer for QR code or ready state (up to 30 seconds)
    let attempts = 0;
    const maxAttempts = 30; // Increased to 30 seconds
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const clientData = clients.get(userId);
      if (!clientData) {
        console.log(`[${userId}] Client data removed during wait`);
        initializing.delete(userId);
        break;
      }
      
      // Check if ready
      if (clientData.isReady && client.info) {
        initializing.delete(userId);
        return res.json({
          status: 'ready',
          phone_number: client.info.wid.user,
          message: 'WhatsApp is ready'
        });
      }
      
      // Check if QR code is available
      if (clientData.qrCode || qrCodeData) {
        initializing.delete(userId);
        return res.json({
          status: 'qr_ready',
          qr_code: clientData.qrCode || qrCodeData,
          message: 'Scan QR code with your phone'
        });
      }
      
      // Check for errors
      if (clientData.error) {
        initializing.delete(userId);
        return res.status(500).json({
          status: 'error',
          error: clientData.error
        });
      }
      
      // Log progress every 5 seconds
      if (attempts % 5 === 0) {
        console.log(`[${userId}] Still waiting for QR/ready... (${attempts}s)`);
      }
    }
    
    // If we get here, still connecting but return immediately so frontend can poll
    const clientData = clients.get(userId);
    if (clientData && (clientData.qrCode || qrCodeData)) {
      initializing.delete(userId);
      return res.json({
        status: 'qr_ready',
        qr_code: clientData.qrCode || qrCodeData,
        message: 'Scan QR code with your phone'
      });
    }
    
    // Don't remove from initializing set - let status endpoint handle it
    return res.json({
      status: 'connecting',
      message: 'Initializing WhatsApp... This may take 30-60 seconds. Please wait.'
    });
    
  } catch (error) {
    console.error(`Error initializing WhatsApp for user ${userId}:`, error);
    res.status(500).json({
      status: 'error',
      error: error.message || 'Failed to initialize WhatsApp'
    });
  }
});

// Get status
app.get('/api/status/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
    if (!clients.has(userId)) {
      return res.json({
        status: 'disconnected',
        qr_code: null,
        phone_number: null,
        error: null
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    // Check for errors
    if (clientData.error) {
      return res.json({
        status: 'error',
        error: clientData.error,
        qr_code: null,
        phone_number: null
      });
    }
    
    // Check if ready
    if (client.info && clientData.isReady) {
      return res.json({
        status: 'ready',
        phone_number: client.info.wid.user,
        qr_code: null,
        error: null
      });
    }
    
    // Check for QR code
    if (clientData.qrCode) {
      return res.json({
        status: 'qr_ready',
        qr_code: clientData.qrCode,
        phone_number: null,
        error: null
      });
    }
    
    // Still connecting
    return res.json({
      status: 'connecting',
      qr_code: null,
      phone_number: null,
      error: null
    });
    
  } catch (error) {
    console.error(`Error getting status for user ${userId}:`, error);
    res.status(500).json({
      status: 'error',
      error: error.message || 'Failed to get status',
      qr_code: null,
      phone_number: null
    });
  }
});

// Send message
app.post('/api/send/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { phone, message } = req.body;
  
  try {
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }
    
    if (!clients.has(userId)) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not initialized. Please initialize first.'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    if (!client.info || !clientData.isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp is not ready. Please scan QR code first.'
      });
    }
    
    // Clean phone number (remove all non-digits)
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Format phone number with country code if needed
    const chatId = `${cleanPhone}@c.us`;
    
    console.log(`Sending message to ${chatId} for user ${userId}`);
    
    // Send message
    const sentMessage = await client.sendMessage(chatId, message);
    
    // Store sent message
    if (!userMessages.has(userId)) {
      userMessages.set(userId, {
        messages: [],
        chats: new Map()
      });
    }
    
    const userData = userMessages.get(userId);
    
    // Try to get contact info, fallback to phone number if not available
    let contactName = cleanPhone;
    try {
      // Try to get contact from the sent message
      const contact = await sentMessage.getContact();
      contactName = contact.pushname || contact.name || contact.number || cleanPhone;
    } catch (contactError) {
      console.log(`[${userId}] Could not get contact from message, trying chat...`);
      // Try to get from chat
      try {
        const chat = await client.getChatById(chatId);
        const contact = await chat.getContact();
        contactName = contact.pushname || contact.name || contact.number || cleanPhone;
      } catch (chatError) {
        console.log(`[${userId}] Could not get chat info, using phone number as name`);
        // Use phone number as name for new contacts
        contactName = cleanPhone;
      }
    }
    
    const messageData = {
      id: sentMessage.id._serialized || sentMessage.id.id,
      from: client.info.wid.user, // Our phone number
      fromName: "You",
      body: message,
      timestamp: Date.now(),
      type: sentMessage.type,
      isGroup: chatId.includes('@g.us'),
      chatId: chatId,
      hasMedia: false,
      isSent: true
    };
    
    userData.messages.push(messageData);
    
    // Create or update chat info - this ensures the chat appears in the list
    // Always use cleanPhone as the key to ensure consistency
    const chatInfo = {
      phone: cleanPhone,
      name: contactName,
      lastMessage: message,
      lastMessageTime: messageData.timestamp,
      unreadCount: 0
    };
    
    // Always set/update the chat - this ensures new chats appear immediately
    userData.chats.set(cleanPhone, chatInfo);
    
    console.log(`[${userId}] Chat created/updated for ${cleanPhone} (${contactName}): ${message.substring(0, 50)}...`);
    console.log(`[${userId}] Total chats now: ${userData.chats.size}`);
    
    // Verify the chat is in the map
    const verifyChat = userData.chats.get(cleanPhone);
    if (verifyChat) {
      console.log(`[${userId}] Verified chat exists: ${JSON.stringify(verifyChat)}`);
    } else {
      console.error(`[${userId}] ERROR: Chat was not properly stored!`);
    }
    
    res.json({
      success: true,
      message: `Message sent to ${phone} successfully`,
      phone_number: cleanPhone,
      chat: chatInfo  // Return chat info so frontend can add it immediately
    });
    
  } catch (error) {
    console.error(`Error sending message for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message'
    });
  }
});

// Disconnect
app.post('/api/disconnect/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
    if (!clients.has(userId)) {
      return res.json({
        success: true,
        message: 'Already disconnected'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    console.log(`[${userId}] Disconnecting client...`);
    
    // Try to logout and destroy, but don't fail if it errors
    try {
      await client.logout();
    } catch (e) {
      console.log(`[${userId}] Logout error (ignoring):`, e.message);
    }
    
    try {
      await client.destroy();
    } catch (e) {
      console.log(`[${userId}] Destroy error (ignoring):`, e.message);
    }
    
    // Remove from map
    clients.delete(userId);
    
    // Optionally clear messages (or keep them for history)
    // userMessages.delete(userId);
    
    console.log(`[${userId}] Client disconnected and removed`);
    
    res.json({
      success: true,
      message: 'Disconnected successfully'
    });
    
  } catch (error) {
    console.error(`[${userId}] Error disconnecting:`, error);
    
    // Remove from map even if error
    if (clients.has(userId)) {
      clients.delete(userId);
      console.log(`[${userId}] Force removed from clients map`);
    }
    
    res.json({
      success: true,
      message: 'Disconnected (with errors)'
    });
  }
});

// Get chats/conversations for a user
app.get('/api/chats/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
    // If client is ready, always try to get fresh chats from WhatsApp
    if (clients.has(userId) && clients.get(userId).isReady) {
      const clientData = clients.get(userId);
      const client = clientData.client;
      
      try {
        // Always fetch fresh chats from WhatsApp to ensure we have the latest
        const whatsappChats = await client.getChats();
        
        if (!userMessages.has(userId)) {
          userMessages.set(userId, {
            messages: [],
            chats: new Map()
          });
        }
        const userData = userMessages.get(userId);
        
            // Update chats from WhatsApp (this ensures we have all chats)
        for (const chat of whatsappChats) {
          if (chat.isGroup) continue;
          try {
            const phoneNumber = (chat.id.user || '').replace(/\D/g, '');
            if (!phoneNumber) continue;
            
            // Try to get contact info, but handle errors gracefully
            let contactName = phoneNumber;
            try {
              const contact = await chat.getContact();
              contactName = contact.pushname || contact.name || contact.number || phoneNumber;
            } catch (contactError) {
              // If contact fetch fails, try alternative methods
              try {
                contactName = chat.name || chat.contact?.name || phoneNumber;
              } catch (e) {
                contactName = phoneNumber;
              }
            }
            
            // Get last message
            let lastMessage = null;
            let lastMessageTime = Date.now();
            try {
              const messages = await chat.fetchMessages({ limit: 1 });
              lastMessage = messages.length > 0 ? messages[0] : null;
              if (lastMessage) {
                lastMessageTime = lastMessage.timestamp * 1000;
              }
            } catch (e) {
              // Use existing time if fetch fails
              const existing = userData.chats.get(phoneNumber);
              if (existing) {
                lastMessageTime = existing.lastMessageTime || Date.now();
                lastMessage = { body: existing.lastMessage || '' };
              }
            }
            
            // Update or create chat entry
            const existingChat = userData.chats.get(phoneNumber);
            if (existingChat) {
              // Update existing chat with latest info
              existingChat.name = contactName;
              existingChat.unreadCount = chat.unreadCount || existingChat.unreadCount || 0;
              // Only update last message if we got a newer one
              if (lastMessage && (!existingChat.lastMessageTime || lastMessageTime > existingChat.lastMessageTime)) {
                existingChat.lastMessage = lastMessage.body || '[Media]';
                existingChat.lastMessageTime = lastMessageTime;
              }
            } else {
              // Create new chat entry
              userData.chats.set(phoneNumber, {
                phone: phoneNumber,
                name: contactName,
                lastMessage: lastMessage ? (lastMessage.body || '[Media]') : '',
                lastMessageTime: lastMessageTime,
                unreadCount: chat.unreadCount || 0
              });
            }
          } catch (e) {
            console.log(`[${userId}] Error processing chat:`, e.message);
            // Continue with other chats
          }
        }
        
        console.log(`[${userId}] Updated chats from WhatsApp: ${userData.chats.size} total`);
      } catch (fetchError) {
        console.error(`[${userId}] Error fetching chats from WhatsApp:`, fetchError.message);
        // Fall through to return stored chats
      }
    }
    
    if (!userMessages.has(userId)) {
      return res.json({
        chats: []
      });
    }
    
    const userData = userMessages.get(userId);
    const chatsArray = Array.from(userData.chats.values())
      .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    
    res.json({
      chats: chatsArray
    });
  } catch (error) {
    console.error(`Error getting chats for user ${userId}:`, error);
    res.status(500).json({
      error: error.message || 'Failed to get chats'
    });
  }
});

// Get messages for a specific chat
app.get('/api/messages/:userId/:phone', async (req, res) => {
    const userId = req.params.userId;
  const phone = req.params.phone.replace(/\D/g, ''); // Clean phone number
  const limit = parseInt(req.query.limit) || 500; // Default to 500 messages for full history
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.json({
        messages: []
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    const chatId = `${phone}@c.us`;
    
    // Try to fetch from WhatsApp directly for more messages
    try {
      const chat = await client.getChatById(chatId);
      const whatsappMessages = await chat.fetchMessages({ limit: limit });
      
      // Convert WhatsApp messages to our format
      const formattedMessages = [];
      for (const msg of whatsappMessages) {
        // Get contact name, but handle errors gracefully
        let contactName = phone;
        try {
          const contact = await msg.getContact();
          contactName = contact.pushname || contact.name || phone;
        } catch (contactError) {
          // Try alternative methods to get name
          try {
            contactName = msg.notifyName || msg._data?.notifyName || chat.name || phone;
          } catch (e) {
            contactName = phone;
          }
        }
        
        // Extract phone from message if it's not from me
        let msgFrom = phone;
        if (!msg.fromMe && msg.from) {
          msgFrom = msg.from.replace('@c.us', '').replace(/\D/g, '') || phone;
        }
        
        const msgData = {
          id: msg.id._serialized || msg.id.id,
          from: msgFrom,
          fromName: msg.fromMe ? "You" : contactName,
          body: msg.body || '[Media]',
          timestamp: msg.timestamp * 1000,
          type: msg.type,
          isGroup: false,
          chatId: chatId,
          hasMedia: msg.hasMedia,
          mediaUrl: null,
          isSent: msg.fromMe || false
        };
        
        // Handle media if present
        if (msg.hasMedia) {
          try {
            const media = await msg.downloadMedia();
            if (media) {
              msgData.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
            }
          } catch (mediaError) {
            console.error(`Error downloading media:`, mediaError);
          }
        }
        
        formattedMessages.push(msgData);
      }
      
      // Mark messages as read
      await chat.sendSeen();
      
      // Update stored messages
      if (userMessages.has(userId)) {
        const userData = userMessages.get(userId);
        // Merge with existing messages, avoiding duplicates
        for (const msg of formattedMessages) {
          const exists = userData.messages.find(m => m.id === msg.id);
          if (!exists) {
            userData.messages.push(msg);
          }
        }
        // Update unread count
        if (userData.chats.has(phone)) {
          userData.chats.get(phone).unreadCount = 0;
        }
      }
      
      return res.json({
        messages: formattedMessages.sort((a, b) => a.timestamp - b.timestamp)
      });
    } catch (chatError) {
      // Fallback to stored messages if chat fetch fails
      console.log(`[${userId}] Could not fetch from WhatsApp, using stored messages:`, chatError.message);
      
      if (!userMessages.has(userId)) {
        return res.json({
          messages: []
        });
      }
      
      const userData = userMessages.get(userId);
      const messages = userData.messages
        .filter(msg => msg.chatId === chatId || msg.from === phone)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-limit); // Limit to last N messages
      
      // Mark messages as read (reset unread count)
      if (userData.chats.has(phone)) {
        userData.chats.get(phone).unreadCount = 0;
      }
      
      return res.json({
        messages: messages
      });
    }
  } catch (error) {
    console.error(`Error getting messages for user ${userId}, phone ${phone}:`, error);
    res.status(500).json({
      error: error.message || 'Failed to get messages'
    });
  }
});

// Get all messages for a user (optional - for debugging)
app.get('/api/messages/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
    if (!userMessages.has(userId)) {
      return res.json({
        messages: []
      });
    }
    
    const userData = userMessages.get(userId);
    const messages = userData.messages.sort((a, b) => a.timestamp - b.timestamp);
    
    res.json({
      messages: messages
    });
  } catch (error) {
    console.error(`Error getting all messages for user ${userId}:`, error);
    res.status(500).json({
      error: error.message || 'Failed to get messages'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'WhatsApp service is running',
    active_clients: clients.size,
    total_messages_stored: Array.from(userMessages.values())
      .reduce((sum, data) => sum + data.messages.length, 0)
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`WhatsApp Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

