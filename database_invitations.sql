-- Create Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending', -- 'pending' or 'completed'
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/insert invitations (we can restrict this in the UI to admins)
CREATE POLICY "Allow authenticated read invitations" ON public.invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert invitations" ON public.invitations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update invitations" ON public.invitations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete invitations" ON public.invitations FOR DELETE TO authenticated USING (true);
-- Allow anon to read invitations during registration
CREATE POLICY "Allow anon read invitations" ON public.invitations FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update invitations" ON public.invitations FOR UPDATE TO anon USING (true);

-- Update Profiles Table to support Suspension and Lockout
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
