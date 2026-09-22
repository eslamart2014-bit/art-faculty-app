import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('portal_coordinators')
      .select('id, name, title, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      // إذا لم يكن الجدول منشأ بعد، نرجع منسق افتراضي
      return NextResponse.json({
        coordinators: [
          { id: '1', name: 'د/ إسلام عبد اللطيف حسن', title: 'مطور ومنسق المنظومة' }
        ]
      });
    }

    // إذا كان الجدول فارغاً
    if (!data || data.length === 0) {
      return NextResponse.json({
        coordinators: [
          { id: '1', name: 'د/ إسلام عبد اللطيف حسن', title: 'مطور ومنسق المنظومة' }
        ]
      });
    }

    return NextResponse.json({ coordinators: data });
  } catch (err: any) {
    return NextResponse.json({
      coordinators: [
        { id: '1', name: 'د/ إسلام عبد اللطيف حسن', title: 'مطور ومنسق المنظومة' }
      ]
    });
  }
}
