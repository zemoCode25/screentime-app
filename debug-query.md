# Debug Query - Check Synced Data

Run these queries in your Supabase SQL Editor to verify the data was synced correctly:

## 1. Check if usage data exists for today

```sql
-- Replace 'YOUR_CHILD_ID' with your actual child ID
SELECT
  package_name,
  total_seconds,
  open_count,
  usage_date,
  device_id
FROM app_usage_daily
WHERE child_id = 'YOUR_CHILD_ID'
  AND usage_date = CURRENT_DATE
ORDER BY total_seconds DESC
LIMIT 10;
```

## 2. Check all usage dates in the database

```sql
SELECT
  usage_date,
  COUNT(*) as row_count,
  SUM(total_seconds) as total_seconds
FROM app_usage_daily
WHERE child_id = 'YOUR_CHILD_ID'
GROUP BY usage_date
ORDER BY usage_date DESC;
```

## 3. Check if child_apps were synced

```sql
SELECT
  app_name,
  package_name,
  category
FROM child_apps
WHERE child_id = 'YOUR_CHILD_ID'
LIMIT 10;
```

## 4. Get your child_id

```sql
SELECT id, name, child_email
FROM children
WHERE child_user_id = auth.uid();
```

Run query 4 first to get your child_id, then use it in queries 1-3.
