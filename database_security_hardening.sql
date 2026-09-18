-- ==============================================================================
-- 🛡️ منظومة التربية الفنية الذكية - سكربت التأمين الشامل لقاعدة البيانات (RLS)
-- الإصدار: v3.3.1 Security Hardening
-- الهدف: حماية تامة لقاعدة البيانات ضد أي عبث أو استعلام غير مصرح به من المتصفح (anon)
-- ==============================================================================

-- 1. إنشاء جداول بوابة الطلاب في حال عدم وجودها (بأمان تام)
CREATE TABLE IF NOT EXISTS public.student_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID,
    student_code TEXT UNIQUE NOT NULL,
    full_name TEXT,
    academic_year TEXT,
    section TEXT,
    mobile TEXT,
    id_card_url TEXT,
    pin_code TEXT,
    is_pin_used BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending',
    devices JSONB DEFAULT '[]'::jsonb,
    failed_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_submissions (
    id TEXT PRIMARY KEY,
    student_code TEXT NOT NULL,
    student_name TEXT,
    course_id TEXT NOT NULL,
    course_name TEXT,
    project_name TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'pending_evaluation',
    score NUMERIC,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_code TEXT NOT NULL,
    student_name TEXT,
    academic_year TEXT,
    target_entity TEXT NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'جديدة',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portal_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_code TEXT,
    action TEXT NOT NULL,
    device_id TEXT,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. تفعيل سياسات الأمان (Row Level Security) على كافة الجداول
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_share_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telegram_bot_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portal_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. إزالة أي سياسات سابقة أو عريضة بأمان ديناميكي يمنع حدوث أخطاء 42P01
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND policyname IN (
            'Allow all', 'Public select',
            'staff_select_students', 'staff_modify_students',
            'staff_manage_evaluations', 'staff_manage_attendance',
            'public_read_courses', 'staff_manage_courses',
            'staff_read_profiles', 'staff_update_own_profile', 'admin_manage_profiles',
            'admin_manage_invitations', 'staff_manage_share_requests',
            'staff_manage_archives', 'public_read_settings', 'admin_manage_settings',
            'staff_manage_student_accounts', 'staff_manage_student_submissions',
            'staff_manage_student_complaints', 'staff_manage_portal_audit_logs'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ==============================================================================
-- 🔒 أولاً: جدول الطلاب (students)
-- منع المستخدم العام (anon) من القراءة أو التعديل، وحصرها على الكادر الأكاديمي المسجل
-- ملاحظة: استعلامات بوابة الطلاب تتم عبر السيرفر (supabaseAdmin) وتظل تعمل بكفاءة 100%
-- ==============================================================================
CREATE POLICY "staff_select_students" ON public.students
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "staff_modify_students" ON public.students
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('مدير', 'مدير مساعد', 'عضو هيئة تدريس', 'معيد')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('مدير', 'مدير مساعد', 'عضو هيئة تدريس', 'معيد')
        )
    );

-- ==============================================================================
-- 🔒 ثانياً: جدول التقييمات والدرجات (evaluations)
-- حظر مطلق لأي تعديل أو قراءة مباشرة من المتصفح عبر المفتاح العام
-- ==============================================================================
CREATE POLICY "staff_manage_evaluations" ON public.evaluations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- ==============================================================================
-- 🔒 ثالثاً: جدول تسجيل الحضور والغياب (attendance)
-- حظر مطلق لأي تلاعب أو تعديل عشوائي لبيانات الغياب والحضور
-- ==============================================================================
CREATE POLICY "staff_manage_attendance" ON public.attendance
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- ==============================================================================
-- 🔒 رابعاً: جدول المقررات الدراسية (courses)
-- القراءة متاحة للجميع (لتشغيل واجهة الكاميرا)، والتعديل مقصور على الكادر
-- ==============================================================================
CREATE POLICY "public_read_courses" ON public.courses
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY "staff_manage_courses" ON public.courses
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- ==============================================================================
-- 🔒 خامساً: جدول الحسابات الشخصية وأعضاء التدريس (profiles)
-- القراءة مقصورة على الكادر المسجل، والتعديل لصاحب الحساب أو المدير العام
-- ==============================================================================
CREATE POLICY "staff_read_profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "staff_update_own_profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = id 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'مدير'
        )
    );

CREATE POLICY "admin_manage_profiles" ON public.profiles
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'مدير'
        )
    );

-- ==============================================================================
-- 🔒 سادساً: جدول الدعوات والزملاء (invitations)
-- مقصور تماماً على المدير العام والمدير المساعد
-- ==============================================================================
CREATE POLICY "admin_manage_invitations" ON public.invitations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('مدير', 'مدير مساعد')
        )
    );

-- ==============================================================================
-- 🔒 سابعاً: جدول طلبات المشاركة (course_share_requests)
-- مقصور على أعضاء هيئة التدريس المسجلين
-- ==============================================================================
CREATE POLICY "staff_manage_share_requests" ON public.course_share_requests
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- ==============================================================================
-- 🔒 ثامناً: جدول الأرشيف (archives)
-- مقصور على الكادر الأكاديمي المسجل
-- ==============================================================================
CREATE POLICY "staff_manage_archives" ON public.archives
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid()
        )
    );

-- ==============================================================================
-- 🔒 تاسعاً: جدول إعدادات النظام وتواريخ الدراسة (system_settings)
-- القراءة متاحة للجميع لمعرفة تواريخ الترم، والتعديل حصري للمدير العام فقط
-- ==============================================================================
CREATE POLICY "public_read_settings" ON public.system_settings
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY "admin_manage_settings" ON public.system_settings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'مدير'
        )
    );

-- ==============================================================================
-- 🔒 عاشراً: جداول بوابة الطلاب والمشاريع والشكاوى
-- حظر الوصول العام (anon)، الإدارة مقصورة على الكادر التدريسي المعتمد
-- ملاحظة: عمليات الطلاب من البوابة تتم كلياً عبر السيرفر (service_role) الذي يتخطى الـ RLS
-- ==============================================================================
CREATE POLICY "staff_manage_student_accounts" ON public.student_accounts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "staff_manage_student_submissions" ON public.student_submissions
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "staff_manage_student_complaints" ON public.student_complaints
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "staff_manage_portal_audit_logs" ON public.portal_audit_logs
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid()));

-- 4. إنعاش كاش قاعدة البيانات وتطبيق التغييرات فوراً
NOTIFY pgrst, 'reload schema';
