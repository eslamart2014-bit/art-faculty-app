-- ==============================================================================
-- 🛡️ منظومة التربية الفنية الذكية — تقفيل قاعدة البيانات (RLS Lockdown)
-- ملف مراجعة فقط — لا يُنفَّذ تلقائياً. راجعه ثم نفّذه من Supabase SQL Editor.
-- ==============================================================================
-- الهدف:
--   1) إغلاق الوصول العام (anon) إلى الجداول الحساسة نهائياً.
--   2) منع أي طالب/زائر من قراءة بيانات الطلاب أو الدرجات أو الحضور أو التوكنات.
--   3) منع تصعيد الصلاحيات عبر تعديل المستخدم لسجل ملفه الشخصي (role / is_suspended).
--   4) تقييد إعدادات النظام (بوت تيليجرام، أسرار الويبهوك، بيانات الدواليب) للإدارة فقط.
--   5) إبقاء كل واجهات الكادر التي تعتمد على Supabase مباشرة من المتصفح تعمل كما هي.
--
-- ⚠️ ملاحظات مهمة قبل التنفيذ:
--   • هذا الملف لا يحذف ولا يعدّل أي صف بيانات. العمليات كلها على الصلاحيات
--     والسياسات (pg_policies) وتفعيل RLS فقط.
--   • خادم التطبيق يستخدم SERVICE_ROLE ويتجاوز RLS، لذلك كل واجهات API تظل تعمل.
--   • يجب نشر تحديثات الواجهة المرفقة أولاً (خدمة /api/public/settings وتعديل
--     شاشات الصيانة والتقارير) حتى لا تتأثر قراءة تواريخ الترم.
--   • راجع قسم "PRE-FLIGHT" أدناه قبل التنفيذ، واحتفظ بنسخة احتياطية من قاعدة
--     البيانات (Supabase Dashboard → Database → Backups).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PRE-FLIGHT (قراءة فقط): اعرض الحالة الحالية وسجّلها للمقارنة بعد التنفيذ.
-- نفّذ هذه الاستعلامات منفصلة إن أردت تقريراً قبل التطبيق.
-- ------------------------------------------------------------------------------
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

BEGIN;

-- ==============================================================================
-- 1) دوال مساعدة آمنة (SECURITY DEFINER) لتفادي التكرار والتكرار اللانهائي
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role::text IN ('مدير', 'مدير مساعد', 'admin', 'أدمن')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_primary_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role::text IN ('مدير', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_primary_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_primary_admin() TO authenticated;

-- ==============================================================================
-- 2) حارس صلاحيات الملفات الشخصية
--    يمنع أي مستخدم عادي من تعديل دوره أو إيقاف حسابه أو منح نفسه صلاحية
--    التحقق، حتى لو استطاع الوصول المباشر إلى Supabase بالمفتاح العام.
--    المدير المساعد يستطيع إيقاف/فك قفل الآخرين، لكنه لا يستطيع تغيير الأدوار
--    أو صلاحيات التحقق ولا تعديل حقول الأمان في سجله هو.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.profiles_privilege_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  oldj jsonb := to_jsonb(OLD);
  newj jsonb := to_jsonb(NEW);
  privileged_changed boolean;
BEGIN
  -- طلبات service_role / السيرفر (بدون JWT مستخدم) تمر كما هي.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- المدير الأساسي يملك الصلاحية الكاملة.
  IF public.is_primary_admin() THEN
    RETURN NEW;
  END IF;

  privileged_changed :=
    (oldj->>'role') IS DISTINCT FROM (newj->>'role')
    OR (oldj->>'is_suspended') IS DISTINCT FROM (newj->>'is_suspended')
    OR (oldj->>'can_verify_students') IS DISTINCT FROM (newj->>'can_verify_students')
    OR (oldj->>'failed_attempts') IS DISTINCT FROM (newj->>'failed_attempts')
    OR (oldj->>'locked_until') IS DISTINCT FROM (newj->>'locked_until');

  -- غير الإداري: لا يلمس أي حقل أمني مطلقاً.
  IF NOT public.is_admin() THEN
    IF privileged_changed THEN
      RAISE EXCEPTION 'غير مصرح بتعديل حقول الصلاحيات أو حالة الحساب'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- المدير المساعد: لا يغيّر الأدوار أو صلاحية التحقق، ولا يعدّل حقول الأمان
  -- في سجله الشخصي.
  IF NEW.id = auth.uid() THEN
    IF privileged_changed THEN
      RAISE EXCEPTION 'غير مصرح بتعديل حقول الأمان في حسابك الشخصي'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (oldj->>'role') IS DISTINCT FROM (newj->>'role')
     OR (oldj->>'can_verify_students') IS DISTINCT FROM (newj->>'can_verify_students') THEN
    RAISE EXCEPTION 'تغيير الأدوار وصلاحيات التحقق مقصور على المدير الأساسي'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_privilege_guard ON public.profiles;
CREATE TRIGGER trg_profiles_privilege_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_privilege_guard();

-- ==============================================================================
-- 3) حذف كل السياسات القديمة على الجداول المستهدفة (سياسات فقط — لا بيانات)
--    الحذف الشامل يضمن عدم بقاء سياسة permissive قديمة تتجاوز القيود الجديدة.
-- ==============================================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'students', 'courses', 'attendance', 'evaluations',
        'system_settings', 'invitations', 'student_accounts',
        'student_submissions', 'student_complaints', 'portal_audit_logs',
        'archives', 'suggestions_chat', 'course_share_requests',
        'telegram_bot_states', 'portal_analytics',
        'lockers_inventory', 'locker_bookings', 'locker_waitlist', 'locker_settings'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ==============================================================================
