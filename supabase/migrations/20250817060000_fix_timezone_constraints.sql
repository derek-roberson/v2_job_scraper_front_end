-- Remove overly restrictive timezone constraints to make timezone optional for basic email notifications
-- Timezone should only be required when using specific notification hours

-- Drop the constraint that requires timezone for email notifications
ALTER TABLE public.notification_preferences 
DROP CONSTRAINT IF EXISTS notification_preferences_timezone_required_for_email;

-- Drop the timezone format constraint if it exists  
ALTER TABLE public.notification_preferences 
DROP CONSTRAINT IF EXISTS notification_preferences_timezone_format;