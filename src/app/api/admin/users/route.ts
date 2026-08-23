import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { action, userId, newPassword, adminId } = await request.json();

    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the caller is an admin
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'مدير' && adminProfile?.role !== 'admin' && adminProfile?.role !== 'أدمن') {
      return NextResponse.json({ error: 'Unauthorized: Admins only' }, { status: 403 });
    }

    if (action === 'change_password') {
      if (!userId || !newPassword) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
      
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });
      
      if (error) throw error;
      
      // Also unlock the account if it was locked
      await supabaseAdmin.from('profiles').update({ failed_attempts: 0, locked_until: null }).eq('id', userId);
      
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_user') {
      if (!userId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
      
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
