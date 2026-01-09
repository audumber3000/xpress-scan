/**
 * Socket.IO client for WhatsApp real-time updates
 */
import { io } from 'socket.io-client';

const WHATSAPP_SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3001';

class WhatsAppSocket {
  constructor(userId) {
    this.userId = userId;
    this.socket = null;
    this.listeners = new Map();
    this.connected = false;
  }

  connect() {
    if (this.socket && this.connected) {
      console.log('Socket already connected');
      return;
    }

    console.log(`Connecting to WhatsApp Socket.IO at ${WHATSAPP_SERVICE_URL}`);
    
    this.socket = io(WHATSAPP_SERVICE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connected');
      this.connected = true;
      // Join user room
      this.socket.emit('join', this.userId);
      this.emit('connected', { userId: this.userId });
    });

    this.socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      this.connected = false;
      this.emit('disconnected', { userId: this.userId });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.emit('error', { error: error.message });
    });

    // Register all event listeners
    this.registerEventListeners();
  }

  registerEventListeners() {
    // Message events
    this.socket.on('message', (data) => {
      this.emit('message', data);
    });

    this.socket.on('message_ack', (data) => {
      this.emit('message_ack', data);
    });

    this.socket.on('message_create', (data) => {
      this.emit('message_create', data);
    });

    this.socket.on('message_sent', (data) => {
      this.emit('message_sent', data);
    });

    // Connection events
    this.socket.on('ready', (data) => {
      this.emit('ready', data);
    });

    this.socket.on('qr', (data) => {
      this.emit('qr', data);
    });

    this.socket.on('authenticated', (data) => {
      this.emit('authenticated', data);
    });

    this.socket.on('auth_failure', (data) => {
      this.emit('auth_failure', data);
    });

    this.socket.on('disconnected', (data) => {
      this.emit('disconnected', data);
    });

    // Group events
    this.socket.on('group_join', (data) => {
      this.emit('group_join', data);
    });

    this.socket.on('group_leave', (data) => {
      this.emit('group_leave', data);
    });

    // State events
    this.socket.on('state_changed', (data) => {
      this.emit('state_changed', data);
    });
  }

  // Subscribe to events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Unsubscribe from events
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Emit to local listeners
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
    }
  }

  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }
}

// Singleton instance per user
let socketInstance = null;

export function getWhatsAppSocket(userId) {
  if (!socketInstance || socketInstance.userId !== userId) {
    if (socketInstance) {
      socketInstance.disconnect();
    }
    socketInstance = new WhatsAppSocket(userId);
  }
  return socketInstance;
}

export default WhatsAppSocket;










