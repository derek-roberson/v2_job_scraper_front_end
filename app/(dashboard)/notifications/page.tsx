'use client'

import { useState } from 'react'
import { useNotificationLogs, useNotificationStatus } from '@/utils/hooks/use-notifications'
import { useNotificationPreferences, useUserProfile } from '@/utils/hooks/use-profile'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NotificationStatusCards } from '@/components/notifications/notification-status-cards'
import { NotificationLogsList } from '@/components/notifications/notification-logs-list'
import { TestNotificationPanel } from '@/components/notifications/test-notification-panel'
import { Bell, BellRing, RefreshCw, TestTube, Settings } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

export default function NotificationsPage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const queryClient = useQueryClient()

  // Check admin access
  const { data: userProfile } = useUserProfile()

  // Fetch notification data
  const { data: notificationLogs, isLoading: logsLoading } = useNotificationLogs(100)
  const { data: notificationStatus, isLoading: statusLoading } = useNotificationStatus()
  const { data: notificationPrefs } = useNotificationPreferences()

  // Admin access check - redirect non-admin users
  if (userProfile && userProfile.account_type !== 'admin') {
    redirect('/dashboard')
  }

  // Filter logs based on selected filters
  const filteredLogs = notificationLogs?.filter(log => {
    if (statusFilter !== 'all' && log.status !== statusFilter) return false
    if (typeFilter !== 'all' && log.notification_type !== typeFilter) return false
    return true
  }) || []

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notification-logs'] })
    queryClient.invalidateQueries({ queryKey: ['notification-status'] })
  }

  const isLoading = logsLoading || statusLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TestTube className="w-8 h-8" />
            Notification Testing (Admin)
          </h1>
          <p className="text-gray-600">Test notification delivery systems and view delivery history</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Notification Settings
            </Button>
          </Link>
          <Button variant="outline" onClick={refreshNotifications}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <NotificationStatusCards 
        status={notificationStatus} 
        preferences={notificationPrefs}
        isLoading={statusLoading} 
      />

      {/* Test Notifications Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Test Notifications
          </CardTitle>
          <CardDescription>
            Send test notifications to verify your notification settings are working correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestNotificationPanel preferences={notificationPrefs} />
        </CardContent>
      </Card>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5" />
            Notification History
          </CardTitle>
          <CardDescription>
            View your recent notification delivery logs and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-sm font-medium">Status:</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="type-filter" className="text-sm font-medium">Type:</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type-filter" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="mobile_push">Push</SelectItem>
                  <SelectItem value="web_push">Web Push</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary">
                {filteredLogs.length} of {notificationLogs?.length || 0} notifications
              </Badge>
            </div>
          </div>

          {/* Notification Logs */}
          <NotificationLogsList 
            logs={filteredLogs} 
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common notification management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/settings" className="block">
              <div className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                <Settings className="w-6 h-6 mb-2" />
                <h4 className="font-medium">Update Preferences</h4>
                <p className="text-sm text-gray-600">Configure notification types and frequency</p>
              </div>
            </Link>

            <div className="p-4 border rounded-lg bg-gray-50">
              <Bell className="w-6 h-6 mb-2" />
              <h4 className="font-medium">Email Digest</h4>
              <p className="text-sm text-gray-600">
                {notificationPrefs?.email_digest ? 'Enabled' : 'Disabled'} - 
                Weekly summary of job activity
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-gray-50">
              <BellRing className="w-6 h-6 mb-2" />
              <h4 className="font-medium">Hourly Job Alerts</h4>
              <p className="text-sm text-gray-600">
                Notifications sent every hour when new jobs match your queries
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}