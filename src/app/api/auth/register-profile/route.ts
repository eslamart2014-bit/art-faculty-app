import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    // Verify the caller's JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    // Confirm the token belongs to a valid Supabase user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { userId, email, fullName, degree } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Ensure the token's user matches the userId being registered (no impersonation)
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden — userId mismatch' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: email,
      full_name: fullName,
      degree: degree,
      is_active: true
    });

    if (updateError) throw updateError;
    
    // Update invitation status
    await supabaseAdmin.from("invitations").update({ status: "completed" }).eq("email", email.toLowerCase().trim());

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
