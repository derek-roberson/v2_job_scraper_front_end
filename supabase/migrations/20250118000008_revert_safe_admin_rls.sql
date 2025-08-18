-- Revert the admin RLS policy that's causing issues again
DROP POLICY IF EXISTS "Admin users can view all user profiles" ON "public"."user_profiles";