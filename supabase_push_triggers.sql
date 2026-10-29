-- =========================================================================
-- إعداد نظام الإشعارات الفورية التلقائي في Supabase (Attendance & Projects Push)
-- انسخ هذا الكود بالكامل والصقه في:
-- Supabase Dashboard > SQL Editor > New Query > اضغط Run
-- =========================================================================

-- 1. تفعيل مكتبة الطلبات الشبكية في السوبابيس
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. دالة إرسال الإشعار التلقائي إلى خادم Vercel
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
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- إرسال طلب HTTP POST في الخلفية بدون أي تأخير على قاعدة البيانات
  PERFORM net.http_post(
    url := 'https://art-faculty-app.vercel.app/api/push/webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'b8d48d9d6c9ebe4d7b675be4c795d7d0a405707b37a7dc39'
    ),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

-- 3. تفعيل التريجر لجدول الحضور (عند تسجيل حضور جديد أو تعديله)
DROP TRIGGER IF EXISTS tr_push_attendance ON public.attendance;
CREATE TRIGGER tr_push_attendance
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_webhook();

-- 4. تفعيل التريجر لجدول المشاريع (عند إضافة مشروع جديد)
DROP TRIGGER IF EXISTS tr_push_projects ON public.projects;
CREATE TRIGGER tr_push_projects
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_webhook();
