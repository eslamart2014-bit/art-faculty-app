-- ====================================================================
-- جداول منظومة دواليب الطلاب (جامعة قنا - كلية التربية النوعية)
-- ====================================================================

-- 1. جدول مخزون دواليب الكلية الأساسي
CREATE TABLE IF NOT EXISTS public.lockers_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locker_code TEXT NOT NULL UNIQUE,       -- رمز الدولاب (A1, A2, B1...)
    letter TEXT NOT NULL,                   -- الحرف (A, B, C, D)
    number INTEGER NOT NULL,                -- الرقم (1, 2, 3...)
    capacity INTEGER DEFAULT 4,             -- السعة (2 أو 4)
    is_enabled BOOLEAN DEFAULT true,        -- متاح للحجز للطلاب أم محجوب إدارياً
    status TEXT DEFAULT 'empty',            -- empty, pending, confirmed
    current_booking_id TEXT,                -- معرف الحجز الحالي
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. جدول حجوزات وتسكين الدواليب
CREATE TABLE IF NOT EXISTS public.locker_bookings (
    id TEXT PRIMARY KEY,                    -- معرف الحجز (مثال: O1726000000)
    locker_code TEXT NOT NULL,              -- رمز الدولاب
    cohort TEXT NOT NULL,                   -- الفرقة الدراسية
    representative_phone TEXT NOT NULL,     -- هاتف ممثل الدولاب
    student_names TEXT[] NOT NULL,          -- أسماء الطلاب
    student_codes TEXT[],                   -- أكواد الطلاب
    status TEXT DEFAULT 'pending',          -- pending (قيد المراجعة), confirmed (معتمد), cancelled
    pdf_url TEXT,                           -- رابط الاستمارة المطبوعة
    responsible TEXT DEFAULT 'ONLINE',      -- المسؤول أو 'ONLINE'
    notes TEXT,                             -- ملاحظات
    created_at TIMESTAMPTZ DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    confirmed_by TEXT
);

-- 3. جدول قائمة الانتظار التلقائية
CREATE TABLE IF NOT EXISTS public.locker_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort TEXT NOT NULL,
    representative_phone TEXT NOT NULL,
    student_names TEXT[] NOT NULL,
    student_codes TEXT[],
    priority_order SERIAL,
    status TEXT DEFAULT 'waiting',          -- waiting, allocated, cancelled
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. جدول إعدادات وضوابط التسكين
CREATE TABLE IF NOT EXISTS public.locker_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    allowed_cohort TEXT DEFAULT 'الكل',
    deadline TIMESTAMPTZ,
    instructions TEXT DEFAULT 'يرجى طباعة الاستمارة وتواجد جميع الطلاب لدى م/ إسلام للتأكيد',
    is_open BOOLEAN DEFAULT true,
    google_sync_enabled BOOLEAN DEFAULT true,
    google_script_url TEXT DEFAULT 'https://script.google.com/macros/s/AKfycbwSM7et9hEz5T9Lff1VGYWhpJ3XBYitTQE82g6IiEunFU3R8LQi8gQOkU2P3gypX7fL/exec',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- إدراج الإعدادات الافتراضية
INSERT INTO public.locker_settings (id, allowed_cohort, instructions, is_open)
VALUES (1, 'الكل', 'يرجى طباعة الاستمارة وتواجد جميع الطلاب لدى م/ إسلام للتأكيد', true)
ON CONFLICT (id) DO NOTHING;

-- تفعيل الفهارس للسرعة القصوى
CREATE INDEX IF NOT EXISTS idx_lockers_code ON public.lockers_inventory(locker_code);
CREATE INDEX IF NOT EXISTS idx_lockers_letter ON public.lockers_inventory(letter);
CREATE INDEX IF NOT EXISTS idx_lockers_status ON public.lockers_inventory(status);
CREATE INDEX IF NOT EXISTS idx_bookings_locker ON public.locker_bookings(locker_code);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.locker_bookings(status);

-- تفعيل سياسات الأمان RLS
ALTER TABLE public.lockers_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_settings ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة العامة للطلاب
CREATE POLICY Public read lockers_inventory ON public.lockers_inventory FOR SELECT USING (true);
CREATE POLICY Public read locker_bookings ON public.locker_bookings FOR SELECT USING (true);
CREATE POLICY Public read locker_settings ON public.locker_settings FOR SELECT USING (true);

-- سياسات التعديل والإدخال للإدارة وخدمة السيرفر (Service Role)
CREATE POLICY Admin manage lockers_inventory ON public.lockers_inventory FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY Admin manage locker_bookings ON public.locker_bookings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY Admin manage locker_waitlist ON public.locker_waitlist FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY Admin manage locker_settings ON public.locker_settings FOR ALL USING (auth.role() = 'authenticated');
