from supabase import create_client, Client
import os

# Try to get from environment variables first, then use provided credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://awdlcycjawoawdotzxpe.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZGxjeWNqYXdvYXdkb3R6eHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDcyMjAsImV4cCI6MjA2ODE4MzIyMH0.YourAnonKeyHere")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZGxjeWNqYXdvYXdkb3R6eHBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjYwNzIyMCwiZXhwIjoyMDY4MTgzMjIwfQ.vXduVnvFU1RC_5Er_mpdUy-sBuq9YhzIU-X3hJSaLeY")

# Storage credentials provided by user
SUPABASE_STORAGE_ACCESS_ID = os.getenv("SUPABASE_STORAGE_ACCESS_ID", "22c2043bad05df89586a2d22999a5029")
SUPABASE_STORAGE_SECRET_KEY = os.getenv("SUPABASE_STORAGE_SECRET_KEY", "ece7a85824401fb440040d73e1d77694627478735629aff97325d5f0117c9227")

# Use anon key for OAuth verification
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY) 