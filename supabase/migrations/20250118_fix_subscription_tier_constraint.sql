-- Fix subscription_tier constraint to use 'pro' instead of 'premium'

-- First, update any existing 'premium' values to 'pro'
UPDATE public.user_profiles 
SET subscription_tier = 'pro' 
WHERE subscription_tier = 'premium';

UPDATE public.user_profiles 
SET subscription_tier = 'pro' 
WHERE subscription_tier = 'basic';

-- Drop the old constraint
ALTER TABLE public.user_profiles 
DROP CONSTRAINT user_profiles_subscription_tier_check;

-- Add the new constraint with correct values
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_subscription_tier_check 
CHECK (subscription_tier = ANY (ARRAY['free'::text, 'pro'::text]));