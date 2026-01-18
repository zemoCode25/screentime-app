# API Contract

This document defines request and response shapes for Supabase usage. It is the working contract for this session.

## Conventions
- IDs: UUID strings
- Timestamps: ISO 8601 UTC (timestamptz)
- Dates: YYYY-MM-DD (date)
- Durations: seconds
- Emails: lowercase strings
- RLS: parent and child access is enforced in the database

## Enums
- user_role: parent | child
- device_platform: android | ios | web | unknown
- app_category: social | games | education | productivity | entertainment | communication | utilities | other
- motivation_type: entertainment_videos | gaming | learning_education | social_communication | creativity | habit_boredom | relaxation_stress_relief | rewards_achievements | other

## Table models (row shapes)

### profiles
```json
{
  "user_id": "uuid",
  "role": "parent | child",
  "display_name": "string | null",
  "created_at": "timestamp"
}
```

### children
```json
{
  "id": "uuid",
  "parent_user_id": "uuid",
  "child_email": "string",
  "child_user_id": "uuid | null",
  "name": "string",
  "age": "number | null",
  "grade_level": "string | null",
  "interests": ["string"],
  "motivations": ["string"],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### child_devices
```json
{
  "id": "uuid",
  "child_id": "uuid",
  "platform": "android | ios | web | unknown",
  "device_id": "string",
  "device_name": "string | null",
  "os_version": "string | null",
  "last_seen_at": "timestamp | null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### child_apps
```json
{
  "id": "uuid",
  "child_id": "uuid",
  "package_name": "string",
  "app_name": "string",
  "category": "app_category",
  "icon_url": "string | null",
  "is_hidden": "boolean",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### app_usage_daily
```json
{
  "id": "uuid",
  "child_id": "uuid",
  "package_name": "string",
  "usage_date": "YYYY-MM-DD",
  "total_seconds": "number",
  "open_count": "number",
  "child_device_id": "uuid",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### app_limits
```json
{
  "id": "uuid",
  "child_id": "uuid",
  "package_name": "string",
  "limit_seconds": "number",
  "applies_to_days": [0, 1, 2, 3, 4, 5, 6],
  "bonus_enabled": "boolean",
  "bonus_minutes": "number",
  "bonus_streak_target": "number",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### ai_insights
```json
{
  "id": "uuid",
  "child_id": "uuid",
  "package_name": "string | null",
  "insight_date": "YYYY-MM-DD",
  "suggested_limit_seconds": "number | null",
  "insights": ["string"],
  "model_version": "string | null",
  "created_at": "timestamp"
}
```

## Core operations

### Parent: list children
Query: `children` by parent_user_id (RLS enforces)

Response: array of children rows (includes `child_email`, `child_user_id`)

### Parent: create child
Insert into `children` (creates a pending child account)

Request
```json
{
  "child_email": "kid@example.com",
  "name": "string",
  "age": 10,
  "grade_level": "4",
  "interests": ["art", "sports"],
  "motivations": ["rewards"]
}
```

Response: created child row

### Child: claim pending child
Update `children` by email when the child signs in with Google

Request
```json
{
  "child_user_id": "auth.uid()",
  "child_email": "kid@example.com"
}
```

Response: updated child row

### Child: upsert device
Upsert `child_devices` on (child_id, device_id)

Request
```json
{
  "child_id": "uuid",
  "platform": "android",
  "device_id": "string",
  "device_name": "Pixel",
  "os_version": "15"
}
```

### Child: upsert app metadata
Upsert `child_apps` on (child_id, package_name)

Request
```json
{
  "child_id": "uuid",
  "package_name": "com.example.app",
  "app_name": "Example App",
  "category": "games"
}
```

### Child: upsert daily usage
Upsert `app_usage_daily` on (child_id, package_name, usage_date, child_device_id)

Request
```json
{
  "child_id": "uuid",
  "package_name": "com.example.app",
  "usage_date": "2026-01-14",
  "total_seconds": 3600,
  "open_count": 12,
  "child_device_id": "uuid"
}
```

### Parent/Child: list usage for a day or week
Query `app_usage_daily` filtered by child_id and usage_date (or range)

Response: array of usage rows

### Parent: upsert app limits
Upsert `app_limits` on (child_id, package_name)

Request
```json
{
  "child_id": "uuid",
  "package_name": "com.example.app",
  "limit_seconds": 5400,
  "applies_to_days": [1, 2, 3, 4, 5],
  "bonus_enabled": true,
  "bonus_minutes": 15,
  "bonus_streak_target": 3
}
```

### Parent/Child: read AI insights
Query `ai_insights` by child_id, optional package_name, and date range

Response: array of insight rows
