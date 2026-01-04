import os
from typing import Optional
# Import R2 storage functions
from services.r2_storage import upload_pdf_to_r2

# Legacy function name for backward compatibility - now uses Cloudflare R2
def upload_pdf_to_supabase(file_path: str, filename: str, bucket_name: str = "xpress-scan-bucket") -> Optional[str]:
    """
    Upload a PDF file to storage and return the public URL
    Legacy function - now uses Cloudflare R2 Storage
    
    Args:
        file_path: Local path to the PDF file
        filename: Name to save the file as in storage
        bucket_name: Storage bucket name (ignored, kept for compatibility)
    
    Returns:
        Public URL of the uploaded file or None if upload failed
    """
    # Use R2 Storage instead - upload to patient-medical-reports folder
    return upload_pdf_to_r2(file_path, filename, folder="patient-medical-reports")

def delete_file_from_supabase(filename: str, bucket_name: str = "xpress-scan-bucket") -> bool:
    """
    Delete a file from storage
    Legacy function - now uses Cloudflare R2 Storage
    
    Args:
        filename: Name of the file to delete
        bucket_name: Storage bucket name (ignored, kept for compatibility)
    
    Returns:
        True if deletion was successful, False otherwise
    """
    from services.r2_storage import delete_file_from_r2
    return delete_file_from_r2(filename, folder="patient-medical-reports")

def list_files_in_bucket(bucket_name: str = "xpress-scan-bucket") -> list:
    """
    List all files in a storage bucket
    Legacy function - now uses Cloudflare R2 Storage
    
    Args:
        bucket_name: Storage bucket name (ignored, kept for compatibility)
    
    Returns:
        List of file objects
    """
    from services.r2_storage import list_files_in_folder
    return list_files_in_folder(folder="patient-medical-reports")

def create_bucket_if_not_exists(bucket_name: str = "xpress-scan-bucket") -> bool:
    """
    Create a storage bucket if it doesn't exist
    Legacy function - R2 buckets are created via Cloudflare Dashboard
    
    Args:
        bucket_name: Name of the bucket (uses env var if not provided)
    
    Returns:
        True if bucket exists, False otherwise
    """
    from services.r2_storage import create_bucket_if_not_exists as r2_create_bucket
    return r2_create_bucket(bucket_name)

def get_storage_credentials():
    """
    Get the storage credentials for debugging
    """
    return {
        "storage_type": "cloudflare_r2",
        "bucket": os.getenv("R2_BUCKET_NAME", "Not configured"),
        "endpoint": os.getenv("R2_ENDPOINT_URL", "Not configured")
    } 