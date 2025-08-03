from supabase import create_client, Client
import os

# Try to get from environment variables first, then use provided credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Storage credentials provided by user
SUPABASE_STORAGE_ACCESS_ID = os.getenv("SUPABASE_STORAGE_ACCESS_ID")
SUPABASE_STORAGE_SECRET_KEY = os.getenv("SUPABASE_STORAGE_SECRET_KEY")

# Validate required environment variables
if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_KEY:
    raise ValueError("Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY")

if not SUPABASE_STORAGE_ACCESS_ID or not SUPABASE_STORAGE_SECRET_KEY:
    raise ValueError("Missing required Supabase storage environment variables: SUPABASE_STORAGE_ACCESS_ID, SUPABASE_STORAGE_SECRET_KEY")

# Use anon key for OAuth verification
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Use service key for storage operations
supabase_storage: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) 