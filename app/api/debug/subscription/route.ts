import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Create an authenticated Supabase client with the user's token
    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // Get user profile data
    const { data: profile, error: profileError } = await supabase
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
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      auth_user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile,
      profile_error: profileError,
      debug_info: {
        profileExists: !!profile,
        hasStripeSubscription: !!profile?.stripe_subscription_id,
        hasStripeCustomer: !!profile?.stripe_customer_id,
        hasStripePriceId: !!profile?.stripe_price_id,
        subscriptionStatus: profile?.status,
        subscriptionTier: profile?.subscription_tier,
        currentTime: new Date().toISOString(),
        periodStart: profile?.current_period_start,
        periodEnd: profile?.current_period_end,
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