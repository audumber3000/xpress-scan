import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_FILE = 'google_creds.json'

def check_drive_usage():
    try:
        # Load credentials
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES
        )
        
        # Build Drive service
        drive_service = build('drive', 'v3', credentials=creds)
        
        # Get about info (includes storage quota)
        about = drive_service.about().get(fields="storageQuota").execute()
        storage_quota = about.get('storageQuota', {})
        
        print("=== Drive Storage Information ===")
        print(f"Total: {storage_quota.get('limit', 'Unknown')} bytes")
        print(f"Used: {storage_quota.get('usage', 'Unknown')} bytes")
        print(f"Available: {storage_quota.get('usageInDrive', 'Unknown')} bytes")
        
        # List files (first 10)
        print("\n=== Files in Drive (first 10) ===")
        results = drive_service.files().list(
            pageSize=10, 
            fields="nextPageToken, files(id, name, size, createdTime)"
        ).execute()
        
        files = results.get('files', [])
        if not files:
            print("No files found in Drive.")
        else:
            for file in files:
                size = file.get('size', 'Unknown')
                print(f"Name: {file['name']}")
                print(f"ID: {file['id']}")
                print(f"Size: {size} bytes")
                print(f"Created: {file['createdTime']}")
                print("---")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_drive_usage() 