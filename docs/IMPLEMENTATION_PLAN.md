# Screentime App Implementation Plan

This doc is the guide for this session. Keep tasks small and verifiable. Do not change app logic unless specified.

## Current focus
- Phase 2: Data model and RLS (verify RLS policies and child access)

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
- Expo Router app with route groups in `app/(auth)`, `app/(parent)`, and `app/(child)` using placeholder screens.
- Supabase client in `lib/supabase.ts` uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase types live in `types/database-types.ts` and the public schema is currently empty.
- Supabase local config is in `supabase/config.toml` with no schema files configured.

## Phase 0: Docs and baseline (this pass)
- [x] `docs/IMPLEMENTATION_PLAN.md`
- [x] `docs/DB_SCHEMA.sql` draft
- [x] `docs/API_CONTRACT.md` draft
- [ ] Confirm app boots with `npm run start` when needed

## Phase 1: Route + module layout (no logic changes)
- [x] Create target route groups under `app/` as listed above
- [x] Move existing starter routes into the new structure (or delete example routes)
- [x] Create `src/` folders for features and shared code
- [ ] Update import aliases to point to `src/` once files are moved

Verify
- [ ] App boots with the new route tree
- [ ] No logic changes; only file moves and layout setup

## Phase 2: Data model and RLS (current)
- [ ] Apply schema in `docs/DB_SCHEMA.sql`
- [ ] Regenerate `types/database-types.ts`
- [ ] Verify RLS policies for parent and child access

Verify
- [ ] Parent reads and writes only their children
- [ ] Child reads only their own data
- [ ] Usage and limits upsert safely

## Phase 3: Auth and session
- [ ] Parent and child auth flows
- [ ] Role-based routing after login
- [ ] Session restore and sign out

Verify
- [ ] Parent lands on parent home
- [ ] Child lands on child home
- [ ] Sign out returns to auth flow

## Phase 4: Parent flows
- [ ] Parent home with child list
- [ ] Child registration form and create flow
- [ ] Selected child usage tab (day and week)
- [ ] Selected app limits and insights

Verify
- [ ] Newly added child appears immediately
- [ ] Usage and limits render from DB

## Phase 5: Child flows
- [ ] Child home with today's usage
- [ ] Child analytics KPIs and charts

Verify
- [ ] Child view matches parent data for the same child

## Phase 6: Device usage sync (Android MVP)
- [ ] UsageStats permission flow
- [ ] Daily aggregation and batch upsert
- [ ] Update child_apps metadata

Verify
- [ ] Parent sees updated usage after sync

## Phase 7: Hardening and docs
- [ ] Error handling and loading states
- [ ] `docs/DEMO_STEPS.md`
- [ ] `docs/TEST_CHECKLIST.md`
