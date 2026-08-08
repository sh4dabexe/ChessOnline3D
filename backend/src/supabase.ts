import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

// Service-role client — bypasses RLS. NEVER expose to the browser.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
