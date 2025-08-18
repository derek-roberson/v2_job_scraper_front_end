import { NextResponse } from 'next/server'
import { stripe, isStripeConfigured } from '@/utils/stripe'

export async function GET() {
  try {
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      )
    }

    // List all webhook endpoints
    const webhookEndpoints = await stripe.webhookEndpoints.list({
      limit: 10
    })

    const webhookInfo = webhookEndpoints.data.map(endpoint => ({
      id: endpoint.id,
      url: endpoint.url,
      status: endpoint.status,
      enabled_events: endpoint.enabled_events,
      description: endpoint.description,
      created: new Date(endpoint.created * 1000).toISOString()
    }))

    const expectedWebhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/webhook`
    const hasCorrectWebhook = webhookEndpoints.data.some(endpoint => 
      endpoint.url === expectedWebhookUrl && endpoint.status === 'enabled'
    )

    return NextResponse.json({
      webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
      expected_webhook_url: expectedWebhookUrl,
      has_correct_webhook: hasCorrectWebhook,
      webhook_endpoints: webhookInfo,
      required_events: [
        'customer.subscription.created',
        'customer.subscription.updated', 
        'customer.subscription.deleted',
        'customer.subscription.trial_will_end',
        'checkout.session.completed',
        'invoice.payment_succeeded',
        'invoice.payment_failed'
      ],
      instructions: hasCorrectWebhook ? 
        'Webhook is configured correctly!' :
        `Please add webhook endpoint in Stripe Dashboard: ${expectedWebhookUrl}`
    })

  } catch (error) {
    console.error('Stripe webhook config check error:', error)
    return NextResponse.json(
      { error: 'Failed to check webhook configuration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}