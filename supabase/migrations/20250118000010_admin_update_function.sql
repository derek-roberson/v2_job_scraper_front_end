-- Create a secure function that allows admin users to update user profiles
-- This function will run with elevated privileges and bypass RLS

CREATE OR REPLACE FUNCTION update_user_profile_for_admin(
  target_user_id uuid,
  new_account_type text DEFAULT NULL,
  new_full_name text DEFAULT NULL
)
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
  IF NOT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.account_type = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Prevent admin from modifying their own permissions
  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Cannot modify your own permissions';
  END IF;
  
  -- Check if target user exists
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE user_profiles.id = target_user_id
  ) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Build and execute update
  UPDATE user_profiles SET
    account_type = COALESCE(new_account_type, account_type),
    full_name = COALESCE(new_full_name, full_name),
    updated_at = now()
  WHERE user_profiles.id = target_user_id;
  
  -- Return the updated user profile with email
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
  WHERE up.id = target_user_id;
END;
$$;