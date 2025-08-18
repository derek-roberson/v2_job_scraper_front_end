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
        </CardContent>
      </Card>
    </div>
  )
}