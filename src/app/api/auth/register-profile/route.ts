import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { userId, email, fullName, degree } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
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
