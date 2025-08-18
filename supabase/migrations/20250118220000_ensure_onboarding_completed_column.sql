-- Ensure onboarding_completed column exists in user_profiles table
-- This handles the case where the column might not have been added despite migration being marked as applied
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;