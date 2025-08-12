'use client'

import { useState } from 'react'
import { NotificationPreferences } from '@/utils/hooks/use-profile'
import { useNotificationMutations, SendNotificationRequest } from '@/utils/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Smartphone, Webhook, Send, CheckCircle, AlertTriangle } from 'lucide-react'

interface TestNotificationPanelProps {
  preferences?: Partial<NotificationPreferences>
}

export function TestNotificationPanel({ preferences }: TestNotificationPanelProps) {
  const [selectedType, setSelectedType] = useState<'email' | 'mobile_push' | 'webhook'>('email')
  const [testEmail, setTestEmail] = useState('')
  const [testWebhook, setTestWebhook] = useState('')
  const [lastTestResult, setLastTestResult] = useState<{ type: string, success: boolean, message: string } | null>(null)

  const { sendTestNotification } = useNotificationMutations()

  const notificationTypes = [
    {
      type: 'email' as const,
      icon: <Mail className="w-4 h-4" />,
      label: 'Email',
      enabled: preferences?.email_notifications ?? true,
      description: 'Send a test email notification'
    },
    {
      type: 'mobile_push' as const,
      icon: <Smartphone className="w-4 h-4" />,
      label: 'Push Notification',
      enabled: preferences?.mobile_push_notifications ?? false,
      description: 'Send a test push notification to your device'
    },
    {
      type: 'webhook' as const,
      icon: <Webhook className="w-4 h-4" />,
      label: 'Webhook',
      enabled: preferences?.webhook_notifications ?? false,
      description: 'Send a test webhook notification'
    }
  ]

  const handleSendTest = async () => {
    try {
      const testData: SendNotificationRequest = {
        notification_type: selectedType,
        trigger_event: 'system_alert' as const,
        job_count: 5,
        query_ids: [1, 2],
        metadata: {
          test_message: 'This is a test notification to verify your settings are working correctly.',
          test_timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      }

      // Add recipient based on type
      if (selectedType === 'email' && testEmail) {
        testData.recipient = testEmail
      } else if (selectedType === 'webhook' && testWebhook) {
        testData.metadata.webhook_url = testWebhook
      }

      await sendTestNotification.mutateAsync(testData)
      
      setLastTestResult({
        type: selectedType,
        success: true,
        message: `Test ${selectedType} notification sent successfully!`
      })
    } catch (error) {
      setLastTestResult({
        type: selectedType,
        success: false,
        message: `Failed to send test notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }

  const selectedTypeInfo = notificationTypes.find(t => t.type === selectedType)
  const canSendTest = selectedTypeInfo?.enabled && !sendTestNotification.isPending

  return (
    <div className="space-y-6">
      {/* Type Selection */}
      <div>
        <Label className="text-base font-medium mb-3 block">Notification Type</Label>
        <div className="grid md:grid-cols-3 gap-3">
          {notificationTypes.map((type) => (
            <Card 
              key={type.type}
              className={`cursor-pointer transition-all ${
                selectedType === type.type 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:bg-gray-50'
              } ${!type.enabled ? 'opacity-50' : ''}`}
              onClick={() => type.enabled && setSelectedType(type.type)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {type.icon}
                  <span className="font-medium">{type.label}</span>
                  {!type.enabled && <Badge variant="secondary">Disabled</Badge>}
                </div>
                <p className="text-sm text-gray-600">{type.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Configuration based on selected type */}
      {selectedType === 'email' && (
        <div className="space-y-3">
          <Label htmlFor="test-email">Test Email Address</Label>
          <Input
            id="test-email"
            type="email"
            placeholder="Enter email address for test notification"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <p className="text-sm text-gray-600">
            Leave empty to use your account email address
          </p>
        </div>
      )}

      {selectedType === 'mobile_push' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-900">Push Notification Setup</span>
          </div>
          <p className="text-sm text-blue-700">
            {preferences?.expo_push_token 
              ? 'Your device is registered for push notifications. Test notification will be sent to your registered device.'
              : 'No push token registered. You need to enable push notifications in your device settings first.'}
          </p>
        </div>
      )}

      {selectedType === 'webhook' && (
        <div className="space-y-3">
          <Label htmlFor="test-webhook">Test Webhook URL</Label>
          <Input
            id="test-webhook"
            type="url"
            placeholder="https://your-server.com/webhook"
            value={testWebhook}
            onChange={(e) => setTestWebhook(e.target.value)}
          />
          <p className="text-sm text-gray-600">
            Leave empty to use your configured webhook URL: {preferences?.webhook_url || 'None configured'}
          </p>
        </div>
      )}

      {/* Send Test Button */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={handleSendTest}
          disabled={!canSendTest}
          className="flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {sendTestNotification.isPending ? 'Sending...' : `Send Test ${selectedTypeInfo?.label}`}
        </Button>

        {!selectedTypeInfo?.enabled && (
          <div className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">This notification type is disabled in your settings</span>
          </div>
        )}
      </div>

      {/* Last Test Result */}
      {lastTestResult && (
        <div className={`p-4 rounded-lg border ${
          lastTestResult.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {lastTestResult.success ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span className={`font-medium ${
              lastTestResult.success ? 'text-green-900' : 'text-red-900'
            }`}>
              Test Result
            </span>
          </div>
          <p className={`text-sm ${
            lastTestResult.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {lastTestResult.message}
          </p>
        </div>
      )}

      {/* Help Text */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-2">Testing Tips</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Test notifications help verify your delivery settings are working correctly</li>
          <li>• Email tests will show delivery status and any bounce/error messages</li>
          <li>• Webhook tests will show HTTP response codes and delivery confirmation</li>
          <li>• Push notifications require your device to be registered and online</li>
          <li>• Test notifications are marked with a &quot;test&quot; flag in the logs</li>
        </ul>
      </div>
    </div>
  )
}