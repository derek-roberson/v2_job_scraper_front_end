-- Add subscription fields to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription_id ON user_profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);

-- Add RLS policy for service role to update subscription data (webhooks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND policyname = 'Service role can update subscription data'
  ) THEN
    CREATE POLICY "Service role can update subscription data" ON user_profiles
      FOR UPDATE
      USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN user_profiles.stripe_customer_id IS 'Stripe customer ID for the user';
COMMENT ON COLUMN user_profiles.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN user_profiles.stripe_price_id IS 'Stripe price ID for the current subscription';
COMMENT ON COLUMN user_profiles.status IS 'Subscription status: free, active, canceled, past_due, etc.';
COMMENT ON COLUMN user_profiles.current_period_start IS 'Start of the current billing period';
COMMENT ON COLUMN user_profiles.current_period_end IS 'End of the current billing period';
COMMENT ON COLUMN user_profiles.cancel_at IS 'When the subscription will be canceled';
COMMENT ON COLUMN user_profiles.canceled_at IS 'When the subscription was canceled';