-- Add timezone field to notification_preferences table
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Add comment for clarity
COMMENT ON COLUMN public.notification_preferences.timezone IS 'User timezone for notification scheduling (e.g., America/New_York)';