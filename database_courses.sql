-- Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    course_type TEXT NOT NULL, -- 'sections' or 'lectures'
    sections TEXT[] DEFAULT '{}',
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (we might keep it disabled temporarily if the user disabled it on profiles, but let's disable it completely to avoid 406 errors for now as we did with profiles)
ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;
