/**
 * WhatsApp Service using whatsapp-web.js
 * Separate Node.js service for WhatsApp automation
 */
const { Client, LocalAuth, MessageAck } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store WhatsApp clients per user
const clients = new Map();

// Track initialization in progress to prevent duplicates
const initializing = new Set();

// Store messages per user (in-memory storage)
// Structure: { userId: { messages: [...], chats: [...] } }
const userMessages = new Map();

// Store Socket.IO connections per user
// Structure: { userId: socket }
const userSockets = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on('join', (userId) => {
    console.log(`User ${userId} joined socket room`);
    socket.join(`user-${userId}`);
    userSockets.set(userId, socket);
    
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected from socket`);
      userSockets.delete(userId);
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Helper function to emit events to a specific user
function emitToUser(userId, event, data) {
  const socket = userSockets.get(userId);
  if (socket) {
    socket.emit(event, data);
  }
  // Also emit to room for redundancy
  io.to(`user-${userId}`).emit(event, data);
}

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
        
        // Emit QR code via Socket.IO
        emitToUser(userId, 'qr', { qrCode: qrCodeData });
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
      
      // Emit ready event
      emitToUser(userId, 'ready', {
        userId,
        phoneNumber: client.info?.wid?.user || null
      });
      
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
            
            // Filter out invalid chat IDs - proper phone number validation
            if (!phoneNumber || phoneNumber.length < 7 || phoneNumber.length > 16) {
              console.log(`[${userId}] Skipping chat with invalid phone number length: ${chat.id.user} (cleaned: ${phoneNumber}, length: ${phoneNumber.length})`);
              continue;
            }

            // Filter out WhatsApp internal IDs (typically very long numbers)
            if (phoneNumber.length > 13 && /^\d+$/.test(phoneNumber)) {
              console.log(`[${userId}] Skipping chat with suspicious long numeric ID (likely WhatsApp internal): ${phoneNumber}`);
              continue;
            }

            // Additional check: phone numbers should start with country codes, not random long numbers
            if (phoneNumber.length > 12 && !phoneNumber.match(/^[1-9][0-9]+$/)) {
              console.log(`[${userId}] Skipping chat with invalid format: ${phoneNumber}`);
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
            
            // Get profile picture URL (with timeout and validation)
            let profilePicUrl = null;
            try {
              const contact = await chat.getContact();
              if (contact) {
                try {
                  profilePicUrl = await Promise.race([
                    contact.getProfilePicUrl(),
                    new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Profile pic timeout')), 3000)
                    )
                  ]);
                  
                  // Validate URL format - WhatsApp returns full URLs
                  if (profilePicUrl) {
                    if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) {
                      console.log(`[${userId}] ✅ Profile pic for ${phoneNumber}: ${profilePicUrl.substring(0, 50)}...`);
                    } else {
                      console.log(`[${userId}] ⚠️ Invalid profile pic URL: ${profilePicUrl}`);
                      profilePicUrl = null;
                    }
                  }
                } catch (picError) {
                  // Profile pic fetch failed, continue without it
                  console.log(`[${userId}] ⚠️ Profile pic fetch failed for ${phoneNumber}:`, picError.message);
                }
              }
            } catch (contactError) {
              // Contact fetch failed, continue without profile pic
              console.log(`[${userId}] ⚠️ Contact fetch failed for ${phoneNumber}:`, contactError.message);
            }
            
            // Always update chat info (even if it exists, to refresh data)
            // Store chat ID for proper message sending
            const chatInfo = {
              phone: phoneNumber,
              chatId: chat.id._serialized, // Store full chat ID
              chatIdUser: chat.id.user || phoneNumber, // Store user part
              name: contactName,
              lastMessage: lastMessage ? (lastMessage.body || '[Media]') : '',
              lastMessageTime: lastMessage ? (lastMessage.timestamp * 1000) : Date.now(),
              unreadCount: chat.unreadCount || 0,
              profilePicUrl: profilePicUrl
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
        
        // Get profile picture URL (with timeout and validation)
        let profilePicUrl = null;
        try {
          const contact = await message.getContact();
          if (contact) {
            try {
              profilePicUrl = await Promise.race([
                contact.getProfilePicUrl(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Profile pic timeout')), 2000)
                )
              ]);
              
              // Validate URL format
              if (profilePicUrl && (!profilePicUrl.startsWith('http') && !profilePicUrl.startsWith('data:'))) {
                console.log(`[${userId}] Invalid profile pic URL: ${profilePicUrl}`);
                profilePicUrl = null;
              }
            } catch (picError) {
              // Profile pic fetch failed, continue without it
            }
          }
        } catch (contactError) {
          // Contact fetch failed, continue without profile pic
        }
        
        // Update chat info - always update to ensure it's in the list and sorted properly
        const existingChat = userData.chats.get(phoneNumber);
        if (existingChat) {
          existingChat.lastMessage = message.body;
          existingChat.lastMessageTime = messageData.timestamp;
          existingChat.unreadCount = (existingChat.unreadCount || 0) + 1;
          existingChat.name = contactName; // Update name in case it changed
          // Store chat ID if not already stored
          if (!existingChat.chatId) {
            existingChat.chatId = message.from;
            existingChat.chatIdUser = phoneNumber;
          }
          if (profilePicUrl) {
            existingChat.profilePicUrl = profilePicUrl;
          }
        } else {
          // Create new chat entry for incoming message
          userData.chats.set(phoneNumber, {
            phone: phoneNumber,
            chatId: message.from, // Store full chat ID
            chatIdUser: phoneNumber, // Store user part
            name: contactName,
            lastMessage: message.body,
            lastMessageTime: messageData.timestamp,
            unreadCount: 1,
            profilePicUrl: profilePicUrl
          });
        }
        
        console.log(`[${userId}] 📨 Incoming message - Chat updated for ${phoneNumber}`);
        
        // Emit real-time message event
        emitToUser(userId, 'message', {
          message: messageData,
          chat: userData.chats.get(phoneNumber)
        });
        
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
      emitToUser(userId, 'authenticated', { userId });
    });
    
    // Authentication failure
    client.on('auth_failure', (msg) => {
      console.error(`Authentication failure for user ${userId}:`, msg);
      if (clients.has(userId)) {
        clients.get(userId).error = `Authentication failed: ${msg}`;
      }
      emitToUser(userId, 'auth_failure', { userId, error: msg });
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
      emitToUser(userId, 'disconnected', { userId, reason });
    });
    
    // Message ACK (status: sent, delivered, read)
    client.on('message_ack', async (message, ack) => {
      try {
        console.log(`[${userId}] Message ACK: ${ack} for message ${message.id._serialized}`);
        
        // Find message in storage and update status
        if (userMessages.has(userId)) {
          const userData = userMessages.get(userId);
          const msgIndex = userData.messages.findIndex(m => 
            m.id === message.id._serialized || m.id === message.id.id
          );
          
          if (msgIndex !== -1) {
            const statusMap = {
              [MessageAck.ACK_PENDING]: 'pending',
              [MessageAck.ACK_SERVER]: 'sent',
              [MessageAck.ACK_DEVICE]: 'delivered',
              [MessageAck.ACK_READ]: 'read',
              [MessageAck.ACK_PLAYED]: 'played',
              [MessageAck.ACK_ERROR]: 'error'
            };
            
            userData.messages[msgIndex].status = statusMap[ack] || 'unknown';
            userData.messages[msgIndex].ack = ack;
            
            // Emit real-time update
            emitToUser(userId, 'message_ack', {
              messageId: message.id._serialized || message.id.id,
              status: statusMap[ack] || 'unknown',
              ack: ack
            });
          }
        }
      } catch (error) {
        console.error(`[${userId}] Error handling message_ack:`, error);
      }
    });
    
    // Message create (when a message is sent)
    client.on('message_create', async (message) => {
      try {
        if (message.fromMe) {
          console.log(`[${userId}] Message created (sent): ${message.body}`);
          
          // Extract phone number
          const phoneNumber = message.to.replace('@c.us', '').replace(/\D/g, '');
          
          // Emit real-time update
          emitToUser(userId, 'message_create', {
            messageId: message.id._serialized || message.id.id,
            phone: phoneNumber,
            body: message.body,
            timestamp: message.timestamp * 1000
          });
        }
      } catch (error) {
        console.error(`[${userId}] Error handling message_create:`, error);
      }
    });
    
    // Group events
    client.on('group_join', (notification) => {
      console.log(`[${userId}] Group join:`, notification);
      emitToUser(userId, 'group_join', {
        groupId: notification.id.remote,
        participants: notification.recipientIds
      });
    });
    
    client.on('group_leave', (notification) => {
      console.log(`[${userId}] Group leave:`, notification);
      emitToUser(userId, 'group_leave', {
        groupId: notification.id.remote,
        participants: notification.recipientIds
      });
    });
    
    // State change
    client.on('change_state', (state) => {
      console.log(`[${userId}] State changed:`, state);
      emitToUser(userId, 'state_changed', { state });
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

// Send message (text or media)
app.post('/api/send/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { phone, message, media, mediaType, filename, replyTo, forwardFrom } = req.body;
  
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
    
    // Validate phone number format (must be at least 10 digits)
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number. Must be at least 10 digits with country code.'
      });
    }
    
    // Check if we have chat info stored (for existing chats)
    let chatId = null;
    let formattedPhone = cleanPhone;
    
    if (userMessages.has(userId)) {
      const userData = userMessages.get(userId);
      const existingChat = userData.chats.get(cleanPhone);
      
      if (existingChat && existingChat.chatId) {
        // Use stored chat ID for existing chats (this ensures proper format)
        chatId = existingChat.chatId;
        console.log(`[${userId}] Using stored chat ID: ${chatId} for phone ${cleanPhone}`);
      } else if (existingChat && existingChat.chatIdUser) {
        // Use stored chat ID user part
        chatId = `${existingChat.chatIdUser}@c.us`;
        formattedPhone = existingChat.chatIdUser.replace(/\D/g, '');
        console.log(`[${userId}] Using stored chat ID user: ${chatId} for phone ${cleanPhone}`);
      }
    }
    
    // If no stored chat ID, construct from phone number
    if (!chatId) {
      formattedPhone = cleanPhone;
      chatId = `${formattedPhone}@c.us`;
      console.log(`[${userId}] Constructed chat ID from phone: ${chatId}`);
    }
    
    console.log(`[${userId}] Sending message to ${chatId} (phone: ${cleanPhone})`);
    
    // Check if number is registered on WhatsApp (for new contacts)
    // Note: This check is optional and may fail, but it helps catch invalid numbers early
    let isRegistered = true;
    try {
      isRegistered = await client.isRegisteredUser(chatId);
      console.log(`[${userId}] Number ${formattedPhone} is registered: ${isRegistered}`);
      
      if (!isRegistered) {
        return res.status(400).json({
          success: false,
          error: `The phone number ${formattedPhone} is not registered on WhatsApp. Please verify the number and try again. Make sure to include the country code (e.g., +1234567890).`
        });
      }
    } catch (checkError) {
      // If check fails, we'll proceed anyway - sometimes this check fails but sending still works
      // The actual send will fail with a better error if the number is invalid
      console.log(`[${userId}] Could not check if number is registered, will proceed:`, checkError.message);
    }
    
    let sentMessage;
    const { MessageMedia } = require('whatsapp-web.js');
    
    // Try to get or create chat first (this helps with new contacts)
    let chat;
    try {
      chat = await client.getChatById(chatId);
      console.log(`[${userId}] Found existing chat for ${formattedPhone}`);
    } catch (chatError) {
      // Chat doesn't exist, we'll create it by sending the message
      console.log(`[${userId}] Chat doesn't exist for ${formattedPhone}, will be created on send`);
    }
    
    // Handle media messages
    if (media && mediaType) {
      try {
        // Create MessageMedia object with filename if provided
        const messageMedia = new MessageMedia(mediaType, media, filename || null);
        sentMessage = await client.sendMessage(chatId, messageMedia, {
          caption: message || ''
        });
      } catch (mediaError) {
        console.error(`[${userId}] Error sending media:`, mediaError);
        throw new Error(`Failed to send media: ${mediaError.message}`);
      }
    } 
    // Handle reply to message
    else if (replyTo) {
      try {
        if (!chat) {
          chat = await client.getChatById(chatId);
        }
        const quotedMessage = await chat.fetchMessages({ limit: 100 });
        const messageToReply = quotedMessage.find(m => 
          m.id._serialized === replyTo || m.id.id === replyTo
        );
        
        if (messageToReply) {
          sentMessage = await messageToReply.reply(message);
        } else {
          // Fallback to regular message if reply message not found
          sentMessage = await client.sendMessage(chatId, message);
        }
      } catch (replyError) {
        console.error(`[${userId}] Error replying to message:`, replyError);
        // Fallback to regular message
        sentMessage = await client.sendMessage(chatId, message);
      }
    }
    // Handle forward message
    else if (forwardFrom) {
      try {
        const sourceChat = await client.getChatById(`${forwardFrom}@c.us`);
        const messages = await sourceChat.fetchMessages({ limit: 100 });
        const messageToForward = messages.find(m => 
          m.id._serialized === forwardFrom || m.id.id === forwardFrom
        );
        
        if (messageToForward) {
          sentMessage = await messageToForward.forward(chatId);
        } else {
          throw new Error('Message to forward not found');
        }
      } catch (forwardError) {
        console.error(`[${userId}] Error forwarding message:`, forwardError);
        throw new Error(`Failed to forward message: ${forwardError.message}`);
      }
    }
    // Regular text message - use sendMessage which handles new contacts
    else {
      try {
        // For new contacts, sendMessage should work
        // WhatsApp will automatically create the chat if the number is valid
        sentMessage = await client.sendMessage(chatId, message);
      } catch (sendError) {
        // Handle LID error specifically
        if (sendError.message && (sendError.message.includes('LID') || sendError.message.includes('No LID'))) {
          console.error(`[${userId}] LID error for ${formattedPhone}:`, sendError.message);
          
          // Provide helpful error message
          const errorMsg = `Cannot send message to ${formattedPhone}. ` +
            `This number may not be registered on WhatsApp, or you may need to add it to your contacts first. ` +
            `Please verify the number is in international format (e.g., +1234567890) and is registered on WhatsApp.`;
          
          return res.status(400).json({
            success: false,
            error: errorMsg,
            details: sendError.message
          });
        }
        
        // For other errors, throw normally
        throw sendError;
      }
    }
    
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
      body: message || (sentMessage.hasMedia ? '[Media]' : ''),
      timestamp: Date.now(),
      type: sentMessage.type,
      isGroup: chatId.includes('@g.us'),
      chatId: chatId,
      hasMedia: sentMessage.hasMedia || false,
      mediaUrl: null,
      isSent: true,
      status: 'pending', // Will be updated by message_ack event
      replyTo: replyTo || null
    };
    
    // Handle media if present
    if (sentMessage.hasMedia) {
      try {
        const media = await sentMessage.downloadMedia();
        if (media) {
          messageData.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
        }
      } catch (mediaError) {
        console.error(`[${userId}] Error downloading sent media:`, mediaError);
      }
    }
    
    userData.messages.push(messageData);
    
    // Get profile picture URL for the contact
    // Try to get from chat first (more reliable for existing chats)
    let profilePicUrl = null;
    try {
      // First try to get from the chat
      if (chat) {
        try {
          const chatContact = await chat.getContact();
          if (chatContact) {
            profilePicUrl = await Promise.race([
              chatContact.getProfilePicUrl(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile pic timeout')), 3000)
              )
            ]).catch(() => null);
            
            // Validate URL
            if (profilePicUrl && !profilePicUrl.startsWith('http') && !profilePicUrl.startsWith('data:')) {
              console.log(`[${userId}] ⚠️ Invalid profile pic URL format: ${profilePicUrl}`);
              profilePicUrl = null;
            }
          }
        } catch (chatError) {
          console.log(`[${userId}] Could not get contact from chat:`, chatError.message);
        }
      }
      
      // If that didn't work, try from sent message
      if (!profilePicUrl) {
        try {
          const contact = await sentMessage.getContact();
          if (contact) {
            profilePicUrl = await Promise.race([
              contact.getProfilePicUrl(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile pic timeout')), 3000)
              )
            ]).catch(() => null);
            
            // Validate URL
            if (profilePicUrl && !profilePicUrl.startsWith('http') && !profilePicUrl.startsWith('data:')) {
              profilePicUrl = null;
            }
          }
        } catch (msgError) {
          console.log(`[${userId}] Could not get contact from message:`, msgError.message);
        }
      }
      
      if (profilePicUrl) {
        console.log(`[${userId}] ✅ Profile pic URL for ${cleanPhone}: ${profilePicUrl.substring(0, 50)}...`);
      }
    } catch (picError) {
      console.log(`[${userId}] Could not get profile pic:`, picError.message);
      // Profile pic is optional
    }
    
    // Create or update chat info - this ensures the chat appears in the list
    // Always use cleanPhone as the key to ensure consistency
    const chatInfo = {
      phone: cleanPhone,
      chatId: chatId, // Store the chat ID we used
      chatIdUser: formattedPhone, // Store the user part
      name: contactName,
      lastMessage: message,
      lastMessageTime: messageData.timestamp,
      unreadCount: 0,
      profilePicUrl: profilePicUrl
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
    
    // Emit real-time message sent event
    emitToUser(userId, 'message_sent', {
      message: messageData,
      chat: chatInfo
    });
    
    res.json({
      success: true,
      message: `Message sent to ${phone} successfully`,
      phone_number: cleanPhone,
      chat: chatInfo,  // Return chat info so frontend can add it immediately
      messageData: messageData  // Return message data for immediate display
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

// Get chats/conversations for a user (with pagination)
app.get('/api/chats/:userId', async (req, res) => {
  const userId = req.params.userId;
  const limit = parseInt(req.query.limit) || 50; // Default 50 chats per page
  const offset = parseInt(req.query.offset) || 0; // Default offset 0
  
  try {
    // Return cached chats immediately if available
    if (userMessages.has(userId)) {
      const userData = userMessages.get(userId);
      const allChats = Array.from(userData.chats.values())
      .filter(chat => {
        // Proper phone number validation - match initial loading logic
        if (!chat.phone || chat.phone.length < 7 || chat.phone.length > 16) {
          return false;
        }
        // Filter out WhatsApp internal IDs
        if (chat.phone.length > 13 && /^\d+$/.test(chat.phone)) {
          return false;
        }
        // Additional check: phone numbers should start with country codes
        if (chat.phone.length > 12 && !chat.phone.match(/^[1-9][0-9]+$/)) {
          return false;
        }
        return true;
      })
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      
      // Apply pagination
      const paginatedChats = allChats.slice(offset, offset + limit);
      const hasMore = offset + limit < allChats.length;

      console.log(`[${userId}] Returning ${paginatedChats.length} chats (offset: ${offset}, limit: ${limit}, total: ${allChats.length}, hasMore: ${hasMore})`);

      // Return cached data immediately
      res.json({
        chats: paginatedChats,
        total: allChats.length,
        hasMore: hasMore,
        limit: limit,
        offset: offset
      });
      
      // Then refresh in background (non-blocking)
      if (clients.has(userId) && clients.get(userId).isReady) {
        refreshChatsInBackground(userId).catch(err => {
          console.error(`[${userId}] Background chat refresh error:`, err.message);
        });
      }
      
      return;
    }
    
    // If no cached data, try to fetch (but with timeout)
    if (clients.has(userId) && clients.get(userId).isReady) {
      const clientData = clients.get(userId);
      const client = clientData.client;
      
      // Initialize user data
      if (!userMessages.has(userId)) {
        userMessages.set(userId, {
          messages: [],
          chats: new Map()
        });
      }
      const userData = userMessages.get(userId);
      
      try {
        // Fetch chats without restrictive timeout
        const whatsappChats = await client.getChats();
        
        // Process all chats but limit slow operations
        for (const chat of whatsappChats.slice(0, 200)) { // Process up to 200 chats
          if (chat.isGroup) continue;
          try {
            const phoneNumber = (chat.id.user || '').replace(/\D/g, '');
            
            // Filter out invalid chat IDs - proper phone number validation
            if (!phoneNumber || phoneNumber.length < 7 || phoneNumber.length > 16) {
              console.log(`[${userId}] Skipping chat with invalid phone number length in API: ${phoneNumber} (length: ${phoneNumber.length})`);
              continue;
            }
            // Filter out WhatsApp internal IDs
            if (phoneNumber.length > 13 && /^\d+$/.test(phoneNumber)) {
              console.log(`[${userId}] Skipping chat with suspicious long numeric ID in API: ${phoneNumber}`);
              continue;
            }
            // Additional check: phone numbers should start with country codes
            if (phoneNumber.length > 12 && !phoneNumber.match(/^[1-9][0-9]+$/)) {
              console.log(`[${userId}] Skipping chat with invalid format in API: ${phoneNumber}`);
              continue;
            }
            
            // Use cached name if available, otherwise use phone
            const existingChat = userData.chats.get(phoneNumber);
            let contactName = existingChat?.name || phoneNumber;
            
            // Get basic chat info first (fast)
            contactName = existingChat?.name || chat.name || phoneNumber;
            lastMessageTime = existingChat?.lastMessageTime || Date.now();
            lastMessage = existingChat ? { body: existingChat.lastMessage || '' } : null;
            profilePicUrl = existingChat?.profilePicUrl || null;
            
            // Update or create chat entry - store chat ID for proper message sending
            if (existingChat) {
              existingChat.name = contactName;
              existingChat.unreadCount = chat.unreadCount ?? existingChat.unreadCount ?? 0;
              if (lastMessage && (!existingChat.lastMessageTime || lastMessageTime > existingChat.lastMessageTime)) {
                existingChat.lastMessage = lastMessage.body || '[Media]';
                existingChat.lastMessageTime = lastMessageTime;
              }
              // Store chat ID if not already stored
              if (!existingChat.chatId) {
                existingChat.chatId = chat.id._serialized;
                existingChat.chatIdUser = chat.id.user || phoneNumber;
              }
              if (profilePicUrl) {
                existingChat.profilePicUrl = profilePicUrl;
              }
            } else {
              userData.chats.set(phoneNumber, {
                phone: phoneNumber,
                chatId: chat.id._serialized, // Store full chat ID
                chatIdUser: chat.id.user || phoneNumber, // Store user part
                name: contactName,
                lastMessage: lastMessage ? (lastMessage.body || '[Media]') : '',
                lastMessageTime: lastMessageTime,
                unreadCount: chat.unreadCount || 0,
                profilePicUrl: profilePicUrl
              });
            }
          } catch (e) {
            // Skip problematic chats
            continue;
          }
        }
        
        console.log(`[${userId}] Initial load: processed ${whatsappChats.length} total chats, loaded ${userData.chats.size} valid chats`);
      } catch (fetchError) {
        console.error(`[${userId}] Error fetching chats:`, fetchError.message);
        // Return empty array if fetch fails
        return res.json({ chats: [] });
      }
    }
    
    // Return chats
    if (!userMessages.has(userId)) {
      return res.json({ chats: [] });
    }
    
    const userData = userMessages.get(userId);
    const allChats = Array.from(userData.chats.values())
      .filter(chat => {
        // More lenient filtering
        if (!chat.phone || chat.phone.length < 7 || chat.phone.length > 20) {
          return false;
        }
        // Only filter out obviously invalid IDs
        if (chat.phone.length > 15 && /^\d+$/.test(chat.phone) && chat.phone.startsWith('1')) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    
    // Apply pagination
    const paginatedChats = allChats.slice(offset, offset + limit);
    const hasMore = offset + limit < allChats.length;
    
    res.json({
      chats: paginatedChats,
      total: allChats.length,
      hasMore: hasMore,
      limit: limit,
      offset: offset
    });
  } catch (error) {
    console.error(`Error getting chats for user ${userId}:`, error);
    res.status(500).json({
      error: error.message || 'Failed to get chats'
    });
  }
});

// Background function to refresh chats (non-blocking)
async function refreshChatsInBackground(userId) {
  if (!clients.has(userId) || !clients.get(userId).isReady) {
    return;
  }

  const clientData = clients.get(userId);
  const client = clientData.client;
  const userData = userMessages.get(userId);

  try {
    const whatsappChats = await client.getChats();
    let processedCount = 0;

    // Process chats and add new ones, update existing ones
    for (const chat of whatsappChats.slice(0, 100)) { // Process up to 100 chats
      if (chat.isGroup) continue;

      try {
        const phoneNumber = (chat.id.user || '').replace(/\D/g, '');

        // More lenient validation for background refresh
        if (!phoneNumber || phoneNumber.length < 7 || phoneNumber.length > 20) {
          continue;
        }

        const existingChat = userData.chats.get(phoneNumber);

        if (!existingChat) {
          // Add new chat
          try {
            // Quick contact name fetch
            let contactName = phoneNumber;
            try {
              const contact = await Promise.race([
                chat.getContact(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
              ]);
              contactName = contact.pushname || contact.name || contact.number || phoneNumber;
            } catch (contactError) {
              contactName = chat.name || phoneNumber;
            }

            // Get last message quickly
            let lastMessage = null;
            let lastMessageTime = Date.now();
            try {
              const messages = await Promise.race([
                chat.fetchMessages({ limit: 1 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
              ]);
              lastMessage = messages.length > 0 ? messages[0] : null;
              if (lastMessage) {
                lastMessageTime = lastMessage.timestamp * 1000;
              }
            } catch (msgError) {
              // Use existing data
            }

            userData.chats.set(phoneNumber, {
              phone: phoneNumber,
              chatId: chat.id._serialized,
              chatIdUser: chat.id.user || phoneNumber,
              name: contactName,
              lastMessage: lastMessage ? (lastMessage.body || '[Media]') : '',
              lastMessageTime: lastMessageTime,
              unreadCount: chat.unreadCount || 0,
              profilePicUrl: null // Will be loaded on demand
            });

            processedCount++;
          } catch (e) {
            continue;
          }
        } else {
          // Update existing chat
          existingChat.unreadCount = chat.unreadCount ?? existingChat.unreadCount ?? 0;
        }
      } catch (e) {
        continue;
      }
    }

    console.log(`[${userId}] Background chat refresh completed, added ${processedCount} new chats`);
  } catch (error) {
    console.error(`[${userId}] Background chat refresh error:`, error.message);
  }
}

// Get messages for a specific chat (with pagination)
app.get('/api/messages/:userId/:phone', async (req, res) => {
  const userId = req.params.userId;
  const phone = req.params.phone.replace(/\D/g, ''); // Clean phone number
  const limit = parseInt(req.query.limit) || 50; // Default to 50 messages per page
  const offset = parseInt(req.query.offset) || 0; // Offset for pagination
  const beforeTimestamp = req.query.before ? parseInt(req.query.before) : null; // Load messages before this timestamp
  
  try {
      // Return cached messages immediately if available
      if (userMessages.has(userId)) {
        const userData = userMessages.get(userId);
        let filteredMessages = userData.messages
          .filter(msg => msg.chatId === `${phone}@c.us` || msg.from === phone || msg.to === phone);
        
        // If beforeTimestamp is provided, filter messages before that timestamp (for loading older messages)
        if (beforeTimestamp) {
          filteredMessages = filteredMessages.filter(msg => msg.timestamp < beforeTimestamp);
        }
        
        // Sort by timestamp (oldest first for pagination)
        filteredMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Apply pagination (for loading older messages, we take from the end)
        const totalMessages = filteredMessages.length;
        let paginatedMessages;
        if (beforeTimestamp) {
          // Loading older messages: take last N messages
          paginatedMessages = filteredMessages.slice(-limit);
        } else {
          // Loading recent messages: take last N messages
          paginatedMessages = filteredMessages.slice(-limit);
        }
        
        const hasMore = beforeTimestamp ? filteredMessages.length > limit : totalMessages > limit;
        const oldestTimestamp = paginatedMessages.length > 0 ? paginatedMessages[0].timestamp : null;
        
        // Return cached data immediately
        res.json({
          messages: paginatedMessages,
          total: totalMessages,
          hasMore: hasMore,
          limit: limit,
          oldestTimestamp: oldestTimestamp
        });
      
      // Then refresh in background (non-blocking)
      if (clients.has(userId) && clients.get(userId).isReady) {
        refreshMessagesInBackground(userId, phone, limit).catch(err => {
          console.error(`[${userId}] Background message refresh error:`, err.message);
        });
      }
      
      return;
    }
    
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.json({
        messages: []
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    const chatId = `${phone}@c.us`;
    
    // Try to fetch from WhatsApp directly with timeout
    try {
      const chat = await Promise.race([
        client.getChatById(chatId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Chat fetch timeout')), 5000)
        )
      ]);
      
      const whatsappMessages = await Promise.race([
        chat.fetchMessages({ limit: Math.min(limit, 100) }), // Limit to 100 for speed
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Message fetch timeout')), 10000)
        )
      ]);
      
      // Convert WhatsApp messages to our format (skip media download for speed)
      const formattedMessages = [];
      for (const msg of whatsappMessages) {
        // Get contact name quickly (with timeout)
        let contactName = phone;
        try {
          const contact = await Promise.race([
            msg.getContact(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Contact timeout')), 1000)
            )
          ]);
          contactName = contact.pushname || contact.name || phone;
        } catch (contactError) {
          // Use fallback
          contactName = msg.notifyName || msg._data?.notifyName || chat.name || phone;
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
          mediaUrl: null, // Media will be loaded on demand
          isSent: msg.fromMe || false
        };
        
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
      let filteredMessages = userData.messages
        .filter(msg => msg.chatId === chatId || msg.from === phone || msg.to === phone);
      
      // If beforeTimestamp is provided, filter messages before that timestamp
      if (beforeTimestamp) {
        filteredMessages = filteredMessages.filter(msg => msg.timestamp < beforeTimestamp);
      }
      
      filteredMessages.sort((a, b) => a.timestamp - b.timestamp);
      const paginatedMessages = filteredMessages.slice(-limit);
      const hasMore = filteredMessages.length > limit;
      const oldestTimestamp = paginatedMessages.length > 0 ? paginatedMessages[0].timestamp : null;
      
      // Mark messages as read (reset unread count)
      if (userData.chats.has(phone)) {
        userData.chats.get(phone).unreadCount = 0;
      }
      
      return res.json({
        messages: paginatedMessages,
        total: filteredMessages.length,
        hasMore: hasMore,
        limit: limit,
        oldestTimestamp: oldestTimestamp
      });
    }
  } catch (error) {
    console.error(`Error getting messages for user ${userId}, phone ${phone}:`, error);
    
    // Return cached messages if available, even on error
    if (userMessages.has(userId)) {
      const userData = userMessages.get(userId);
      const cachedMessages = userData.messages
        .filter(msg => msg.chatId === `${phone}@c.us` || msg.from === phone)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-limit);
      
      return res.json({
        messages: cachedMessages
      });
    }
    
    res.status(500).json({
      error: error.message || 'Failed to get messages'
    });
  }
});

// Background function to refresh messages (non-blocking)
async function refreshMessagesInBackground(userId, phone, limit) {
  if (!clients.has(userId) || !clients.get(userId).isReady) {
    return;
  }
  
  const clientData = clients.get(userId);
  const client = clientData.client;
  const chatId = `${phone}@c.us`;
  const userData = userMessages.get(userId);
  
  try {
    const chat = await client.getChatById(chatId);
    const whatsappMessages = await chat.fetchMessages({ limit: Math.min(limit, 100) });
    
    // Update messages in background
    for (const msg of whatsappMessages) {
      const exists = userData.messages.find(m => m.id === (msg.id._serialized || msg.id.id));
      if (!exists) {
        let contactName = phone;
        try {
          const contact = await msg.getContact();
          contactName = contact.pushname || contact.name || phone;
        } catch (e) {
          contactName = msg.notifyName || msg._data?.notifyName || phone;
        }
        
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
        
        userData.messages.push(msgData);
      }
    }
    
    // Mark as read
    await chat.sendSeen();
    if (userData.chats.has(phone)) {
      userData.chats.get(phone).unreadCount = 0;
    }
    
    console.log(`[${userId}] Background message refresh completed for ${phone}`);
  } catch (error) {
    console.error(`[${userId}] Background message refresh error:`, error.message);
  }
}

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

// ============================================
// GROUP MANAGEMENT ENDPOINTS
// ============================================

// Get group info
app.get('/api/group/:userId/:groupId', async (req, res) => {
  const userId = req.params.userId;
  const groupId = req.params.groupId;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        error: 'WhatsApp session not ready'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const chat = await client.getChatById(groupId);
    
    if (!chat.isGroup) {
      return res.status(400).json({
        error: 'Chat is not a group'
      });
    }
    
    const participants = await chat.participants;
    const groupInfo = {
      id: chat.id._serialized,
      name: chat.name,
      description: chat.description || '',
      participants: participants.map(p => ({
        id: p.id._serialized,
        name: p.name || p.pushname || p.number || 'Unknown',
        isAdmin: chat.groupMetadata?.participants?.find(pp => pp.id._serialized === p.id._serialized)?.isAdmin || false
      })),
      createdAt: chat.groupMetadata?.creation || null,
      creator: chat.groupMetadata?.owner || null
    };
    
    res.json(groupInfo);
  } catch (error) {
    console.error(`Error getting group info for user ${userId}:`, error);
    res.status(500).json({
      error: error.message || 'Failed to get group info'
    });
  }
});

// Create group
app.post('/api/group/create/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { name, participants } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!name || !participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Group name and at least one participant are required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    // Format participant IDs (add @c.us if not present)
    const formattedParticipants = participants.map(p => {
      const clean = p.replace(/\D/g, '');
      return clean.includes('@') ? p : `${clean}@c.us`;
    });
    
    const group = await client.createGroup(name, formattedParticipants);
    
    // Handle different return structures from createGroup
    const groupId = group.gid?._serialized || group.id?._serialized || group.id || null;
    const groupName = group.name || name;
    
    res.json({
      success: true,
      groupId: groupId,
      groupName: groupName,
      message: 'Group created successfully'
    });
  } catch (error) {
    console.error(`Error creating group for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create group'
    });
  }
});

// Invite user to group
app.post('/api/group/invite/:userId/:groupId', async (req, res) => {
  const userId = req.params.userId;
  const groupId = req.params.groupId;
  const { participant } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!participant) {
      return res.status(400).json({
        success: false,
        error: 'Participant phone number is required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const chat = await client.getChatById(groupId);
    
    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        error: 'Chat is not a group'
      });
    }
    
    // Format participant ID
    const clean = participant.replace(/\D/g, '');
    const participantId = clean.includes('@') ? participant : `${clean}@c.us`;
    
    await chat.addParticipants([participantId]);
    
    res.json({
      success: true,
      message: 'User invited to group successfully'
    });
  } catch (error) {
    console.error(`Error inviting user to group for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to invite user to group'
    });
  }
});

// Make user admin
app.post('/api/group/make-admin/:userId/:groupId', async (req, res) => {
  const userId = req.params.userId;
  const groupId = req.params.groupId;
  const { participant } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!participant) {
      return res.status(400).json({
        success: false,
        error: 'Participant phone number is required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const chat = await client.getChatById(groupId);
    
    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        error: 'Chat is not a group'
      });
    }
    
    // Format participant ID
    const clean = participant.replace(/\D/g, '');
    const participantId = clean.includes('@') ? participant : `${clean}@c.us`;
    
    await chat.promoteParticipants([participantId]);
    
    res.json({
      success: true,
      message: 'User promoted to admin successfully'
    });
  } catch (error) {
    console.error(`Error making user admin for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to make user admin'
    });
  }
});

// Demote admin
app.post('/api/group/demote-admin/:userId/:groupId', async (req, res) => {
  const userId = req.params.userId;
  const groupId = req.params.groupId;
  const { participant } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!participant) {
      return res.status(400).json({
        success: false,
        error: 'Participant phone number is required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const chat = await client.getChatById(groupId);
    
    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        error: 'Chat is not a group'
      });
    }
    
    // Format participant ID
    const clean = participant.replace(/\D/g, '');
    const participantId = clean.includes('@') ? participant : `${clean}@c.us`;
    
    await chat.demoteParticipants([participantId]);
    
    res.json({
      success: true,
      message: 'Admin demoted successfully'
    });
  } catch (error) {
    console.error(`Error demoting admin for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to demote admin'
    });
  }
});

// Leave group
app.post('/api/group/leave/:userId/:groupId', async (req, res) => {
  const userId = req.params.userId;
  const groupId = req.params.groupId;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const chat = await client.getChatById(groupId);
    
    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        error: 'Chat is not a group'
      });
    }
    
    await chat.leave();
    
    res.json({
      success: true,
      message: 'Left group successfully'
    });
  } catch (error) {
    console.error(`Error leaving group for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to leave group'
    });
  }
});

// Get all groups
app.get('/api/groups/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(200).json({
        groups: [],
        total: 0,
        error: 'WhatsApp session not ready'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    console.log(`[${userId}] Fetching groups...`);
    const chats = await client.getChats();
    console.log(`[${userId}] Total chats: ${chats.length}`);
    const groups = chats.filter(chat => chat.isGroup);
    console.log(`[${userId}] Total groups: ${groups.length}`);
    
    const groupsList = await Promise.all(groups.map(async (chat) => {
      try {
        const participants = await chat.participants;
        return {
          id: chat.id._serialized,
          name: chat.name,
          description: chat.description || '',
          participantCount: participants.length,
          createdAt: chat.groupMetadata?.creation || null
        };
      } catch (e) {
        return {
          id: chat.id._serialized,
          name: chat.name,
          description: chat.description || '',
          participantCount: 0,
          createdAt: null
        };
      }
    }));
    
    console.log(`[${userId}] Returning ${groupsList.length} groups`);
    res.json({
      groups: groupsList,
      total: groupsList.length
    });
  } catch (error) {
    console.error(`Error getting groups for user ${userId}:`, error);
    res.status(500).json({
      groups: [],
      total: 0,
      error: error.message || 'Failed to get groups'
    });
  }
});

// Update group subject
app.post('/api/group/update-subject/:userId/:groupId', async (req, res) => {
  const userId = req.params.userId;
  const groupId = req.params.groupId;
  const { subject } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!subject) {
      return res.status(400).json({
        success: false,
        error: 'Group subject is required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const chat = await client.getChatById(groupId);
    
    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        error: 'Chat is not a group'
      });
    }
    
    await chat.setSubject(subject);
    
    res.json({
      success: true,
      message: 'Group subject updated successfully'
    });
  } catch (error) {
    console.error(`Error updating group subject for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update group subject'
    });
  }
});

