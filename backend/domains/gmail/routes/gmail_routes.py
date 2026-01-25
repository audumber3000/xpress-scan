from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from core.auth_utils import get_current_user
from models import User
from pydantic import BaseModel
import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import base64
from email.mime.text import MIMEText
import json

router = APIRouter()

# Google OAuth2 configuration
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'
]

# Store user credentials temporarily (in production, use database)
user_credentials = {}


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str


@router.get("/status")
async def check_gmail_status(
    current_user: User = Depends(get_current_user)
):
    """Check if user has connected their Gmail account"""
    user_id = str(current_user.id)
    is_connected = user_id in user_credentials and user_credentials[user_id] is not None
    
    return {
        "connected": is_connected,
        "email": user_credentials.get(user_id, {}).get("email") if is_connected else None
    }


@router.get("/auth-url")
async def get_gmail_auth_url(
    current_user: User = Depends(get_current_user)
):
    """Generate Gmail OAuth URL for user to authenticate"""
    try:
        # Get Gmail OAuth credentials from environment (separate from Firebase/Auth)
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
        client_config = {
            "web": {
                "client_id": os.getenv("GMAIL_CLIENT_ID"),
                "client_secret": os.getenv("GMAIL_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [f"{backend_url}/api/v1/gmail/oauth-callback"]
            }
        }
        
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=client_config["web"]["redirect_uris"][0]
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=str(current_user.id)
        )
        
        return {"auth_url": authorization_url}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate auth URL: {str(e)}"
        )


@router.get("/oauth-callback")
async def gmail_oauth_callback(
    code: str,
    state: str
):
    """Handle OAuth callback from Google and redirect to frontend"""
    try:
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        
        client_config = {
            "web": {
                "client_id": os.getenv("GMAIL_CLIENT_ID"),
                "client_secret": os.getenv("GMAIL_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [f"{backend_url}/api/v1/gmail/oauth-callback"]
            }
        }
        
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=client_config["web"]["redirect_uris"][0]
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Store credentials for this user
        user_id = state
        user_credentials[user_id] = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes
        }
        
        # Redirect to frontend mail page
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{frontend_url}/mail?connected=true")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth callback failed: {str(e)}"
        )


@router.get("/messages")
async def get_gmail_messages(
    folder: str = "inbox",
    max_results: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Fetch emails from Gmail"""
    try:
        user_id = str(current_user.id)
        
        if user_id not in user_credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Gmail not connected. Please authenticate first."
            )
        
        creds_dict = user_credentials[user_id]
        creds = Credentials(
            token=creds_dict["token"],
            refresh_token=creds_dict.get("refresh_token"),
            token_uri=creds_dict["token_uri"],
            client_id=creds_dict["client_id"],
            client_secret=creds_dict["client_secret"],
            scopes=creds_dict["scopes"]
        )
        
        service = build('gmail', 'v1', credentials=creds)
        
        # Map folder names to Gmail labels
        label_map = {
            "inbox": "INBOX",
            "sent": "SENT",
            "starred": "STARRED",
            "trash": "TRASH"
        }
        
        label_id = label_map.get(folder, "INBOX")
        
        # Fetch message list
        results = service.users().messages().list(
            userId='me',
            labelIds=[label_id],
            maxResults=max_results
        ).execute()
        
        messages = results.get('messages', [])
        
        # Fetch details for each message
        email_list = []
        for msg in messages[:max_results]:
            msg_data = service.users().messages().get(
                userId='me',
                id=msg['id'],
                format='metadata',
                metadataHeaders=['From', 'Subject', 'Date']
            ).execute()
            
            headers = {h['name']: h['value'] for h in msg_data.get('payload', {}).get('headers', [])}
            
            email_list.append({
                "id": msg['id'],
                "from": headers.get('From', 'Unknown'),
                "subject": headers.get('Subject', '(No Subject)'),
                "date": headers.get('Date', ''),
                "snippet": msg_data.get('snippet', ''),
                "unread": 'UNREAD' in msg_data.get('labelIds', [])
            })
        
        return {"messages": email_list}
        
    except HttpError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gmail API error: {str(error)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch emails: {str(e)}"
        )


@router.get("/messages/{message_id}")
async def get_gmail_message_detail(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Fetch detailed email content"""
    try:
        user_id = str(current_user.id)
        
        if user_id not in user_credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Gmail not connected. Please authenticate first."
            )
        
        creds_dict = user_credentials[user_id]
        creds = Credentials(
            token=creds_dict["token"],
            refresh_token=creds_dict.get("refresh_token"),
            token_uri=creds_dict["token_uri"],
            client_id=creds_dict["client_id"],
            client_secret=creds_dict["client_secret"],
            scopes=creds_dict["scopes"]
        )
        
        service = build('gmail', 'v1', credentials=creds)
        
        msg_data = service.users().messages().get(
            userId='me',
            id=message_id,
            format='full'
        ).execute()
        
        headers = {h['name']: h['value'] for h in msg_data.get('payload', {}).get('headers', [])}
        
        # Extract body
        body = ""
        if 'parts' in msg_data['payload']:
            for part in msg_data['payload']['parts']:
                if part['mimeType'] == 'text/plain' or part['mimeType'] == 'text/html':
                    if 'data' in part['body']:
                        body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                        break
        elif 'body' in msg_data['payload'] and 'data' in msg_data['payload']['body']:
            body = base64.urlsafe_b64decode(msg_data['payload']['body']['data']).decode('utf-8')
        
        return {
            "id": message_id,
            "from": headers.get('From', 'Unknown'),
            "to": headers.get('To', ''),
            "subject": headers.get('Subject', '(No Subject)'),
            "date": headers.get('Date', ''),
            "body": body
        }
        
    except HttpError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gmail API error: {str(error)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch email: {str(e)}"
        )


@router.post("/send")
async def send_gmail_message(
    email_data: SendEmailRequest,
    current_user: User = Depends(get_current_user)
):
    """Send an email via Gmail"""
    try:
        user_id = str(current_user.id)
        
        if user_id not in user_credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Gmail not connected. Please authenticate first."
            )
        
        creds_dict = user_credentials[user_id]
        creds = Credentials(
            token=creds_dict["token"],
            refresh_token=creds_dict.get("refresh_token"),
            token_uri=creds_dict["token_uri"],
            client_id=creds_dict["client_id"],
            client_secret=creds_dict["client_secret"],
            scopes=creds_dict["scopes"]
        )
        
        service = build('gmail', 'v1', credentials=creds)
        
        # Create message
        message = MIMEText(email_data.body)
        message['to'] = email_data.to
        message['subject'] = email_data.subject
        
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        send_message = service.users().messages().send(
            userId='me',
            body={'raw': raw_message}
        ).execute()
        
        return {
            "message": "Email sent successfully",
            "id": send_message['id']
        }
        
    except HttpError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gmail API error: {str(error)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )
