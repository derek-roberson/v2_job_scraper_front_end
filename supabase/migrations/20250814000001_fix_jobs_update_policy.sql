-- Fix RLS policy for jobs table to allow updating applied field

-- Drop the restrictive update policy
DROP POLICY IF EXISTS "Users can soft delete own jobs" ON public.jobs;

-- Create a new policy that allows updating is_deleted and applied fields while protecting core job data
CREATE POLICY "Users can update own jobs" ON public.jobs 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (
  auth.uid() = user_id AND
  -- Only allow changes to is_deleted and applied fields, core job data must remain unchanged
  title = (SELECT title FROM public.jobs WHERE id = jobs.id) AND
  company = (SELECT company FROM public.jobs WHERE id = jobs.id) AND  
  link = (SELECT link FROM public.jobs WHERE id = jobs.id) AND
  location IS NOT DISTINCT FROM (SELECT location FROM public.jobs WHERE id = jobs.id) AND
  posted IS NOT DISTINCT FROM (SELECT posted FROM public.jobs WHERE id = jobs.id) AND
  scraped_at IS NOT DISTINCT FROM (SELECT scraped_at FROM public.jobs WHERE id = jobs.id) AND
  query_id IS NOT DISTINCT FROM (SELECT query_id FROM public.jobs WHERE id = jobs.id) AND
  created_at IS NOT DISTINCT FROM (SELECT created_at FROM public.jobs WHERE id = jobs.id)
);