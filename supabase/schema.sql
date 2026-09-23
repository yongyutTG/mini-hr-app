create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  line_user_id text unique,
  display_name text,
  full_name text,
  department text,
  position text,
  phone text,
  email text,
  bank_account text,
  roles text,
  status text not null default 'active',
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  employee_code text not null,
  leave_type text,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  duration_type text,
  hours numeric(8, 2) not null default 0,
  reason text,
  status text not null default 'pending',
  approver_l1_id text,
  approver_l2_id text,
  approver_l3_id text,
  evidence_url text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leave_requests_employee_code_idx
  on public.leave_requests (employee_code);

create index if not exists leave_requests_status_idx
  on public.leave_requests (status);

create index if not exists leave_requests_start_date_idx
  on public.leave_requests (start_date);

create table if not exists public.ot_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  employee_code text not null,
  ot_date date,
  start_time time,
  end_time time,
  hours numeric(8, 2) not null default 0,
  reason text,
  status text not null default 'pending',
  approver_l1_id text,
  approver_l2_id text,
  approver_l3_id text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ot_requests_employee_code_idx
  on public.ot_requests (employee_code);

create index if not exists ot_requests_status_idx
  on public.ot_requests (status);

create index if not exists ot_requests_ot_date_idx
  on public.ot_requests (ot_date);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  checkin_id text not null unique,
  employee_code text not null,
  line_user_id text,
  event_type text not null default 'checkin',
  event_at timestamptz not null default now(),
  branch_name text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  distance_meters numeric(10, 2),
  photo_url text,
  status text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_logs_employee_code_idx
  on public.attendance_logs (employee_code);

create index if not exists attendance_logs_event_at_idx
  on public.attendance_logs (event_at);

create table if not exists public.sync_errors (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'apps_script',
  table_name text,
  request_id text,
  status_code integer,
  error_message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;
alter table public.leave_requests enable row level security;
alter table public.ot_requests enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.sync_errors enable row level security;

-- During the migration, Apps Script should write with SUPABASE_SERVICE_ROLE_KEY.
-- Do not expose the service role key in frontend LIFF pages.
