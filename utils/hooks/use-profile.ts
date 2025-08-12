import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase'
import { useAuth } from '@/utils/hooks/use-auth'

export interface UserProfile {
  id: string
  account_type: 'admin' | 'privileged' | 'user'
  full_name?: string
  company?: string
  subscription_tier: 'free' | 'basic' | 'premium'
  max_active_queries: number
  is_suspended: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface NotificationPreferences {
  id: number
  user_id: string
  email_notifications: boolean
  mobile_push_notifications: boolean
  webhook_notifications: boolean
  webhook_url?: string
  webhook_secret?: string
  notification_frequency: 'immediate' | 'hourly' | 'daily'
  email_digest: boolean
  push_subscription_data?: any
  expo_push_token?: string
  data_sharing_consent: boolean
  marketing_consent: boolean
  created_at: string
  updated_at: string
}

export interface UpdateProfileRequest {
  full_name?: string
  company?: string
}

export interface UpdateNotificationPreferencesRequest {
  email_notifications?: boolean
  mobile_push_notifications?: boolean
  webhook_notifications?: boolean
  webhook_url?: string
  notification_frequency?: 'immediate' | 'hourly' | 'daily'
  email_digest?: boolean
  data_sharing_consent?: boolean
  marketing_consent?: boolean
}

export function useUserProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data as UserProfile
    },
    enabled: !!user?.id,
  })
}

export function useNotificationPreferences() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        // If no preferences exist, return defaults
        if (error.code === 'PGRST116') {
          return {
            user_id: user.id,
            email_notifications: true,
            mobile_push_notifications: false,
            webhook_notifications: false,
            notification_frequency: 'immediate',
            email_digest: false,
            data_sharing_consent: false,
            marketing_consent: false,
          } as Partial<NotificationPreferences>
        }
        throw error
      }
      
      return data as NotificationPreferences
    },
    enabled: !!user?.id,
  })
}

export function useProfileMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const updateProfile = useMutation({
    mutationFn: async (updates: UpdateProfileRequest) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      return data as UserProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
    },
  })

  const updateNotificationPreferences = useMutation({
    mutationFn: async (updates: UpdateNotificationPreferencesRequest) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      // First try to update existing preferences
      const { data: existingData, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      let data, error
      
      if (existingData) {
        // Update existing preferences
        const result = await supabase
          .from('notification_preferences')
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .single()
        data = result.data
        error = result.error
      } else {
        // Create new preferences
        const result = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            ...updates,
          })
          .select()
          .single()
        data = result.data
        error = result.error
      }

      if (error) throw error
      return data as NotificationPreferences
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  return { updateProfile, updateNotificationPreferences }
}