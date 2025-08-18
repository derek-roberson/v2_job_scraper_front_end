-- Drop the problematic policy and recreate it properly
DROP POLICY IF EXISTS "Admins can view all profiles" ON "public"."user_profiles";

-- Create a better policy that doesn't interfere with users viewing their own profiles
CREATE POLICY "Admins can view all profiles" 
ON "public"."user_profiles" 
FOR SELECT 
USING (
  -- Users can always see their own profile
  "auth"."uid"() = "id"
  OR
  -- Admins can see all profiles
  EXISTS (
    SELECT 1 
    FROM "public"."user_profiles" admin_profile 
    WHERE admin_profile.id = "auth"."uid"() 
    AND admin_profile.account_type = 'admin'
  )
);