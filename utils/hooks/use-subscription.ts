import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase'
import { useAuth } from '@/utils/hooks/use-auth'
import { useUserProfile } from '@/utils/hooks/use-profile'
import { subscriptionPlans } from '@/config/subscriptions'

export interface SubscriptionStatus {
  isActive: boolean
  isTrial: boolean
  isPrivileged: boolean
  planId: string
  planName: string
  status: string
  currentPeriodEnd?: string
  cancelAt?: string
  trialEndsAt?: string
  canCreateQueries: boolean
  canResumeQueries: boolean
  canFetchNewJobs: boolean
  maxQueries: number
  maxJobsPerMonth: number
  features: string[]
  limitations?: string[]
}

export function useSubscription() {
  const { user } = useAuth()
  const { data: profile } = useUserProfile()

  return useQuery({
    queryKey: ['subscription', user?.id, profile?.account_type],
    queryFn: async (): Promise<SubscriptionStatus> => {
      if (!user?.id) {
        return getFreePlanStatus()
      }

      // Check if user is privileged (admin or privileged account type)
      const isPrivileged = profile?.account_type === 'admin' || profile?.account_type === 'privileged'
      
      // Privileged users get full access without subscription
      if (isPrivileged) {
        return getPrivilegedStatus()
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        return getFreePlanStatus()
      }

      // Determine the plan based on subscription_tier stored in user_profiles
      const isPro = data.subscription_tier === 'pro'
      const planId = isPro ? 'pro' : 'free'

      const plan = subscriptionPlans.find(p => p.id === planId) || subscriptionPlans[0]
      
      // Determine capabilities based on plan
      const canCreateQueries = planId === 'pro'
      const canResumeQueries = planId === 'pro'
      const canFetchNewJobs = planId === 'pro'
      const isActive = planId === 'pro'
      
      return {
        isActive,
        isTrial: false, // Simplified: no trial tracking in user_profiles
        isPrivileged: false,
        planId: plan.id,
        planName: plan.name,
        status: planId, // Use planId as status
        canCreateQueries,
        canResumeQueries,
        canFetchNewJobs,
        maxQueries: getMaxQueries(planId),
        maxJobsPerMonth: getMaxJobsPerMonth(planId),
        features: plan.features,
        limitations: plan.limitations,
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })
}

function getFreePlanStatus(): SubscriptionStatus {
  const freePlan = subscriptionPlans[0]
  return {
    isActive: false,
    isTrial: false,
    isPrivileged: false,
    planId: 'free',
    planName: 'Free',
    status: 'free',
    canCreateQueries: false,
    canResumeQueries: false,
    canFetchNewJobs: false,
    maxQueries: 0,
    maxJobsPerMonth: 0,
    features: freePlan.features,
    limitations: freePlan.limitations,
  }
}

function getPrivilegedStatus(): SubscriptionStatus {
  return {
    isActive: true,
    isTrial: false,
    isPrivileged: true,
    planId: 'privileged',
    planName: 'Privileged Access',
    status: 'privileged',
    canCreateQueries: true,
    canResumeQueries: true,
    canFetchNewJobs: true,
    maxQueries: -1, // Unlimited
    maxJobsPerMonth: -1, // Unlimited
    features: [
      'Unlimited active search queries',
      'Unlimited jobs per month',
      'Real-time job fetching',
      'Email notifications',
      'Resume and pause queries',
      'Export to all formats',
      'Advanced filters',
      'Admin controls',
      'Priority support',
    ],
    limitations: [],
  }
}

function getMaxQueries(planId: string): number {
  switch (planId) {
    case 'free':
      return 0 // Free accounts cannot create new queries
    case 'pro':
      return -1 // Unlimited
    default:
      return 0
  }
}

function getMaxJobsPerMonth(planId: string): number {
  switch (planId) {
    case 'free':
      return 0 // Free accounts cannot fetch new jobs
    case 'pro':
      return -1 // Unlimited
    default:
      return 0
  }
}

export function useCanCreateQuery() {
  const { data: subscription } = useSubscription()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['can-create-query', user?.id, subscription?.planId, subscription?.isPrivileged],
    queryFn: async () => {
      if (!user?.id || !subscription) {
        return { canCreate: false, reason: 'Not authenticated' }
      }

      // Privileged users always have access
      if (subscription.isPrivileged) {
        return { canCreate: true, reason: '', remaining: -1 }
      }

      // Check if user has permission to create queries
      if (!subscription.canCreateQueries) {
        if (subscription.planId === 'free') {
          return {
            canCreate: false,
            reason: 'Free accounts cannot create new queries. Upgrade to Pro to create and manage queries.',
            needsUpgrade: true
          }
        }
        return { canCreate: false, reason: 'Your plan does not allow creating queries' }
      }

      // Pro users have unlimited queries
      return { canCreate: true, reason: '', remaining: -1 }
    },
    enabled: !!user?.id && !!subscription,
  })
}

export function useCanResumeQuery() {
  const { data: subscription } = useSubscription()
  
  // Privileged users always have access
  if (subscription?.isPrivileged) {
    return {
      canResume: true,
      reason: '',
      needsUpgrade: false
    }
  }
  
  return {
    canResume: subscription?.canResumeQueries || false,
    reason: subscription?.canResumeQueries 
      ? '' 
      : 'Free accounts cannot resume queries. Upgrade to Pro to manage your queries.',
    needsUpgrade: subscription?.planId === 'free'
  }
}