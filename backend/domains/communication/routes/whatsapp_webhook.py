import datetime
import base64
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from domains.infrastructure.services.r2_storage import upload_bytes_to_r2, StorageCategory
from models import User, WhatsAppChat, WhatsAppMessage, Patient

router = APIRouter(tags=["WhatsApp Webhook"])

def process_media_url(media_data_url: str, message_id: str, clinic_id: int, patient_id: Optional[int] = None) -> str:
    """Helper to process base64 data URL and upload to R2"""
    if not media_data_url or not media_data_url.startswith("data:"):
        return media_data_url
        
    try:
        header, base64_data = media_data_url.split(",", 1)
        mime_type = header.split(";")[0].split(":")[1]
        extension = mime_type.split("/")[-1]
        if extension == "jpeg": extension = "jpg"
        
        file_bytes = base64.b64decode(base64_data)
        filename = f"{message_id}_{str(uuid.uuid4())[:8]}.{extension}"
        
        r2_url = upload_bytes_to_r2(
            data=file_bytes, 
            filename=filename, 
            content_type=mime_type,
            clinic_id=clinic_id,
            patient_id=patient_id,
            category=StorageCategory.WHATSAPP_MEDIA
        )
        return r2_url if r2_url else media_data_url
    except Exception as e:
        print(f"Error processing media for message {message_id}: {e}")
        return media_data_url

