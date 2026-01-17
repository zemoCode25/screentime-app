-- Migration: Add icon_url column to child_apps table
-- Run this in your Supabase SQL Editor

-- Add icon_url column
ALTER TABLE public.child_apps 
ADD COLUMN IF NOT EXISTS icon_url text;

-- Comment for documentation
COMMENT ON COLUMN public.child_apps.icon_url IS 'Public URL of the app icon stored in Supabase Storage (app-icons bucket)';
