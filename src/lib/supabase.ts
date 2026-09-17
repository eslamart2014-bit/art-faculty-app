import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zyjwxzkxkwkkpfdipmoc.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_icyal0PmeqMePWyzT9QJuA_mqezDg3f';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Client for browser / client-side components
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for secure server-side API routes (bypasses RLS)
// Safely created ONLY in server runtime when service key is provided; otherwise fall back to standard client
export const supabaseAdmin = (typeof window === 'undefined' && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