@router.post("")
async def whatsapp_webhook_handler(request: Request, db: Session = Depends(get_db)):
    """
    Handle incoming webhooks from the Node.js WhatsApp service.
    """
    try:
        data = await request.json()
        event_type = data.get("type")
        user_id = data.get("userId")
        clinic_id = data.get("clinicId")
        
        if not event_type or not user_id:
            return JSONResponse(status_code=400, content={"error": "Missing type or userId"})
            
        if not clinic_id:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                 return JSONResponse(status_code=404, content={"error": "User not found"})
            clinic_id = user.clinic_id
            
        if event_type == "ready_sync":
            # Initial sync of all chats and messages
            chats = data.get("chats", [])
            messages = data.get("messages", [])
            
            # Upsert chats
            for c in chats:
                chat_id_serialized = c.get("chatId")
                phone = c.get("phone")
                
                existing_chat = db.query(WhatsAppChat).filter(
                    WhatsAppChat.clinic_id == clinic_id,
                    WhatsAppChat.phone_number == phone
                ).first()
                
                if existing_chat:
                    existing_chat.chat_id_serialized = chat_id_serialized
                    existing_chat.contact_name = c.get("name")
                    existing_chat.unread_count = c.get("unreadCount", 0)
                    existing_chat.profile_pic_url = c.get("profilePicUrl")
                    existing_chat.last_message = c.get("lastMessage")
                    if c.get("lastMessageTime"):
                         existing_chat.last_message_time = datetime.datetime.fromtimestamp(c.get("lastMessageTime") / 1000.0)
                else:
                    new_chat = WhatsAppChat(
                        clinic_id=clinic_id,
                        user_id=user_id,
                        phone_number=phone,
                        chat_id_serialized=chat_id_serialized,
                        contact_name=c.get("name"),
                        unread_count=c.get("unreadCount", 0),
                        profile_pic_url=c.get("profilePicUrl"),
                        last_message=c.get("lastMessage")
                    )
                    if c.get("lastMessageTime"):
                         new_chat.last_message_time = datetime.datetime.fromtimestamp(c.get("lastMessageTime") / 1000.0)
                    db.add(new_chat)
                    
            db.commit()
            
            # Upsert messages
            for m in messages:
                chat = db.query(WhatsAppChat).filter(
                    WhatsAppChat.clinic_id == clinic_id,
                    WhatsAppChat.chat_id_serialized == m.get("chatId")
                ).first()
                
                if chat:
                    msg_id = m.get("id")
                    existing_msg = db.query(WhatsAppMessage).filter(WhatsAppMessage.id == msg_id).first()
                    if not existing_msg:
                         # Process media for history
                         media_url = m.get("mediaUrl")
                         if m.get("hasMedia") and media_url:
                             # Resolve patient_id
                             patient = db.query(Patient).filter(
                                 Patient.clinic_id == clinic_id,
                                 Patient.phone == chat.phone_number
                             ).first()
                             patient_id = patient.id if patient else None
                             media_url = process_media_url(media_url, msg_id, clinic_id, patient_id)
                             
                         new_msg = WhatsAppMessage(
                             id=msg_id,
                             chat_id=chat.id,
                             from_phone=m.get("from", ""),
                             from_name=m.get("fromName", ""),
                             body=m.get("body", ""),
                             timestamp=datetime.datetime.fromtimestamp(m.get("timestamp", 0) / 1000.0),
                             type=m.get("type", "chat"),
                             is_group=m.get("isGroup", False),
                             has_media=m.get("hasMedia", False),
                             media_url=media_url,
                             is_sent=m.get("isSent", False),
                             status=m.get("status", "sent" if m.get("isSent") else "received")
                         )
                         db.add(new_msg)
            db.commit()
            return {"success": True, "message": "Synced chats and messages"}
            
        elif event_type == "message":
            # Incoming message
            msg = data.get("message", {})
            chatData = data.get("chat", {})
            phone = chatData.get("phone")
            
            # Upsert chat
            chat = db.query(WhatsAppChat).filter(
                WhatsAppChat.clinic_id == clinic_id,
                WhatsAppChat.phone_number == phone
            ).first()
            
            if not chat:
                chat = WhatsAppChat(
                    clinic_id=clinic_id,
                    user_id=user_id,
                    phone_number=phone,
                    chat_id_serialized=chatData.get("chatId"),
                    contact_name=chatData.get("name"),
                    unread_count=chatData.get("unreadCount", 1),
                    profile_pic_url=chatData.get("profilePicUrl"),
                    last_message=chatData.get("lastMessage")
                )
                if chatData.get("lastMessageTime"):
                     chat.last_message_time = datetime.datetime.fromtimestamp(chatData.get("lastMessageTime") / 1000.0)
                db.add(chat)
                db.commit()
                db.refresh(chat)
            else:
                chat.last_message = chatData.get("lastMessage")
                if chatData.get("lastMessageTime"):
                    chat.last_message_time = datetime.datetime.fromtimestamp(chatData.get("lastMessageTime") / 1000.0)
                chat.unread_count = chatData.get("unreadCount", chat.unread_count + 1)
                db.commit()
                
            # Insert message
            msg_id = msg.get("id")
            existing_msg = db.query(WhatsAppMessage).filter(WhatsAppMessage.id == msg_id).first()
            if not existing_msg:
                 media_url = msg.get("mediaUrl")
                 if msg.get("hasMedia") and media_url:
                     # Resolve patient_id
                     patient = db.query(Patient).filter(
                         Patient.clinic_id == clinic_id,
                         Patient.phone == phone
                     ).first()
                     patient_id = patient.id if patient else None
                     media_url = process_media_url(media_url, msg_id, clinic_id, patient_id)
                     
                 new_msg = WhatsAppMessage(
                     id=msg_id,
                     chat_id=chat.id,
                     from_phone=msg.get("from", ""),
                     from_name=msg.get("fromName", ""),
                     body=msg.get("body", ""),
                     timestamp=datetime.datetime.fromtimestamp(msg.get("timestamp", 0) / 1000.0),
                     type=msg.get("type", "chat"),
                     is_group=msg.get("isGroup", False),
                     has_media=msg.get("hasMedia", False),
                     media_url=media_url,
                     is_sent=False,
                     status="received"
                 )
                 db.add(new_msg)
                 db.commit()
            
            return {"success": True}
            
        elif event_type == "message_create":
            # A message was sent from elsewhere (or from us)
            msg = data.get("message", {})
            phone = msg.get("phone")
            msg_id = msg.get("messageId")
            
            chat = db.query(WhatsAppChat).filter(
                WhatsAppChat.clinic_id == clinic_id,
                WhatsAppChat.phone_number == phone
            ).first()
            if chat:
                media_url = msg.get("mediaUrl")
                if msg.get("hasMedia") and media_url:
                    # Resolve patient_id
                    patient = db.query(Patient).filter(
                        Patient.clinic_id == clinic_id,
                        Patient.phone == phone
                    ).first()
                    patient_id = patient.id if patient else None
                    media_url = process_media_url(media_url, msg_id, clinic_id, patient_id)
                    
                new_msg = WhatsAppMessage(
                    id=msg_id,
                    chat_id=chat.id,
                    from_phone="Me",
                    from_name="Me",
                    body=msg.get("body", ""),
                    timestamp=datetime.datetime.fromtimestamp(msg.get("timestamp", 0) / 1000.0),
                    is_sent=True,
                    status="sent",
                    has_media=msg.get("hasMedia", False),
                    media_url=media_url
                )
                chat.last_message = msg.get("body", "")
                chat.last_message_time = new_msg.timestamp
                db.add(new_msg)
                db.commit()
            return {"success": True}
            
        elif event_type == "message_ack":
            # Message read receipt
            msg_id = data.get("messageId")
            status_val = data.get("status")
            
            msg = db.query(WhatsAppMessage).filter(WhatsAppMessage.id == msg_id).first()
            if msg:
                msg.status = status_val
                db.commit()
            return {"success": True}
            
        return {"success": True, "message": "unhandled event type ignoring"}

    except Exception as e:
        import traceback
        print(f"Webhook error: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
