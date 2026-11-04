-- =========================================================================
-- كود تنظيف وضبط نظام الإشعارات الفورية في سوبابيس (Supabase Clean & Fix)
-- انسخ هذا الكود بالكامل وضعه في:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =========================================================================

-- 1. التأكد من وجود جدول توكنات أجهزة الطلاب
CREATE TABLE IF NOT EXISTS public.device_tokens (
  token text PRIMARY KEY,
  student_code text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_student_code ON public.device_tokens(student_code);

-- 2. إتاحة الصلاحيات للطلاب والتطبيق لتسجيل التوكن بدون أي قيود
ALTER TABLE public.device_tokens DISABLE ROW LEVEL SECURITY;

-- 3. حذف الـ Triggers القديمة بأمان تام لمنع تكرار الإشعارات
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') THEN
        DROP TRIGGER IF EXISTS tr_push_attendance ON public.attendance;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluations') THEN
        DROP TRIGGER IF EXISTS tr_push_evaluations ON public.evaluations;
    END IF;
END $$;

-- 4. حذف دالة الويب هوك القديمة إن وجدت
DROP FUNCTION IF EXISTS public.notify_push_webhook();

-- 5. إنعاش كاش قاعدة البيانات
NOTIFY pgrst, 'reload schema';
