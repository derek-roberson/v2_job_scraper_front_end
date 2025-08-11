import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase'
import { USState, USCity } from '@/types/api'

export function useStates() {
  return useQuery({
    queryKey: ['states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('us_states')
        .select('id, name, code')
        .order('name')

      if (error) throw error
      return data as USState[]
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - states don't change often
  })
}

export function useCities(stateId?: number) {
  return useQuery({
    queryKey: ['cities', stateId],
    queryFn: async () => {
      if (!stateId) return []
      
      const { data, error } = await supabase
        .from('us_cities')
        .select('id, city, state_name, state_id')
        .eq('state_id', stateId)
        .order('city')

      if (error) throw error
      return data as USCity[]
    },
    enabled: !!stateId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}