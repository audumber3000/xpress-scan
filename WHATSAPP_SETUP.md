# WhatsApp Web Application Setup Guide

This guide will help you set up and run the complete WhatsApp Web application with real-time messaging capabilities.

## Architecture

The application consists of three main services:

1. **WhatsApp Service (Node.js)** - Port 3001
   - Handles WhatsApp Web automation using `whatsapp-web.js`
   - Provides REST API and Socket.IO for real-time updates
   - Manages WhatsApp client sessions per user

2. **Python Backend (FastAPI)** - Port 8000
   - Main application backend
   - Proxies requests to WhatsApp service
   - Handles authentication and business logic

3. **React Frontend** - Port 5173
   - User interface for WhatsApp messaging
   - Real-time updates via Socket.IO
   - WhatsApp-like UI/UX

## Prerequisites

- Node.js (v16 or higher)
- Python 3.8 or higher
- npm or yarn
- Git

## Quick Start

### Option 1: Using Startup Scripts (Recommended)

```bash
# Make scripts executable (if not already)
chmod +x start-services.sh stop-services.sh

# Start all services
./start-services.sh

# Stop all services
./stop-services.sh
```

### Option 2: Manual Start

#### 1. Start WhatsApp Service (Node.js)

```bash
cd whatsapp-service
npm install
npm start
```

The service will run on `http://localhost:3001`

#### 2. Start Python Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will run on `http://localhost:8000`

#### 3. Start React Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

## Features

### ✅ Implemented Features

1. **Authentication & Connection**
   - QR code generation for WhatsApp Web login
   - Persistent session with LocalAuth
   - Connection status tracking
   - Auto-reconnect handling

2. **Chat Management**
   - Fetch all chats/conversations
   - Chat metadata (name, unread count, last message, timestamp)
   - Group chat detection
   - Real-time chat list updates

3. **Messaging**
   - Send text messages
   - Send media (images, audio, video, documents)
   - Reply to messages
   - Forward messages
   - Message history with pagination
   - Real-time message delivery

4. **Message Status**
   - Sent (✓)
   - Delivered (✓✓)
   - Read (✓✓ blue)
   - Real-time status updates via Socket.IO

5. **Real-Time Updates**
   - Socket.IO integration
   - Live message delivery
   - Message status updates
   - Connection status changes
   - Group events

6. **Groups (Basic)**
   - Group chat detection
   - Fetch group participants
   - Group metadata

## API Endpoints

### WhatsApp Service (Node.js) - Port 3001

- `POST /api/initialize/:userId` - Initialize WhatsApp session
- `GET /api/status/:userId` - Get connection status
- `POST /api/disconnect/:userId` - Disconnect session
- `POST /api/send/:userId` - Send message (text or media)
- `GET /api/chats/:userId` - Get all chats
- `GET /api/messages/:userId/:phone` - Get messages for a chat
- `GET /api/group/:userId/:groupId` - Get group info
- `GET /health` - Health check

### Socket.IO Events

**Client → Server:**
- `join` - Join user room

**Server → Client:**
- `message` - New incoming message
- `message_ack` - Message status update
- `message_create` - Message sent confirmation
- `message_sent` - Message sent event
- `ready` - WhatsApp client ready
- `qr` - QR code generated
- `authenticated` - Authentication successful
- `auth_failure` - Authentication failed
- `disconnected` - Connection lost
- `group_join` - User joined group
- `group_leave` - User left group
- `state_changed` - Connection state changed

## Environment Variables

### WhatsApp Service

Create `whatsapp-service/.env`:

```env
PORT=3001
```

### Python Backend

Create `backend/.env`:

```env
WHATSAPP_SERVICE_URL=http://localhost:3001
# ... other backend env vars
```

### React Frontend

Create `frontend/.env`:

```env
VITE_WHATSAPP_SERVICE_URL=http://localhost:3001
VITE_API_URL=http://localhost:8000
# ... other frontend env vars
```

## Usage

1. **Login to WhatsApp**
   - Navigate to the Inbox page
   - Click "Connect WhatsApp"
   - Scan QR code with your phone
   - Wait for connection confirmation

2. **View Chats**
   - All your WhatsApp chats will appear in the left sidebar
   - Click on a chat to view messages

3. **Send Messages**
   - Select a chat
   - Type message in input box
   - Press Enter or click Send
   - Message status will update in real-time

4. **Send Media**
   - Click attachment icon
   - Select file (image, audio, video, document)
   - Add optional caption
   - Send

5. **Reply to Messages**
   - Long-press or right-click a message
   - Select "Reply"
   - Type your reply
   - Send

6. **Forward Messages**
   - Long-press or right-click a message
   - Select "Forward"
   - Choose destination chat
   - Send

## Troubleshooting

### WhatsApp Service Not Starting

- Check if port 3001 is available
- Ensure Node.js dependencies are installed: `cd whatsapp-service && npm install`
- Check logs: `logs/whatsapp-service.log`

### Connection Issues

- Verify WhatsApp service is running: `curl http://localhost:3001/health`
- Check browser console for Socket.IO connection errors
- Ensure CORS is properly configured

### QR Code Not Appearing

- Wait 30-60 seconds for initialization
- Check WhatsApp service logs
- Try disconnecting and reconnecting

### Messages Not Sending

- Verify WhatsApp is connected (status should be "ready")
- Check phone number format (should be digits only)
- Review backend logs for errors

## Development

### Adding New Features

1. **Backend (WhatsApp Service)**
   - Add new endpoints in `whatsapp-service/server.js`
   - Emit Socket.IO events for real-time updates
   - Update event handlers as needed

2. **Frontend**
   - Use `whatsappSocket.js` utility for Socket.IO
   - Update UI components in `frontend/src/pages/Inbox.jsx`
   - Add new message types as needed

### Testing

- Test QR code generation
- Test message sending/receiving
- Test real-time updates
- Test media messages
- Test message status updates

## Security Notes

- WhatsApp sessions are stored locally per user
- Never commit `.wwebjs_auth` directories
- Use HTTPS in production
- Implement proper authentication
- Rate limit API endpoints

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review WhatsApp service health: `http://localhost:3001/health`
- Check browser console for frontend errors
- Review backend API docs: `http://localhost:8000/docs`

## License

[Your License Here]










