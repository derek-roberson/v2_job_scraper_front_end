'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TimezoneSelect } from '@/components/ui/timezone-select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Mail, 
  Clock, 
  Globe, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Bell,
  Zap,
  Shield
} from 'lucide-react'
import { useProfileMutations } from '@/utils/hooks/use-profile'

interface NotificationOnboardingProps {
  open: boolean
  onComplete: () => void
}

export function NotificationOnboarding({ open, onComplete }: NotificationOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [respectNotificationHours, setRespectNotificationHours] = useState(false)
  const [timezone, setTimezone] = useState('UTC')
  const [notificationHours, setNotificationHours] = useState<number[]>([9, 10, 11, 12, 13, 14, 15, 16, 17])
  const [saving, setSaving] = useState(false)
  
  const { updateNotificationPreferences } = useProfileMutations()

  const handleHourToggle = (hour: number, checked: boolean) => {
    if (checked) {
      setNotificationHours(prev => [...prev, hour].sort((a, b) => a - b))
    } else {
      setNotificationHours(prev => prev.filter(h => h !== hour))
    }
  }

  const selectBusinessHours = () => {
    setNotificationHours([9, 10, 11, 12, 13, 14, 15, 16, 17])
  }

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  const handleComplete = async () => {
    setSaving(true)
    
    try {
      await updateNotificationPreferences.mutateAsync({
        email_notifications: emailNotifications,
        respect_notification_hours: respectNotificationHours,
        timezone: timezone,
        notification_hours: notificationHours,
      })
      
      onComplete()
    } catch (error) {
      console.error('Failed to save onboarding preferences:', error)
      // Continue with onboarding completion even if save fails
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Welcome to Job Alerts!</h3>
        <p className="text-gray-600">
          Let&apos;s set up your notification preferences to help you never miss the perfect opportunity.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <Label htmlFor="email-onboarding" className="font-medium">Email Notifications</Label>
            </div>
            <p className="text-sm text-gray-600">
              Get instant alerts when new jobs match your criteria
            </p>
          </div>
          <Switch
            id="email-onboarding"
            checked={emailNotifications}
            onCheckedChange={setEmailNotifications}
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Benefits of Email Notifications
          </h4>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Instant alerts when jobs are posted that match your search criteria
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Never miss opportunities from your favorite companies
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Customizable notification timing to respect your schedule
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Clean, organized job details delivered directly to your inbox
            </li>
          </ul>
        </div>
      </div>

      <div className="flex justify-between">
        <div></div>
        <Button onClick={() => setCurrentStep(2)} className="flex items-center gap-2">
          Next: Timing Preferences
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Notification Timing</h3>
        <p className="text-gray-600">
          Control when you receive notifications to maintain work-life balance.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <Label htmlFor="respect-hours-onboarding" className="font-medium">Respect Time Preferences</Label>
            </div>
            <p className="text-sm text-gray-600">
              Only receive notifications during your preferred hours
            </p>
          </div>
          <Switch
            id="respect-hours-onboarding"
            checked={respectNotificationHours}
            onCheckedChange={setRespectNotificationHours}
          />
        </div>

        {respectNotificationHours && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-medium">
                <Globe className="w-4 h-4" />
                Your Timezone
              </Label>
              <TimezoneSelect
                value={timezone}
                onValueChange={setTimezone}
                placeholder="Select your timezone"
              />
              <p className="text-xs text-gray-600">
                Required for scheduling notifications at specific hours
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Notification Hours</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectBusinessHours}
                >
                  Business Hours (9-5)
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Jobs found outside these hours will be queued for your next notification window.
              </p>
              
              <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="flex items-center space-x-2">
                    <Checkbox
                      id={`hour-onboarding-${hour}`}
                      checked={notificationHours.includes(hour)}
                      onCheckedChange={(checked) => handleHourToggle(hour, checked as boolean)}
                    />
                    <Label htmlFor={`hour-onboarding-${hour}`} className="text-xs">
                      {formatHour(hour)}
                    </Label>
                  </div>
                ))}
              </div>

              {notificationHours.length > 0 && (
                <p className="text-sm text-gray-600">
                  Selected: {notificationHours.length} hour{notificationHours.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-medium text-green-900 mb-2">
            Why timing matters
          </h4>
          <p className="text-sm text-green-800">
            Setting notification hours helps maintain work-life balance and ensures you receive 
            job alerts when you&apos;re most likely to act on them. Jobs found outside your preferred 
            hours will be saved and sent during your next notification window.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => setCurrentStep(1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button 
          onClick={handleComplete}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving ? 'Saving...' : 'Complete Setup'}
          <CheckCircle className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${currentStep >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-8 h-0.5 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-2 h-2 rounded-full ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            </div>
            <span className="ml-2">Step {currentStep} of 2</span>
          </DialogTitle>
          <DialogDescription>
            Set up your notification preferences to get the most out of Job Alerts
          </DialogDescription>
        </DialogHeader>
        
        {currentStep === 1 ? renderStep1() : renderStep2()}
      </DialogContent>
    </Dialog>
  )
}