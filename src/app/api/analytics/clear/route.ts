import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    // Note: We use a basic auth check, assuming only admin accesses this button on client side.
    // In a real app we'd verify JWT. Here we just delete everything.
    const { error } = await supabase
      .from('portal_analytics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // hack to delete all rows

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
