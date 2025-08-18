import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, isStripeConfigured } from '@/utils/stripe'
import Stripe from 'stripe'

// Type for accessing period fields on Stripe Subscription
type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start: number
  current_period_end: number
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

    // Find Stripe customer by email
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 10  // Get more customers to see if there are multiple
    })

    console.log('Searching for customers with email:', user.email)
    console.log('Found customers:', customers.data.length)

    if (customers.data.length === 0) {
      // Also try to find any customers with similar emails or metadata
      const allRecentCustomers = await stripe.customers.list({ limit: 10 })
      
      return NextResponse.json({ 
        error: 'No Stripe customer found with your email',
        email: user.email,
        debug_info: {
          customers_checked: customers.data.length,
          recent_customers_preview: allRecentCustomers.data.map(c => ({
            id: c.id,
            email: c.email,
            created: new Date(c.created * 1000).toISOString()
          }))
        }
      }, { status: 404 })
    }

    const customer = customers.data[0]
    console.log('Found customer:', customer.id, 'email:', customer.email)

    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    })

    console.log('Found subscriptions for customer:', subscriptions.data.length)
    subscriptions.data.forEach(sub => {
      console.log('Subscription:', sub.id, 'status:', sub.status, 'created:', new Date(sub.created * 1000).toISOString())
    })

    // If no subscriptions found with the customer, also try to find the specific known subscription
    if (subscriptions.data.length === 0) {
      console.log('No subscriptions found for customer, checking for known subscription ID: si_StBJs3G0p3uWUZ')
      
      try {
        const knownSubscription = await stripe.subscriptions.retrieve('si_StBJs3G0p3uWUZ')
        console.log('Found known subscription:', knownSubscription.id, 'customer:', knownSubscription.customer)
        
        // Check if this subscription belongs to this user's customer
        if (knownSubscription.customer === customer.id) {
          subscriptions.data = [knownSubscription]
          console.log('Known subscription matches customer, using it for sync')
        } else {
          console.log('Known subscription belongs to different customer:', knownSubscription.customer)
        }
      } catch (knownSubError) {
        console.log('Known subscription not found or inaccessible:', knownSubError)
      }
    }

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ 
        error: 'No subscriptions found for your account',
        debug_info: {
          customer_id: customer.id,
          customer_email: customer.email,
          customer_created: new Date(customer.created * 1000).toISOString(),
          subscriptions_count: subscriptions.data.length,
          checked_known_subscription: 'si_StBJs3G0p3uWUZ'
        }
      }, { status: 404 })
    }

    // Get the most recent active or trialing subscription
    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    ) || subscriptions.data[0]

    // Cast to our extended type that includes period fields
    const sub = activeSubscription as StripeSubscriptionWithPeriod

    // Prepare subscription data
    const subscriptionData = {
      stripe_customer_id: customer.id,
      stripe_subscription_id: activeSubscription.id,
      stripe_price_id: activeSubscription.items.data[0]?.price.id,
      status: activeSubscription.status,
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      subscription_tier: activeSubscription.status === 'active' || activeSubscription.status === 'trialing' ? 'pro' : 'free',
      updated_at: new Date().toISOString()
    }

    // Update user profile with Stripe data
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(subscriptionData)
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update user profile',
        details: updateError 
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Subscription synced successfully!',
      customer_id: customer.id,
      subscription_id: activeSubscription.id,
      subscription_status: activeSubscription.status,
      price_id: activeSubscription.items.data[0]?.price.id,
      current_period_end: subscriptionData.current_period_end,
      is_trial: activeSubscription.status === 'trialing',
      synced_data: subscriptionData
    })

  } catch (error) {
    console.error('Stripe sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}