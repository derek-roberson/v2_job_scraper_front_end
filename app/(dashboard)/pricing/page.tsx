'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { subscriptionPlans } from '@/config/subscriptions'
import { useAuth } from '@/utils/hooks/use-auth'
import { useSubscription } from '@/utils/hooks/use-subscription'
import { getStripe } from '@/lib/stripe-client'

export default function PricingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { data: subscription } = useSubscription()
  const [loading, setLoading] = useState<string | null>(null)

  // Redirect privileged users away from pricing page
  useEffect(() => {
    if (subscription?.isPrivileged) {
      router.push('/dashboard')
    }
  }, [subscription?.isPrivileged, router])

  // Show message for privileged users
  if (subscription?.isPrivileged) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2 text-green-800">
                <Shield className="h-6 w-6" />
                Privileged Access
              </CardTitle>
              <CardDescription className="text-green-700">
                You have full access to all features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-green-800 mb-4">
                As a privileged user, you have unlimited access to all features without any subscription requirements.
              </p>
              <Button onClick={() => router.push('/dashboard')}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const handleSubscribe = async (priceId: string, planId: string) => {
    if (!user) {
      router.push('/login')
      return
    }

    if (!priceId) {
      // Free plan - no checkout needed
      return
    }

    try {
      setLoading(planId)

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          userEmail: user.email,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { sessionId } = await response.json()
      
      const stripe = await getStripe()
      if (!stripe) {
        throw new Error('Failed to load Stripe')
      }

      const { error } = await stripe.redirectToCheckout({ sessionId })
      
      if (error) {
        console.error('Stripe redirect error:', error)
        alert(error.message)
      }
    } catch (error) {
      console.error('Subscription error:', error)
      alert('Failed to start subscription process. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-gray-600">
          Select the perfect plan for your job search needs
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {subscriptionPlans.map((plan) => (
          <Card
            key={plan.id}
            className={plan.id === 'pro' ? 'border-blue-500 shadow-lg relative' : 'relative'}
          >
            {plan.id === 'pro' && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500">
                Recommended
              </Badge>
            )}
            {plan.trialDays && (
              <Badge className="absolute -top-3 right-4 bg-green-500">
                {plan.trialDays} Day Free Trial
              </Badge>
            )}
            
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <span className="text-4xl font-bold">
                  ${plan.price}
                </span>
                <span className="text-gray-600">/{plan.interval}</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Included:</p>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {plan.limitations && plan.limitations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Limitations:</p>
                    <ul className="space-y-2">
                      {plan.limitations.map((limitation, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-red-500 flex-shrink-0 mt-0.5">×</span>
                          <span className="text-sm text-gray-500">{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.id === 'pro' ? 'default' : 'outline'}
                onClick={() => handleSubscribe(plan.priceId, plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? (
                  'Processing...'
                ) : plan.price === 0 ? (
                  'Current Plan'
                ) : plan.trialDays ? (
                  `Start ${plan.trialDays}-Day Free Trial`
                ) : (
                  `Subscribe to ${plan.name}`
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="text-center mt-12 text-sm text-gray-600">
        <p className="font-semibold">Start with a 3-day free trial of Pro!</p>
        <p className="mt-2">
          No credit card required during trial. Cancel anytime.
        </p>
        <p className="mt-2">
          After trial ends, you'll automatically move to the Free plan unless you upgrade.
        </p>
      </div>
    </div>
  )
}