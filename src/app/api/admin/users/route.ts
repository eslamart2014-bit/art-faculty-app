import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error: Missing Supabase keys.' }, { status: 500 });
  }
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  try {
    const { action, userId, newPassword, newRole, adminId } = await request.json();

    if (!adminId) {
      return NextResponse.json({ error: 'Missing adminId' }, { status: 401 });
    }

    // Verify Authorization Header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Validate the token and get the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // Check if the user is an admin in the database
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['مدير', 'مدير مساعد'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch target user to prevent Assistant from modifying Manager
    const { data: targetProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).single();
    if (profile.role === 'مدير مساعد' && targetProfile?.role === 'مدير') {
      return NextResponse.json({ error: 'غير مصرح: لا يمكنك التعديل على حساب المدير الأساسي' }, { status: 403 });
    }

    if (action === 'unlock') {
      if (!userId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
      await supabaseAdmin.from('profiles').update({ failed_attempts: 0, locked_until: null }).eq('id', userId);
      return NextResponse.json({ success: true });
    }

    if (action === 'change_password') {
      if (!userId || !newPassword) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
      
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });
      
      if (error) throw error;
      
      await supabaseAdmin.from('profiles').update({ failed_attempts: 0, locked_until: null }).eq('id', userId);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_user') {
      if (!userId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
      
      if (profile.role === 'مدير مساعد') {
        const { data: userToDelete } = await supabaseAdmin.from('profiles').select('full_name').eq('id', userId).single();
        const currentName = userToDelete?.full_name || 'بدون اسم';
        const newName = currentName.startsWith('[محذوف]') ? currentName : `[محذوف] ${currentName}`;
        
        await supabaseAdmin.from('profiles').update({
          is_suspended: true,
          full_name: newName
        }).eq('id', userId);
      } else {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
      }
      
      return NextResponse.json({ success: true });
    }

    if (action === 'grant_role') {
      if (profile.role !== 'مدير') {
        return NextResponse.json({ error: 'Forbidden: Only admin can change roles' }, { status: 403 });
      }
      const roleToSet = newRole || 'teacher';
      if (!userId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

      const { error: roleError } = await supabaseAdmin
        .from('profiles')
        .update({ role: roleToSet })
        .eq('id', userId);

      if (roleError) throw roleError;
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_verify_permission') {
      if (!['مدير', 'مدير مساعد'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!userId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

      const { data: targetUser } = await supabaseAdmin
        .from('profiles')
        .select('can_verify_students, full_name')
        .eq('id', userId)
        .single();

      const newPerm = !targetUser?.can_verify_students;

      const { error: permError } = await supabaseAdmin
        .from('profiles')
        .update({ can_verify_students: newPerm })
        .eq('id', userId);

      if (permError) throw permError;

      // Sync with portal_coordinators
      if (newPerm && targetUser?.full_name) {
        try {
          await supabaseAdmin.from('portal_coordinators').upsert({
            name: targetUser.full_name,
            title: 'منسق تأكيد هوية الطلاب',
            is_active: true
          }, { onConflict: 'name' });
        } catch (e) {}
      }

      return NextResponse.json({ success: true, can_verify_students: newPerm });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
