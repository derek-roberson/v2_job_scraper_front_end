'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/utils/hooks/use-auth'
import { useSubscription } from '@/utils/hooks/use-subscription'
import { supabase } from '@/utils/supabase'
import { getPlanById } from '@/config/subscriptions'
import { CreditCard, Calendar, AlertCircle, Shield } from 'lucide-react'

interface SubscriptionData {
  stripe_customer_id?: string
  stripe_subscription_id?: string
  stripe_price_id?: string
  status?: string
  current_period_end?: string
  cancel_at?: string
}

export function SubscriptionManager() {
  const router = useRouter()
  const { user } = useAuth()
  const { data: subscriptionStatus } = useSubscription()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (user && !subscriptionStatus?.isPrivileged) {
      fetchSubscription()
    } else {
      setLoading(false)
    }
  }, [user, subscriptionStatus?.isPrivileged])

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_end, cancel_at')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setSubscription(data)
    } catch (error) {
      console.error('Error fetching subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCustomerPortal = async () => {
    try {
      setPortalLoading(true)
      
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error opening customer portal:', error)
      alert('Failed to open billing portal. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">Loading subscription details...</div>
        </CardContent>
      </Card>
    )
  }

  const currentPlan = subscription?.stripe_price_id 
    ? getPlanById(subscription.stripe_price_id.includes('pro') ? 'pro' : 'enterprise')
    : getPlanById('free')

  const getStatusBadge = () => {
    switch (subscription?.status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>
      case 'canceled':
        return <Badge className="bg-gray-500">Canceled</Badge>
      case 'past_due':
        return <Badge className="bg-red-500">Past Due</Badge>
      case 'trialing':
        return <Badge className="bg-blue-500">Trial</Badge>
      default:
        return <Badge className="bg-gray-400">Free</Badge>
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Show special card for privileged users
  if (subscriptionStatus?.isPrivileged) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Shield className="h-5 w-5" />
              {subscriptionStatus.planName}
            </CardTitle>
            <CardDescription className="text-green-700">
              You have privileged access to all features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-800">Full Access</h3>
                <p className="text-sm text-green-700">
                  All features available without subscription
                </p>
              </div>
              <Badge className="bg-green-500">Privileged</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {subscriptionStatus.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subscription Plan</CardTitle>
          <CardDescription>
            Manage your subscription and billing details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{currentPlan?.name || 'Free'} Plan</h3>
              <p className="text-sm text-gray-600">{currentPlan?.description}</p>
            </div>
            {getStatusBadge()}
          </div>

          {subscription?.status === 'active' && (
            <div className="grid md:grid-cols-2 gap-4 py-4 border-t">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Current Period Ends</p>
                  <p className="font-medium">{formatDate(subscription.current_period_end)}</p>
                </div>
              </div>
              
              {subscription.cancel_at && (
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm text-gray-600">Cancels On</p>
                    <p className="font-medium">{formatDate(subscription.cancel_at)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {subscription?.stripe_customer_id ? (
              <>
                <Button
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {portalLoading ? 'Loading...' : 'Manage Billing'}
                </Button>
                {subscription.status !== 'active' && (
                  <Button
                    variant="outline"
                    onClick={() => router.push('/pricing')}
                  >
                    Upgrade Plan
                  </Button>
                )}
              </>
            ) : (
              <Button onClick={() => router.push('/pricing')}>
                Upgrade to Pro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {currentPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {currentPlan.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}