-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    term1_start DATE,
    term2_start DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ensure only one row exists
INSERT INTO public.system_settings (id, term1_start, term2_start)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to system_settings" ON public.system_settings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow anon read access to system_settings" ON public.system_settings FOR SELECT TO anon USING (true);
