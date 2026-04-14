import os
import httpx
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv
from .email_templates import build_email, PLATFORM_EVENTS
from .whatsapp_templates import build_whatsapp

load_dotenv(os.path.join(os.path.dirname(__file__), '../../../../.env'))

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Unified Notification Service
      WhatsApp → Meta Cloud API (WhatsApp Business Platform)
      Email    → ZeptoMail (Zoho transactional email)
      SMS      → MSG91
    """

    def __init__(self):
        # ── Meta Cloud API (WhatsApp) ──────────────────────────────────────────
        self.meta_access_token = os.getenv("META_ACCESS_TOKEN", "")
        self.meta_phone_number_id = os.getenv("META_PHONE_NUMBER_ID", "")
        self.meta_api_version = os.getenv("META_API_VERSION", "v19.0")

        # ── ZeptoMail (transactional email) ───────────────────────────────────
        self.zepto_token = os.getenv("ZEPTO_MAIL_TOKEN", "")
        self.zepto_api_url = os.getenv(
            "ZEPTO_API_URL", "https://api.zeptomail.in/v1.1/email"
        )
        # Platform → Clinic sender (system events — not charged)
        self.platform_from_email = os.getenv("ZEPTO_PLATFORM_FROM_EMAIL", "clinic@molarplus.com")
        self.platform_from_name  = os.getenv("ZEPTO_PLATFORM_FROM_NAME",  "MolarPlus")
        # Clinic → Patient sender (clinical events — charged to clinic wallet)
        self.patient_from_email  = os.getenv("ZEPTO_PATIENT_FROM_EMAIL",  "care@molarplus.com")
        self.patient_from_name   = os.getenv("ZEPTO_PATIENT_FROM_NAME",   "MolarPlus Care")
        # Legacy single-sender fallback
        self.zepto_from_email    = os.getenv("ZEPTO_FROM_EMAIL", self.platform_from_email)
        self.zepto_from_name     = os.getenv("ZEPTO_FROM_NAME",  self.platform_from_name)

        # ── MSG91 (SMS / WhatsApp) ────────────────────────────────────────────
        self.msg91_auth_key = os.getenv("MSG91_AUTH_KEY", "")
        self.msg91_sms_sender = os.getenv("MSG91_SMS_SENDER", "MOLARPLUS")
        self.msg91_wa_namespace = os.getenv("MSG91_WA_NAMESPACE", "")

    # ─── WhatsApp via Meta Cloud API ─────────────────────────────────────────

    async def send_whatsapp(
        self,
        mobile_number: str,
        template_name: str,
        language_code: str = "en",
        components: Optional[list] = None,
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp template message via MSG91 WhatsApp API.
        mobile_number must include country code, e.g. "919876543210"
        """
        if not self.msg91_auth_key:
            return {"success": False, "error": "MSG91 Auth Key not configured"}

        integrated_number = os.getenv("MSG91_WHATSAPP_INTEGRATED_NUMBER", "919326330412")
        url = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
        headers = {
            "authkey": self.msg91_auth_key,
            "Content-Type": "application/json",
        }
        
        # Translate Meta components structure to MSG91 components dictionary
        msg91_components = {}
        if components:
            for comp in components:
                comp_type = comp.get("type")
                if comp_type == "header":
                    params = comp.get("parameters", [])
                    if params:
                        param = params[0]
                        if param.get("type") == "text":
                            msg91_components["header_1"] = {"type": "text", "value": param.get("text")}
                        elif param.get("type") == "document":
                            doc = param.get("document", {})
                            doc_val = doc.get("link") or doc.get("id") or ""
                            
                            # If they passed a relative R2 path directly instead of a full link, convert it
                            if doc_val and not doc_val.startswith("http"):
                                public_r2_domain = os.getenv("PUBLIC_R2_URL", "https://pub-dffc1ddb83334a5d876764f248e780d7.r2.dev")
                                doc_val = f"{public_r2_domain.rstrip('/')}/{doc_val.lstrip('/')}"
                                
                            msg91_components["header_1"] = {
                                "type": "document",
                                "value": doc_val,
                                "filename": doc.get("filename", "document.pdf")
                            }
                elif comp_type == "body":
                    params = comp.get("parameters", [])
                    for i, param in enumerate(params):
                        if param.get("type") == "text":
                            msg91_components[f"body_{i+1}"] = {"type": "text", "value": param.get("text")}
                
        template_obj: Dict[str, Any] = {
            "name": template_name,
            "language": {
                "code": language_code,
                "policy": "deterministic"
            },
            "to_and_components": [
                {
                    "to": [mobile_number],
                    "components": msg91_components
                }
            ]
        }
        if self.msg91_wa_namespace:
            template_obj["namespace"] = self.msg91_wa_namespace

        payload: Dict[str, Any] = {
            "integrated_number": integrated_number,
            "content_type": "template",
            "payload": {
                "messaging_product": "whatsapp",
                "type": "template",
                "template": template_obj,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                data = resp.json()
                if resp.status_code == 200 and not data.get("hasError", False):
                    return {"success": True, "data": data}
                return {
                    "success": False,
                    "error": data.get("message", "MSG91 API error"),
                    "status_code": resp.status_code,
                }
        except Exception as e:
            logger.error(f"MSG91 WhatsApp error: {e}")
            return {"success": False, "error": str(e)}

    async def send_whatsapp_text(
        self, mobile_number: str, message: str
    ) -> Dict[str, Any]:
        """
        Send a free-form WhatsApp text message (for test/utility purposes).
        Only works within a 24-hour customer-initiated window.
        """
        if not self.meta_access_token or not self.meta_phone_number_id:
            return {"success": False, "error": "Meta Cloud API credentials not configured"}

        url = (
            f"https://graph.facebook.com/{self.meta_api_version}"
            f"/{self.meta_phone_number_id}/messages"
        )
        headers = {
            "Authorization": f"Bearer {self.meta_access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": mobile_number,
            "type": "text",
            "text": {"body": message},
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                data = resp.json()
                if resp.status_code == 200:
                    return {"success": True, "data": data}
                return {
                    "success": False,
                    "error": data.get("error", {}).get("message", "Meta API error"),
                    "status_code": resp.status_code,
                }
        except Exception as e:
            logger.error(f"Meta WhatsApp text error: {e}")
            return {"success": False, "error": str(e)}

    async def upload_media_to_meta(
        self, pdf_bytes: bytes, filename: str = "document.pdf",
        clinic_id: Optional[str] = None, patient_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Uploads a PDF directly to Cloudflare R2 and returns its public URL for MSG91.
        (Method name kept for backward compatibility with calling endpoints).
        """
        import uuid
        import boto3
        from botocore.config import Config
        access_key_id = os.getenv("R2_ACCESS_KEY_ID")
        secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
        endpoint_url = os.getenv("R2_ENDPOINT_URL")
        bucket_name = os.getenv("R2_BUCKET_NAME")
        
        # New public URL provided by user
        public_r2_domain = os.getenv("PUBLIC_R2_URL", "https://pub-dffc1ddb83334a5d876764f248e780d7.r2.dev")

        if not all([access_key_id, secret_access_key, endpoint_url, bucket_name]):
            return {"success": False, "error": "R2 credentials not configured"}
            
        client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name='auto',
            config=Config(signature_version='s3v4')
        )
        
        unique_id = str(uuid.uuid4())[:8]
        safe_filename = filename.replace(' ', '_')
        
        if clinic_id and patient_id:
            storage_path = f"clinics/{clinic_id}/patients/{patient_id}/whatsapp/{unique_id}/{safe_filename}"
        elif clinic_id:
            storage_path = f"clinics/{clinic_id}/whatsapp/{unique_id}/{safe_filename}"
        else:
            storage_path = f"tmp/whatsapp/{unique_id}/{safe_filename}"
        
        try:
            client.put_object(
                Bucket=bucket_name,
                Key=storage_path,
                Body=pdf_bytes,
                ContentType='application/pdf'
            )
            public_url = f"{public_r2_domain.rstrip('/')}/{storage_path}"
            # Return as media_id to keep compatibility with send_event
            return {"success": True, "media_id": public_url}
        except Exception as e:
            logger.error(f"R2 WhatsApp media upload error: {e}")
            return {"success": False, "error": str(e)}

    # ─── SMS via MSG91 ───────────────────────────────────────────────────────

    async def send_sms(
        self,
        mobile_number: str,
        template_id: str,
        flow_variables: Dict[str, str],
    ) -> Dict[str, Any]:
        """Send SMS via MSG91 Flow API."""
        if not self.msg91_auth_key:
            return {"success": False, "error": "MSG91 Auth Key not configured"}

        url = "https://control.msg91.com/api/v5/flow/"
        payload = {
            "template_id": template_id,
            "sender": self.msg91_sms_sender,
            "short_url": "0",
            "mobiles": mobile_number,
            **flow_variables,
        }
        headers = {
            "authkey": self.msg91_auth_key,
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                data = resp.json()
                if resp.status_code == 200:
                    return {"success": True, "data": data}
                return {
                    "success": False,
                    "error": data.get("message", "API Error"),
                    "status_code": resp.status_code,
                }
        except Exception as e:
            logger.error(f"MSG91 SMS error: {e}")
            return {"success": False, "error": str(e)}

    async def send_sms_simple(self, mobile_number: str, message: str) -> Dict[str, Any]:
        """Send a plain SMS via MSG91 (for testing/utility)."""
        if not self.msg91_auth_key:
            return {"success": False, "error": "MSG91 Auth Key not configured"}

        url = "https://control.msg91.com/api/v5/flow/"
        payload = {
            "sender": self.msg91_sms_sender,
            "short_url": "0",
            "mobiles": mobile_number,
            "message": message,
        }
        headers = {
            "authkey": self.msg91_auth_key,
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                data = resp.json()
                if resp.status_code == 200:
                    return {"success": True, "data": data}
                return {
                    "success": False,
                    "error": data.get("message", "API Error"),
                    "status_code": resp.status_code,
                }
        except Exception as e:
            logger.error(f"MSG91 SMS simple error: {e}")
            return {"success": False, "error": str(e)}

    # ─── Email via ZeptoMail ─────────────────────────────────────────────────

    async def send_email(
        self, to_email: str, subject: str, html_content: str, to_name: str = ""
    ) -> Dict[str, Any]:
        """Send transactional email via ZeptoMail (legacy single-sender)."""
        return await self._zepto_post(
            from_email=self.zepto_from_email,
            from_name=self.zepto_from_name,
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            html_content=html_content,
        )

    async def send_platform_email(
        self, to_email: str, to_name: str, subject: str, html_content: str
    ) -> Dict[str, Any]:
        """Platform → Clinic email from clinic@molarplus.com."""
        return await self._zepto_post(
            from_email=self.platform_from_email,
            from_name=self.platform_from_name,
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            html_content=html_content,
        )

    async def send_patient_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
        attachments: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Clinic → Patient email from care@molarplus.com, with optional PDF attachments."""
        return await self._zepto_post(
            from_email=self.patient_from_email,
            from_name=self.patient_from_name,
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            html_content=html_content,
            attachments=attachments,
        )

    async def _zepto_post(
        self,
        from_email: str,
        from_name: str,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
        attachments: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        Core ZeptoMail API POST.
        attachments: list of {"name": "file.pdf", "content": "<base64>", "mime_type": "application/pdf"}
        """
        if not self.zepto_token:
            return {"success": False, "error": "ZeptoMail token not configured"}

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": f"Zoho-enczapikey {self.zepto_token}",
        }
        payload: Dict[str, Any] = {
            "from": {"address": from_email, "name": from_name},
            "to": [{"email_address": {"address": to_email, "name": to_name or to_email}}],
            "subject": subject,
            "htmlbody": html_content,
        }
        if attachments:
            payload["attachments"] = [
                {
                    "name": a["name"],
                    "content": a["content"],  # base64 string
                    "mime_type": a.get("mime_type", "application/pdf"),
                }
                for a in attachments
            ]
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(self.zepto_api_url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    return {"success": True, "message": "Email sent successfully"}
                return {
                    "success": False,
                    "error": resp.text,
                    "status_code": resp.status_code,
                }
        except Exception as e:
            logger.error(f"ZeptoMail error: {e}")
            return {"success": False, "error": str(e)}

    # ─── Utilities ───────────────────────────────────────────────────────────

    def get_email_template(self, clinic_name: str, body_content: str) -> str:
        """Generate a clean branded HTML email body."""
        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f4f6f9; }}
    .wrapper {{ max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }}
    .header {{ background:#2a276e; padding:28px 32px; text-align:center; }}
    .header h2 {{ margin:0; color:#fff; font-size:20px; letter-spacing:.5px; }}
    .content {{ padding:32px; color:#374151; line-height:1.7; font-size:15px; }}
    .footer {{ background:#f9fafb; padding:20px 32px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h2>{clinic_name}</h2></div>
    <div class="content">{body_content}</div>
    <div class="footer">© {datetime.now().year} {clinic_name} · Powered by MolarPlus</div>
  </div>
</body>
</html>"""

    async def dispatch_event(
        self,
        event_type: str,
        channel: str,
        to_email: str = "",
        to_name: str = "",
        to_phone: str = "",
        attachments: Optional[List[Dict[str, str]]] = None,
        **template_kwargs,
    ) -> Dict[str, Any]:
        """
        Unified event dispatcher.
        Builds the correct message for event_type and sends via channel.

        channel: "email" | "whatsapp" | "sms"
        template_kwargs: all fields required by the email/WA template builder for this event.
        """
        try:
            if channel == "email":
                tpl = build_email(event_type, **template_kwargs)
                is_platform = event_type in PLATFORM_EVENTS
                if is_platform:
                    return await self.send_platform_email(
                        to_email=to_email,
                        to_name=to_name,
                        subject=tpl["subject"],
                        html_content=tpl["html"],
                    )
                else:
                    return await self.send_patient_email(
                        to_email=to_email,
                        to_name=to_name,
                        subject=tpl["subject"],
                        html_content=tpl["html"],
                        attachments=attachments,
                    )

            elif channel == "whatsapp":
                wa = build_whatsapp(event_type, **template_kwargs)
                return await self.send_whatsapp(
                    mobile_number=to_phone,
                    template_name=wa["template_name"],
                    components=wa["components"],
                )

            else:
                return {"success": False, "error": f"Unsupported channel: {channel}"}

        except ValueError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"dispatch_event error [{event_type}/{channel}]: {e}")
            return {"success": False, "error": str(e)}

    def get_channel_status(self) -> Dict[str, Any]:
        """Return configuration status of each channel."""
        return {
            "whatsapp": {
                "configured": bool(self.msg91_auth_key),
                "channel": "MSG91 API",
                "phone_number_id": os.getenv("MSG91_WHATSAPP_INTEGRATED_NUMBER", "919326330412"),
            },
            "email": {
                "configured": bool(self.zepto_token),
                "channel": "ZeptoMail (API)",
                "platform_from": self.platform_from_email,
                "patient_from": self.patient_from_email,
            },
            "sms": {
                "configured": bool(self.msg91_auth_key),
                "channel": "MSG91",
                "sender_id": self.msg91_sms_sender or None,
            },
        }
