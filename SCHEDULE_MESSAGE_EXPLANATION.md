# Scheduled Message System - How It Works

## Overview
The scheduled message system allows you to send WhatsApp messages to multiple patients at a specific future date and time.

## Components

### 1. Frontend (`ScheduleMessagePanel.jsx`)
- **Step 1: Select Patients**
  - Search and select multiple patients (with phone numbers)
  - Can select all or individual patients with checkboxes
  - Maximum 50 patients per scheduled message (to avoid WhatsApp restrictions)

- **Step 2: Compose & Schedule**
  - Enter the message text
  - Select date and time using datetime picker
  - The datetime is sent in ISO format to the backend

### 2. Backend Endpoint (`/whatsapp/inbox/schedule-message`)
Located in `backend/routes/whatsapp_inbox.py`

**Request Schema:**
```python
{
  "patient_ids": [1, 2, 3],  # Array of patient IDs
  "message": "Your message text",
  "scheduled_at": "2024-01-15T14:30:00"  # ISO datetime string
}
```

**Process:**
1. Validates datetime format and ensures it's in the future
2. Verifies all patient IDs belong to the user's clinic
3. Ensures all selected patients have phone numbers
4. Creates a `ScheduledMessage` record in the database with status `pending`
5. Returns success response with scheduled message ID

**Database Model (`ScheduledMessage`):**
- `id`: Unique identifier
- `clinic_id`: Which clinic scheduled it
- `user_id`: Which user scheduled it
- `message`: The message text
- `scheduled_at`: When to send it (UTC datetime)
- `status`: `pending`, `processing`, `sent`, `failed`, `partial`, `cancelled`
- `patient_ids`: JSON array of patient IDs
- `recipient_count`: Total number of recipients
- `sent_count`: How many successfully sent
- `failed_count`: How many failed
- `created_at`: When it was scheduled
- `sent_at`: When it was actually sent

### 3. Scheduler Service (`scheduler_whatsapp.py`)
This is a background Python script that runs continuously (or via cron) to process scheduled messages.

**How it works:**
1. **Checks every minute** for messages where:
   - `status = 'pending'`
   - `scheduled_at <= now` (the scheduled time has passed)

2. **For each due message:**
   - Updates status to `processing`
   - Fetches patient phone numbers from database
   - Sends messages one by one via the Node.js WhatsApp service
   - **Rate limiting**: 12 seconds delay between each message (to avoid WhatsApp account blocking)

3. **After sending:**
   - Updates status to `sent` (if all succeeded) or `partial` (if some failed)
   - Records `sent_count` and `failed_count`
   - Sets `sent_at` timestamp

**Running the Scheduler:**
```bash
# Run once (for cron):
python backend/scheduler_whatsapp.py

# Run continuously (for systemd service):
python backend/scheduler_whatsapp.py --loop
```

### 4. Viewing Scheduled Messages
The `ScheduledMessagesListPanel` component displays all scheduled messages for the clinic, showing:
- Message text
- Scheduled date/time
- Status (pending, sent, partial, failed)
- Number of recipients
- Success/failure counts

## Flow Diagram

```
User Action (Frontend)
    ↓
Select Patients → Compose Message → Set Date/Time → Click "Schedule"
    ↓
POST /whatsapp/inbox/schedule-message
    ↓
Backend Validation & Database Save
    ↓
ScheduledMessage record created (status: 'pending')
    ↓
[Time passes...]
    ↓
Scheduler Service (runs every minute)
    ↓
Finds messages where scheduled_at <= now AND status = 'pending'
    ↓
For each message:
    - Update status to 'processing'
    - Fetch patient phone numbers
    - Send messages via WhatsApp service (12 sec delay between each)
    - Update status to 'sent' or 'partial'
    - Record sent_count and failed_count
```

## Rate Limiting Strategy
- **12 seconds delay** between messages prevents WhatsApp from flagging the account as spam
- For 50 messages, this takes approximately 10 minutes total
- This is a conservative approach to avoid account blocking

## Error Handling
- If a message fails to send, it's counted in `failed_count`
- Status is set to `partial` if some succeed and some fail
- Status is set to `failed` if there's an error processing the entire scheduled message
- Individual message failures don't stop the rest from being sent

## Future Enhancements
- Add ability to cancel scheduled messages
- Retry failed messages
- Allow scheduling recurring messages (daily, weekly, etc.)
- Add timezone support for scheduling



