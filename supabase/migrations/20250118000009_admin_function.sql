-- Create a secure function that allows admin users to view all profiles
-- This function will run with elevated privileges and bypass RLS

CREATE OR REPLACE FUNCTION get_all_user_profiles_for_admin()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  company text,
  account_type text,
  subscription_tier text,
  max_active_queries integer,
  is_suspended boolean,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- First check if the calling user is an admin
  -- We do this by checking their profile with elevated privileges
  IF NOT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.account_type = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- If they are admin, return all user profiles with emails from auth.users
  RETURN QUERY 
  SELECT 
    up.id,
    au.email::text,
    up.full_name,
    up.company,
    up.account_type,
    up.subscription_tier,
    up.max_active_queries,
    up.is_suspended,
    up.last_login_at,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  LEFT JOIN auth.users au ON up.id = au.id
  ORDER BY up.created_at DESC;
END;
$$;