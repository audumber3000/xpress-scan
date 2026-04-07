import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional
import urllib.parse

# Initialize R2 client
_r2_client = None

def _get_r2_client():
    """Initialize and return R2 S3 client"""
    global _r2_client
    
    if _r2_client is not None:
        return _r2_client
    
    # Get R2 credentials from environment
    access_key_id = os.getenv("R2_ACCESS_KEY_ID")
    secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("R2_BUCKET_NAME")
    endpoint_url = os.getenv("R2_ENDPOINT_URL")  # R2 endpoint (required)
    
    if not all([access_key_id, secret_access_key, bucket_name, endpoint_url]):
        print("Warning: R2 credentials not fully configured")
        print(f"Missing: access_key_id={bool(access_key_id)}, secret_access_key={bool(secret_access_key)}, bucket_name={bool(bucket_name)}, endpoint_url={bool(endpoint_url)}")
        return None
    
    # Create S3 client with R2 configuration
    _r2_client = boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name='auto',  # R2 uses 'auto' as region
        config=Config(signature_version='s3v4')
    )
    
    return _r2_client


class StorageCategory:
    CONSENTS = "consents"
    MEDICAL_REPORTS = "medical-reports"
    INVOICES = "invoices"
    DOCUMENTS = "documents"
    WHATSAPP_MEDIA = "whatsapp-media"
    EXPENSES = "expenses"
    STAFF = "staff"

def get_r2_path(clinic_id: int, patient_id: Optional[int] = None, category: str = StorageCategory.DOCUMENTS, filename: str = "") -> str:
    """
    Generate a standardized R2 storage path
    Hierarchy: clinics/{clinic_id}/[patients/{patient_id}/]{category}/{filename}
    """
    if patient_id:
        base = f"clinics/{clinic_id}/patients/{patient_id}/{category}"
    else:
        # Clinic level documents (finance, staff, etc)
        if category == StorageCategory.EXPENSES:
            base = f"clinics/{clinic_id}/finance/expenses"
        elif category == StorageCategory.STAFF:
            base = f"clinics/{clinic_id}/staff/documents"
        else:
            base = f"clinics/{clinic_id}/{category}"
            
    return f"{base}/{filename}" if filename else base

def get_presigned_url(key_or_url: str, expires_in: int = 604800) -> Optional[str]:
    """Generate a presigned GET URL for an R2 object (key or full API URL)"""
    if not key_or_url: return None
    
    try:
        client = _get_r2_client()
        if not client: return key_or_url
        
        bucket_name = os.getenv("R2_BUCKET_NAME")
        r2_public_url = os.getenv("R2_PUBLIC_URL")
        
        # If it's already a public URL, just return it
        if r2_public_url and key_or_url.startswith(r2_public_url):
            return key_or_url
            
        # Extract key if it's a full R2 API URL
        key = key_or_url
        if "cloudflarestorage.com" in key_or_url:
            parsed = urllib.parse.urlparse(key_or_url)
            path_parts = parsed.path.lstrip('/').split('/')
            if len(path_parts) > 1:
                # Format: /bucket/key/path/to/file
                key = "/".join(path_parts[1:])
        
        # If bucket name is already in the key (legacy), remove it
        if bucket_name and key.startswith(f"{bucket_name}/"):
            key = key[len(bucket_name)+1:]

        if r2_public_url:
            return f"{r2_public_url.rstrip('/')}/{key}"
            
        return client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': key},
            ExpiresIn=expires_in
        )
    except Exception as e:
        print(f"Error generating presigned URL: {e}")
        return key_or_url

def upload_pdf_to_r2(file_path: str, filename: str, clinic_id: Optional[int] = None, patient_id: Optional[int] = None, category: str = StorageCategory.MEDICAL_REPORTS) -> Optional[str]:
    """
    Upload a PDF file to Cloudflare R2 and return the relative storage path (key)
    """
    try:
        client = _get_r2_client()
        if not client:
            return None
        
        bucket_name = os.getenv("R2_BUCKET_NAME")
        
        # Resolve storage path
        if clinic_id:
            storage_path = get_r2_path(clinic_id, patient_id, category, filename)
        else:
            storage_path = f"legacy/{category}/{filename}"
        
        print(f"Uploading {filename} to R2: {storage_path}")
        with open(file_path, 'rb') as file:
            client.upload_fileobj(
                file,
                bucket_name,
                storage_path,
                ExtraArgs={'ContentType': 'application/pdf'}
            )
        
        # Return the relative path (key)
        return storage_path
            
    except Exception as e:
        print(f"Error uploading to R2: {e}")
        return None

def upload_bytes_to_r2(data: bytes, filename: str, content_type: str, clinic_id: Optional[int] = None, patient_id: Optional[int] = None, category: str = StorageCategory.DOCUMENTS) -> Optional[str]:
    """
    Upload bytes to Cloudflare R2 and return the relative storage path (key)
    """
    try:
        client = _get_r2_client()
        if not client:
            return None
        
        bucket_name = os.getenv("R2_BUCKET_NAME")
        
        if clinic_id:
            storage_path = get_r2_path(clinic_id, patient_id, category, filename)
        else:
            storage_path = f"legacy/{category}/{filename}"
            
        client.put_object(
            Body=data,
            Bucket=bucket_name,
            Key=storage_path,
            ContentType=content_type
        )
        
        # Return the relative path (key)
        return storage_path
            
    except Exception as e:
        print(f"Error uploading bytes to R2: {e}")
        return None

def delete_file_from_r2(storage_path: str) -> bool:
    """Delete a file from Cloudflare R2 using its full storage path"""
    try:
        client = _get_r2_client()
        if not client: return False
        client.delete_object(Bucket=os.getenv("R2_BUCKET_NAME"), Key=storage_path)
        return True
    except Exception as e:
        print(f"Error deleting from R2: {e}")
        return False

def list_files_in_prefix(prefix: str) -> list:
    """List files in R2 by prefix"""
    try:
        client = _get_r2_client()
        if not client: return []
        response = client.list_objects_v2(Bucket=os.getenv("R2_BUCKET_NAME"), Prefix=prefix)
        return [obj['Key'] for obj in response.get('Contents', [])]
    except Exception as e:
        print(f"Error listing R2 files: {e}")
        return []

def create_bucket_if_not_exists(bucket_name: str = None) -> bool:
    """Placeholder for bucket existence check"""
    try:
        client = _get_r2_client()
        if not client: return False
        if not bucket_name: bucket_name = os.getenv("R2_BUCKET_NAME")
        client.head_bucket(Bucket=bucket_name)
        return True
    except Exception:
        return False

