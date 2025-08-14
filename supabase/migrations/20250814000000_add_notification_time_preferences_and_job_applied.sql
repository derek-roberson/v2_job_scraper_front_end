-- Add notification time preferences and job application tracking

-- Add notification time fields to notification_preferences  
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS notification_hours INTEGER[] DEFAULT ARRAY[9,10,11,12,13,14,15,16,17] CHECK (array_length(notification_hours, 1) <= 24),
ADD COLUMN IF NOT EXISTS respect_notification_hours BOOLEAN DEFAULT true;

-- Add applied field to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS applied BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.notification_preferences.notification_hours IS 'Array of hours (0-23) when notifications should be sent';
COMMENT ON COLUMN public.notification_preferences.respect_notification_hours IS 'Whether to respect the selected notification hours';
COMMENT ON COLUMN public.jobs.applied IS 'Whether the user has applied to this job';

-- Create index for applied jobs filtering
CREATE INDEX IF NOT EXISTS idx_jobs_applied ON public.jobs (user_id, applied) WHERE applied = true;

-- Create index for time-based notification queries  
CREATE INDEX IF NOT EXISTS idx_notification_preferences_hours ON public.notification_preferences (user_id, respect_notification_hours) WHERE respect_notification_hours = true;