'use client'

import { useState } from 'react'
import { useUserProfile, useNotificationPreferences } from '@/utils/hooks/use-profile'
import { useAuth } from '@/utils/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { NotificationSettings } from '@/components/settings/notification-settings'
import { AccountInfo } from '@/components/settings/account-info'
import { SubscriptionManager } from '@/components/subscription/subscription-manager'
import { ChangePasswordDialog } from '@/components/settings/change-password-dialog'
import { ResetPasswordDialog } from '@/components/settings/reset-password-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { User, Bell, Shield, RefreshCw, Key } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile, isLoading: profileLoading } = useUserProfile()
  const { data: notificationPrefs, isLoading: prefsLoading } = useNotificationPreferences()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
  
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
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your account preferences and settings</p>
        </div>
        <Button variant="outline" onClick={refreshData} className="w-full sm:w-auto">
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
                <p className="text-sm text-gray-600">Secure your account with a strong password</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setChangePasswordOpen(true)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm text-gray-600">Forgot your password?</h4>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setResetPasswordOpen(true)}
                className="text-blue-600 hover:text-blue-700"
              >
                Reset via Email
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
      <SubscriptionManager />

      {/* Password Change Dialog */}
      <ChangePasswordDialog 
        open={changePasswordOpen} 
        onOpenChange={setChangePasswordOpen} 
      />

      {/* Password Reset Dialog */}
      <ResetPasswordDialog 
        open={resetPasswordOpen} 
        onOpenChange={setResetPasswordOpen}
        userEmail={user?.email}
      />
    </div>
  )
}