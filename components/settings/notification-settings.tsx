'use client'

import { useState, useEffect } from 'react'
import { NotificationPreferences, useProfileMutations } from '@/utils/hooks/use-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Save, Mail, Webhook, Settings } from 'lucide-react'

interface NotificationSettingsProps {
  preferences?: Partial<NotificationPreferences>
}

export function NotificationSettings({ preferences }: NotificationSettingsProps) {
  const { updateNotificationPreferences } = useProfileMutations()
  
  // Form state
  const [emailNotifications, setEmailNotifications] = useState(preferences?.email_notifications ?? true)
  const [webhookNotifications, setWebhookNotifications] = useState(preferences?.webhook_notifications ?? false)
  const [webhookUrl, setWebhookUrl] = useState(preferences?.webhook_url || '')
  const [frequency, setFrequency] = useState(preferences?.notification_frequency || 'hourly')
  const [emailDigest, setEmailDigest] = useState(preferences?.email_digest ?? false)
  const [dataSharing, setDataSharing] = useState(preferences?.data_sharing_consent ?? false)

  // Update form when preferences change
  useEffect(() => {
    if (preferences) {
      setEmailNotifications(preferences.email_notifications ?? true)
      setWebhookNotifications(preferences.webhook_notifications ?? false)
      setWebhookUrl(preferences.webhook_url || '')
      setFrequency(preferences.notification_frequency || 'hourly')
      setEmailDigest(preferences.email_digest ?? false)
      setDataSharing(preferences.data_sharing_consent ?? false)
    }
  }, [preferences])

  const handleSave = async () => {
    try {
      await updateNotificationPreferences.mutateAsync({
        email_notifications: emailNotifications,
        webhook_notifications: webhookNotifications,
        webhook_url: webhookUrl.trim() || undefined,
        notification_frequency: frequency as 'hourly',
        email_digest: emailDigest,
        data_sharing_consent: dataSharing,
      })
    } catch (error) {
      console.error('Failed to update notification preferences:', error)
      alert('Failed to update preferences. Please try again.')
    }
  }

  const hasChanges = 
    emailNotifications !== (preferences?.email_notifications ?? true) ||
    webhookNotifications !== (preferences?.webhook_notifications ?? false) ||
    webhookUrl !== (preferences?.webhook_url || '') ||
    emailDigest !== (preferences?.email_digest ?? false) ||
    dataSharing !== (preferences?.data_sharing_consent ?? false)

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
            <Label htmlFor="frequency">Notification Frequency</Label>
            <div className="p-3 bg-gray-50 rounded-lg border">
              <div className="font-medium text-sm">Hourly notifications</div>
              <p className="text-sm text-gray-600">
                Job alerts are sent once per hour when new matches are found
              </p>
            </div>
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