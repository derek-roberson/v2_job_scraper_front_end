export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  features: string[]
  limitations?: string[]
  priceId: string
  price: number
  currency: string
  interval: 'month' | 'year'
  trialDays?: number
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Limited access after trial',
    features: [
      'View previously fetched jobs',
      'Export saved jobs to CSV',
      'Basic search and filters',
    ],
    limitations: [
      'Cannot create new queries',
      'Cannot resume paused queries',
      'No new job fetching',
      'No email notifications',
    ],
    priceId: '', // Free tier doesn't need a price ID
    price: 0,
    currency: 'usd',
    interval: 'month',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Full access to all features',
    features: [
      'Unlimited active search queries',
      'Unlimited jobs per month',
      'Real-time job fetching',
      'Email notifications',
      'Resume and pause queries',
      'Export to CSV & Excel',
      'Advanced filters',
      'Priority support',
    ],
    priceId: 'price_pro_monthly', // Replace with actual Stripe price ID
    price: 10,
    currency: 'usd',
    interval: 'month',
    trialDays: 3,
  },
]

export function getPlanByPriceId(priceId: string): SubscriptionPlan | undefined {
  return subscriptionPlans.find(plan => plan.priceId === priceId)
}

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return subscriptionPlans.find(plan => plan.id === id)
}