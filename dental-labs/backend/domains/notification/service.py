"""
NotificationService — Dental Labs' own WhatsApp + email sender.

Self-contained: replicates MolarPlus's provider pattern (MSG91 for WhatsApp
template messages, ZeptoMail for transactional email) but runs in-process here
and shares nothing with the clinic app. Reads its own env vars.

All send methods return {"success": bool, ...} and never raise — failures are
reported, not thrown, so the dispatcher can log them.
"""
import os
import logging
from typing import Optional, Dict, Any, List

import httpx

logger = logging.getLogger(__name__)

MSG91_WA_URL = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"


class NotificationService:
    def __init__(self):
        # ── MSG91 (WhatsApp) ──────────────────────────────────────────────
        self.msg91_auth_key = os.getenv("MSG91_AUTH_KEY", "")
        self.msg91_integrated_number = os.getenv("MSG91_WHATSAPP_INTEGRATED_NUMBER", "919326330412")
        self.msg91_wa_namespace = os.getenv("MSG91_WA_NAMESPACE", "")

        # ── ZeptoMail (email) ─────────────────────────────────────────────
        self.zepto_token = os.getenv("ZEPTO_MAIL_TOKEN", "")
        self.zepto_api_url = os.getenv("ZEPTO_API_URL", "https://api.zeptomail.in/v1.1/email")
        self.from_email = os.getenv("DL_FROM_EMAIL") or os.getenv("ZEPTO_FROM_EMAIL", "labs@molarplus.com")
        self.from_name = os.getenv("DL_FROM_NAME", "MolarPlus Labs")

    # ── Channel readiness ────────────────────────────────────────────────

    def whatsapp_configured(self) -> bool:
        return bool(self.msg91_auth_key)

    def email_configured(self) -> bool:
        return bool(self.zepto_token)

    def get_channel_status(self) -> Dict[str, Any]:
        return {
            "whatsapp": {
                "configured": self.whatsapp_configured(),
                "channel": "MSG91 API",
                "integrated_number": self.msg91_integrated_number,
            },
            "email": {
                "configured": self.email_configured(),
                "channel": "ZeptoMail (API)",
                "from": self.from_email,
            },
        }

    # ── WhatsApp via MSG91 ───────────────────────────────────────────────

    async def send_whatsapp(
        self,
        mobile_number: str,
        template_name: str,
        language_code: str = "en",
        components: Optional[list] = None,
    ) -> Dict[str, Any]:
        """Send a WhatsApp template message via MSG91.

        mobile_number must be digits-only with country code, e.g. "919876543210".
        components follow the Meta structure; we translate them to MSG91's shape.
        """
        if not self.msg91_auth_key:
            return {"success": False, "error": "WhatsApp not configured"}
        if not mobile_number:
            return {"success": False, "error": "missing recipient phone"}

        headers = {"authkey": self.msg91_auth_key, "Content-Type": "application/json"}

        # Translate Meta components → MSG91 components dict.
        msg91_components: Dict[str, Any] = {}
        for comp in components or []:
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
                        msg91_components["header_1"] = {
                            "type": "document",
                            "value": doc_val,
                            "filename": doc.get("filename", "document.pdf"),
                        }
            elif comp_type == "body":
                for i, param in enumerate(comp.get("parameters", [])):
                    if param.get("type") == "text":
                        msg91_components[f"body_{i+1}"] = {"type": "text", "value": param.get("text")}

        template_obj: Dict[str, Any] = {
            "name": template_name,
            "language": {"code": language_code, "policy": "deterministic"},
            "to_and_components": [{"to": [mobile_number], "components": msg91_components}],
        }
        if self.msg91_wa_namespace:
            template_obj["namespace"] = self.msg91_wa_namespace

        payload = {
            "integrated_number": self.msg91_integrated_number,
            "content_type": "template",
            "payload": {
                "messaging_product": "whatsapp",
                "type": "template",
                "template": template_obj,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(MSG91_WA_URL, json=payload, headers=headers)
                data = resp.json()
                if resp.status_code == 200 and not data.get("hasError", False):
                    return {"success": True, "data": data}
                return {
                    "success": False,
                    "error": data.get("message", "MSG91 API error"),
                    "status_code": resp.status_code,
                    "data": data,
                }
        except Exception as e:
            logger.error(f"MSG91 WhatsApp error: {e}")
            return {"success": False, "error": str(e)}

    # ── Email via ZeptoMail ──────────────────────────────────────────────

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        to_name: str = "",
        attachments: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Send a transactional email via ZeptoMail.

        attachments: list of {"name", "content" (base64), "mime_type"}.
        """
        if not self.zepto_token:
            return {"success": False, "error": "Email not configured"}
        if not to_email:
            return {"success": False, "error": "missing recipient email"}

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": f"Zoho-enczapikey {self.zepto_token}",
        }
        payload: Dict[str, Any] = {
            "from": {"address": self.from_email, "name": self.from_name},
            "to": [{"email_address": {"address": to_email, "name": to_name or to_email}}],
            "subject": subject,
            "htmlbody": html_content,
        }
        if attachments:
            payload["attachments"] = [
                {
                    "name": a["name"],
                    "content": a["content"],
                    "mime_type": a.get("mime_type", "application/pdf"),
                }
                for a in attachments
            ]

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(self.zepto_api_url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    return {"success": True, "message": "Email sent"}
                return {"success": False, "error": resp.text, "status_code": resp.status_code}
        except Exception as e:
            logger.error(f"ZeptoMail error: {e}")
            return {"success": False, "error": str(e)}


# Module-level singleton — cheap, stateless aside from env-derived config.
notification_service = NotificationService()
