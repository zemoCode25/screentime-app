-- Screentime App DB Schema (draft)
-- Intended for Supabase Postgres. Apply via migrations when ready.
-- Keep in sync with docs/API_CONTRACT.md and types/database-types.ts.

create extension if not exists "pgcrypto";

-- Enums
create type if not exists user_role as enum ('parent', 'child');
create type if not exists device_platform as enum ('android', 'ios', 'web', 'unknown');
create type if not exists app_category as enum (
  'social',
  'games',
  'education',
  'productivity',
  'entertainment',
  'communication',
  'utilities',
  'other'
);

-- Core tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role user_role not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  child_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  age integer check (age >= 0 and age <= 21),
  grade_level text,
  interests text[] not null default '{}',
  motivations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_devices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  platform device_platform not null default 'android',
  device_id text not null,
  device_name text,
  os_version text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, device_id)
);

create table if not exists public.child_apps (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  package_name text not null,
  app_name text not null,
  category app_category not null default 'other',
  icon_url text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, package_name)
);

create table if not exists public.app_usage_daily (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  package_name text not null,
  usage_date date not null,
  total_seconds integer not null default 0,
  open_count integer not null default 0,
  child_device_id uuid not null references public.child_devices(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, package_name, usage_date, child_device_id)
);

-- applies_to_days: integers 0-6 where 0 = Sunday, 6 = Saturday
create table if not exists public.app_limits (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  package_name text not null,
  limit_seconds integer not null,
  applies_to_days smallint[] not null default '{0,1,2,3,4,5,6}',
  bonus_enabled boolean not null default false,
  bonus_minutes integer not null default 0,
  bonus_streak_target integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, package_name)
);

-- package_name null means child-level insight
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  package_name text,
  insight_date date not null,
  suggested_limit_seconds integer,
  insights text[] not null default '{}',
  model_version text,
  created_at timestamptz not null default now()
);

-- Updated at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_children on public.children;
create trigger set_updated_at_children
before update on public.children
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_child_devices on public.child_devices;
create trigger set_updated_at_child_devices
before update on public.child_devices
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_child_apps on public.child_apps;
create trigger set_updated_at_child_apps
before update on public.child_apps
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_app_usage_daily on public.app_usage_daily;
create trigger set_updated_at_app_usage_daily
before update on public.app_usage_daily
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_app_limits on public.app_limits;
create trigger set_updated_at_app_limits
before update on public.app_limits
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_children_parent on public.children(parent_user_id);
create index if not exists idx_children_child_user on public.children(child_user_id);
create index if not exists idx_child_devices_child on public.child_devices(child_id);
create index if not exists idx_child_apps_child on public.child_apps(child_id);
create index if not exists idx_child_apps_package on public.child_apps(package_name);
create index if not exists idx_usage_child_date on public.app_usage_daily(child_id, usage_date);
create index if not exists idx_usage_child_package_date on public.app_usage_daily(child_id, package_name, usage_date);
create index if not exists idx_limits_child on public.app_limits(child_id);
create index if not exists idx_insights_child_date on public.ai_insights(child_id, insight_date);

-- RLS
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.child_devices enable row level security;
alter table public.child_apps enable row level security;
alter table public.app_usage_daily enable row level security;
alter table public.app_limits enable row level security;
alter table public.ai_insights enable row level security;

-- Profiles: user can read and edit their own row
create policy "profiles_select_own" on public.profiles
for select using (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
for insert with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid());

-- Children: parent can CRUD, child can read their own row
create policy "children_select_parent_or_child" on public.children
for select using (
  parent_user_id = auth.uid()
  or child_user_id = auth.uid()
);

create policy "children_insert_parent" on public.children
for insert with check (parent_user_id = auth.uid());

create policy "children_update_parent" on public.children
for update using (parent_user_id = auth.uid());

create policy "children_delete_parent" on public.children
for delete using (parent_user_id = auth.uid());

-- Child devices: parent or child can read, child can write
create policy "child_devices_select_parent_or_child" on public.child_devices
for select using (
  exists (
    select 1 from public.children c
    where c.id = child_devices.child_id
      and (c.parent_user_id = auth.uid() or c.child_user_id = auth.uid())
  )
);

create policy "child_devices_write_child" on public.child_devices
for insert with check (
  exists (
    select 1 from public.children c
    where c.id = child_devices.child_id
      and c.child_user_id = auth.uid()
  )
);

create policy "child_devices_update_child" on public.child_devices
for update using (
  exists (
    select 1 from public.children c
    where c.id = child_devices.child_id
      and c.child_user_id = auth.uid()
  )
);

-- Child apps: parent or child can read, child can write (device sync)
create policy "child_apps_select_parent_or_child" on public.child_apps
for select using (
  exists (
    select 1 from public.children c
    where c.id = child_apps.child_id
      and (c.parent_user_id = auth.uid() or c.child_user_id = auth.uid())
  )
);

create policy "child_apps_write_child" on public.child_apps
for insert with check (
  exists (
    select 1 from public.children c
    where c.id = child_apps.child_id
      and c.child_user_id = auth.uid()
  )
);

create policy "child_apps_update_child" on public.child_apps
for update using (
  exists (
    select 1 from public.children c
    where c.id = child_apps.child_id
      and c.child_user_id = auth.uid()
  )
);

-- App usage: parent or child can read, child can write (device sync)
create policy "app_usage_select_parent_or_child" on public.app_usage_daily
for select using (
  exists (
    select 1 from public.children c
    where c.id = app_usage_daily.child_id
      and (c.parent_user_id = auth.uid() or c.child_user_id = auth.uid())
  )
);

create policy "app_usage_write_child" on public.app_usage_daily
for insert with check (
  exists (
    select 1 from public.children c
    where c.id = app_usage_daily.child_id
      and c.child_user_id = auth.uid()
  )
);

create policy "app_usage_update_child" on public.app_usage_daily
for update using (
  exists (
    select 1 from public.children c
    where c.id = app_usage_daily.child_id
      and c.child_user_id = auth.uid()
  )
);

-- App limits: parent can write, parent/child can read
create policy "app_limits_select_parent_or_child" on public.app_limits
for select using (
  exists (
    select 1 from public.children c
    where c.id = app_limits.child_id
      and (c.parent_user_id = auth.uid() or c.child_user_id = auth.uid())
  )
);

create policy "app_limits_write_parent" on public.app_limits
for insert with check (
  exists (
    select 1 from public.children c
    where c.id = app_limits.child_id
      and c.parent_user_id = auth.uid()
  )
);

create policy "app_limits_update_parent" on public.app_limits
for update using (
  exists (
    select 1 from public.children c
    where c.id = app_limits.child_id
      and c.parent_user_id = auth.uid()
  )
);

-- AI insights: parent/child can read; service role writes (no insert policy)
create policy "ai_insights_select_parent_or_child" on public.ai_insights
for select using (
  exists (
    select 1 from public.children c
    where c.id = ai_insights.child_id
      and (c.parent_user_id = auth.uid() or c.child_user_id = auth.uid())
  )
);
