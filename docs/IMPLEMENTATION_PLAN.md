# WellTime Implementation Plan (Codex CLI Checklist)

> Rules for Codex execution

- Keep each task small and verifiable (1 feature slice per commit).
- No extra screens beyond: Parent Auth (Login/Signup), Parent Home, Child Registration Form, Selected Child (Usage/Analytics tabs), Selected App, Child Auth (Login), Child Home, Child Analytics.
- Prefer aggregated screen-time storage (daily; hourly optional).

---

## Phase 0 — Project Setup

- [ ] Add `docs/IMPLEMENTATION_PLAN.md` (this file)
- [ ] Add `docs/DB_SCHEMA.sql` (final SQL schema)
- [ ] Add `docs/API_CONTRACT.md` (payload shapes)
- [ ] Confirm Expo app boots
- [ ] Configure NativeWind
- [ ] Configure TanStack Query provider
- [ ] Configure Supabase client (env vars + client init)
- [ ] Add a simple “health render” screen to confirm navigation works

**Verify**

- [ ] `npm run start` runs without errors
- [ ] App renders a basic screen

---

## Phase 1 — Supabase DB + RLS

- [ ] Execute schema: enums, tables, indexes, triggers
- [ ] Enable RLS on all tables
- [ ] Add RLS policies:
  - [ ] Parent can CRUD their `children`
  - [ ] Child can read their own `children` row and write usage for their `child_id`
  - [ ] Parent/Child can read usage + limits for their linked child
- [ ] (Optional) Insert seed test data for local testing

**Verify**

- [ ] Parent can select only their children
- [ ] Child can upsert only their usage rows
- [ ] Other-user access is denied by RLS

---

## Phase 2 — Authentication (Parent + Child)

- [ ] Parent Login: email/password + Google
- [ ] Parent Sign-up: email/password + Google
- [ ] Child Login only: email/password + Google
- [ ] Session restore on app launch
- [ ] Role-based routing (based on `profiles.role`):
  - [ ] parent → Parent Home
  - [ ] child → Child Home
- [ ] Sign out clears session and cache

**Verify**

- [ ] Parent account logs in and reaches Parent Home
- [ ] Child account logs in and reaches Child Home
- [ ] Sign out returns to correct auth flow

---

## Phase 3 — Parent Home + Child Registration

- [ ] Parent Home header: app title/logo + profile dropdown + sign out
- [ ] Parent Home list of child cards (name, age, interests, avg screen time)
- [ ] “+” opens Child Registration Form
- [ ] Child Registration Form fields:
  - [ ] name, age, grade_level
  - [ ] interests[]
  - [ ] motivations[]
- [ ] Create child row in `children` with `parent_user_id = auth.uid()`
- [ ] Refresh child list after add
- [ ] Implement TanStack Query hooks:
  - [ ] `useChildrenList()`
  - [ ] `useCreateChild()`

**Verify**

- [ ] Adding a child immediately appears on Parent Home
- [ ] Avg screen time placeholder works (0 if no data)

---

## Phase 4 — Parent Selected Child Screen (Usage Tab)

- [ ] Navigate from child card → Selected Child screen
- [ ] Tabs: Usage | Analytics (Analytics implemented later)
- [ ] Usage tab:
  - [ ] Day/Week filter (default Day)
  - [ ] Bar graph for total screen time:
    - [ ] Day: selected date total
    - [ ] Week: Sun–Sat totals
  - [ ] App list for selected period:
    - [ ] app icon/name
    - [ ] usage today (or selected date)
    - [ ] remaining time (if limit exists)
    - [ ] progress bar
  - [ ] Tap app row → Selected Application screen

**Verify**

- [ ] Day filter shows correct totals for chosen date
- [ ] Week filter shows 7 bars with correct sums
- [ ] App list matches stored `app_usage_daily`

---

## Phase 5 — Parent Selected Application Screen (Limits + Bonus + AI panels)

