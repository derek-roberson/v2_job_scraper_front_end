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
      
      console.log('Fetching queries for user:', user.id)
      
      const { data, error } = await supabase
        .from('queries')
        .select(`
          *,
          us_cities(id, city, state_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching queries:', error)
        throw error
      }
      
      console.log('Fetched queries:', data)
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
      console.log('createQuery mutation called with:', newQuery)
      console.log('User ID:', user?.id)
      
      if (!user?.id) {
        console.error('User not authenticated')
        throw new Error('User not authenticated')
      }
      
      const insertData = {
        ...newQuery,
        user_id: user.id,
        is_active: true
      }
      
      console.log('About to insert into queries table:', insertData)
      
      const { data, error } = await supabase
        .from('queries')
        .insert(insertData)
        .select()
        .single()

      console.log('Supabase response - data:', data)
      console.log('Supabase response - error:', error)
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      console.log('Query creation successful, returning:', data)
      return data as Query
    },
    onSuccess: (data) => {
      console.log('createQuery onSuccess called with:', data)
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
    onError: (error) => {
      console.error('createQuery onError called with:', error)
    }
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