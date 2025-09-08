import { NextRequest, NextResponse } from 'next/server'
import { stripe, isStripeConfigured } from '@/utils/stripe'
import { supabase } from '@/utils/supabase'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Type for accessing period fields on Stripe Subscription
type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start?: number
  current_period_end?: number
  cancel_at?: number | null
  canceled_at?: number | null
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log('Handling subscription update:', subscription.id, 'status:', subscription.status)
  console.log('Subscription metadata:', subscription.metadata)
  console.log('Trial end:', subscription.trial_end)
  console.log('Trial start:', subscription.trial_start)
  
  let userId = subscription.metadata.userId
  
  // If no userId in metadata, try to get it from the customer
  if (!userId && subscription.customer) {
    console.log('No userId in subscription metadata, checking customer')
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    
    // Look up user by Stripe customer ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()
    
    if (profile) {
      userId = profile.id
      console.log('Found userId from customer lookup:', userId)
      
      // Update the subscription metadata for future reference
      if (stripe) {
        await stripe.subscriptions.update(subscription.id, {
          metadata: {
            ...subscription.metadata,
            userId: userId
          }
        })
      }
    }
  }
  
  if (!userId) {
    console.error('Could not determine userId for subscription:', subscription.id)
    console.error('Subscription metadata:', subscription.metadata)
    console.error('Customer:', subscription.customer)
    return
  }

  console.log('Processing subscription for userId:', userId)

  const sub = subscription as StripeSubscriptionWithPeriod
  const subscriptionData = {
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price.id,
    stripe_customer_id: subscription.customer as string,
    status: subscription.status,
    current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
  }

  // Also update the subscription_tier based on the subscription status
  const subscriptionTier = (subscription.status === 'active' || subscription.status === 'trialing') ? 'pro' : 'free'
  
  console.log('Updating user profile for userId:', userId)
  console.log('Update data:', { ...subscriptionData, subscription_tier: subscriptionTier })

  // Update the user's profile with subscription data
  const { error } = await supabase
    .from('user_profiles')
    .update({
      ...subscriptionData,
      subscription_tier: subscriptionTier
    })
    .eq('id', userId)

  if (error) {
    console.error('Error updating subscription:', error)
    throw error
  }

  console.log('Successfully updated user profile for userId:', userId)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId
  
  if (!userId) {
    console.error('No userId in subscription metadata')
    return
  }

  const sub = subscription as StripeSubscriptionWithPeriod
  // Clear subscription data from the user's profile
  const { error } = await supabase
    .from('user_profiles')
    .update({
      stripe_subscription_id: null,
      stripe_price_id: null,
      status: 'canceled',
      subscription_tier: 'free',
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    })
    .eq('id', userId)

  if (error) {
    console.error('Error deleting subscription:', error)
    throw error
  }
}

export async function POST(req: NextRequest) {
  // Check if Stripe is configured
  if (!isStripeConfigured() || !stripe || !webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe webhook is not configured' },
      { status: 503 }
    )
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    console.log('Processing webhook event:', event.type)
    
    switch (event.type) {
      case 'customer.subscription.created':
        console.log('New subscription created')
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break
        
      case 'customer.subscription.updated':
        console.log('Subscription updated')
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.trial_will_end':
        // Send reminder email 1 day before trial ends
        const trialSubscription = event.data.object as Stripe.Subscription
        console.log('Trial ending soon for subscription:', trialSubscription.id)
        // TODO: Send email notification to user
        break
      
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Checkout session completed:', session.id)
        console.log('Session metadata:', session.metadata)
        
        if (session.mode === 'subscription' && session.subscription) {
          // Retrieve the subscription with expanded data
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          
          // If the subscription doesn't have userId in metadata, get it from the session
          if (!subscription.metadata.userId && session.metadata?.userId && stripe) {
            console.log('Updating subscription metadata with userId from session')
            // Update the subscription with the userId
            await stripe.subscriptions.update(subscription.id, {
              metadata: {
                ...subscription.metadata,
                userId: session.metadata.userId,
                priceId: session.metadata.priceId
              }
            })
            
            // Retrieve the updated subscription
            const updatedSubscription = await stripe.subscriptions.retrieve(subscription.id)
            await handleSubscriptionUpdate(updatedSubscription)
          } else {
            await handleSubscriptionUpdate(subscription)
          }
        }
        break
      
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string }
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          )
          await handleSubscriptionUpdate(subscription)
        }
        break
      
      case 'invoice.payment_failed':
        // Handle failed payment - user moves to free tier
        const failedInvoice = event.data.object as Stripe.Invoice & { 
          subscription?: string 
          subscription_details?: { metadata?: { userId?: string } }
        }
        console.log('Payment failed for invoice:', failedInvoice.id)
        
        if (failedInvoice.subscription) {
          const userId = failedInvoice.subscription_details?.metadata?.userId
          if (userId) {
            // Downgrade user to free plan
            await supabase
              .from('user_profiles')
              .update({
                status: 'free',
                stripe_price_id: null,
              })
              .eq('id', userId)
            
            console.log('User downgraded to free plan due to payment failure:', userId)
          }
        }
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}