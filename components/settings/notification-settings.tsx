'use client'

import { useState, useEffect } from 'react'
import { NotificationPreferences, useProfileMutations } from '@/utils/hooks/use-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Save, Mail, Webhook, Settings, Clock } from 'lucide-react'

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
  const [respectNotificationHours, setRespectNotificationHours] = useState(preferences?.respect_notification_hours ?? true)
  const [notificationHours, setNotificationHours] = useState<number[]>(preferences?.notification_hours ?? [9, 10, 11, 12, 13, 14, 15, 16, 17])

  // Update form when preferences change
  useEffect(() => {
    if (preferences) {
      setEmailNotifications(preferences.email_notifications ?? true)
      setWebhookNotifications(preferences.webhook_notifications ?? false)
      setWebhookUrl(preferences.webhook_url || '')
      setFrequency(preferences.notification_frequency || 'hourly')
      setEmailDigest(preferences.email_digest ?? false)
      setDataSharing(preferences.data_sharing_consent ?? false)
      setRespectNotificationHours(preferences.respect_notification_hours ?? true)
      setNotificationHours(preferences.notification_hours ?? [9, 10, 11, 12, 13, 14, 15, 16, 17])
    }
  }, [preferences])

  const handleHourToggle = (hour: number, checked: boolean) => {
    if (checked) {
      setNotificationHours(prev => [...prev, hour].sort((a, b) => a - b))
    } else {
      setNotificationHours(prev => prev.filter(h => h !== hour))
    }
  }

  const selectAllHours = () => {
    setNotificationHours(Array.from({ length: 24 }, (_, i) => i))
  }

  const selectBusinessHours = () => {
    setNotificationHours([9, 10, 11, 12, 13, 14, 15, 16, 17])
  }

  const clearAllHours = () => {
    setNotificationHours([])
  }

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  const handleSave = async () => {
    try {
      await updateNotificationPreferences.mutateAsync({
        email_notifications: emailNotifications,
        webhook_notifications: webhookNotifications,
        webhook_url: webhookUrl.trim() || undefined,
        notification_frequency: frequency as 'hourly',
        email_digest: emailDigest,
        data_sharing_consent: dataSharing,
        notification_hours: notificationHours,
        respect_notification_hours: respectNotificationHours,
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
    dataSharing !== (preferences?.data_sharing_consent ?? false) ||
    respectNotificationHours !== (preferences?.respect_notification_hours ?? true) ||
    JSON.stringify(notificationHours.sort()) !== JSON.stringify((preferences?.notification_hours ?? [9, 10, 11, 12, 13, 14, 15, 16, 17]).sort())

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

      {/* Notification Timing */}
      <div>
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Notification Timing
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="respect-hours">Respect Time Preferences</Label>
              <p className="text-sm text-gray-600">
                Only send notifications during your selected hours
              </p>
            </div>
            <Switch
              id="respect-hours"
              checked={respectNotificationHours}
              onCheckedChange={setRespectNotificationHours}
            />
          </div>

          {respectNotificationHours && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Hours for Notifications</Label>
                <p className="text-sm text-gray-600">
                  Choose the hours when you want to receive job notifications. Jobs found during other hours will be queued.
                </p>
                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectBusinessHours}
                  >
                    Business Hours (9-5)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllHours}
                  >
                    All Hours
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAllHours}
                  >
                    Clear All
                  </Button>
                </div>
                <div className="grid grid-cols-6 gap-2 p-4 bg-gray-50 rounded-lg border">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="flex items-center space-x-2">
                      <Checkbox
                        id={`hour-${hour}`}
                        checked={notificationHours.includes(hour)}
                        onCheckedChange={(checked) => handleHourToggle(hour, checked as boolean)}
                      />
                      <Label htmlFor={`hour-${hour}`} className="text-xs">
                        {formatHour(hour)}
                      </Label>
                    </div>
                  ))}
                </div>
                {notificationHours.length === 0 && (
                  <p className="text-sm text-amber-600">
                    ⚠️ No hours selected. You won&apos;t receive any notifications.
                  </p>
                )}
                {notificationHours.length > 0 && (
                  <p className="text-sm text-gray-600">
                    Selected: {notificationHours.length} hour{notificationHours.length !== 1 ? 's' : ''}
                    {notificationHours.length <= 8 && (
                      <span className="ml-2">
                        ({notificationHours.map(h => formatHour(h)).join(', ')})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Email Digest */}
      <div>
        <h4 className="font-medium mb-4">Email Digest</h4>
        <div className="space-y-4">

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