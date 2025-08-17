import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabase } from '@/utils/supabase'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId
  
  if (!userId) {
    console.error('No userId in subscription metadata')
    return
  }

  const subscriptionData = {
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price.id,
    stripe_customer_id: subscription.customer as string,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
  }

  // Update the user's profile with subscription data
  const { error } = await supabase
    .from('profiles')
    .update(subscriptionData)
    .eq('id', userId)

  if (error) {
    console.error('Error updating subscription:', error)
    throw error
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId
  
  if (!userId) {
    console.error('No userId in subscription metadata')
    return
  }

  // Clear subscription data from the user's profile
  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: null,
      stripe_price_id: null,
      status: 'canceled',
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.error('Error deleting subscription:', error)
    throw error
  }
}

export async function POST(req: NextRequest) {
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
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
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
        if (session.mode === 'subscription') {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          await handleSubscriptionUpdate(subscription)
        }
        break
      
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          )
          await handleSubscriptionUpdate(subscription)
        }
        break
      
      case 'invoice.payment_failed':
        // Handle failed payment - user moves to free tier
        const failedInvoice = event.data.object as Stripe.Invoice
        console.log('Payment failed for invoice:', failedInvoice.id)
        
        if (failedInvoice.subscription) {
          const userId = failedInvoice.subscription_details?.metadata?.userId
          if (userId) {
            // Downgrade user to free plan
            await supabase
              .from('profiles')
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