// Update group description
app.post('/api/group/update-description/:userId/:groupId', async (req, res) => {
  const userId = req.params.userId;
  const groupId = req.params.groupId;
  const { description } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const chat = await client.getChatById(groupId);
    
    if (!chat.isGroup) {
      return res.status(400).json({
        success: false,
        error: 'Chat is not a group'
      });
    }
    
    await chat.setDescription(description || '');
    
    res.json({
      success: true,
      message: 'Group description updated successfully'
    });
  } catch (error) {
    console.error(`Error updating group description for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update group description'
    });
  }
});

// Get group invite code
app.get('/api/group/invite-code/:userId/:groupId', async (req, res) => {
  const userId = req.params.userId;
  const groupId = req.params.groupId;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        error: 'WhatsApp session not ready'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const chat = await client.getChatById(groupId);
    
    if (!chat.isGroup) {
      return res.status(400).json({
        error: 'Chat is not a group'
      });
    }
    
    const code = await chat.getInviteInfo();
    
    res.json({
      inviteCode: code.code || null,
      inviteLink: code.link || null
    });
  } catch (error) {
    console.error(`Error getting group invite code for user ${userId}:`, error);
    res.status(500).json({
      error: error.message || 'Failed to get group invite code'
    });
  }
});

// ============================================
// STATUS & PROFILE ENDPOINTS
// ============================================

// Set status
app.post('/api/status/set/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { status } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status text is required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    await client.setStatus(status);
    
    res.json({
      success: true,
      message: 'Status updated successfully'
    });
  } catch (error) {
    console.error(`Error setting status for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set status'
    });
  }
});

