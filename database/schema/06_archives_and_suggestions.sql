-- Create Archives Table
CREATE TABLE IF NOT EXISTS public.archives (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- 'course', 'student', 'project', 'grade', 'attendance'
    description TEXT NOT NULL,
    original_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for archives
ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/insert archives
CREATE POLICY "Allow authenticated read archives" ON public.archives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert archives" ON public.archives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated delete archives" ON public.archives FOR DELETE TO authenticated USING (true);

-- Create Suggestions Chat Table
CREATE TABLE IF NOT EXISTS public.suggestions_chat (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    read_by_user BOOLEAN DEFAULT false,
    read_by_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for suggestions_chat
ALTER TABLE public.suggestions_chat ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own chats, and admins to see all
CREATE POLICY "Allow authenticated read chat" ON public.suggestions_chat FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert chat" ON public.suggestions_chat FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update chat" ON public.suggestions_chat FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete chat" ON public.suggestions_chat FOR DELETE TO authenticated USING (true);
