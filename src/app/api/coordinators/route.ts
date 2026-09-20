import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentCode = (searchParams.get('student_code') || '').trim();

  try {
    const coordMap = new Map<string, { id: string; full_name: string; role: string; degree?: string }>();

    // 1. استرجاع المنسقين من جدول profiles (المديرون أو الحاصلون على صلاحية can_verify_students)
    try {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role, degree, can_verify_students')
        .or('role.eq.مدير,can_verify_students.eq.true');

      (profiles || []).forEach((p: any) => {
        if (p.full_name) {
          coordMap.set(p.id, {
            id: p.id,
            full_name: `${p.degree ? p.degree + '/ ' : ''}${p.full_name}`,
            role: p.role === 'مدير' ? 'المدير العام ومنسق النظام' : 'منسق هوية معتمد',
            degree: p.degree,
          });
        }
      });
    } catch (e) {}

    // 2. استرجاع المنسقين من إعدادات النظام system_settings (telegram_config.verified_coordinators)
    try {
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 'global')
        .maybeSingle();

      const list = settings?.telegram_config?.verified_coordinators;
      if (Array.isArray(list) && list.length > 0) {
        const { data: extraProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, role, degree')
          .in('id', list);

        (extraProfiles || []).forEach((p: any) => {
          if (!coordMap.has(p.id) && p.full_name) {
            coordMap.set(p.id, {
              id: p.id,
              full_name: `${p.degree ? p.degree + '/ ' : ''}${p.full_name}`,
              role: 'منسق هوية معتمد',
              degree: p.degree,
            });
          }
        });
      }
    } catch (e) {}

    let allCoordinators = Array.from(coordMap.values());

    // في حال عدم وجود أي منسق بقاعدة البيانات، نضع المنسق والمطور الافتراضي
    if (allCoordinators.length === 0) {
      allCoordinators = [
        { id: 'dev-1', full_name: 'د/ إسلام عبد اللطيف حسن', role: 'مطور ومنسق المنظومة' }
      ];
    }

    // 3. التوزيع العادل والمتوازن: اختيار منسقين اثنين فقط لكل طالب بالتناوب
    let assignedCoordinators = allCoordinators;
    if (studentCode && allCoordinators.length >= 2) {
      let hash = 0;
      for (let i = 0; i < studentCode.length; i++) {
        hash = ((hash << 5) - hash) + studentCode.charCodeAt(i);
        hash |= 0;
      }
      const idx1 = Math.abs(hash) % allCoordinators.length;
      let idx2 = (idx1 + 1) % allCoordinators.length;
      if (idx1 === idx2 && allCoordinators.length > 1) {
        idx2 = (idx1 + 1) % allCoordinators.length;
      }
      assignedCoordinators = [allCoordinators[idx1], allCoordinators[idx2]];
    }

    return NextResponse.json({
      coordinators: assignedCoordinators,
      allCoordinators,
      totalAvailable: allCoordinators.length,
    });
  } catch (err: any) {
    console.error('Error fetching coordinators:', err);
    return NextResponse.json({
      coordinators: [
        { id: '1', full_name: 'د/ إسلام عبد اللطيف حسن', role: 'مطور ومنسق المنظومة' }
      ],
      allCoordinators: [],
    });
  }
}