// Get user status
app.get('/api/status/user/:userId/:phone', async (req, res) => {
  const userId = req.params.userId;
  const phone = req.params.phone.replace(/\D/g, '');
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        error: 'WhatsApp session not ready'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const contactId = `${phone}@c.us`;
    const contact = await client.getContactById(contactId);
    const status = await contact.getStatus();
    
    res.json({
      phone: phone,
      status: status.status || null,
      statusTimestamp: status.setAt || null
    });
  } catch (error) {
    console.error(`Error getting user status for user ${userId}:`, error);
    res.status(500).json({
      error: error.message || 'Failed to get user status'
    });
  }
});

// Update profile picture
app.post('/api/profile/picture/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { image, imageType } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Image data is required (base64)'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const { MessageMedia } = require('whatsapp-web.js');
    const media = new MessageMedia(imageType || 'image/jpeg', image);
    
    await client.setProfilePicture(media);
    
    res.json({
      success: true,
      message: 'Profile picture updated successfully'
    });
  } catch (error) {
    console.error(`Error updating profile picture for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profile picture'
    });
  }
});

// Download profile picture
app.get('/api/profile/picture/:userId/:phone', async (req, res) => {
  const userId = req.params.userId;
  const phone = req.params.phone.replace(/\D/g, '');
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        error: 'WhatsApp session not ready'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const contactId = `${phone}@c.us`;
    const contact = await client.getContactById(contactId);
    const profilePicUrl = await contact.getProfilePicUrl();
    
    if (!profilePicUrl) {
      return res.json({
        phone: phone,
        profilePicUrl: null,
        message: 'No profile picture available'
      });
    }
    
    res.json({
      phone: phone,
      profilePicUrl: profilePicUrl
    });
  } catch (error) {
    console.error(`Error getting profile picture for user ${userId}:`, error);
    res.status(500).json({
      error: error.message || 'Failed to get profile picture'
    });
  }
});

// ============================================
// CONTACT MANAGEMENT ENDPOINTS
// ============================================

// Check if user is on WhatsApp
app.get('/api/is-on-whatsapp/:userId/:phone', async (req, res) => {
  const userId = req.params.userId;
  const phone = req.params.phone.replace(/\D/g, '');
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(200).json({
        phone: phone,
        isRegistered: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const contactId = `${phone}@c.us`;
    console.log(`[${userId}] Checking if ${phone} (${contactId}) is registered on WhatsApp...`);
    
    let isRegistered = false;
    try {
      isRegistered = await client.isRegisteredUser(contactId);
      console.log(`[${userId}] Registration check result for ${phone}: ${isRegistered}`);
    } catch (checkError) {
      console.error(`[${userId}] Error checking registration:`, checkError.message);
      // If check fails, return false with error
      return res.json({
        phone: phone,
        isRegistered: false,
        error: checkError.message || 'Failed to check registration'
      });
    }
    
    res.json({
      phone: phone,
      isRegistered: isRegistered
    });
  } catch (error) {
    console.error(`Error checking if user is on WhatsApp for user ${userId}:`, error);
    res.status(200).json({
      phone: phone,
      isRegistered: false,
      error: error.message || 'Failed to check if user is on WhatsApp'
    });
  }
});

// ============================================
// BUTTON, LIST, CONTACT MESSAGE ENDPOINTS
// ============================================

// Send button message
app.post('/api/send-button/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { phone, message, buttons, footer, media, mediaType } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!phone || !message || !buttons || !Array.isArray(buttons) || buttons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Phone number, message, and at least one button are required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const clean = phone.replace(/\D/g, '');
    const chatId = `${clean}@c.us`;
    
    const { Buttons, MessageMedia } = require('whatsapp-web.js');
    
    // Validate button format - buttons should be array of {id, body}
    const validButtons = buttons.map(btn => {
      if (typeof btn === 'string') {
        // If button is just a string, convert to {id, body}
        return { id: btn.toLowerCase().replace(/\s+/g, '_'), body: btn };
      }
      return { id: btn.id || btn.body?.toLowerCase().replace(/\s+/g, '_'), body: btn.body || btn.id };
    }).filter(btn => btn.id && btn.body);
    
    if (validButtons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid button format. Buttons must have both id and body.'
      });
    }
    
    // Validate button text length (WhatsApp limit is 20 characters)
    const invalidButtons = validButtons.filter(btn => btn.body.length > 20);
    if (invalidButtons.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Button text too long. Maximum 20 characters. Invalid buttons: ${invalidButtons.map(b => b.body).join(', ')}`
      });
    }
    
    // Check for duplicate button texts
    const buttonTexts = validButtons.map(b => b.body);
    const duplicates = buttonTexts.filter((text, index) => buttonTexts.indexOf(text) !== index);
    if (duplicates.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Duplicate button texts not allowed: ${[...new Set(duplicates)].join(', ')}`
      });
    }
    
    let buttonMessage;
    
    try {
      if (media && mediaType) {
        // Button message with media
        const messageMedia = new MessageMedia(mediaType, media);
        buttonMessage = new Buttons(message, validButtons, null, footer || null, messageMedia);
      } else {
        // Button message without media
        buttonMessage = new Buttons(message, validButtons, null, footer || null);
      }
    } catch (buttonError) {
      console.error(`Error creating Buttons object:`, buttonError);
      return res.status(500).json({
        success: false,
        error: `Failed to create button message: ${buttonError.message}. Note: Buttons feature may be deprecated in this version of whatsapp-web.js.`
      });
    }
    
    try {
      const sentMessage = await client.sendMessage(chatId, buttonMessage);
      
      res.json({
        success: true,
        message: 'Button message sent successfully',
        messageId: sentMessage.id._serialized || sentMessage.id.id
      });
    } catch (sendError) {
      console.error(`Error sending button message for user ${userId}:`, sendError);
      // Check if it's a deprecation issue
      if (sendError.message && sendError.message.includes('deprecated')) {
        return res.status(500).json({
          success: false,
          error: 'Button messages are deprecated in this version of WhatsApp. Please use List messages or regular text messages instead.'
        });
      }
      throw sendError;
    }
  } catch (error) {
    console.error(`Error sending button message for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send button message'
    });
  }
});

