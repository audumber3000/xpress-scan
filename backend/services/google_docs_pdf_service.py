import io
import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from supabase_client import supabase
from typing import Optional
import pickle

class GoogleDocsPDFService:
    def __init__(self):
        self.credentials = self.get_credentials()
        self.drive_service = build('drive', 'v3', credentials=self.credentials)
    
    def get_credentials(self):
        """Get or refresh Google credentials for personal account."""
        creds = None
        
        # The file token.pickle stores the user's access and refresh tokens
        if os.path.exists('token.pickle'):
            with open('token.pickle', 'rb') as token:
                creds = pickle.load(token)
        
        # If there are no (valid) credentials available, let the user log in
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                # You'll need to create a client_secrets.json file from Google Cloud Console
                # Go to APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client IDs
                # Download as JSON and save as client_secrets.json
                if not os.path.exists('client_secrets.json'):
                    raise Exception("Please create client_secrets.json from Google Cloud Console OAuth 2.0 credentials")
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    'client_secrets.json', ['https://www.googleapis.com/auth/drive.readonly'])
                creds = flow.run_local_server(port=0)
            
            # Save the credentials for the next run
            with open('token.pickle', 'wb') as token:
                pickle.dump(creds, token)
        
        return creds
    
    def create_public_bucket(self, bucket_name: str = "xpress-scan-bucket"):
        """Create a public bucket in Supabase storage"""
        try:
            # Check if bucket already exists
            try:
                supabase.storage.get_bucket(bucket_name)
                print(f"Bucket {bucket_name} already exists")
                return True
            except:
                pass
            
            # Create bucket with public access
            response = supabase.storage.create_bucket(
                bucket_name,
                options={
                    "public": True,  # Make bucket public
                    "allowedMimeTypes": ["application/pdf"],  # Allow PDF files
                    "fileSizeLimit": 52428800
                }
            )
            
            if response:
                print(f"Successfully created public bucket: {bucket_name}")
                
                # Set bucket policy for public read access
                try:
                    # This creates a policy that allows public read access
                    policy = {
                        "public": True,
                        "allowedMimeTypes": ["application/pdf"],
                        "fileSizeLimit": 52428800
                    }
                    supabase.storage.update_bucket(bucket_name, policy)
                    print(f"Set public access policy for bucket: {bucket_name}")
                except Exception as e:
                    print(f"Warning: Could not set bucket policy: {e}")
                
                return True      
            return False
            
        except Exception as e:
            print(f"Error creating bucket {bucket_name}: {e}")
            return False   
    def export_doc_as_pdf(self, doc_id: str) -> Optional[bytes]:
        """
        Export Google Docs document as PDF in memory
        
        Args:
            doc_id: Google Docs document ID
            
        Returns:
            PDF content as bytes or None if failed
        """
        try:
            # Export the document as PDF
            request = self.drive_service.files().export_media(
                fileId=doc_id,
                mimeType='application/pdf'
            )
            
            # Download to memory
            file = io.BytesIO()
            downloader = MediaIoBaseDownload(file, request)
            
            done = False
            while done is False:
                status, done = downloader.next_chunk()
                print(f"Download {int(status.progress() * 100)}%")
            
            file.seek(0)
            return file.getvalue()
            
        except Exception as e:
            print(f"Error exporting Google Doc as PDF: {e}")
            return None
    
    def upload_pdf_to_supabase(self, pdf_content: bytes, filename: str, bucket_name: str = "xpress-scan-bucket") -> Optional[str]:
        """
        Upload PDF content to Supabase storage
        
        Args:
            pdf_content: PDF content as bytes
            filename: Name to save the file as
            bucket_name: Supabase bucket name
            
        Returns:
            Public URL of uploaded file or None if failed
        """
        try:
            # Ensure bucket exists with public access
            self.create_public_bucket(bucket_name)
            
            # Upload to Supabase storage
            response = supabase.storage.from_(bucket_name).upload(
                path=filename,
                file=pdf_content,
                file_options={"content-type": "application/pdf"}
            )
            
            if response:
                # Get the public URL
                public_url = supabase.storage.from_(bucket_name).get_public_url(filename)
                print(f"File uploaded successfully. Public URL: {public_url}")
                return public_url
            
            return None
            
        except Exception as e:
            print(f"Error uploading PDF to Supabase: {e}")
            return None
    
    def get_doc_title(self, doc_id: str) -> Optional[str]:
        """
        Get the title of a Google Docs document
        
        Args:
            doc_id: Google Docs document ID
            
        Returns:
            Document title or None if failed
        """
        try:
            file_metadata = self.drive_service.files().get(fileId=doc_id).execute()
            return file_metadata.get('name', 'Unknown Document')
        except Exception as e:
            print(f"Error getting document title: {e}")
            return None 