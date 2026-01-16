# Screentime App - Project Overview

## Project Goal

A React Native mobile app for parents to monitor and manage their children's screen time, with a companion child interface for self-monitoring. The app tracks device usage on Android devices, provides analytics, and enforces screen time limits.

## Tech Stack

- **Frontend**: React Native with Expo Router
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security)
- **State Management**: TanStack Query (planned)
- **Native Module**: Expo Modules API for Android UsageStats
- **Language**: TypeScript

## Architecture

### Route Structure
```
app/
  (auth)/       # Login/Signup for parents and children
  (parent)/     # Parent dashboard and child management
  (child)/      # Child's own screen time view
```

### Application Code
```
src/
  features/     # Feature-based organization
    auth/       # Authentication flows
    parent/     # Parent-specific logic
    child/      # Child-specific logic
  ui/           # Shared UI components
  lib/          # Third-party integrations
  utils/        # Utilities
```

## Key Features

### For Parents
- Register and manage multiple children
- View each child's app usage and screen time
- Set daily limits per app
- View analytics across days/weeks/months
- Google OAuth and email/password authentication

### For Children
- Login to view their own screen time data
- See app usage with limits and remaining time
- View personal analytics (trends, most used apps)
- Cannot access other children's data (enforced by RLS)

### Device Integration
- Android UsageStats permission for usage tracking
- Daily aggregation and batch sync to Supabase
- Automatic metadata updates for installed apps

## Database Schema Highlights

- `profiles` - User profiles with role (parent/child)
- `children` - Child records linked to parent
- `child_apps` - App metadata and daily limits
- `app_usage` - Daily usage records per child per app
- **RLS Policies**: Strict row-level security ensures parents only see their children, children only see their own data

## Current Status

**Phase 2: Data model and RLS**
- ✅ Route structure created
- ✅ Database schema applied
- ✅ Auth flows implemented
- ✅ Role-based routing working
- ⏳ Verifying RLS policies
- ⏳ Regenerating TypeScript types

**Next Steps:**
- Complete RLS verification
- Build Parent Home with child list
- Implement Child Home and Analytics
- Integrate Android UsageStats module

## Important Files

- `docs/IMPLEMENTATION_PLAN.md` - Detailed phase-by-phase plan
- `docs/DB_SCHEMA.sql` - Database schema
- `docs/API_CONTRACT.md` - API endpoints and contracts
- `docs/RLS_TESTS.sql` - Manual RLS verification tests
- `lib/supabase.ts` - Supabase client configuration
- `types/database-types.ts` - Generated TypeScript types

## Development Guidelines

1. Keep tasks small and verifiable
2. Do not change app logic unless specified in the plan
3. Follow the phased implementation approach
4. Verify RLS policies for all data access
5. Use TanStack Query for server state management
6. Test both parent and child user flows

## Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
