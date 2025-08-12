-- Fix infinite recursion in user_profiles RLS policies

-- Drop the problematic admin policies that cause recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Admins can update any profile" ON "public"."user_profiles";

-- The basic user policies should already exist, so we don't need to recreate them
-- This migration just removes the problematic admin policies that cause infinite recursion