import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
]
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_CREDS_JSON', 'google_creds.json')
TEMPLATE_FILE_ID = '19O0JT_SUdrPJR1w8zlBxmYVzh-sjtDZMb5pY2mFUPa0'

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build('drive', 'v3', credentials=creds)
docs_service = build('docs', 'v1', credentials=creds)

def copy_template_and_fill(patient_data):
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
        requests.append({
            "replaceAllText": {
                "containsText": {"text": f"{{{{{key}}}}}", "matchCase": True},
                "replaceText": str(value)
            }
        })
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