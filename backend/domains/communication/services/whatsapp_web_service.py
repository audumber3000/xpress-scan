"""
WhatsApp Web Service using Playwright
Handles WhatsApp Web automation for sending messages
"""
import asyncio
import base64
import os
from typing import Optional, Dict
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, TimeoutError as PlaywrightTimeoutError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WhatsAppWebService:
    """WhatsApp Web automation service using Playwright"""
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.status = "disconnected"
        self.qr_code: Optional[str] = None
        self.phone_number: Optional[str] = None
        self.error_message: Optional[str] = None
        self._initialized = False
        
    async def initialize(self) -> Dict:
        """Initialize WhatsApp Web session"""
        try:
            self.status = "connecting"
            self.error_message = None
            
            logger.info(f"Initializing WhatsApp Web for user {self.user_id}")
            
            # Start Playwright
            self.playwright = await async_playwright().start()
            
            # Create user data directory for persistence
            user_data_dir = os.path.join(
                os.path.expanduser("~"),
                ".whatsapp-web",
                f"user-{self.user_id}"
            )
            os.makedirs(user_data_dir, exist_ok=True)
            
            # Use launch_persistent_context for session persistence
            # This method combines browser launch and context creation
            self.context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=True,
                viewport={'width': 1280, 'height': 720},
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            )
            
            # Get the first page from persistent context (it creates one automatically)
            pages = self.context.pages
            if pages:
                self.page = pages[0]
            else:
                self.page = await self.context.new_page()
            
            # Note: self.browser is None when using launch_persistent_context
            self.browser = None
            
            # Navigate to WhatsApp Web
            logger.info("Navigating to WhatsApp Web...")
            try:
                await self.page.goto('https://web.whatsapp.com', wait_until='domcontentloaded', timeout=90000)
            except Exception as e:
                logger.warning(f"Initial navigation timeout, trying with networkidle: {str(e)}")
                await self.page.goto('https://web.whatsapp.com', wait_until='load', timeout=90000)
            
            # Wait for page to fully load
            logger.info("Waiting for page to load...")
            await asyncio.sleep(5)
            
            # Check if already logged in (look for chat list)
            try:
                await self.page.wait_for_selector('div[data-testid="chatlist"]', timeout=5000)
                logger.info("Already logged in to WhatsApp Web")
                self.status = "ready"
                self._initialized = True
                
                # Try to get phone number
                try:
                    # Click on profile to get phone number
                    profile_button = await self.page.query_selector('span[data-testid="default-user"]')
                    if profile_button:
                        await profile_button.click()
                        await asyncio.sleep(1)
                        # Try to extract phone number from profile
                        phone_element = await self.page.query_selector('span[title]')
                        if phone_element:
                            title = await phone_element.get_attribute('title')
                            if title:
                                self.phone_number = title
                except:
                    pass
                
                return {
                    "status": "ready",
                    "phone_number": self.phone_number,
                    "message": "WhatsApp Web is ready"
                }
            except PlaywrightTimeoutError:
                # Not logged in, need QR code
                logger.info("Not logged in, waiting for QR code...")
                return await self._get_qr_code()
                
        except Exception as e:
            error_msg = f"Error initializing WhatsApp Web: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.status = "error"
            self.error_message = error_msg
            await self._cleanup()
            return {
                "status": "error",
                "error": error_msg
            }
    
    async def _get_qr_code(self) -> Dict:
        """Extract QR code from WhatsApp Web"""
        try:
            # Wait for QR code canvas to appear with longer timeout
            logger.info("Waiting for QR code canvas...")
            
            # Try multiple selectors for QR code
            qr_selectors = [
                'canvas',
                'div[data-ref] canvas',
                'div[role="button"] canvas',
                'canvas[aria-label*="QR"]'
            ]
            
            canvas = None
            for selector in qr_selectors:
                try:
                    logger.info(f"Trying selector: {selector}")
                    await self.page.wait_for_selector(selector, timeout=15000)
                    canvas = await self.page.query_selector(selector)
                    if canvas:
                        logger.info(f"Found canvas with selector: {selector}")
                        break
                except PlaywrightTimeoutError:
                    continue
            
            if not canvas:
                # Try to find any canvas on the page
                logger.info("Trying to find any canvas element...")
                await asyncio.sleep(3)  # Wait a bit more
                canvas = await self.page.query_selector('canvas')
            
            if not canvas:
                # Check if page loaded correctly
                page_title = await self.page.title()
                logger.info(f"Page title: {page_title}")
                
                # Take a screenshot for debugging
                try:
                    screenshot = await self.page.screenshot()
                    logger.info(f"Page screenshot taken, size: {len(screenshot)} bytes")
                except:
                    pass
                
                # Try waiting a bit more and retry
                logger.info("Waiting additional 5 seconds and retrying...")
                await asyncio.sleep(5)
                canvas = await self.page.query_selector('canvas')
            
            if not canvas:
                raise Exception("QR code canvas not found after multiple attempts. WhatsApp Web may be blocking automated access or taking longer to load.")
            
            # Wait a bit for QR code to fully render
            logger.info("Waiting for QR code to render...")
            await asyncio.sleep(3)
            
            # Take screenshot of QR code
            qr_screenshot = await canvas.screenshot()
            
            # Verify screenshot is not empty
            if len(qr_screenshot) < 100:
                raise Exception("QR code screenshot is too small, may not be rendered yet")
            
            # Convert to base64
            qr_base64 = base64.b64encode(qr_screenshot).decode()
            self.qr_code = f"data:image/png;base64,{qr_base64}"
            self.status = "qr_ready"
            
            logger.info("QR code generated successfully")
            return {
                "status": "qr_ready",
                "qr_code": self.qr_code,
                "message": "Scan QR code with your phone"
            }
        except PlaywrightTimeoutError:
            error_msg = "QR code timeout - WhatsApp Web is taking longer than expected to load. Please try again."
            logger.error(error_msg)
            self.status = "error"
            self.error_message = error_msg
            return {
                "status": "error",
                "error": error_msg
            }
        except Exception as e:
            error_msg = f"Error getting QR code: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.status = "error"
            self.error_message = error_msg
            return {
                "status": "error",
                "error": error_msg
            }
    
    async def wait_for_ready(self, timeout: int = 120) -> Dict:
        """Wait for WhatsApp to be ready (after QR scan)"""
        try:
            logger.info(f"Waiting for WhatsApp to be ready (timeout: {timeout}s)...")
            
            # Wait for chat list to appear (indicates logged in)
            await self.page.wait_for_selector('div[data-testid="chatlist"]', timeout=timeout * 1000)
            
            self.status = "ready"
            self._initialized = True
            self.qr_code = None
            
            # Try to get phone number
            try:
                profile_button = await self.page.query_selector('span[data-testid="default-user"]')
                if profile_button:
                    await profile_button.click()
                    await asyncio.sleep(1)
                    phone_element = await self.page.query_selector('span[title]')
                    if phone_element:
                        title = await phone_element.get_attribute('title')
                        if title:
                            self.phone_number = title
            except:
                pass
            
            logger.info("WhatsApp is ready!")
            return {
                "status": "ready",
                "phone_number": self.phone_number,
                "message": "WhatsApp Web is ready"
            }
        except PlaywrightTimeoutError:
            error_msg = f"Timeout waiting for WhatsApp to be ready after {timeout} seconds"
            logger.error(error_msg)
            self.status = "error"
            self.error_message = error_msg
            return {
                "status": "error",
                "error": error_msg
            }
        except Exception as e:
            error_msg = f"Error waiting for ready: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.status = "error"
            self.error_message = error_msg
            return {
                "status": "error",
                "error": error_msg
            }
    
    async def send_message(self, phone_number: str, message: str) -> Dict:
        """Send message automatically"""
        try:
            if not self._initialized or self.status != "ready":
                # Try to wait for ready first
                ready_result = await self.wait_for_ready(timeout=10)
                if ready_result.get("status") != "ready":
                    return {
                        "success": False,
                        "error": "WhatsApp is not ready. Please scan QR code first."
                    }
            
            logger.info(f"Sending message to {phone_number}")
            
            # Clean phone number (remove all non-digits)
            clean_phone = ''.join(filter(str.isdigit, phone_number))
            
            # Navigate to chat URL with pre-filled message
            chat_url = f"https://web.whatsapp.com/send?phone={clean_phone}&text={message}"
            await self.page.goto(chat_url, wait_until='networkidle', timeout=30000)
            
            # Wait for page to load
            await asyncio.sleep(3)
            
            # Wait for send button to appear
            try:
                # Try multiple selectors for send button
                send_selectors = [
                    'button[data-testid="send"]',
                    'span[data-icon="send"]',
                    'button[aria-label*="Send"]',
                    'div[role="button"][aria-label*="Send"]'
                ]
                
                send_button = None
                for selector in send_selectors:
                    try:
                        send_button = await self.page.wait_for_selector(selector, timeout=5000)
                        if send_button:
                            break
                    except:
                        continue
                
                if not send_button:
                    # Try to find any button with send icon
                    send_button = await self.page.query_selector('button span[data-icon="send"]')
                    if send_button:
                        send_button = await send_button.evaluate_handle('el => el.closest("button")')
                
                if not send_button:
                    raise Exception("Send button not found")
                
                # Click send button
                await send_button.click()
                await asyncio.sleep(2)
                
                logger.info("Message sent successfully")
                return {
                    "success": True,
                    "message": f"Message sent to {phone_number} successfully",
                    "phone_number": phone_number
                }
            except PlaywrightTimeoutError:
                error_msg = "Timeout waiting for send button. The phone number may be invalid or WhatsApp Web is slow."
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg
                }
            except Exception as e:
                error_msg = f"Error clicking send button: {str(e)}"
                logger.error(error_msg, exc_info=True)
                return {
                    "success": False,
                    "error": error_msg
                }
                
        except Exception as e:
            error_msg = f"Error sending message: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {
                "success": False,
                "error": error_msg
            }
    
    def get_status(self) -> Dict:
        """Get current status"""
        return {
            "status": self.status,
            "qr_code": self.qr_code if self.status == "qr_ready" else None,
            "phone_number": self.phone_number,
            "error": self.error_message
        }
    
    async def disconnect(self) -> Dict:
        """Disconnect and cleanup"""
        try:
            await self._cleanup()
            self.status = "disconnected"
            self.qr_code = None
            self.phone_number = None
            self.error_message = None
            self._initialized = False
            return {"success": True, "message": "Disconnected successfully"}
        except Exception as e:
            error_msg = f"Error disconnecting: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {"success": False, "error": error_msg}
    
    async def _cleanup(self):
        """Clean up resources"""
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            # Note: browser is not separate when using launch_persistent_context
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
        finally:
            self.page = None
            self.context = None
            self.browser = None  # Not used with launch_persistent_context
            self.playwright = None

