-- RLS verification tests (manual)
-- Run in Supabase SQL Editor. Replace placeholders in angle brackets.
-- Tip: Run each block separately; expected failures will abort the current transaction.

-- ===== SETUP (run as postgres/admin) =====
-- Create auth users in the Supabase Auth UI first and copy their UUIDs.
-- Required placeholders: <PARENT_UID>, <CHILD_UID>, <OTHER_UID>

insert into public.profiles (user_id, role, display_name)
values
  ('<PARENT_UID>', 'parent', 'Parent User'),
  ('<CHILD_UID>', 'child', 'Child User'),
  ('<OTHER_UID>', 'parent', 'Other User')
on conflict (user_id) do nothing;

-- Create a child row and copy the returned id as <CHILD_ID>
insert into public.children (parent_user_id, child_user_id, name, age)
values ('<PARENT_UID>', '<CHILD_UID>', 'Test Child', 10)
returning id;

-- Create a device row and copy the returned id as <CHILD_DEVICE_ID>
insert into public.child_devices (child_id, platform, device_id, device_name)
values ('<CHILD_ID>', 'android', 'device-1', 'Test Device')
returning id;

-- ===== PARENT ACCESS TESTS =====
-- Expect: parent can read own child, create children, and manage limits.

begin;
select set_config('request.jwt.claims', '{"sub":"<PARENT_UID>","role":"authenticated"}', true);
set local role authenticated;

select auth.uid() as parent_uid;
select * from public.children where parent_user_id = '<PARENT_UID>';

insert into public.children (parent_user_id, name)
values ('<PARENT_UID>', 'Another Child');

insert into public.app_limits (child_id, package_name, limit_seconds)
values ('<CHILD_ID>', 'com.example.app', 3600);

rollback;

-- Expect: parent cannot create children for another parent (should fail)
-- Run this block separately; it should error on insert.

begin;
select set_config('request.jwt.claims', '{"sub":"<PARENT_UID>","role":"authenticated"}', true);
set local role authenticated;

insert into public.children (parent_user_id, name)
values ('<OTHER_UID>', 'Should Fail');

rollback;

-- ===== CHILD ACCESS TESTS =====
-- Expect: child can read their row and write usage, but cannot set limits.

begin;
select set_config('request.jwt.claims', '{"sub":"<CHILD_UID>","role":"authenticated"}', true);
set local role authenticated;

select auth.uid() as child_uid;
select * from public.children where child_user_id = '<CHILD_UID>';

insert into public.app_usage_daily (
  child_id,
  package_name,
  usage_date,
  total_seconds,
  open_count,
  child_device_id
) values (
  '<CHILD_ID>',
  'com.example.app',
  current_date,
  120,
  1,
  '<CHILD_DEVICE_ID>'
);

rollback;

-- Expect: child cannot create limits (should fail)
-- Run this block separately; it should error on insert.

begin;
select set_config('request.jwt.claims', '{"sub":"<CHILD_UID>","role":"authenticated"}', true);
set local role authenticated;

insert into public.app_limits (child_id, package_name, limit_seconds)
values ('<CHILD_ID>', 'com.example.app', 3600);

rollback;

-- ===== OTHER USER ACCESS TESTS =====
-- Expect: other user cannot read this family's rows.

begin;
select set_config('request.jwt.claims', '{"sub":"<OTHER_UID>","role":"authenticated"}', true);
set local role authenticated;

select * from public.children where parent_user_id = '<PARENT_UID>';
select * from public.app_usage_daily where child_id = '<CHILD_ID>';

rollback;
