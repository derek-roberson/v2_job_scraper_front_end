import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase'
import { useAuth } from '@/utils/hooks/use-auth'
import { Job, JobFilters } from '@/types/api'

export function useJobs(filters?: JobFilters) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['jobs', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      let query = supabase
        .from('jobs')
        .select(`
          *,
          queries(id, keywords, location_string)
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)

      // Apply applied filter
      if (filters?.appliedOnly) {
        query = query.eq('applied', true)
      } else if (filters?.showApplied === false) {
        query = query.eq('applied', false)
      }

      // Apply filters
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
      }

      if (filters?.queryId) {
        query = query.eq('query_id', filters.queryId)
      }

      if (filters?.dateRange?.from) {
        query = query.gte('posted', filters.dateRange.from.toISOString())
      }

      if (filters?.dateRange?.to) {
        query = query.lte('posted', filters.dateRange.to.toISOString())
      }

      // Apply sorting
      const sortBy = filters?.sortBy || 'posted'
      const sortOrder = filters?.sortOrder || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit)
      }
      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 20)) - 1)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Job[]
    },
    enabled: !!user?.id,
  })
}

export function useJobMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const softDeleteJob = useMutation({
    mutationFn: async (jobId: number) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { error } = await supabase
        .from('jobs')
        .update({ is_deleted: true })
        .eq('id', jobId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const markJobAsApplied = useMutation({
    mutationFn: async ({ jobId, applied }: { jobId: number; applied: boolean }) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { error } = await supabase
        .from('jobs')
        .update({ applied })
        .eq('id', jobId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  return { softDeleteJob, markJobAsApplied }
}

export function useJobStats() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['job-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('jobs')
        .select('posted, query_id')
        .eq('user_id', user.id)
        .eq('is_deleted', false)

      if (error) throw error

      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

      const todayJobs = data.filter(job => 
        job.posted && new Date(job.posted) >= today
      ).length

      const weekJobs = data.filter(job => 
        job.posted && new Date(job.posted) >= thisWeek
      ).length

      const uniqueQueries = new Set(data.map(job => job.query_id)).size

      return {
        totalJobs: data.length,
        todayJobs,
        weekJobs,
        uniqueQueries
      }
    },
    enabled: !!user?.id,
  })
}