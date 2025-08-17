-- Add subscription fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- Add RLS policies for subscription fields
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only view their own subscription data
CREATE POLICY "Users can view own subscription data" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Only the service role can update subscription data (webhooks)
CREATE POLICY "Service role can update subscription data" ON profiles
  FOR UPDATE
  USING (auth.role() = 'service_role');

COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for the user';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN profiles.stripe_price_id IS 'Stripe price ID for the current subscription';
COMMENT ON COLUMN profiles.status IS 'Subscription status: free, active, canceled, past_due, etc.';
COMMENT ON COLUMN profiles.current_period_start IS 'Start of the current billing period';
COMMENT ON COLUMN profiles.current_period_end IS 'End of the current billing period';
COMMENT ON COLUMN profiles.cancel_at IS 'When the subscription will be canceled';
COMMENT ON COLUMN profiles.canceled_at IS 'When the subscription was canceled';