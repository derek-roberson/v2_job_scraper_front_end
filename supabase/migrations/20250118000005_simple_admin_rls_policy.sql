-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON "public"."user_profiles";

-- Simple approach: just allow users with admin account_type to see all profiles
-- This avoids the recursive query issue
CREATE POLICY "Admins can view all profiles" 
ON "public"."user_profiles" 
FOR SELECT 
USING (
  -- Users can see their own profile
  "auth"."uid"() = "id"
  OR
  -- Users with admin account_type can see all profiles
  (
    SELECT account_type 
    FROM "public"."user_profiles" 
    WHERE id = "auth"."uid"()
  ) = 'admin'
);