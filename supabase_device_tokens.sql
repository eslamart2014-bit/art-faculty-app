-- شغّل هذا في Supabase > SQL Editor (مرة واحدة)
create table if not exists public.device_tokens (
  token text primary key,
  student_code text not null,
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_student_code_idx on public.device_tokens (student_code);

-- الوصول للجدول عبر السيرفر فقط (service role)
alter table public.device_tokens enable row level security;
