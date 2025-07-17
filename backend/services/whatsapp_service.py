import requests
import os
from typing import Optional

class WhatsAppService:
    def __init__(self):
        self.api_key = os.getenv("RAPIWHA_API_KEY", "your-rapiwha-api-key")
        self.base_url = "https://panel.rapiwha.com/send_message.php"
    
    def send_pdf_link(self, phone_number: str, pdf_url: str, message: str = None) -> dict:
        """
        Send PDF link via WhatsApp using Rapiwha API
        
        Args:
            phone_number: Phone number with country code (e.g., "919876543210")
            pdf_url: Public URL of the PDF
            message: Custom message (optional)
            
        Returns:
            API response as dictionary
        """
        try:
            # Ensure phone number starts with '91'
            phone_number = str(phone_number)
            if not phone_number.startswith('91'):
                phone_number = '91' + phone_number.lstrip('+')
            # Prepare the message
            if message:
                full_message = f"{message}\n\nYour report is ready: {pdf_url}"
            else:
                full_message = f"Your radiology report is ready!\n\nView your report: {pdf_url}"
            
            # Prepare the request
            params = {
                'apikey': self.api_key,
                'number': phone_number,
                'text': full_message
            }
            
            # Send the request
            response = requests.get(self.base_url, params=params)
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "WhatsApp message sent successfully",
                    "response": response.text
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to send WhatsApp message. Status: {response.status_code}",
                    "response": response.text
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending WhatsApp message: {str(e)}",
                "response": None
            }
    
    def test_connection(self) -> dict:
        """
        Test the WhatsApp API connection
        
        Returns:
            Test result as dictionary
        """
        try:
            params = {
                'apikey': self.api_key,
                'number': '1234567890',  # Test number
                'text': 'Test message'
            }
            
            response = requests.get(self.base_url, params=params)
            
            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response": response.text,
                "api_key_configured": bool(self.api_key and self.api_key != "your-rapiwha-api-key")
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "api_key_configured": bool(self.api_key and self.api_key != "your-rapiwha-api-key")
            } 