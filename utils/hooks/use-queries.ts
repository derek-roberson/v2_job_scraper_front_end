import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase'
import { useAuth } from '@/utils/hooks/use-auth'
import { CreateQueryRequest, UpdateQueryRequest, Query } from '@/types/api'

export function useQueries() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['queries', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('queries')
        .select(`
          *,
          us_cities(id, city, state_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Query[]
    },
    enabled: !!user?.id,
  })
}

export function useQueryMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const createQuery = useMutation({
    mutationFn: async (newQuery: CreateQueryRequest) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('queries')
        .insert({
          ...newQuery,
          user_id: user.id,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error
      return data as Query
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  const updateQuery = useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateQueryRequest) => {
      const { data, error } = await supabase
        .from('queries')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Query
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  const deleteQuery = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('queries')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  return { createQuery, updateQuery, deleteQuery }
}