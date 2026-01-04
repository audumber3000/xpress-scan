import os
from typing import Optional
from firebase_admin import storage, credentials, initialize_app
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
            initialize_app(cred, {
                'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET")
            })
            _firebase_initialized = True
        else:
            # Try to use service account file path
            service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                initialize_app(cred, {
                    'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET")
                })
                _firebase_initialized = True
            else:
                # Use default credentials (for Google Cloud environments)
                initialize_app(credential=None, options={
                    'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET")
                })
                _firebase_initialized = True
    except Exception as e:
        print(f"Warning: Could not initialize Firebase Storage: {e}")
        _firebase_initialized = False

def upload_pdf_to_firebase(file_path: str, filename: str, folder: str = "reports") -> Optional[str]:
    """
    Upload a PDF file to Firebase Storage and return the public URL
    
    Args:
        file_path: Local path to the PDF file
        filename: Name to save the file as in storage
        folder: Folder path in storage (default: "reports")
    
    Returns:
        Public URL of the uploaded file or None if upload failed
    """
    try:
        _initialize_firebase()
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
        if not bucket_name:
            print("FIREBASE_STORAGE_BUCKET not configured")
            return None
        
        bucket = storage.bucket(bucket_name)
        
        # Create the full path in storage
        storage_path = f"{folder}/{filename}"
        blob = bucket.blob(storage_path)
        
        # Set content type
        blob.content_type = "application/pdf"
        
        # Upload the file
        print(f"Uploading {filename} to Firebase Storage...")
        with open(file_path, 'rb') as file:
            blob.upload_from_file(file)
        
        # Make the file publicly accessible
        blob.make_public()
        
        # Get the public URL
        public_url = blob.public_url
        print(f"File uploaded successfully. Public URL: {public_url}")
        
        return public_url
        
    except Exception as e:
        print(f"Error uploading to Firebase Storage: {e}")
        return None

def delete_file_from_firebase(filename: str, folder: str = "reports") -> bool:
    """
    Delete a file from Firebase Storage
    
    Args:
        filename: Name of the file to delete
        folder: Folder path in storage (default: "reports")
    
    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        _initialize_firebase()
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
        if not bucket_name:
            return False
        
        bucket = storage.bucket(bucket_name)
        storage_path = f"{folder}/{filename}"
        blob = bucket.blob(storage_path)
        blob.delete()
        
        return True
    except Exception as e:
        print(f"Error deleting from Firebase Storage: {e}")
        return False

def list_files_in_folder(folder: str = "reports") -> list:
    """
    List all files in a Firebase Storage folder
    
    Args:
        folder: Folder path in storage (default: "reports")
    
    Returns:
        List of file objects
    """
    try:
        _initialize_firebase()
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
        if not bucket_name:
            return []
        
        bucket = storage.bucket(bucket_name)
        blobs = bucket.list_blobs(prefix=f"{folder}/")
        
        return [blob.name for blob in blobs]
    except Exception as e:
        print(f"Error listing files from Firebase Storage: {e}")
        return []

