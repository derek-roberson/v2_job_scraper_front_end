-- Fix RLS policy for jobs table - final fix for applied field update error

-- Drop any existing update policies for jobs
DROP POLICY IF EXISTS "Users can soft delete own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;

-- Create a simple, working policy for job updates
CREATE POLICY "Users can update own jobs" ON public.jobs 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);