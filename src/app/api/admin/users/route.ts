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
    const { action, userId, newPassword, newRole, adminId, email, fullName, degree } = await request.json();

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
      .maybeSingle();

    if (!profile || !['مدير', 'مدير مساعد'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch target user to prevent Assistant from modifying Manager
    if (userId) {
      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (profile.role === 'مدير مساعد' && targetProfile?.role === 'مدير') {
        return NextResponse.json({ error: 'غير مصرح: لا يمكنك التعديل على حساب المدير الأساسي' }, { status: 403 });
      }
    }

    if (action === 'create_faculty_user') {
      if (!email || !fullName) {
        return NextResponse.json({ error: 'يرجى إدخال اسم الزميل والبريد الإلكتروني' }, { status: 400 });
      }

      const cleanEmail = email.toLowerCase().trim();
      const cleanName = fullName.trim();
      const userDegree = degree || 'م';
      
      // Generate clean memorable password
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const generatedPassword = `Art#${randomDigits}`;

      let createdAuthUserId: string | null = null;
      let isExisting = false;

      // Try creating user in Supabase Auth
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          degree: userDegree
        }
      });

      if (createError) {
        if (createError.message.toLowerCase().includes('already registered') || createError.message.toLowerCase().includes('already exists')) {
          // If already exists, find user to update their password and profile
          isExisting = true;
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const found = listData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
          if (found) {
            createdAuthUserId = found.id;
            await supabaseAdmin.auth.admin.updateUserById(found.id, {
              password: generatedPassword,
              user_metadata: { full_name: cleanName, degree: userDegree }
            });
          } else {
            return NextResponse.json({ error: 'البريد مسجل مسبقاً ولكن تعذر العثور على الحساب لتحديثه.' }, { status: 400 });
          }
        } else {
          return NextResponse.json({ error: 'خطأ في إنشاء الحساب: ' + createError.message }, { status: 400 });
        }
      } else if (createData?.user) {
        createdAuthUserId = createData.user.id;
      }

      if (!createdAuthUserId) {
        return NextResponse.json({ error: 'فشل إنشاء أو تحديث المستخدم' }, { status: 500 });
      }

      // Upsert profile
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: createdAuthUserId,
        email: cleanEmail,
        full_name: cleanName,
        degree: userDegree,
        role: newRole || 'عضو هيئة تدريس',
        is_suspended: false,
        failed_attempts: 0,
        locked_until: null
      });

      if (profileError) {
        console.error('Error upserting profile:', profileError);
      }

      // Upsert invitations table as completed
      try {
        await supabaseAdmin.from('invitations').upsert({
          email: cleanEmail,
          created_by: adminId,
          status: 'completed'
        }, { onConflict: 'email' });
      } catch (invErr) {
        console.error('Error updating invitations:', invErr);
      }

      return NextResponse.json({
        success: true,
        userId: createdAuthUserId,
        email: cleanEmail,
        password: generatedPassword,
        fullName: cleanName,
        degree: userDegree,
        isExisting
      });
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
      if (profile.role !== 'مدير') {
        return NextResponse.json({ error: 'صلاحية حصرية للمدير العام فقط' }, { status: 403 });
      }
      if (!userId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

      // 1. استرجاع بيانات المستخدم من profiles
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // 2. فحص الصلاحية الحالية من عدة مصادر موثوقة
      let currentPerm = false;
      if (targetProfile && targetProfile.can_verify_students !== undefined && targetProfile.can_verify_students !== null) {
        currentPerm = !!targetProfile.can_verify_students;
      }

      // فحص بيانات المستخدم في auth.users
      let authUserMetadata: any = {};
      try {
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUserData?.user?.user_metadata) {
          authUserMetadata = authUserData.user.user_metadata;
          if (authUserMetadata.can_verify_students !== undefined && authUserMetadata.can_verify_students !== null) {
            currentPerm = !!authUserMetadata.can_verify_students;
          }
        }
      } catch (e) {}

      // فحص إعدادات النظام system_settings
      try {
        const { data: settings } = await supabaseAdmin
          .from('system_settings')
          .select('id, telegram_config')
          .eq('id', 1)
          .maybeSingle();
        if (settings?.telegram_config) {
          const coords: string[] = settings.telegram_config.verified_coordinators || [];
          if (coords.includes(userId)) {
            currentPerm = true;
          }
        }
      } catch (e) {}

      const newPerm = !currentPerm;

      // 3. حفظ الصلاحية الجديدة في auth.users (يعمل دائماً بدون الحاجة لتعديل الجداول)
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...authUserMetadata,
            can_verify_students: newPerm
          }
        });
      } catch (e) {}

      // 4. حفظ الصلاحية الجديدة في system_settings
      try {
        const { data: settings } = await supabaseAdmin
          .from('system_settings')
          .select('id, telegram_config')
          .eq('id', 1)
          .maybeSingle();
        if (settings) {
          const cfg = settings.telegram_config || {};
          let coords: string[] = cfg.verified_coordinators || [];
          if (newPerm) {
            if (!coords.includes(userId)) coords.push(userId);
          } else {
            coords = coords.filter((id: string) => id !== userId);
          }
          await supabaseAdmin.from('system_settings').update({
            telegram_config: { ...cfg, verified_coordinators: coords }
          }).eq('id', 1);
        }
      } catch (e) {}

      // 5. محاولة التحديث في جدول profiles في حال كان العمود موجوداً
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ can_verify_students: newPerm })
          .eq('id', userId);
      } catch (e) {
        // تجاهل آمن في حال لم يتم تشغيل سكربت إضافة العمود بعد
      }

      return NextResponse.json({ success: true, can_verify_students: newPerm });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
