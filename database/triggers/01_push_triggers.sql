-- =========================================================================
-- إعداد نظام الإشعارات الفورية التلقائي في Supabase (Attendance & Evaluations Push)
-- انسخ هذا الكود بالكامل والصقه في:
-- Supabase Dashboard > SQL Editor > New Query > اضغط Run
-- =========================================================================

-- 1. جدول توكنات أجهزة الطلاب
CREATE TABLE IF NOT EXISTS public.device_tokens (
  token text PRIMARY KEY,
  student_code text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_student_code ON public.device_tokens(student_code);

-- 2. تفعيل مكتبة الطلبات الشبكية في سوبابيس (pg_net)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. دالة إرسال الإشعار الفوري إلى سيرفر Vercel
CREATE OR REPLACE FUNCTION public.notify_push_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'type', TG_OP,
    'record', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(NEW) END,
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- إرسال الإشعار في الخلفية عبر pg_net بدون أي تأخير على قاعدة البيانات
  PERFORM net.http_post(
    url := 'https://art-faculty-app.vercel.app/api/push/webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'b8d48d9d6c9ebe4d7b675be4c795d7d0a405707b37a7dc39'
    ),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- 4. تشغيل الإشعار الفوري عند تسجيل أو تعديل أو إلغاء الحضور
DROP TRIGGER IF EXISTS tr_push_attendance ON public.attendance;
CREATE TRIGGER tr_push_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_webhook();

-- 5. تشغيل الإشعار الفوري عند رصد تقييم جديد أو تحديث الدرجات
DROP TRIGGER IF EXISTS tr_push_evaluations ON public.evaluations;
CREATE TRIGGER tr_push_evaluations
AFTER INSERT OR UPDATE ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_webhook();