// Send list message
app.post('/api/send-list/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { phone, title, description, buttonText, sections, footer } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!phone || !title || !buttonText || !sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Phone number, title, button text, and at least one section are required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const clean = phone.replace(/\D/g, '');
    const chatId = `${clean}@c.us`;
    
    const { List } = require('whatsapp-web.js');
    
    const listMessage = new List(title, buttonText, sections, description || '', footer || '');
    
    const sentMessage = await client.sendMessage(chatId, listMessage);
    
    res.json({
      success: true,
      message: 'List message sent successfully',
      messageId: sentMessage.id._serialized || sentMessage.id.id
    });
  } catch (error) {
    console.error(`Error sending list message for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send list message'
    });
  }
});

// Send contact message
app.post('/api/send-contact/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { phone, contact } = req.body;
  
  try {
    if (!clients.has(userId) || !clients.get(userId).isReady) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp session not ready'
      });
    }
    
    if (!phone || !contact) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and contact data are required'
      });
    }
    
    if (!contact.name || !contact.number) {
      return res.status(400).json({
        success: false,
        error: 'Contact name and number are required'
      });
    }
    
    const clientData = clients.get(userId);
    const client = clientData.client;
    
    const clean = phone.replace(/\D/g, '');
    const chatId = `${clean}@c.us`;
    
    const { ContactCard } = require('whatsapp-web.js');
    
    const contactCard = new ContactCard(contact.name, contact.number);
    if (contact.displayName) contactCard.setDisplayName(contact.displayName);
    
    const sentMessage = await client.sendMessage(chatId, contactCard);
    
    res.json({
      success: true,
      message: 'Contact message sent successfully',
      messageId: sentMessage.id._serialized || sentMessage.id.id
    });
  } catch (error) {
    console.error(`Error sending contact message for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send contact message'
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
      .reduce((sum, data) => sum + data.messages.length, 0),
    socket_connections: userSockets.size
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WhatsApp Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Socket.IO enabled for real-time updates`);
});

