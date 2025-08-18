import requests
import os
from typing import Optional

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class WhatsAppService:
    def __init__(self, api_key: Optional[str] = None):
        # Allow custom API key to be passed in, otherwise use environment variable
        if api_key:
            self.api_key = api_key
        else:
            self.api_key = os.getenv("RAPIWHA_API_KEY", "your-rapiwha-api-key")
        
        # Clean up the API key (remove any trailing characters)
        if self.api_key and self.api_key != "your-rapiwha-api-key":
            self.api_key = self.api_key.strip().rstrip('%')
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
            
            # Clean up the PDF URL (remove trailing '?' from Supabase URLs)
            clean_pdf_url = pdf_url.rstrip('?') if pdf_url else pdf_url
            
            # Send patient details message first
            patient_message = message if message else "Your radiology report is ready!"
            
            patient_params = {
                'apikey': self.api_key,
                'number': phone_number,
                'text': patient_message
            }
            
            patient_response = requests.get(self.base_url, params=patient_params)
            
            if patient_response.status_code != 200:
                return {
                    "success": False,
                    "message": f"Failed to send patient details message. Status: {patient_response.status_code}",
                    "response": patient_response.text
                }
            
            # Wait a moment before sending the PDF link
            import time
            time.sleep(2)
            
            # Send PDF link in separate message (URL only)
            pdf_message = clean_pdf_url
            
            pdf_params = {
                'apikey': self.api_key,
                'number': phone_number,
                'text': pdf_message
            }
            
            pdf_response = requests.get(self.base_url, params=pdf_params)
            
            if pdf_response.status_code == 200:
                return {
                    "success": True,
                    "message": "Report sent to patient successfully",
                    "response": {
                        "patient_message": patient_response.text,
                        "pdf_message": pdf_response.text
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to send report to patient. Status: {pdf_response.status_code}",
                    "response": pdf_response.text
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending WhatsApp messages: {str(e)}",
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
                "api_key_configured": bool(self.api_key and self.api_key != "your-rapiwha-api-key"),
                "api_key_source": "user_config" if hasattr(self, '_user_config') else "env_default"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "api_key_configured": bool(self.api_key and self.api_key != "your-rapiwha-api-key"),
                "api_key_source": "user_config" if hasattr(self, '_user_config') else "env_default"
            }
    
    def get_credit(self) -> dict:
        """
        Get WhatsApp API credit balance
        
        Returns:
            Credit information as dictionary
        """
        try:
            credit_url = "https://panel.rapiwha.com/get_credit.php"
            
            params = {
                'apikey': self.api_key
            }
            
            response = requests.get(credit_url, params=params)
            
            if response.status_code == 200:
                try:
                    credit_data = response.json()
                    credit_amount = credit_data.get('credit', 0)
                    
                    # Calculate messages (1 credit = 1 message)
                    messages_remaining = int(credit_amount)
                    
                    # Convert to INR only (1 credit = $0.0023, 1 USD = 83 INR)
                    inr_amount = credit_amount * 0.0023 * 83
                    
                    return {
                        "success": True,
                        "credit": credit_amount,
                        "messages_remaining": messages_remaining,
                        "inr_value": round(inr_amount, 2),
                        "message": f"Credit balance: {credit_amount} credits",
                        "api_key_source": "user_config" if hasattr(self, '_user_config') else "env_default"
                    }
                except ValueError:
                    # If response is not JSON, try to extract credit from text
                    response_text = response.text
                    if 'credit' in response_text.lower():
                        # Try to find credit number in response
                        import re
                        credit_match = re.search(r'credit["\']?\s*:\s*(\d+\.?\d*)', response_text, re.IGNORECASE)
                        if credit_match:
                            credit_amount = float(credit_match.group(1))
                            messages_remaining = int(credit_amount)
                            inr_amount = credit_amount * 0.0023 * 83
                            
                            return {
                                "success": True,
                                "credit": credit_amount,
                                "messages_remaining": messages_remaining,
                                "inr_value": round(inr_amount, 2),
                                "message": f"Credit balance: {credit_amount} credits",
                                "api_key_source": "user_config" if hasattr(self, '_user_config') else "env_default"
                            }
                    
                    return {
                        "success": False,
                        "credit": 0,
                        "messages_remaining": 0,
                        "inr_value": 0,
                        "message": f"Could not parse credit response: {response_text}",
                        "api_key_source": "user_config" if hasattr(self, '_user_config') else "env_default"
                    }
            else:
                return {
                    "success": False,
                    "credit": 0,
                    "messages_remaining": 0,
                    "inr_value": 0,
                    "message": f"Failed to get credit. Status: {response.status_code}",
                    "api_key_source": "user_config" if hasattr(self, '_user_config') else "env_default"
                }
                
        except Exception as e:
            return {
                "success": False,
                "credit": 0,
                "messages_remaining": 0,
                "inr_value": 0,
                "message": f"Error getting credit: {str(e)}",
                "api_key_source": "user_config" if hasattr(self, '_user_config') else "env_default"
            } 