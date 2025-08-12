'use client'

import { useState, useEffect } from 'react'
import { NotificationPreferences, useProfileMutations } from '@/utils/hooks/use-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Save, Mail, Smartphone, Webhook, Settings } from 'lucide-react'

interface NotificationSettingsProps {
  preferences?: Partial<NotificationPreferences>
}

export function NotificationSettings({ preferences }: NotificationSettingsProps) {
  const { updateNotificationPreferences } = useProfileMutations()
  
  // Form state
  const [emailNotifications, setEmailNotifications] = useState(preferences?.email_notifications ?? true)
  const [mobileNotifications, setMobileNotifications] = useState(preferences?.mobile_push_notifications ?? false)
  const [webhookNotifications, setWebhookNotifications] = useState(preferences?.webhook_notifications ?? false)
  const [webhookUrl, setWebhookUrl] = useState(preferences?.webhook_url || '')
  const [frequency, setFrequency] = useState(preferences?.notification_frequency || 'immediate')
  const [emailDigest, setEmailDigest] = useState(preferences?.email_digest ?? false)
  const [dataSharing, setDataSharing] = useState(preferences?.data_sharing_consent ?? false)
  const [marketing, setMarketing] = useState(preferences?.marketing_consent ?? false)

  // Update form when preferences change
  useEffect(() => {
    if (preferences) {
      setEmailNotifications(preferences.email_notifications ?? true)
      setMobileNotifications(preferences.mobile_push_notifications ?? false)
      setWebhookNotifications(preferences.webhook_notifications ?? false)
      setWebhookUrl(preferences.webhook_url || '')
      setFrequency(preferences.notification_frequency || 'immediate')
      setEmailDigest(preferences.email_digest ?? false)
      setDataSharing(preferences.data_sharing_consent ?? false)
      setMarketing(preferences.marketing_consent ?? false)
    }
  }, [preferences])

  const handleSave = async () => {
    try {
      await updateNotificationPreferences.mutateAsync({
        email_notifications: emailNotifications,
        mobile_push_notifications: mobileNotifications,
        webhook_notifications: webhookNotifications,
        webhook_url: webhookUrl.trim() || undefined,
        notification_frequency: frequency as 'immediate' | 'hourly' | 'daily',
        email_digest: emailDigest,
        data_sharing_consent: dataSharing,
        marketing_consent: marketing,
      })
    } catch (error) {
      console.error('Failed to update notification preferences:', error)
      alert('Failed to update preferences. Please try again.')
    }
  }

  const hasChanges = 
    emailNotifications !== (preferences?.email_notifications ?? true) ||
    mobileNotifications !== (preferences?.mobile_push_notifications ?? false) ||
    webhookNotifications !== (preferences?.webhook_notifications ?? false) ||
    webhookUrl !== (preferences?.webhook_url || '') ||
    frequency !== (preferences?.notification_frequency || 'immediate') ||
    emailDigest !== (preferences?.email_digest ?? false) ||
    dataSharing !== (preferences?.data_sharing_consent ?? false) ||
    marketing !== (preferences?.marketing_consent ?? false)

  return (
    <div className="space-y-6">
      {/* Job Alert Notifications */}
      <div>
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Job Alert Settings
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Notifications
              </Label>
              <p className="text-sm text-gray-600">
                Receive job alerts via email when new opportunities are found
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mobile-notifications" className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Mobile Push Notifications
              </Label>
              <p className="text-sm text-gray-600">
                Get instant push notifications on your mobile device
              </p>
            </div>
            <Switch
              id="mobile-notifications"
              checked={mobileNotifications}
              onCheckedChange={setMobileNotifications}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="webhook-notifications" className="flex items-center gap-2">
                <Webhook className="w-4 h-4" />
                Webhook Notifications
              </Label>
              <p className="text-sm text-gray-600">
                Send job alerts to your custom webhook endpoint
              </p>
            </div>
            <Switch
              id="webhook-notifications"
              checked={webhookNotifications}
              onCheckedChange={setWebhookNotifications}
            />
          </div>

          {webhookNotifications && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-server.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Must be a secure HTTPS URL. We&apos;ll POST job data to this endpoint.
              </p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Notification Frequency */}
      <div>
        <h4 className="font-medium mb-4">Notification Frequency</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">How often should we send notifications?</Label>
            <Select value={frequency} onValueChange={(value) => setFrequency(value as 'immediate' | 'hourly' | 'daily')}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate (as jobs are found)</SelectItem>
                <SelectItem value="hourly">Hourly digest</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-digest">Email Digest</Label>
              <p className="text-sm text-gray-600">
                Receive a weekly summary of your job search activity
              </p>
            </div>
            <Switch
              id="email-digest"
              checked={emailDigest}
              onCheckedChange={setEmailDigest}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Privacy & Consent */}
      <div>
        <h4 className="font-medium mb-4">Privacy & Consent</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="data-sharing">Analytics & Improvement</Label>
              <p className="text-sm text-gray-600">
                Help us improve our service by sharing anonymous usage data
              </p>
            </div>
            <Switch
              id="data-sharing"
              checked={dataSharing}
              onCheckedChange={setDataSharing}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing">Marketing Communications</Label>
              <p className="text-sm text-gray-600">
                Receive updates about new features and job search tips
              </p>
            </div>
            <Switch
              id="marketing"
              checked={marketing}
              onCheckedChange={setMarketing}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Save Button */}
      <div>
        <Button 
          onClick={handleSave}
          disabled={updateNotificationPreferences.isPending || !hasChanges}
          className="flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {updateNotificationPreferences.isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
        {hasChanges && (
          <p className="text-xs text-orange-600 mt-2">
            You have unsaved changes
          </p>
        )}
      </div>
    </div>
  )
}