'use client'

import { useUnreadNotifications } from '@/utils/hooks/use-notifications'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'

export function NotificationIndicator() {
  const { data: unreadData } = useUnreadNotifications()
  const unreadCount = unreadData?.unread_count || 0

  if (unreadCount === 0) {
    return <Bell className="w-5 h-5" />
  }

  return (
    <div className="relative">
      <Bell className="w-5 h-5" />
      <Badge 
        variant="destructive" 
        className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
      >
        {unreadCount > 9 ? '9+' : unreadCount}
      </Badge>
    </div>
  )
}