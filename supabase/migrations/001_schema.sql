create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  admin_class text not null check (admin_class ~ '^(10[1-8]|20[1-8])$'),
  student_number text not null,
  course_type text not null check (course_type in ('HCL','CL')),
  teaching_class text not null,
  login_code_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (admin_class, student_number)
);

create table if not exists public.idiom_answers (
  idiom_num integer primary key check (idiom_num between 1 and 138),
  idiom_name text not null,
  answer_key jsonb not null,
  explanations jsonb not null
);

create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  idiom_num integer not null check (idiom_num between 1 and 138),
  first_attempt_correct boolean not null,
  first_attempt_answers jsonb not null,
  practice_completed boolean not null default false,
  attempt_count integer not null default 1,
  last_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, idiom_num)
);

create table if not exists public.gold_cards (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  idiom_num integer not null check (idiom_num between 1 and 138),
  awarded_at timestamptz not null default now(),
  unique (student_id, idiom_num)
);

create index if not exists students_teaching_class_idx on public.students(teaching_class);
create index if not exists students_course_type_idx on public.students(course_type);
create index if not exists attempts_student_idx on public.attempts(student_id);
create index if not exists gold_cards_student_idx on public.gold_cards(student_id);

alter table public.students enable row level security;
alter table public.idiom_answers enable row level security;
alter table public.attempts enable row level security;
alter table public.gold_cards enable row level security;

-- No browser-facing policies are created. Netlify Functions use the service-role key.

create or replace function public.get_student_leaderboard(p_student_id uuid, p_scope text)
returns table (
  label text,
  teaching_class text,
  course_type text,
  gold bigint
)
language sql
security definer
set search_path = public
as $$
  with viewer as (
    select admin_class, teaching_class, course_type
    from public.students where id = p_student_id and active = true
  )
  select
    s.admin_class || '班·' || s.student_number || '号' as label,
    s.teaching_class,
    s.course_type,
    count(g.id) as gold
  from public.students s
  cross join viewer v
  left join public.gold_cards g on g.student_id = s.id
  where s.active = true and (
    (p_scope = 'teaching' and s.teaching_class = v.teaching_class) or
    (p_scope = 'admin' and s.admin_class = v.admin_class) or
    (p_scope = 'course' and s.course_type = v.course_type)
  )
  group by s.id, s.admin_class, s.student_number, s.teaching_class, s.course_type
  order by gold desc, label asc
  limit 50;
$$;

revoke all on function public.get_student_leaderboard(uuid, text) from public, anon, authenticated;
grant execute on function public.get_student_leaderboard(uuid, text) to service_role;
