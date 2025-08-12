'use client'

import { useUserProfile, useNotificationPreferences } from '@/utils/hooks/use-profile'
import { useAuth } from '@/utils/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { NotificationSettings } from '@/components/settings/notification-settings'
import { AccountInfo } from '@/components/settings/account-info'
import { useQueryClient } from '@tanstack/react-query'
import { User, Bell, Shield, CreditCard, RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile, isLoading: profileLoading } = useUserProfile()
  const { data: notificationPrefs, isLoading: prefsLoading } = useNotificationPreferences()
  
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['user-profile'] })
    queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
  }

  if (profileLoading || prefsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Loading your account settings...</p>
        </div>
        <div className="text-center py-8 text-gray-500">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Manage your account preferences and settings</p>
        </div>
        <Button variant="outline" onClick={refreshData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Account Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Overview
          </CardTitle>
          <CardDescription>
            Your account status and subscription information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountInfo profile={profile} user={user} />
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your personal information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileSettings profile={profile} />
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Configure how and when you receive job alerts and updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettings preferences={notificationPrefs} />
        </CardContent>
      </Card>

      {/* Account Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Account Security
          </CardTitle>
          <CardDescription>
            Manage your account security and privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Email Address</h4>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>
              <Badge variant="secondary">Verified</Badge>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Password</h4>
                <p className="text-sm text-gray-600">Last updated: Not available</p>
              </div>
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Two-Factor Authentication</h4>
                <p className="text-sm text-gray-600">Add an extra layer of security</p>
              </div>
              <Button variant="outline" size="sm">
                Enable 2FA
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription & Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Subscription & Billing
          </CardTitle>
          <CardDescription>
            Manage your subscription and billing preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Current Plan</h4>
                <p className="text-sm text-gray-600">
                  {profile?.subscription_tier === 'free' ? 'Free Plan' : 
                   profile?.subscription_tier === 'basic' ? 'Basic Plan' : 'Premium Plan'}
                </p>
              </div>
              <Badge variant={profile?.subscription_tier === 'free' ? 'secondary' : 'default'}>
                {profile?.subscription_tier?.toUpperCase()}
              </Badge>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Query Limit</h4>
                <p className="text-sm text-gray-600">
                  {profile?.max_active_queries === -1 
                    ? 'Unlimited active queries' 
                    : `${profile?.max_active_queries} active queries max`}
                </p>
              </div>
            </div>

            {profile?.subscription_tier === 'free' && (
              <>
                <Separator />
                <div className="text-center py-4">
                  <Button>
                    Upgrade to Premium
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Get unlimited queries and priority support
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}