- [ ] KPIs:
  - [ ] screen time today
  - [ ] avg usage (day/week toggle)
- [ ] Chart:
  - [ ] Day/Week usage chart (toggle acceptable)
- [ ] Add/Edit Usage Limit form:
  - [ ] apply days (multi-select) OR whole-week toggle
  - [ ] limit input (hours/minutes)
  - [ ] save to `app_limits` (upsert)
- [ ] Bonus extension:
  - [ ] bonus_enabled toggle
  - [ ] bonus_minutes (converted to seconds in DB)
  - [ ] bonus_streak_target (default 1)
- [ ] AI panels (read-only from DB):
  - [ ] read latest `ai_insights` for child+app over last 7 days
  - [ ] display suggested limit + bullet insights array
  - [ ] handle empty state gracefully

**Verify**

- [ ] Saving limits updates remaining time back on Usage tab
- [ ] Bonus fields persist correctly
- [ ] AI panel renders without errors even if empty

---

## Phase 6 — Parent Analytics Tab

- [ ] Analytics tab KPIs:
  - [ ] average time usage (interval filter)
  - [ ] most used app
  - [ ] most used category
  - [ ] overuse days count (simple logic)
- [ ] Filters:
  - [ ] day/week/month
  - [ ] category filter
- [ ] Charts/Lists:
  - [ ] Pie chart: category distribution
  - [ ] Top 5 apps list
  - [ ] Most screen time per day of week (Sun–Sat)
  - [ ] Time most active:
    - [ ] if hourly table exists: compute peak hour/range
    - [ ] else: compute simple estimate or omit visualization but keep value
- [ ] AI Insights summary:
  - [ ] display child-level `ai_insights` (package_name is null)

**Verify**

- [ ] Filters update KPIs and charts correctly
- [ ] Analytics loads fast for 7–30 days of data

---

## Phase 7 — Child Module Screens (Home + Analytics)

- [ ] Child Home:
  - [ ] list apps with usage today, limit, remaining time, progress bar
- [ ] Child Analytics:
  - [ ] KPIs: average trend, most used app, simple behavior label
  - [ ] Pie chart: category distribution
  - [ ] Bar chart: day/week/month totals
- [ ] Ensure queries are RLS-safe (child sees only own records)

**Verify**

- [ ] Child cannot read other children’s data
- [ ] Values match parent views for same child

---

## Phase 8 — Child Device Screen-Time Sync (Android MVP)

- [ ] Android permission flow: Usage Access (UsageStatsManager)
- [ ] Collect today’s per-app total seconds (MVP)
- [ ] Batch upsert to `app_usage_daily`:
  - [ ] include `child_id`, `package_name`, `usage_date`, `total_seconds`, `open_count?`, `device_id`
- [ ] Upsert/update `child_apps` metadata:
  - [ ] `package_name`, `app_name`, default category `other`
- [ ] Sync triggers:
  - [ ] on Child Home mount (on app open)
  - [ ] optional periodic sync while app is open (30–60 mins)

**Verify**

- [ ] Usage rows appear in DB after sync
- [ ] Parent sees updated usage after refresh
- [ ] Sync uses batch upsert (no per-second logging)

---

## Phase 9 — Stabilization + Demo Readiness

- [ ] Error handling for all network calls (friendly messages)
- [ ] Loading states for all queries (skeleton/spinner)
- [ ] Add `docs/DEMO_STEPS.md` (end-to-end demo script)
- [ ] Add `docs/TEST_CHECKLIST.md` (manual test cases)
- [ ] Confirm indexes cover common queries (child_id + date)
- [ ] Final smoke test:
  - [ ] Parent: login → add child → usage → set limit → analytics
  - [ ] Child: login → grant permission → sync → view home/analytics

**Verify**

- [ ] End-to-end demo completes without crashes
- [ ] RLS confirmed working
- [ ] App matches minimal screen list exactly
