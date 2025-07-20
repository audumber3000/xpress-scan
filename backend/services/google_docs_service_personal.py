import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from datetime import datetime
import pickle
from bs4 import BeautifulSoup

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
]

TEMPLATE_FILE_ID = '19O0JT_SUdrPJR1w8zlBxmYVzh-sjtDZMb5pY2mFUPa0'

def get_credentials():
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
                'client_secrets.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    return creds

def copy_template_and_fill(patient_data):
    """Copy template and fill with patient data using personal Google account."""
    try:
        # Get credentials
        creds = get_credentials()
        
        # Build services
        drive_service = build('drive', 'v3', credentials=creds)
        docs_service = build('docs', 'v1', credentials=creds)
        
        # 1. Copy the template
        now = datetime.now().strftime('%Y-%m-%d')
        new_title = f"{patient_data['name']}_{patient_data['scan_type']}_{now}"
        copied_file = drive_service.files().copy(
            fileId=TEMPLATE_FILE_ID,
            body={"name": new_title}
        ).execute()
        new_file_id = copied_file['id']
        
        # 2. Replace placeholders in the new doc
        requests = []
        for key, value in patient_data.items():
            # If the field is 'transcript' or 'report', clean HTML to plain text with newlines
            if key in ("transcript", "report"):
                soup = BeautifulSoup(str(value), "html.parser")
                cleaned = soup.get_text(separator="\n")
                value = cleaned
            requests.append({
                "replaceAllText": {
                    "containsText": {"text": f"{{{{{key}}}}}", "matchCase": True},
                    "replaceText": str(value)
                }
            })
        
        if requests:
            docs_service.documents().batchUpdate(
                documentId=new_file_id,
                body={"requests": requests}
            ).execute()
        
        # 3. Share the doc (make public for now)
        drive_service.permissions().create(
            fileId=new_file_id,
            body={"role": "writer", "type": "anyone"},
            fields="id"
        ).execute()
        
        # 4. Return the edit URL
        edit_url = f"https://docs.google.com/document/d/{new_file_id}/edit"
        return edit_url
        
    except Exception as e:
        raise Exception(f"Error creating document: {str(e)}") 

def list_reports_from_folder(folder_name="Radiology Reports"):
    """List all files from a specific Google Drive folder."""
    try:
        # Get credentials
        creds = get_credentials()
        
        # Build Drive service
        drive_service = build('drive', 'v3', credentials=creds)
        
        # First, find the folder by name
        folder_query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        folder_results = drive_service.files().list(
            q=folder_query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        folder_files = folder_results.get('files', [])
        
        if not folder_files:
            # If folder doesn't exist, return empty list
            return []
        
        folder_id = folder_files[0]['id']
        
        # List all files in the folder
        file_query = f"'{folder_id}' in parents and trashed=false"
        file_results = drive_service.files().list(
            q=file_query,
            spaces='drive',
            fields='files(id, name, createdTime, modifiedTime, webViewLink, mimeType)',
            orderBy='createdTime desc'
        ).execute()
        
        files = file_results.get('files', [])
        
        # Format the response
        formatted_files = []
        for file in files:
            formatted_files.append({
                'id': file['id'],
                'name': file['name'],
                'createdTime': file['createdTime'],
                'modifiedTime': file['modifiedTime'],
                'webViewLink': file['webViewLink'],
                'mimeType': file['mimeType']
            })
        
        return formatted_files
        
    except Exception as e:
        raise Exception(f"Error listing files from folder: {str(e)}") 