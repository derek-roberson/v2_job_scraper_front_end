/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/utils/hooks/use-auth'
import { useSubscription } from '@/utils/hooks/use-subscription'
import { supabase } from '@/utils/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DebugSubscriptionPage() {
  const { user } = useAuth()
  const { data: subscription } = useSubscription()
  const [profileData, setProfileData] = useState<{data: Record<string, unknown> | null, error: Error | null} | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [stripeData, setStripeData] = useState<any>(null)
  const [loadingStripeData, setLoadingStripeData] = useState(false)
  const [webhookConfig, setWebhookConfig] = useState<any>(null)
  const [loadingWebhookConfig, setLoadingWebhookConfig] = useState(false)
  const [testingCheckout, setTestingCheckout] = useState(false)
  const [creatingTrial, setCreatingTrial] = useState(false)

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.id) return

      try {
        const { data, error } = await supabase
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

        setProfileData({ data, error })
      } catch (err) {
        setProfileData({ data: null, error: err instanceof Error ? err : new Error('Unknown error') })
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
  }, [user?.id])

  const createProfile = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          account_type: 'user',
          subscription_tier: 'free'
        })
        .select()
        .single()

      if (error) {
        alert('Error creating profile: ' + error.message)
      } else {
        alert('Profile created successfully!')
        window.location.reload()
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const syncStripeData = async () => {
    if (!user) return

    try {
      setSyncing(true)
      
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Not authenticated')
        return
      }

      const response = await fetch('/api/debug/sync-stripe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync')
      }

      alert('Subscription synced successfully! Refreshing page...')
      window.location.reload()
    } catch (error) {
      console.error('Sync error:', error)
      alert('Error syncing subscription: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSyncing(false)
    }
  }

  const fetchStripeData = async () => {
    if (!user) return

    try {
      setLoadingStripeData(true)
      
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Not authenticated')
        return
      }

      const response = await fetch('/api/debug/stripe-data', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch Stripe data')
      }

      setStripeData(result)
    } catch (error) {
      console.error('Fetch Stripe data error:', error)
      alert('Error fetching Stripe data: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoadingStripeData(false)
    }
  }

  const checkWebhookConfig = async () => {
    try {
      setLoadingWebhookConfig(true)
      
      const response = await fetch('/api/debug/stripe-webhook-config', {
        method: 'GET',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check webhook config')
      }

      setWebhookConfig(result)
    } catch (error) {
      console.error('Check webhook config error:', error)
      alert('Error checking webhook config: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoadingWebhookConfig(false)
    }
  }

  const testCheckoutFlow = async () => {
    if (!user) return

    try {
      setTestingCheckout(true)
      
      // Create a checkout session for testing
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: 'price_1RxOkkAbsZI7KsCx9X1slt3a', // Pro plan price ID
          userId: user.id,
          userEmail: user.email,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { sessionId, url } = await response.json()
      alert(`Checkout session created! Session ID: ${sessionId}\nURL: ${url}\n\nNormally this would redirect you to Stripe checkout.`)
      
    } catch (error) {
      console.error('Test checkout error:', error)
      alert('Error testing checkout: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setTestingCheckout(false)
    }
  }

  const createTrialSubscription = async () => {
    if (!user) return

    try {
      setCreatingTrial(true)
      
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('Not authenticated')
        return
      }

      const response = await fetch('/api/debug/create-trial-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create trial subscription')
      }

      alert('Trial subscription created successfully! Refreshing page...')
      window.location.reload()
    } catch (error) {
      console.error('Create trial subscription error:', error)
      alert('Error creating trial subscription: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setCreatingTrial(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">Subscription Debug</h1>

      <Card>
        <CardHeader>
          <CardTitle>Auth User</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify({
              id: user?.id,
              email: user?.email,
              created_at: user?.created_at,
            }, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Profile Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(profileData, null, 2)}
          </pre>
          
          {profileData?.error && (
            <div className="mt-4">
              <p className="text-red-600 mb-2">Profile not found! This is the issue.</p>
              <Button onClick={createProfile}>
                Create Missing User Profile
              </Button>
            </div>
          )}

          {profileData?.data && !(profileData.data as any)?.stripe_subscription_id && (
            <div className="mt-4 space-y-2">
              <p className="text-yellow-600 mb-2">Stripe subscription data is missing! This is likely why your trial isn&apos;t working.</p>
              <div className="flex gap-2">
                <Button onClick={syncStripeData} disabled={syncing}>
                  {syncing ? 'Syncing...' : 'Sync Stripe Subscription Data'}
                </Button>
                <Button onClick={fetchStripeData} disabled={loadingStripeData} variant="outline">
                  {loadingStripeData ? 'Loading...' : 'View Raw Stripe Data'}
                </Button>
                <Button onClick={checkWebhookConfig} disabled={loadingWebhookConfig} variant="outline">
                  {loadingWebhookConfig ? 'Loading...' : 'Check Webhook Config'}
                </Button>
                <Button onClick={testCheckoutFlow} disabled={testingCheckout} variant="secondary">
                  {testingCheckout ? 'Testing...' : 'Test Checkout Flow'}
                </Button>
                <Button onClick={createTrialSubscription} disabled={creatingTrial} variant="destructive">
                  {creatingTrial ? 'Creating...' : 'Force Create Trial (Debug Only)'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Hook Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(subscription, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li>✅ Auth User Exists: {user ? 'Yes' : 'No'}</li>
            <li>{profileData?.data ? '✅' : '❌'} User Profile Exists: {profileData?.data ? 'Yes' : 'No'}</li>
            <li>{(profileData?.data as any)?.stripe_customer_id ? '✅' : '❌'} Stripe Customer ID: {(profileData?.data as any)?.stripe_customer_id || 'Missing'}</li>
            <li>{(profileData?.data as any)?.stripe_subscription_id ? '✅' : '❌'} Stripe Subscription ID: {(profileData?.data as any)?.stripe_subscription_id || 'Missing'}</li>
            <li>📊 Subscription Status: {(profileData?.data as any)?.status || 'None'}</li>
            <li>🎯 Subscription Tier: {(profileData?.data as any)?.subscription_tier || 'None'}</li>
          </ul>
          
          {(profileData?.data as any)?.stripe_customer_id && !(profileData?.data as any)?.stripe_subscription_id && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h4 className="font-semibold text-yellow-800 mb-2">🔍 Issue Identified</h4>
              <p className="text-sm text-yellow-700 mb-2">
                You have a Stripe customer ID but no subscription ID. This means:
              </p>
              <ul className="text-sm text-yellow-700 list-disc ml-4 space-y-1">
                <li>The Stripe customer was created successfully</li>
                <li>However, the subscription was never created or completed</li>
                <li>This could happen if the checkout session was abandoned</li>
                <li>Or if webhook events aren&apos;t being received properly</li>
              </ul>
              <p className="text-sm text-yellow-700 mt-2">
                <strong>Next Steps:</strong> Check webhook configuration and test the checkout flow
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {stripeData && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Stripe Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(stripeData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {webhookConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(webhookConfig, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}