ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS course_type TEXT NOT NULL DEFAULT 'sections';
NOTIFY pgrst, 'reload schema';
