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

export async function GET(req: NextRequest) {
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

    // Get all recent customers from Stripe
    const customers = await stripe.customers.list({
      limit: 20
    })

    // Get all recent subscriptions from Stripe  
    const subscriptions = await stripe.subscriptions.list({
      limit: 20,
      status: 'all'
    })

    return NextResponse.json({
      user_info: {
        id: user.id,
        email: user.email
      },
      stripe_customers: customers.data.map(c => ({
        id: c.id,
        email: c.email,
        created: new Date(c.created * 1000).toISOString(),
        metadata: c.metadata
      })),
      stripe_subscriptions: subscriptions.data.map(s => {
        const sub = s as StripeSubscriptionWithPeriod
        return {
          id: s.id,
          customer: s.customer,
          status: s.status,
          created: new Date(s.created * 1000).toISOString(),
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          metadata: s.metadata,
          price_id: s.items.data[0]?.price.id
        }
      })
    })

  } catch (error) {
    console.error('Stripe data debug error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}