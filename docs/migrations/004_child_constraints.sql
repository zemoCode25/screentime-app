-- Migration: Add child constraints tables for bedtime/focus and usage settings
-- Run this in your Supabase SQL Editor

create table if not exists public.child_time_rules (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  rule_type text not null check (rule_type in ('bedtime', 'focus')),
  days smallint[] not null default '{}',
  start_seconds integer not null check (start_seconds >= 0 and start_seconds < 86400),
  end_seconds integer not null check (end_seconds >= 0 and end_seconds < 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_usage_settings (
  child_id uuid primary key references public.children(id) on delete cascade,
  daily_limit_seconds integer not null default 0,
  weekend_bonus_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at_child_time_rules on public.child_time_rules;
create trigger set_updated_at_child_time_rules
before update on public.child_time_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_child_usage_settings on public.child_usage_settings;
create trigger set_updated_at_child_usage_settings
before update on public.child_usage_settings
for each row execute function public.set_updated_at();

create index if not exists idx_child_time_rules_child_type
  on public.child_time_rules(child_id, rule_type);

alter table public.child_time_rules enable row level security;
alter table public.child_usage_settings enable row level security;

create policy "child_time_rules_select_parent_or_child"
on public.child_time_rules
for select using (
  exists (
    select 1 from public.children c
    where c.id = child_time_rules.child_id
      and (c.parent_user_id = auth.uid() or c.child_user_id = auth.uid())
  )
);

create policy "child_time_rules_insert_parent"
on public.child_time_rules
for insert with check (
  exists (
    select 1 from public.children c
    where c.id = child_time_rules.child_id
      and c.parent_user_id = auth.uid()
  )
);

create policy "child_time_rules_update_parent"
on public.child_time_rules
for update using (
  exists (
    select 1 from public.children c
    where c.id = child_time_rules.child_id
      and c.parent_user_id = auth.uid()
  )
);

create policy "child_time_rules_delete_parent"
on public.child_time_rules
for delete using (
  exists (
    select 1 from public.children c
    where c.id = child_time_rules.child_id
      and c.parent_user_id = auth.uid()
  )
);

create policy "child_usage_settings_select_parent_or_child"
on public.child_usage_settings
for select using (
  exists (
    select 1 from public.children c
    where c.id = child_usage_settings.child_id
      and (c.parent_user_id = auth.uid() or c.child_user_id = auth.uid())
  )
);

create policy "child_usage_settings_insert_parent"
on public.child_usage_settings
for insert with check (
  exists (
    select 1 from public.children c
    where c.id = child_usage_settings.child_id
      and c.parent_user_id = auth.uid()
  )
);

create policy "child_usage_settings_update_parent"
on public.child_usage_settings
for update using (
  exists (
    select 1 from public.children c
    where c.id = child_usage_settings.child_id
      and c.parent_user_id = auth.uid()
  )
);

create policy "child_usage_settings_delete_parent"
on public.child_usage_settings
for delete using (
  exists (
    select 1 from public.children c
    where c.id = child_usage_settings.child_id
      and c.parent_user_id = auth.uid()
  )
);
