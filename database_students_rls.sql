-- Disable RLS on students table to allow the admin interface to insert and update records from Google Sheets
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
