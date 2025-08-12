-- Add the missing INSERT policy for queries table
-- This allows authenticated users to insert their own queries

CREATE POLICY "Users can create their own queries" ON "public"."queries"
  FOR INSERT WITH CHECK (auth.uid() = user_id);