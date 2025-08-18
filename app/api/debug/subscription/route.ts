import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

export async function GET(req: NextRequest) {
  try {
    // Get user ID from query params for debugging
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 })
    }

    // Get user profile data
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        subscription_tier,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at,
        canceled_at,
        account_type,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Database error', details: error }, { status: 500 })
    }

    return NextResponse.json({
      profile,
      debug_info: {
        hasStripeSubscription: !!profile.stripe_subscription_id,
        hasStripeCustomer: !!profile.stripe_customer_id,
        hasStripePriceId: !!profile.stripe_price_id,
        subscriptionStatus: profile.status,
        subscriptionTier: profile.subscription_tier,
        currentTime: new Date().toISOString(),
        periodStart: profile.current_period_start,
        periodEnd: profile.current_period_end,
      }
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}