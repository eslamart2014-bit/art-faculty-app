-- 1. مسح الجداول القديمة التالفة وتوابعها (لن يتم المساس بالمدير أو الطلاب)
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.course_students CASCADE;
DROP TABLE IF EXISTS public.course_sections CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;

-- 2. بناء جدول المقررات الجديد
CREATE TABLE public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    course_type TEXT NOT NULL DEFAULT 'sections',
    sections TEXT[] DEFAULT '{}',
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. بناء جدول الغياب الجديد
CREATE TABLE public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL, -- 'حاضر', 'غائب', 'إذن'
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(course_id, student_id, date)
);

-- 4. بناء جدول التقييمات الجديد
CREATE TABLE public.evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    score NUMERIC NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(course_id, student_id, project_name)
);

-- 5. إغلاق قيود الأمان المزعجة لتسهيل عمل النظام كمدير
ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations DISABLE ROW LEVEL SECURITY;

-- 6. إنعاش ذاكرة قاعدة البيانات لتبدأ العمل فوراً
NOTIFY pgrst, 'reload schema';
