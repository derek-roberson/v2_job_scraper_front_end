-- Debug and fix email retrieval in admin function
-- Let's test if we can access auth.users from a SECURITY DEFINER function

DROP FUNCTION IF EXISTS get_all_user_profiles_for_admin();

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
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- First check if the calling user is an admin
  -- We do this by checking their profile with elevated privileges
  IF NOT EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE public.user_profiles.id = auth.uid() 
    AND public.user_profiles.account_type = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- If they are admin, return all user profiles with emails from auth.users
  RETURN QUERY 
  SELECT 
    up.id,
    COALESCE(au.email, au.raw_user_meta_data->>'email', 'No email found')::text as email,
    up.full_name,
    up.company,
    up.account_type,
    up.subscription_tier,
    up.max_active_queries,
    up.is_suspended,
    up.last_login_at,
    up.created_at,
    up.updated_at
  FROM public.user_profiles up
  LEFT JOIN auth.users au ON up.id = au.id
  ORDER BY up.created_at DESC;
END;
$$;