-- Fix RLS policy for jobs table to allow updating applied field

-- Drop the restrictive update policy
DROP POLICY IF EXISTS "Users can soft delete own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;

-- Create a new policy that allows updating is_deleted and applied fields
CREATE POLICY "Users can update own jobs" ON public.jobs 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);