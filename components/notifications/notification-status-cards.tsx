'use client'

import { NotificationStatus } from '@/utils/hooks/use-notifications'
import { NotificationPreferences } from '@/utils/hooks/use-profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Webhook, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface NotificationStatusCardsProps {
  status?: NotificationStatus
  preferences?: Partial<NotificationPreferences>
  isLoading: boolean
}

export function NotificationStatusCards({ status, preferences, isLoading }: NotificationStatusCardsProps) {
  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Loading...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-gray-600">Loading data...</p>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const formatLastSent = (dateString?: string) => {
    if (!dateString) return 'Never'
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  const getStatusBadge = (enabled: boolean, lastSent?: string) => {
    if (!enabled) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Disabled
      </Badge>
    }
    
    if (!lastSent) {
      return <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Ready
      </Badge>
    }
    
    return <Badge variant="default" className="flex items-center gap-1">
      <CheckCircle className="w-3 h-3" />
      Active
    </Badge>
  }

  const cards = [
    {
      title: 'Email Notifications',
      icon: <Mail className="w-5 h-5" />,
      enabled: status?.email_enabled ?? true,
      lastSent: status?.last_email_sent,
      frequency: 'hourly',
      digest: preferences?.email_digest ?? false
    },
    {
      title: 'Webhook Notifications',
      icon: <Webhook className="w-5 h-5" />,
      enabled: status?.webhook_enabled ?? false,
      lastSent: status?.last_webhook_sent,
      url: preferences?.webhook_url ? 'Configured' : 'Not configured'
    },
    {
      title: 'Delivery Stats',
      icon: <AlertTriangle className="w-5 h-5" />,
      sent: status?.total_notifications_sent || 0,
      failed: status?.failed_notifications || 0,
      successRate: status?.total_notifications_sent 
        ? Math.round(((status.total_notifications_sent - (status.failed_notifications || 0)) / status.total_notifications_sent) * 100)
        : 100
    }
  ]

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Email Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            {cards[0].icon}
            {cards[0].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {getStatusBadge(cards[0].enabled ?? true, cards[0].lastSent)}
            <div className="text-xs text-gray-600">
              <div>Frequency: {cards[0].frequency}</div>
              <div>Digest: {cards[0].digest ? 'Enabled' : 'Disabled'}</div>
              <div>Last sent: {formatLastSent(cards[0].lastSent)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            {cards[1].icon}
            {cards[1].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {getStatusBadge(cards[1].enabled ?? false, cards[1].lastSent)}
            <div className="text-xs text-gray-600">
              <div>Endpoint: {cards[1].url}</div>
              <div>Last sent: {formatLastSent(cards[1].lastSent)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            {cards[2].icon}
            {cards[2].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold">{cards[2].successRate}%</div>
            <div className="text-xs text-gray-600">
              <div>{cards[2].sent} sent</div>
              <div>{cards[2].failed} failed</div>
              <div>Success rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}