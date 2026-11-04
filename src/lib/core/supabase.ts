import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zyjwxzkxkwkkpfdipmoc.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_icyal0PmeqMePWyzT9QJuA_mqezDg3f';

// Client for browser / client-side components
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for secure server-side API routes (bypasses RLS).
// On the server it fails closed if the service key is missing; it must never
// silently downgrade to the anon client.
const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const missingServerKey = new Proxy(
  {},
  {
    get() {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server');
    },
  }
);

export const supabaseAdmin = (typeof window === 'undefined')
  ? (serverKey
      ? createClient(supabaseUrl, serverKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : (missingServerKey as any))
  : supabase;
