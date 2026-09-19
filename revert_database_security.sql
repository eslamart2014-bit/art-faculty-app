-- ==============================================================================
-- 🔄 سكربت استعادة قاعدة البيانات وإلغاء قيود RLS
-- الهدف: إعادة ظهور المستخدمين والطلاب والتقييمات فوراً في كافة شاشات النظام
-- ==============================================================================

-- 1. تعطيل سياسات RLS عن الجداول الرئيسية لتعود البيانات فوراً كما كانت في السابق
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_share_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.archives DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telegram_bot_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portal_audit_logs DISABLE ROW LEVEL SECURITY;

-- 2. إزالة أي سياسات سابقة كانت تحجب البيانات
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 3. منح الصلاحيات الطبيعية للمتصفح والتطبيق ليعمل كل شيء بنجاح 100%
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
