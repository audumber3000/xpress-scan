import os
from typing import Optional, Dict, Any
from firebase_admin import auth, credentials, initialize_app
from firebase_admin.exceptions import FirebaseError

# Initialize Firebase Admin SDK if not already initialized
_firebase_initialized = False

def _initialize_firebase():
    """Initialize Firebase Admin SDK if not already initialized"""
    global _firebase_initialized
    
    if _firebase_initialized:
        return
    
    try:
        # Check if Firebase is already initialized by trying to get the default app
        from firebase_admin import _apps
        if len(_apps) > 0:
            _firebase_initialized = True
            return
    except:
        pass
    
    # Initialize Firebase Admin SDK
    try:
        # Try to use service account from environment variable (JSON string)
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_json:
            import json
            cred = credentials.Certificate(json.loads(service_account_json))
            initialize_app(cred)
            _firebase_initialized = True
        else:
            # Try to use service account file path
            service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                initialize_app(cred)
                _firebase_initialized = True
            else:
                # Use default credentials (for Google Cloud environments)
                initialize_app(credential=None)
                _firebase_initialized = True
    except Exception as e:
        print(f"Warning: Could not initialize Firebase Auth: {e}")
        _firebase_initialized = False

def verify_firebase_token(id_token: str) -> Optional[Dict[str, Any]]:
    """
    Verify a Firebase ID token and return the decoded token
    
    Args:
        id_token: Firebase ID token from client
    
    Returns:
        Decoded token with user info or None if invalid
    """
    try:
        _initialize_firebase()
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        print(f"Error verifying Firebase token: {e}")
        return None

def get_firebase_user(uid: str) -> Optional[Dict[str, Any]]:
    """
    Get Firebase user by UID
    
    Args:
        uid: Firebase user UID
    
    Returns:
        User record or None if not found
    """
    try:
        _initialize_firebase()
        user_record = auth.get_user(uid)
        return {
            "uid": user_record.uid,
            "email": user_record.email,
            "email_verified": user_record.email_verified,
            "display_name": user_record.display_name,
            "photo_url": user_record.photo_url,
            "disabled": user_record.disabled,
            "metadata": {
                "creation_timestamp": user_record.user_metadata.creation_timestamp if hasattr(user_record, 'user_metadata') else None,
                "last_sign_in_timestamp": user_record.user_metadata.last_sign_in_timestamp if hasattr(user_record, 'user_metadata') else None,
            }
        }
    except Exception as e:
        print(f"Error getting Firebase user: {e}")
        return None

def create_firebase_user(email: str, password: str, display_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Create a new Firebase user
    
    Args:
        email: User email
        password: User password
        display_name: Optional display name
    
    Returns:
        Created user record or None if creation failed
    """
    try:
        _initialize_firebase()
        user_record = auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
            email_verified=False
        )
        return {
            "uid": user_record.uid,
            "email": user_record.email,
            "display_name": user_record.display_name
        }
    except Exception as e:
        print(f"Error creating Firebase user: {e}")
        return None

def delete_firebase_user(uid: str) -> bool:
    """
    Delete a Firebase user
    
    Args:
        uid: Firebase user UID
    
    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        _initialize_firebase()
        auth.delete_user(uid)
        return True
    except Exception as e:
        print(f"Error deleting Firebase user: {e}")
        return False

