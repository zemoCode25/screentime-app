# Screentime App Implementation Plan

This doc is the guide for this session. Keep tasks small and verifiable. Do not change app logic unless specified.

## Current focus

- Resolve schema drift between `docs/DB_SCHEMA.sql`, `types/database-types.ts`, and app code; then verify RLS.

## Target folder structure

Routes (Expo Router): `app/`

```
app/
  (auth)/
    login.tsx
    signup.tsx
  (parent)/
    home.tsx
    child/
      [childId].tsx
      app/
        [packageName].tsx
  (child)/
    home.tsx
    analytics.tsx
```

Application code: `src/`

```
src/
  features/
    auth/
      components/
      hooks/
      services/
      validation/
    parent/
      hooks/
      services/
    child/
      hooks/
      services/
  ui/
  lib/
  utils/
```

## Repo scan summary (current state)

- Expo Router app with route groups in `app/(auth)`, `app/(parent)`, and `app/(child)` plus built-out screens (parent dashboard, child registration/detail/app detail, child home/analytics, override requests, blocked app).
- Supabase client in `lib/supabase.ts` uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; data hooks live in `src/features/*`.
- `types/database-types.ts` includes tables/enums like `app_usage_hourly` and `app_limits.applies_*` that the app code expects.
- `docs/DB_SCHEMA.sql` + `docs/API_CONTRACT.md` describe a different schema (e.g., `applies_to_days`, `child_device_id`, `insight_date`, enum values).
- Supabase local config is in `supabase/config.toml` with no schema files configured; `docs/migrations/*` covers icon storage setup.

## Phase 0: Docs and baseline (this pass)

- [x] ~~`docs/IMPLEMENTATION_PLAN.md`~~
- [x] ~~`docs/DB_SCHEMA.sql` draft~~
- [x] ~~`docs/API_CONTRACT.md` draft~~
- [ ] Confirm app boots with `npm run start` when needed

## Phase 1: Route + module layout (no logic changes)

- [x] ~~Create target route groups under `app/` as listed above~~
- [x] ~~Move existing starter routes into the new structure (or delete example routes)~~
- [x] ~~Create `src/` folders for features and shared code~~
- [ ] Update import aliases to point to `src/` once files are moved

Verify

- [ ] App boots with the new route tree
- [ ] No logic changes; only file moves and layout setup

## Phase 2: Data model and RLS (current)

- [ ] Choose canonical schema source (docs vs generated types) and align code + docs
- [ ] Align `app_limits` day-of-week fields (`applies_*` vs `applies_to_days`)
- [ ] Align `app_usage_daily` device linkage (`device_id` vs `child_device_id`) and unique constraints
- [ ] Add/rename `app_usage_hourly` (used in child analytics) or remove usage in app
- [ ] Align enums + motivations (`app_category` values, `motivation_type` vs text[])
- [ ] Align `ai_insights` shape (`insight_date` vs `period_start/period_end`)
- [ ] Update `docs/DB_SCHEMA.sql` + `docs/API_CONTRACT.md` to match canonical schema
- [ ] Refresh `docs/RLS_TESTS.sql` for the final columns
- [ ] Regenerate `types/database-types.ts`
- [ ] Verify RLS policies for parent and child access
- [x] ~~Add `docs/RLS_TESTS.sql` for manual verification~~

Verify

- [ ] Run updated `docs/RLS_TESTS.sql` in Supabase SQL editor
- [ ] Parent reads and writes only their children
- [ ] Child reads only their own data
- [ ] Usage and limits upsert safely (daily + hourly)

## Phase 3: Auth and session

- [x] ~~Parent and child auth flows~~
- [x] ~~Parent Login: email/password + Google~~
- [x] ~~Parent Sign-up: email/password + Google~~
- [x] ~~Child Login only: email/password + Google~~
- [x] ~~Session restore on app launch~~
- [x] ~~Role-based routing (based on `profiles.role`):~~
  - [x] ~~parent → Parent Home~~
  - [x] ~~child → Child Home~~
- [x] ~~Sign out clears session and cache~~

Verify

- [ ] Parent lands on parent home
- [ ] Child lands on child home
- [ ] Sign out returns to auth flow

## Phase 4: Parent Home + Child Registration

- [x] ~~Parent Home header: app title/logo + profile dropdown + sign out~~
- [x] ~~Parent Home list of child cards (name, age, interests, avg screen time)~~
- [x] ~~"+" opens Child Registration Form~~
- [x] ~~Child Registration Form fields:~~
  - [x] ~~name, age, grade_level~~
  - [x] ~~interests[]~~
  - [x] ~~motivations[]~~
- [x] ~~Create child row in `children` with `parent_user_id = auth.uid()`~~
- [x] ~~Refresh child list after add~~
- [x] ~~Implement TanStack Query hooks:~~
  - [x] ~~`useChildrenList()`~~
  - [x] ~~`useCreateChild()`~~

Verify

- [ ] Newly added child appears immediately
- [ ] Usage and limits render from DB

## Phase 5: Child Module Screens (Home + Analytics)

- [x] ~~Child Home:~~
  - [x] ~~list apps with usage today, limit, remaining time, progress bar~~
- [x] ~~Child Analytics:~~
  - [x] ~~KPIs: average trend, most used app, simple behavior label~~
  - [x] ~~Pie chart: category distribution~~
  - [x] ~~Bar chart: day/week/month totals~~
- [ ] Ensure queries are RLS-safe (child sees only own records)

Verify

- [ ] Child view matches parent data for the same child

## Phase 6: Device usage sync (Android MVP)

- [x] ~~UsageStats permission flow~~
- [x] ~~Daily aggregation and batch upsert~~
- [x] ~~Update child_apps metadata~~
- [x] ~~Icon sync to Supabase Storage (app-icons bucket)~~
- [ ] Hourly aggregation + `app_usage_hourly` upsert for analytics charts
- [x] ~~Override request + grant/deny flows~~
- [x] ~~Blocking enforcement + blocked app screen~~

Verify

- [ ] Parent sees updated usage after sync

## Phase 7: Hardening and docs

- [ ] Error handling and loading states
- [ ] `docs/DEMO_STEPS.md`
- [ ] `docs/TEST_CHECKLIST.md`
