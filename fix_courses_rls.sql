-- ==============================================================================
-- 🛡️ حل سياسة الأمان (RLS) لجدول المقررات (courses)
-- شغّل هذا السكربت في Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- الحل الموصى به: إيقاف RLS عن جدول المقررات للسماح بالعمليات المباشرة بسلاسة
ALTER TABLE IF EXISTS public.courses DISABLE ROW LEVEL SECURITY;

-- أو إذا كنت تفضل إبقاء RLS مفعلاً مع السماح بالإضافة والتعديل:
-- DROP POLICY IF EXISTS "public_read_courses" ON public.courses;
-- DROP POLICY IF EXISTS "staff_manage_courses" ON public.courses;
-- CREATE POLICY "allow_all_courses_select" ON public.courses FOR SELECT TO authenticated, anon USING (true);
-- CREATE POLICY "allow_all_courses_insert" ON public.courses FOR INSERT TO authenticated, anon WITH CHECK (true);
-- CREATE POLICY "allow_all_courses_update" ON public.courses FOR UPDATE TO authenticated, anon USING (true);
-- CREATE POLICY "allow_all_courses_delete" ON public.courses FOR DELETE TO authenticated, anon USING (true);

-- إنعاش الكاش
NOTIFY pgrst, 'reload schema';
