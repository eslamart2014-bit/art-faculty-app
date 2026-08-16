-- This script will completely rebuild the courses table with ALL required columns
DROP TABLE IF EXISTS public.courses;

CREATE TABLE public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    course_type TEXT NOT NULL DEFAULT 'sections',
    sections TEXT[] DEFAULT '{}',
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable RLS so you can insert easily
ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;

-- Reload Cache
NOTIFY pgrst, 'reload schema';
