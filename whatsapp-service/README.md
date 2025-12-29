# WhatsApp Service

Separate Node.js service for WhatsApp automation using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

The service will run on port 3001 by default (or PORT environment variable).

## API Endpoints

### Initialize WhatsApp Session
```
POST /api/initialize/:userId
```

### Get Status
```
GET /api/status/:userId
```

### Send Message
```
POST /api/send/:userId
Body: { "phone": "919876543210", "message": "Hello" }
```

### Disconnect
```
POST /api/disconnect/:userId
```

### Health Check
```
GET /health
```

## Environment Variables

- `PORT` - Server port (default: 3001)

