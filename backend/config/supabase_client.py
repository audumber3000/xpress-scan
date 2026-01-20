import os

# Check if we're in offline/desktop mode (no Supabase)
OFFLINE_MODE = os.getenv("OFFLINE_MODE", "false").lower() == "true"

# Try to get from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_STORAGE_ACCESS_ID = os.getenv("SUPABASE_STORAGE_ACCESS_ID")
SUPABASE_STORAGE_SECRET_KEY = os.getenv("SUPABASE_STORAGE_SECRET_KEY")

# Only initialize Supabase if not in offline mode and credentials are available
supabase = None
supabase_storage = None

if not OFFLINE_MODE and SUPABASE_URL and SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY:
    try:
        from supabase import create_client, Client
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        supabase_storage = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"Warning: Could not initialize Supabase: {e}")
        OFFLINE_MODE = True
else:
    OFFLINE_MODE = True
    print("Running in OFFLINE MODE - Supabase disabled") 