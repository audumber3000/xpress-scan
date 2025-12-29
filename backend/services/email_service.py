import requests
import os
from typing import Optional
from datetime import datetime
import time
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class EmailService:
    """
    Email notification service using Zoho Mail API
    Architecture designed to support future WhatsApp integration
    """
    
    def __init__(self, client_id: Optional[str] = None, client_secret: Optional[str] = None, 
                 refresh_token: Optional[str] = None, from_email: Optional[str] = None):
        """
        Initialize Email Service with Zoho OAuth credentials
        
        Args:
            client_id: Zoho Client ID (optional, defaults to env variable)
            client_secret: Zoho Client Secret (optional, defaults to env variable)
            refresh_token: Zoho Refresh Token (optional, defaults to env variable)
            from_email: Sender email address (optional, defaults to env variable)
        """
        # OAuth credentials - Use provided values or fall back to environment variables
        if client_id:
            self.client_id = client_id
        else:
            self.client_id = os.getenv("ZOHO_CLIENT_ID", "")
        
        if client_secret:
            self.client_secret = client_secret
        else:
            self.client_secret = os.getenv("ZOHO_CLIENT_SECRET", "")
        
        if refresh_token:
            self.refresh_token = refresh_token
        else:
            self.refresh_token = os.getenv("ZOHO_REFRESH_TOKEN", "")
        
        # Sender email address
        if from_email:
            self.from_email = from_email
        else:
            self.from_email = os.getenv("ZOHO_FROM_EMAIL", "")
        
        # Token cache
        self._access_token = None
        self._token_expires_at = 0

        # SMTP settings for fallback
        self.smtp_server = os.getenv("ZOHO_SMTP_SERVER", "smtp.zoho.com")
        self.smtp_port = int(os.getenv("ZOHO_SMTP_PORT", "587"))

        # Test mode for development
        self.test_mode = os.getenv("EMAIL_TEST_MODE", "false").lower() == "true"
        
        # Zoho OAuth and Mail API endpoints
        # Support both EU and non-EU regions
        self.zoho_region = os.getenv("ZOHO_REGION", "eu").lower()  # Default to EU since account is EU
        
        if self.zoho_region == "eu":
            self.oauth_token_url = "https://accounts.zoho.eu/oauth/v2/token"
            self.mail_api_base = "https://mail.zoho.eu/api"
        else:
            self.oauth_token_url = "https://accounts.zoho.com/oauth/v2/token"
            self.mail_api_base = "https://mail.zoho.com/api"
    
    def _get_access_token(self) -> Optional[str]:
        """
        Get OAuth access token (refresh if needed)
        
        Returns:
            Access token string or None if failed
        """
        # Return cached token if still valid (with 5 minute buffer)
        if self._access_token and time.time() < (self._token_expires_at - 300):
            return self._access_token
        
        if not self.client_id or not self.client_secret:
            print("Zoho Client ID or Client Secret not configured")
            return None
        
        # If we have a refresh token, use it to get a new access token
        if self.refresh_token:
            try:
                response = requests.post(
                    self.oauth_token_url,
                    data={
                        "refresh_token": self.refresh_token,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "grant_type": "refresh_token"
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    self._access_token = token_data.get("access_token")
                    expires_in = token_data.get("expires_in", 3600)
                    self._token_expires_at = time.time() + expires_in
                    return self._access_token
                else:
                    print(f"Failed to refresh access token: {response.status_code} - {response.text}")
                    return None
            except Exception as e:
                print(f"Error refreshing access token: {e}")
                return None
        else:
            # If no refresh token, try client credentials grant (may not work for Mail API)
            print("No refresh token configured. Please generate a refresh token through OAuth flow.")
            return None
    
    def _get_email_template(self, clinic_name: str, content: str) -> str:
        """
        Generate email HTML template with consistent header and footer
        
        Args:
            clinic_name: Name of the clinic
            content: Main content of the email (will be inserted in the body)
            
        Returns:
            Complete HTML email template
        """
        logo_url = "https://via.placeholder.com/200x60/10B981/FFFFFF?text=Clinic+Logo"  # Default placeholder, can be replaced with clinic logo
        
        html_template = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notification from {clinic_name}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f4f4f4;
        }}
        .email-container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }}
        .email-header {{
            background-color: #10B981;
            padding: 30px 20px;
            text-align: center;
        }}
        .email-logo {{
            max-width: 200px;
            height: auto;
            margin-bottom: 15px;
        }}
        .email-body {{
            padding: 40px 30px;
        }}
        .email-content {{
            color: #333333;
            font-size: 16px;
            line-height: 1.8;
        }}
        .email-content h2 {{
            color: #10B981;
            margin-bottom: 20px;
            font-size: 24px;
        }}
        .email-content p {{
            margin-bottom: 15px;
        }}
        .email-content .highlight {{
            background-color: #ECFDF5;
            padding: 15px;
            border-left: 4px solid #10B981;
            margin: 20px 0;
        }}
        .email-footer {{
            background-color: #F9FAFB;
            padding: 30px 20px;
            text-align: center;
            border-top: 1px solid #E5E7EB;
        }}
        .email-footer p {{
            color: #6B7280;
            font-size: 14px;
            margin-bottom: 10px;
        }}
        .email-footer a {{
            color: #10B981;
            text-decoration: none;
        }}
        .btn {{
            display: inline-block;
            padding: 12px 30px;
            background-color: #10B981;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 500;
        }}
        .btn:hover {{
            background-color: #059669;
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header with Logo -->
        <div class="email-header">
            <img src="{logo_url}" alt="{clinic_name}" class="email-logo" />
        </div>
        
        <!-- Body Content -->
        <div class="email-body">
            <div class="email-content">
                {content}
            </div>
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
            <p><strong>{clinic_name}</strong></p>
            <p>Thank you for choosing our services.</p>
            <p style="margin-top: 20px; font-size: 12px; color: #9CA3AF;">
                This is an automated email. Please do not reply to this message.
            </p>
            <p style="font-size: 12px; color: #9CA3AF;">
                © {datetime.now().year} {clinic_name}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
"""
        return html_template
    
    def _get_account_id(self, access_token: str) -> Optional[str]:
        """
        Get Zoho Mail account ID for the configured email address

        Args:
            access_token: OAuth access token

        Returns:
            Account ID string or None if not found
        """
        try:
            headers = {
                "Authorization": f"Zoho-oauthtoken {access_token}",
                "Content-Type": "application/json"
            }

            # Get accounts endpoint
            url = f"{self.mail_api_base}/accounts"
            response = requests.get(url, headers=headers, timeout=30)

            if response.status_code == 200:
                accounts_data = response.json()
                accounts = accounts_data.get("data", [])

                # Find account that matches our from_email
                for account in accounts:
                    if account.get("mailId") == self.from_email:
                        return str(account.get("accountId"))

                # If no exact match, try to find any account (fallback)
                if accounts:
                    return str(accounts[0].get("accountId"))

                return None
            else:
                print(f"Failed to get accounts: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"Error getting account ID: {e}")
            return None

    def _send_email_smtp(self, to_email: str, subject: str, html_content: str) -> dict:
        """
        Send email using SMTP as fallback when REST API fails

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of the email

        Returns:
            API response as dictionary
        """
        try:
            if not self.from_email:
                return {
                    "success": False,
                    "message": "Sender email not configured",
                    "error": "ZOHO_FROM_EMAIL environment variable not set"
                }

            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to_email

            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)

            # For SMTP, we need username/password
            # Since we don't have a password in the config, we'll use app-specific password approach
            # For now, let's skip SMTP and just return an error indicating REST API is preferred

            return {
                "success": False,
                "message": "SMTP fallback not configured. Please check Zoho Mail API setup.",
                "error": "SMTP credentials not available"
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"SMTP send failed: {str(e)}",
                "error": str(e)
            }

    def _send_email(self, to_email: str, subject: str, html_content: str) -> dict:
        """
        Send email using Zoho Mail API

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of the email

        Returns:
            API response as dictionary
        """
        # Test mode - simulate successful email sending
        if self.test_mode:
            print(f"TEST MODE: Would send email to {to_email} with subject '{subject}'")
            return {
                "success": True,
                "message": "Email sent successfully (TEST MODE)",
                "test_mode": True,
                "recipient": to_email,
                "subject": subject
            }

        try:
            if not self.from_email:
                return {
                    "success": False,
                    "message": "Sender email not configured",
                    "error": "ZOHO_FROM_EMAIL environment variable not set"
                }

            # Get access token
            access_token = self._get_access_token()
            if not access_token:
                return {
                    "success": False,
                    "message": "Failed to obtain access token. Please check Zoho credentials.",
                    "error": "Access token generation failed"
                }

            # Get account ID
            account_id = self._get_account_id(access_token)
            if not account_id:
                return {
                    "success": False,
                    "message": "Could not find or access Zoho Mail account. Please check your email configuration.",
                    "error": "Account ID not found"
                }

            headers = {
                "Authorization": f"Zoho-oauthtoken {access_token}",
                "Content-Type": "application/json"
            }

            # Zoho Mail API endpoint for sending emails
            url = f"{self.mail_api_base}/accounts/{account_id}/messages"

            # Zoho Mail API message format
            payload = {
                "fromAddress": "notification@betterclinic.app",
                "toAddress": to_email,
                "subject": subject,
                "content": html_content,
                "mailFormat": "html"
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code in [200, 201]:
                return {
                    "success": True,
                    "message": "Email sent successfully",
                    "response": response.json() if response.text else None
                }
            else:
                error_response = response.text
                try:
                    error_json = response.json()
                    error_message = error_json.get("message") or error_json.get("error") or error_response
                    error_data = error_json.get("data", {})
                except:
                    error_message = error_response or f"HTTP {response.status_code}"
                    error_data = {}

                print(f"Zoho Mail API error ({response.status_code}): {error_message}")

                return {
                    "success": False,
                    "message": f"Failed to send email. {error_message}",
                    "data": error_data,
                    "response": error_response,
                    "status_code": response.status_code
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending email: {str(e)}",
                "error": str(e)
            }
    
    def send_appointment_scheduled_email(
        self, 
        to_email: str, 
        patient_name: str, 
        clinic_name: str,
        appointment_date: str,
        appointment_time: str,
        treatment: str,
        clinic_phone: Optional[str] = None
    ) -> dict:
        """
        Send email notification when appointment is scheduled
        
        Args:
            to_email: Patient email address
            patient_name: Patient's name
            clinic_name: Name of the clinic
            appointment_date: Appointment date (e.g., "December 15, 2024")
            appointment_time: Appointment time (e.g., "10:00 AM")
            treatment: Treatment type/description
            clinic_phone: Clinic phone number (optional)
            
        Returns:
            API response as dictionary
        """
        content = f"""
            <h2>Appointment Confirmed</h2>
            <p>Dear {patient_name},</p>
            <p>Your appointment has been successfully scheduled!</p>
            <div class="highlight">
                <p><strong>Date:</strong> {appointment_date}</p>
                <p><strong>Time:</strong> {appointment_time}</p>
                <p><strong>Treatment:</strong> {treatment}</p>
            </div>
            <p>We look forward to seeing you at {clinic_name}.</p>
            {"<p>If you have any questions, please contact us at " + clinic_phone + ".</p>" if clinic_phone else ""}
            <p>Please arrive 10 minutes before your scheduled appointment time.</p>
        """
        
        html_content = self._get_email_template(clinic_name, content)
        subject = f"Appointment Confirmed - {clinic_name}"
        
        return self._send_email(to_email, subject, html_content)
    
    def send_appointment_accepted_email(
        self,
        to_email: str,
        patient_name: str,
        clinic_name: str,
        appointment_date: str,
        appointment_time: str,
        treatment: str,
        doctor_name: Optional[str] = None,
        clinic_phone: Optional[str] = None
    ) -> dict:
        """
        Send email notification when appointment is accepted by doctor/staff
        
        Args:
            to_email: Patient email address
            patient_name: Patient's name
            clinic_name: Name of the clinic
            appointment_date: Appointment date
            appointment_time: Appointment time
            treatment: Treatment type/description
            doctor_name: Doctor's name (optional)
            clinic_phone: Clinic phone number (optional)
            
        Returns:
            API response as dictionary
        """
        content = f"""
            <h2>Appointment Accepted</h2>
            <p>Dear {patient_name},</p>
            <p>Great news! Your appointment has been accepted.</p>
            <div class="highlight">
                <p><strong>Date:</strong> {appointment_date}</p>
                <p><strong>Time:</strong> {appointment_time}</p>
                <p><strong>Treatment:</strong> {treatment}</p>
                {"<p><strong>Doctor:</strong> " + doctor_name + "</p>" if doctor_name else ""}
            </div>
            <p>Your appointment at {clinic_name} is confirmed and we're ready to assist you.</p>
            {"<p>If you have any questions, please contact us at " + clinic_phone + ".</p>" if clinic_phone else ""}
            <p>We look forward to seeing you!</p>
        """
        
        html_content = self._get_email_template(clinic_name, content)
        subject = f"Appointment Accepted - {clinic_name}"
        
        return self._send_email(to_email, subject, html_content)
    
    def send_appointment_rejected_email(
        self,
        to_email: str,
        patient_name: str,
        clinic_name: str,
        appointment_date: str,
        appointment_time: str,
        treatment: str,
        rejection_reason: Optional[str] = None,
        clinic_phone: Optional[str] = None
    ) -> dict:
        """
        Send email notification when appointment is rejected
        
        Args:
            to_email: Patient email address
            patient_name: Patient's name
            clinic_name: Name of the clinic
            appointment_date: Appointment date
            appointment_time: Appointment time
            treatment: Treatment type/description
            rejection_reason: Custom rejection message (optional)
            clinic_phone: Clinic phone number (optional)
            
        Returns:
            API response as dictionary
        """
        rejection_message = rejection_reason if rejection_reason else "Unfortunately, we are unable to accommodate your appointment request at this time. Please try scheduling for a different date or time."
        
        content = f"""
            <h2>Appointment Update</h2>
            <p>Dear {patient_name},</p>
            <p>We regret to inform you that your appointment request could not be accepted.</p>
            <div class="highlight">
                <p><strong>Date:</strong> {appointment_date}</p>
                <p><strong>Time:</strong> {appointment_time}</p>
                <p><strong>Treatment:</strong> {treatment}</p>
            </div>
            <p><strong>Reason:</strong> {rejection_message}</p>
            <p>We apologize for any inconvenience. Please feel free to book a new appointment at a time that works for you.</p>
            {"<p>If you have any questions, please contact us at " + clinic_phone + ".</p>" if clinic_phone else ""}
            <p>Thank you for your understanding.</p>
        """
        
        html_content = self._get_email_template(clinic_name, content)
        subject = f"Appointment Update - {clinic_name}"
        
        return self._send_email(to_email, subject, html_content)
    
    def send_clinic_signup_email(
        self,
        to_email: str,
        owner_name: str,
        clinic_name: str
    ) -> dict:
        """
        Send email notification after clinic signup
        
        Args:
            to_email: Clinic owner email address
            owner_name: Clinic owner's name
            clinic_name: Name of the clinic
            
        Returns:
            API response as dictionary
        """
        content = f"""
            <h2>Welcome to {clinic_name}!</h2>
            <p>Dear {owner_name},</p>
            <p>Congratulations! Your clinic <strong>{clinic_name}</strong> has been successfully registered.</p>
            <p>You can now start managing your appointments, patients, and clinic operations through our platform.</p>
            <p>If you need any assistance, please don't hesitate to reach out to our support team.</p>
            <p>Welcome aboard!</p>
        """
        
        html_content = self._get_email_template(clinic_name, content)
        subject = f"Welcome to {clinic_name} - Registration Successful"
        
        return self._send_email(to_email, subject, html_content)
    
    def send_staff_invitation_email(
        self,
        to_email: str,
        staff_name: str,
        clinic_name: str,
        role: str,
        inviter_name: Optional[str] = None
    ) -> dict:
        """
        Send email notification when staff is added to clinic
        
        Args:
            to_email: Staff email address
            staff_name: Staff member's name
            clinic_name: Name of the clinic
            role: Staff role (e.g., "doctor", "receptionist")
            inviter_name: Name of the person who added the staff (optional)
            
        Returns:
            API response as dictionary
        """
        inviter_text = f" by {inviter_name}" if inviter_name else ""
        
        content = f"""
            <h2>Welcome to {clinic_name}!</h2>
            <p>Dear {staff_name},</p>
            <p>You have been added as a <strong>{role}</strong> to <strong>{clinic_name}</strong>{inviter_text}.</p>
            <p>You can now access the clinic management system and start working with your team.</p>
            <p>If you need any assistance getting started, please don't hesitate to reach out.</p>
            <p>Welcome to the team!</p>
        """
        
        html_content = self._get_email_template(clinic_name, content)
        subject = f"Welcome to {clinic_name} - Team Invitation"
        
        return self._send_email(to_email, subject, html_content)
    
    def send_test_email(
        self,
        to_email: str,
        clinic_name: str
    ) -> dict:
        """
        Send a test email to verify email service configuration
        
        Args:
            to_email: Recipient email address
            clinic_name: Name of the clinic
            
        Returns:
            API response as dictionary
        """
        content = f"""
            <h2>Test Email from {clinic_name}</h2>
            <p>Hello!</p>
            <p>This is a test email from the <strong>{clinic_name}</strong> notification system.</p>
            <p>If you received this email, it means the email service is configured correctly and working properly.</p>
            <div class="highlight">
                <p><strong>Email Service Status:</strong> ✅ Active</p>
                <p><strong>Clinic:</strong> {clinic_name}</p>
                <p><strong>Sent At:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
            </div>
            <p>You can now receive automated email notifications for appointments, staff invitations, and other important updates.</p>
        """
        
        html_content = self._get_email_template(clinic_name, content)
        subject = f"Test Email - {clinic_name} Notification Service"
        
        return self._send_email(to_email, subject, html_content)

