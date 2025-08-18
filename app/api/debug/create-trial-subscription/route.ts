import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, isStripeConfigured } from '@/utils/stripe'
import Stripe from 'stripe'

// Type for accessing period fields on Stripe Subscription
type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start?: number
  current_period_end?: number
  cancel_at?: number | null
  canceled_at?: number | null
}

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      )
    }

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

    // Get user profile to find existing customer ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ 
        error: 'No Stripe customer found. Customer must be created first through checkout.' 
      }, { status: 404 })
    }

    // Check if subscription already exists
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 10
    })

    if (existingSubscriptions.data.length > 0) {
      return NextResponse.json({ 
        error: 'Customer already has subscriptions',
        subscriptions: existingSubscriptions.data.map(s => ({
          id: s.id,
          status: s.status,
          created: new Date(s.created * 1000).toISOString()
        }))
      }, { status: 409 })
    }

    // Create a trial subscription directly
    const subscription = await stripe.subscriptions.create({
      customer: profile.stripe_customer_id,
      items: [{
        price: 'price_1RxOkkAbsZI7KsCx9X1slt3a', // Pro plan price ID
      }],
      trial_period_days: 3,
      metadata: {
        userId: user.id,
        priceId: 'price_1RxOkkAbsZI7KsCx9X1slt3a',
        created_via: 'debug_api',
      },
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    })

    const sub = subscription as StripeSubscriptionWithPeriod
    
    return NextResponse.json({
      message: 'Trial subscription created successfully!',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        customer: subscription.customer,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        metadata: subscription.metadata,
      }
    })

  } catch (error) {
    console.error('Create trial subscription error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}