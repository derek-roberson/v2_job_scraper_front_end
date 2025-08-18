-- Drop all the admin policies that are causing issues
DROP POLICY IF EXISTS "Admins can view all profiles" ON "public"."user_profiles";

-- This should leave us with just the original "Users can view own profile" policy
-- which will restore your admin access