import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️  VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set in frontend/.env\n' +
    '   Realtime features (move sync, chat) will not work until these are configured.'
  );
}

// Anon key only — used for Realtime subscriptions only (read-only).
// All database mutations go through the Express backend.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder_anon_key'
);
