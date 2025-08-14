-- Force fix the jobs policy - the previous migrations didn't work properly

-- Drop the current buggy policy
DROP POLICY "Users can update own jobs" ON public.jobs;

-- Create the correct simple policy
CREATE POLICY "Users can update own jobs" ON public.jobs 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);