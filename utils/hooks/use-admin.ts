import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/utils/hooks/use-auth'

export interface AdminUser {
  id: string
  email: string
  full_name?: string
  account_type: 'standard' | 'privileged' | 'admin'
  subscription_tier: 'free' | 'basic' | 'premium'
  max_active_queries: number
  created_at: string
  updated_at: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  status?: string
}

export interface AdminStats {
  totalUsers: number
  proUsers: number
  privilegedUsers: number
  activeQueries: number
}

export interface AdminUsersResponse {
  users: AdminUser[]
  stats: AdminStats
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UserFilters {
  page?: number
  limit?: number
  search?: string
  account_type?: string
}

export function useAdminUsers(filters: UserFilters = {}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['admin-users', filters],
    queryFn: async (): Promise<AdminUsersResponse> => {
      if (!user) throw new Error('Not authenticated')

      const { data: { session } } = await import('@/utils/supabase').then(m => m.supabase.auth.getSession())
      if (!session?.access_token) throw new Error('No access token')

      const searchParams = new URLSearchParams()
      if (filters.page) searchParams.set('page', filters.page.toString())
      if (filters.limit) searchParams.set('limit', filters.limit.toString())
      if (filters.search) searchParams.set('search', filters.search)
      if (filters.account_type) searchParams.set('account_type', filters.account_type)

      const response = await fetch(`/api/admin/users?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      return response.json()
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })
}

export function useAdminUserMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const updateUser = useMutation({
    mutationFn: async ({ 
      userId, 
      updates 
    }: { 
      userId: string
      updates: Partial<Pick<AdminUser, 'account_type' | 'subscription_tier' | 'max_active_queries' | 'full_name'>>
    }) => {
      if (!user) throw new Error('Not authenticated')

      const { data: { session } } = await import('@/utils/supabase').then(m => m.supabase.auth.getSession())
      if (!session?.access_token) throw new Error('No access token')

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update user')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) throw new Error('Not authenticated')

      const { data: { session } } = await import('@/utils/supabase').then(m => m.supabase.auth.getSession())
      if (!session?.access_token) throw new Error('No access token')

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete user')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  return {
    updateUser,
    deleteUser,
  }
}