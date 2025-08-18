-- Add RLS policy to allow admin users to view all profiles
-- This will allow admin users to see all users in the admin panel

CREATE POLICY "Admins can view all profiles" 
ON "public"."user_profiles" 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM "public"."user_profiles" admin_profile 
    WHERE admin_profile.id = "auth"."uid"() 
    AND admin_profile.account_type = 'admin'
  )
);