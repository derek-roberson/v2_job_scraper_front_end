'use client'

import { NotificationLog, useNotificationMutations } from '@/utils/hooks/use-notifications'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mail, Smartphone, Webhook, Globe, CheckCircle, XCircle, Clock, AlertTriangle, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface NotificationLogsListProps {
  logs: NotificationLog[]
  isLoading: boolean
}

export function NotificationLogsList({ logs, isLoading }: NotificationLogsListProps) {
  const { markNotificationAsRead } = useNotificationMutations()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications found</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          No notification logs match your current filters. Notifications will appear here as they are sent.
        </p>
      </div>
    )
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />
      case 'mobile_push': return <Smartphone className="w-4 h-4" />
      case 'web_push': return <Globe className="w-4 h-4" />
      case 'webhook': return <Webhook className="w-4 h-4" />
      default: return <AlertTriangle className="w-4 h-4" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />
      case 'skipped': return <AlertTriangle className="w-4 h-4 text-gray-600" />
      default: return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge variant="default">Sent</Badge>
      case 'failed': return <Badge variant="destructive">Failed</Badge>
      case 'pending': return <Badge variant="secondary">Pending</Badge>
      case 'skipped': return <Badge variant="outline">Skipped</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const getEventLabel = (event: string) => {
    switch (event) {
      case 'new_jobs': return 'New Jobs Found'
      case 'query_complete': return 'Query Completed'
      case 'system_alert': return 'System Alert'
      case 'digest': return 'Weekly Digest'
      default: return event
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return {
        relative: formatDistanceToNow(date, { addSuffix: true }),
        absolute: date.toLocaleString()
      }
    } catch {
      return { relative: 'Unknown', absolute: 'Unknown' }
    }
  }

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await markNotificationAsRead.mutateAsync(notificationId)
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const isUnread = !log.metadata?.read
        const isTest = log.metadata?.test
        const createdAt = formatDateTime(log.created_at)
        const sentAt = log.sent_at ? formatDateTime(log.sent_at) : null

        return (
          <Card key={log.id} className={`p-4 ${isUnread ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {/* Type Icon */}
                <div className="mt-1">
                  {getTypeIcon(log.notification_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">
                      {getEventLabel(log.trigger_event)}
                    </h4>
                    {isTest && (
                      <Badge variant="outline" className="text-xs">Test</Badge>
                    )}
                    {isUnread && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-4">
                      <span>Type: {log.notification_type}</span>
                      {log.job_count > 0 && (
                        <span>{log.job_count} jobs</span>
                      )}
                      {log.recipient && (
                        <span>To: {log.recipient}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs">
                      <span title={createdAt.absolute}>
                        Created {createdAt.relative}
                      </span>
                      {sentAt && (
                        <span title={sentAt.absolute}>
                          Sent {sentAt.relative}
                        </span>
                      )}
                    </div>

                    {log.error_message && (
                      <div className="text-red-600 text-xs mt-1">
                        Error: {log.error_message}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status and Actions */}
              <div className="flex items-center gap-2 ml-4">
                <div className="flex items-center gap-1">
                  {getStatusIcon(log.status)}
                  {getStatusBadge(log.status)}
                </div>

                {isUnread && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkAsRead(log.id)}
                    disabled={markNotificationAsRead.isPending}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Additional metadata for test notifications */}
            {isTest && log.metadata && (
              <div className="mt-3 pt-3 border-t bg-gray-50 rounded p-2 text-xs">
                <div className="font-medium mb-1">Test Metadata:</div>
                <pre className="text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}