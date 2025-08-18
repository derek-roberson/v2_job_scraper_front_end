-- Add onboarding_completed column to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Update RLS policies if needed to include the new column
-- The existing policies should already allow users to update their own profiles