-- 4) تفعيل RLS على كل الجداول المستهدفة (مذكور IF EXISTS لتفادي أخطاء الجداول
--    غير الموجودة في بعض النسخ).
-- ==============================================================================
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portal_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suggestions_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_share_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telegram_bot_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portal_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lockers_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locker_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locker_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locker_settings ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 5) سحب صلاحيات anon من كل الجداول الحساسة (الوصول العام = صفر)
-- ==============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'profiles', 'students', 'courses', 'attendance', 'evaluations',
      'system_settings', 'invitations', 'student_accounts',
      'student_submissions', 'student_complaints', 'portal_audit_logs',
      'archives', 'suggestions_chat', 'course_share_requests',
      'telegram_bot_states', 'portal_analytics',
      'lockers_inventory', 'locker_bookings', 'locker_waitlist', 'locker_settings'
    ])
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
    END IF;
  END LOOP;
END $$;

-- الجداول التي يعمل بها السيرفر فقط (بيانات الدواليب، التحليلات، حالات البوت)
-- لا يحتاجها المتصفح إطلاقاً؛ نسحبها أيضاً من المستخدمين المسجلين.
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'telegram_bot_states', 'portal_analytics',
      'lockers_inventory', 'locker_bookings', 'locker_waitlist', 'locker_settings'
    ])
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', tbl);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 6) الصلاحيات اللازمة للكادر المسجل (RLS هي التي تحدد الصفوف المسموحة)
-- ==============================================================================
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.archives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.suggestions_chat TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_share_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.system_settings TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.student_accounts TO authenticated;
GRANT SELECT, INSERT ON TABLE public.portal_audit_logs TO authenticated;

-- ==============================================================================
-- 7) استثناء واحد مقصود: كاميرا المشاريع العامة
--    صفحة /camera تعمل أحياناً بدون تسجيل دخول وتحتاج فقط:
--        id, custom_week_names
--    لذلك نمنح anon صلاحية قراءة هذين العمودين فقط، مع سياسة قراءة عامة.
--    أي محاولة لقراءة أي عمود آخر (أو تعديل) ستُرفض من قاعدة البيانات.
-- ==============================================================================
REVOKE ALL ON TABLE public.courses FROM anon;
GRANT SELECT (id, custom_week_names) ON TABLE public.courses TO anon;

-- ==============================================================================
-- 8) السياسات الجديدة
-- ==============================================================================

-- 8.1 الملفات الشخصية: قراءة لكل الكادر، تعديل ذاتي آمن (الحارس يمنع الحقول
--     الأمنية)، وإدارة كاملة للمدير/المساعد.
CREATE POLICY profiles_read_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_manage_admins ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8.2 الطلاب: الكادر فقط. لا وصول عام إطلاقاً.
CREATE POLICY students_manage_staff ON public.students
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 8.3 المقررات: قراءة عامة محدودة الأعمدة للكاميرا + إدارة كاملة للكادر.
CREATE POLICY courses_read_camera ON public.courses
  FOR SELECT TO anon
  USING (true);

CREATE POLICY courses_manage_staff ON public.courses
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 8.4 الحضور والتقييمات: الكادر فقط.
CREATE POLICY attendance_manage_staff ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY evaluations_manage_staff ON public.evaluations
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 8.5 إعدادات النظام (توكن البوت، سر الويبهوك، بيانات الدواليب): الإدارة فقط.
--     الواجهات العامة تقرأ بيانات الصيانة والتواريخ من /api/public/settings.
CREATE POLICY settings_manage_admins ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8.6 الدعوات: المدير والمساعد فقط. كانت مكشوفة لـ anon سابقاً.
CREATE POLICY invitations_manage_admins ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8.7 حسابات بوابة الطلاب (تحتوي PIN): الإدارة فقط عبر المتصفح.
--     واجهات المنسق والطالب تمر عبر السيرفر (service_role).
CREATE POLICY student_accounts_manage_admins ON public.student_accounts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8.8 باقي جداول الكادر.
CREATE POLICY student_submissions_manage_staff ON public.student_submissions
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY student_complaints_manage_staff ON public.student_complaints
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY portal_audit_logs_manage_staff ON public.portal_audit_logs
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY archives_manage_staff ON public.archives
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY suggestions_chat_manage_staff ON public.suggestions_chat
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY course_share_requests_manage_staff ON public.course_share_requests
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 8.9 telegram_bot_states / portal_analytics / lockers_*:
--     لا سياسات = لا وصول مباشر. الوصول الوحيد عبر service_role في السيرفر.

-- ==============================================================================
-- 9) إنعاش كاش PostgREST
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- ROLLBACK (في حال الحاجة — لا ينفَّذ إلا بقرار صريح):
--   ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.evaluations DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.student_accounts DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.student_submissions DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.student_complaints DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.portal_audit_logs DISABLE ROW LEVEL SECURITY;
--   DROP TRIGGER IF EXISTS trg_profiles_privilege_guard ON public.profiles;
--   DROP FUNCTION IF EXISTS public.profiles_privilege_guard();
--   DROP FUNCTION IF EXISTS public.is_staff();
--   DROP FUNCTION IF EXISTS public.is_admin();
--   DROP FUNCTION IF EXISTS public.is_primary_admin();
--   NOTIFY pgrst, 'reload schema';
-- ملاحظة: إرجاع RLS إلى وضع الإيقاف يعيد المخاطر الأمنية السابقة؛ استخدمه
-- فقط كخطة طوارئ مؤقتة ثم أعد التقفيل بعد إصلاح سبب التعطل.
-- ==============================================================================
