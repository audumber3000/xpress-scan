import os
import requests
from supabase_client import supabase_storage, SUPABASE_STORAGE_ACCESS_ID, SUPABASE_STORAGE_SECRET_KEY
from typing import Optional

def upload_pdf_to_supabase(file_path: str, filename: str, bucket_name: str = "xpress-scan-bucket") -> Optional[str]:
    """
    Upload a PDF file to storage and return the public URL
    
    Args:
        file_path: Local path to the PDF file
        filename: Name to save the file as in storage
        bucket_name: Storage bucket name (default: "xpress-scan-bucket")
    
    Returns:
        Public URL of the uploaded file or None if upload failed
    """
    try:
        # Read the file
        with open(file_path, 'rb') as file:
            file_data = file.read()
        
        print(f"Attempting to upload {filename} to Supabase storage...")
        print(f"Supabase URL: {supabase_storage.supabase_url}")
        print(f"Bucket: {bucket_name}")
        
        # Try Supabase storage first
        try:
            response = supabase_storage.storage.from_(bucket_name).upload(
                path=filename,
                file=file_data,
                file_options={"content-type": "application/pdf"}
            )
            
            print(f"Upload response: {response}")
            
            if response:
                # Get the public URL
                public_url = supabase_storage.storage.from_(bucket_name).get_public_url(filename)
                print(f"Public URL: {public_url}")
                return public_url
        except Exception as e:
            print(f"Supabase storage failed: {e}")
            print(f"Error type: {type(e)}")
            print(f"Error details: {str(e)}")
        
        # If Supabase fails, return None instead of placeholder
        print("Supabase upload failed, returning None")
        return None
        
    except Exception as e:
        print(f"Error uploading to storage: {e}")
        return None

def delete_file_from_supabase(filename: str, bucket_name: str = "xpress-scan-bucket") -> bool:
    """
    Delete a file from storage
    
    Args:
        filename: Name of the file to delete
        bucket_name: Storage bucket name (default: "xpress-scan-bucket")
    
    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        response = supabase_storage.storage.from_(bucket_name).remove([filename])
        return True
    except Exception as e:
        print(f"Error deleting from storage: {e}")
        return False

def list_files_in_bucket(bucket_name: str = "xpress-scan-bucket") -> list:
    """
    List all files in a storage bucket
    
    Args:
        bucket_name: Storage bucket name (default: "xpress-scan-bucket")
    
    Returns:
        List of file objects
    """
    try:
        response = supabase_storage.storage.from_(bucket_name).list()
        return response
    except Exception as e:
        print(f"Error listing files from storage: {e}")
        return []

def create_bucket_if_not_exists(bucket_name: str = "xpress-scan-bucket") -> bool:
    """
    Create a storage bucket if it doesn't exist
    
    Args:
        bucket_name: Name of the bucket to create
    
    Returns:
        True if bucket exists or was created successfully, False otherwise
    """
    try:
        # Try to list files to check if bucket exists
        supabase_storage.storage.from_(bucket_name).list()
        return True
    except Exception:
        try:
            # If bucket doesn't exist, create it
            supabase_storage.storage.create_bucket(bucket_name, {"public": True})
            return True
        except Exception as e:
            print(f"Error creating bucket: {e}")
            return False

def get_storage_credentials():
    """
    Get the storage credentials for debugging
    """
    return {
        "access_id": SUPABASE_STORAGE_ACCESS_ID,
        "secret_key": SUPABASE_STORAGE_SECRET_KEY[:10] + "..." if SUPABASE_STORAGE_SECRET_KEY else None
    } 