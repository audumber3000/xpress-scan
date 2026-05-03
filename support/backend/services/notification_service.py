import os
import httpx
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv

# Load env variables (assumes ../../.env)
load_dotenv()

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Standalone Notification Service for Support Dashboard Bulk Marketing/Utility Messaging
      WhatsApp → MSG91
      Email    → ZeptoMail (Zoho)
    """

    def __init__(self):
        # ── ZeptoMail (transactional email) ───────────────────────────────────
        self.zepto_token = os.getenv("ZEPTO_MAIL_TOKEN", "").strip()
        self.zepto_api_url = os.getenv(
            "ZEPTO_API_URL", "https://api.zeptomail.in/v1.1/email"
        )
        self.platform_from_email = os.getenv("ZEPTO_PLATFORM_FROM_EMAIL", "clinic@molarplus.com")
        self.platform_from_name  = os.getenv("ZEPTO_PLATFORM_FROM_NAME",  "MolarPlus")

        # ── MSG91 (WhatsApp) ───────────────────────────────────────────────────────
        self.msg91_auth_key = os.getenv("MSG91_AUTH_KEY", "")


    async def send_whatsapp(
        self,
        mobile_number: str,
        template_name: str,
        language_code: str = "en",
        parameters: Optional[list] = None,
        header_image_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send a WhatsApp template message via MSG91 WhatsApp API.
        mobile_number must include country code, e.g. "919876543210"
        parameters: simple list of strings to inject into the template body
        header_image_url: public HTTPS URL of an image, set when the template
            has an IMAGE header component on the MSG91 / Meta side. Sent as the
            `header_1` component per MSG91's bulk message schema.
        """
        if not self.msg91_auth_key:
            return {"success": False, "error": "MSG91 Auth Key not configured"}

        integrated_number = os.getenv("MSG91_WHATSAPP_INTEGRATED_NUMBER", "919326330412")
        url = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
        headers = {
            "authkey": self.msg91_auth_key,
            "Content-Type": "application/json",
        }

        msg91_components: Dict[str, Any] = {}
        if header_image_url:
            msg91_components["header_1"] = {
                "type": "image",
                "value": header_image_url,
            }
        if parameters:
            for i, param in enumerate(parameters):
                msg91_components[f"body_{i+1}"] = {"type": "text", "value": param}

        payload: Dict[str, Any] = {
            "integrated_number": integrated_number,
            "content_type": "template",
            "payload": {
                "messaging_product": "whatsapp",
                "type": "template",
                "template": {
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

    async def send_email(
        self, to_email: str, subject: str, html_content: str, to_name: str = ""
    ) -> Dict[str, Any]:
        """Send Marketing/Utility email via ZeptoMail."""
        if not self.zepto_token:
            return {"success": False, "error": "ZeptoMail token not configured"}

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": f"Zoho-enczapikey {self.zepto_token}",
        }
        payload: Dict[str, Any] = {
            "from": {"address": self.platform_from_email, "name": self.platform_from_name},
            "to": [{"email_address": {"address": to_email, "name": to_name or to_email}}],
            "subject": subject,
            "htmlbody": html_content,
        }
        try:
            logger.info(f"Sending email via ZeptoMail to {to_email} using URL: {self.zepto_api_url} (Token Prefix: {self.zepto_token[:5]}...)")
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

notification_service = NotificationService()
