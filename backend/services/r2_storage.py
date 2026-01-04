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

def upload_pdf_to_r2(file_path: str, filename: str, folder: str = "reports") -> Optional[str]:
    """
    Upload a PDF file to Cloudflare R2 and return the public URL
    
    Args:
        file_path: Local path to the PDF file
        filename: Name to save the file as in storage
        folder: Folder path in storage (default: "reports")
    
    Returns:
        Public URL of the uploaded file or None if upload failed
    """
    try:
        client = _get_r2_client()
        if not client:
            print("R2 client not initialized")
            return None
        
        bucket_name = os.getenv("R2_BUCKET_NAME")
        r2_public_url = os.getenv("R2_PUBLIC_URL")  # Custom domain or public URL
        
        # Create the full path in storage
        storage_path = f"{folder}/{filename}"
        
        # Upload the file
        print(f"Uploading {filename} to R2 Storage...")
        with open(file_path, 'rb') as file:
            client.upload_fileobj(
                file,
                bucket_name,
                storage_path,
                ExtraArgs={
                    'ContentType': 'application/pdf'
                }
            )
        
        # Generate public URL
        if r2_public_url:
            # Use custom domain if configured
            public_url = f"{r2_public_url.rstrip('/')}/{storage_path}"
        else:
            # Generate a presigned URL (valid for 7 days by default)
            # R2 doesn't provide direct public URLs without a custom domain
            public_url = client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': storage_path},
                ExpiresIn=604800  # 7 days
            )
        
        print(f"File uploaded successfully. Public URL: {public_url}")
        return public_url
        
    except ClientError as e:
        print(f"Error uploading to R2 Storage: {e}")
        return None
    except Exception as e:
        print(f"Error uploading to R2 Storage: {e}")
        return None

def delete_file_from_r2(filename: str, folder: str = "reports") -> bool:
    """
    Delete a file from Cloudflare R2
    
    Args:
        filename: Name of the file to delete
        folder: Folder path in storage (default: "reports")
    
    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        client = _get_r2_client()
        if not client:
            return False
        
        bucket_name = os.getenv("R2_BUCKET_NAME")
        storage_path = f"{folder}/{filename}"
        
        client.delete_object(Bucket=bucket_name, Key=storage_path)
        return True
    except ClientError as e:
        print(f"Error deleting from R2 Storage: {e}")
        return False
    except Exception as e:
        print(f"Error deleting from R2 Storage: {e}")
        return False

def list_files_in_folder(folder: str = "reports") -> list:
    """
    List all files in an R2 folder
    
    Args:
        folder: Folder path in storage (default: "reports")
    
    Returns:
        List of file names
    """
    try:
        client = _get_r2_client()
        if not client:
            return []
        
        bucket_name = os.getenv("R2_BUCKET_NAME")
        prefix = f"{folder}/"
        
        response = client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
        
        if 'Contents' in response:
            return [obj['Key'] for obj in response['Contents']]
        return []
    except ClientError as e:
        print(f"Error listing files from R2 Storage: {e}")
        return []
    except Exception as e:
        print(f"Error listing files from R2 Storage: {e}")
        return []

def create_bucket_if_not_exists(bucket_name: str = None) -> bool:
    """
    Create an R2 bucket if it doesn't exist
    Note: R2 buckets are typically created via Cloudflare dashboard
    
    Args:
        bucket_name: Name of the bucket (optional, uses env var if not provided)
    
    Returns:
        True if bucket exists or was created successfully, False otherwise
    """
    try:
        client = _get_r2_client()
        if not client:
            return False
        
        if not bucket_name:
            bucket_name = os.getenv("R2_BUCKET_NAME")
        
        if not bucket_name:
            return False
        
        # Try to access the bucket
        client.head_bucket(Bucket=bucket_name)
        return True
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code == '404':
            # Bucket doesn't exist, but we can't create it via API
            print(f"Bucket {bucket_name} does not exist. Please create it via Cloudflare dashboard.")
            return False
        print(f"Error checking R2 bucket: {e}")
        return False
    except Exception as e:
        print(f"Error checking R2 bucket: {e}")
        return False

