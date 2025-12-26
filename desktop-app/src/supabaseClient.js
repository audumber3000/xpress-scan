import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://awdlcycjawoawdotzxpe.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZGxjeWNqYXdvYXdkb3R6eHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDcyMjAsImV4cCI6MjA2ODE4MzIyMH0.YourAnonKeyHere";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'clinic_auth_token',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
}); 