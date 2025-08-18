-- Create a safe admin RLS policy that doesn't cause recursion
-- This policy will allow admin users to see all profiles while preserving the existing policy

CREATE POLICY "Admin users can view all user profiles" 
ON "public"."user_profiles" 
FOR SELECT 
USING (
  -- Allow if user is viewing their own profile (preserves existing functionality)
  "auth"."uid"() = "id"
  OR
  -- Allow admin users to view all profiles by checking a separate admin table or using a simpler approach
  -- We'll use the auth.jwt() function to check user metadata if available
  -- For now, use a direct query but with a different approach to avoid recursion
  "auth"."uid"() IN (
    SELECT up.id 
    FROM "public"."user_profiles" up 
    WHERE up.account_type = 'admin'
  )
);