import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeAcademicDegree } from '@/lib/academicHelper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, email, fullName, degree } = body || {};

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden — userId mismatch' }, { status: 403 });
    }

    const verifiedEmail = String(user.email || '').toLowerCase().trim();
    const requestedEmail = String(email || '').toLowerCase().trim();
    if (!verifiedEmail || (requestedEmail && requestedEmail !== verifiedEmail)) {
      return NextResponse.json({ error: 'Forbidden — email mismatch' }, { status: 403 });
    }

    const cleanName = typeof fullName === 'string' ? fullName.trim().slice(0, 120) : '';
    if (cleanName.length < 3) {
      return NextResponse.json({ error: 'الاسم غير صالح' }, { status: 400 });
    }

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .select('id, email, status')
      .eq('email', verifiedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (invitationError) {
      console.error('Invitation lookup error:', invitationError.message);
      return NextResponse.json({ error: 'تعذر التحقق من الدعوة' }, { status: 500 });
    }

    if (!invitation) {
      return NextResponse.json(
        { error: 'لا توجد دعوة سارية لهذا البريد الإلكتروني. يرجى مراجعة الإدارة.' },
        { status: 403 }
      );
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfile?.is_active === false) {
      return NextResponse.json({ error: 'الحساب موقوف. يرجى مراجعة الإدارة.' }, { status: 403 });
    }

    const profilePayload: Record<string, unknown> = {
      id: userId,
      email: verifiedEmail,
      full_name: cleanName,
      degree: normalizeAcademicDegree(degree),
      is_active: true,
    };

    if (!existingProfile) {
      profilePayload.role = 'عضو هيئة تدريس';
    }

    const { error: updateError } = await supabaseAdmin.from('profiles').upsert(profilePayload);

    if (updateError) {
      console.error('Profile registration error:', updateError.message);
      return NextResponse.json({ error: 'تعذر إكمال التسجيل' }, { status: 500 });
    }

    await supabaseAdmin
      .from('invitations')
      .update({ status: 'completed' })
      .eq('id', invitation.id)
      .eq('status', 'pending');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('register-profile error:', error);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
