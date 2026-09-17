import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Internal secret — must be set in environment variables
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(request: Request) {
  try {
    // This endpoint should only be called from the login flow (server-side internal use).
    // Verify internal secret header to prevent public abuse.
    const secret = request.headers.get('x-internal-secret');
    if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    // Lock the profile
    const lockTime = new Date();
    lockTime.setHours(lockTime.getHours() + 24); // lock for 24 hours

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ failed_attempts: 3, locked_until: lockTime.toISOString() })
      .eq('email', email.toLowerCase().trim());

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
