import os
import boto3
from botocore.config import Config
from typing import Optional

class StorageService:
    @staticmethod
    def _get_client():
        access_key_id = os.getenv("R2_ACCESS_KEY_ID")
        secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
        endpoint_url = os.getenv("R2_ENDPOINT_URL")
        
        if not all([access_key_id, secret_access_key, endpoint_url]):
            return None
            
        return boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name='auto',
            config=Config(signature_version='s3v4')
        )

    @staticmethod
    def upload_consent_pdf(file_path: str, filename: str, clinic_id: int, patient_id: int) -> Optional[str]:
        """
        Uploads a consent PDF to R2 and returns the key.
        """
        client = StorageService._get_client()
        if not client:
            return None
            
        bucket_name = os.getenv("R2_BUCKET_NAME")
        storage_path = f"clinics/{clinic_id}/patients/{patient_id}/consents/{filename}"
        
        try:
            with open(file_path, 'rb') as data:
                client.put_object(
                    Bucket=bucket_name,
                    Key=storage_path,
                    Body=data,
                    ContentType='application/pdf'
                )
            return storage_path
        except Exception as e:
            print(f"Nexus Storage Error: {str(e)}")
            return None

    @staticmethod
    def upload_report_pdf(file_path: str, filename: str, clinic_id: int) -> Optional[str]:
        """
        Uploads a dashboard report PDF to R2 and returns the key.
        """
        client = StorageService._get_client()
        if not client:
            return None
            
        bucket_name = os.getenv("R2_BUCKET_NAME")
        storage_path = f"clinics/{clinic_id}/reports/dashboard/{filename}"
        
        try:
            with open(file_path, 'rb') as data:
                client.put_object(
                    Bucket=bucket_name,
                    Key=storage_path,
                    Body=data,
                    ContentType='application/pdf'
                )
            return storage_path
        except Exception as e:
            print(f"Nexus Report Storage Error: {str(e)}")
            return None
