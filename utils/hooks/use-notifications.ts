import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase'
import { useAuth } from '@/utils/hooks/use-auth'

export interface NotificationLog {
  id: number
  user_id: string
  notification_type: 'email' | 'mobile_push' | 'web_push' | 'webhook'
  trigger_event: 'new_jobs' | 'query_complete' | 'system_alert' | 'digest'
  job_count: number
  query_ids: number[]
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  recipient?: string
  error_message?: string
  metadata?: any
  sent_at?: string
  created_at: string
}

export interface SendNotificationRequest {
  notification_type: 'email' | 'mobile_push' | 'web_push' | 'webhook'
  trigger_event: 'new_jobs' | 'query_complete' | 'system_alert' | 'digest'
  job_count?: number
  query_ids?: number[]
  recipient?: string
  metadata?: any
}

export interface NotificationStatus {
  email_enabled: boolean
  push_enabled: boolean
  webhook_enabled: boolean
  last_email_sent?: string
  last_push_sent?: string
  last_webhook_sent?: string
  total_notifications_sent: number
  failed_notifications: number
}

export function useNotificationLogs(limit: number = 50) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['notification-logs', user?.id, limit],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data as NotificationLog[]
    },
    enabled: !!user?.id,
  })
}

export function useNotificationStatus() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['notification-status', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')

      // Get notification preferences
      const { data: prefs, error: prefsError } = await supabase
        .from('notification_preferences')
        .select('email_notifications, mobile_push_notifications, webhook_notifications')
        .eq('user_id', user.id)
        .single()

      if (prefsError && prefsError.code !== 'PGRST116') throw prefsError

      // Get recent notification logs for stats
      const { data: logs, error: logsError } = await supabase
        .from('notification_logs')
        .select('notification_type, status, sent_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (logsError) throw logsError

      const recentLogs = logs || []
      const emailLogs = recentLogs.filter(log => log.notification_type === 'email')
      const pushLogs = recentLogs.filter(log => log.notification_type === 'mobile_push')
      const webhookLogs = recentLogs.filter(log => log.notification_type === 'webhook')

      const status: NotificationStatus = {
        email_enabled: prefs?.email_notifications ?? true,
        push_enabled: prefs?.mobile_push_notifications ?? false,
        webhook_enabled: prefs?.webhook_notifications ?? false,
        last_email_sent: emailLogs.find(log => log.status === 'sent')?.sent_at,
        last_push_sent: pushLogs.find(log => log.status === 'sent')?.sent_at,
        last_webhook_sent: webhookLogs.find(log => log.status === 'sent')?.sent_at,
        total_notifications_sent: recentLogs.filter(log => log.status === 'sent').length,
        failed_notifications: recentLogs.filter(log => log.status === 'failed').length
      }

      return status
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const sendTestNotification = useMutation({
    mutationFn: async (request: SendNotificationRequest) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      // In a real app, this would trigger the backend notification service
      // For now, we'll create a notification log entry to simulate
      const { data, error } = await supabase
        .from('notification_logs')
        .insert({
          user_id: user.id,
          notification_type: request.notification_type,
          trigger_event: request.trigger_event,
          job_count: request.job_count || 0,
          query_ids: request.query_ids || [],
          status: 'sent', // Simulate successful send
          recipient: request.recipient,
          metadata: {
            ...request.metadata,
            test: true,
            sent_via: 'frontend_test'
          },
          sent_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return data as NotificationLog
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] })
      queryClient.invalidateQueries({ queryKey: ['notification-status'] })
    },
  })

  const markNotificationAsRead = useMutation({
    mutationFn: async (notificationId: number) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      // Update metadata to mark as read
      const { error } = await supabase
        .from('notification_logs')
        .update({
          metadata: { read: true, read_at: new Date().toISOString() }
        })
        .eq('id', notificationId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] })
    },
  })

  return { sendTestNotification, markNotificationAsRead }
}

// Hook for checking if user has unread notifications
export function useUnreadNotifications() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['unread-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('notification_logs')
        .select('id, metadata')
        .eq('user_id', user.id)
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      const unreadCount = (data || []).filter(log => 
        !log.metadata?.read
      ).length

      return {
        unread_count: unreadCount,
        notifications: data || []
      }
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds
  })
}