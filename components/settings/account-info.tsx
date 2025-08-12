'use client'

import { UserProfile } from '@/utils/hooks/use-profile'
import { User } from '@supabase/supabase-js'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface AccountInfoProps {
  profile?: UserProfile
  user?: User | null
}

export function AccountInfo({ profile, user }: AccountInfoProps) {
  const formatAccountType = (type: string) => {
    switch (type) {
      case 'admin': return 'Administrator'
      case 'privileged': return 'Privileged User'
      case 'user': return 'Standard User'
      default: return 'User'
    }
  }

  const getAccountTypeBadge = (type: string) => {
    switch (type) {
      case 'admin': return 'destructive'
      case 'privileged': return 'default'
      case 'user': return 'secondary'
      default: return 'secondary'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available'
    
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'Not available'
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Account Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span>{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Account Type:</span>
              <Badge variant={getAccountTypeBadge(profile?.account_type || 'user') as 'default' | 'secondary' | 'destructive' | 'outline'}>
                {formatAccountType(profile?.account_type || 'user')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">User ID:</span>
              <span className="font-mono text-xs">{user?.id?.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Account Status</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <Badge variant={profile?.is_suspended ? 'destructive' : 'default'}>
                {profile?.is_suspended ? 'Suspended' : 'Active'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Member since:</span>
              <span>{formatDate(profile?.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last login:</span>
              <span>{formatDate(profile?.last_login_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Subscription Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Plan:</span>
              <Badge variant={profile?.subscription_tier === 'free' ? 'secondary' : 'default'}>
                {profile?.subscription_tier?.toUpperCase() || 'FREE'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Query Limit:</span>
              <span>
                {profile?.max_active_queries === -1 
                  ? 'Unlimited' 
                  : `${profile?.max_active_queries || 3} active`}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Profile Completion</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Profile completion:</span>
              <span>
                {(() => {
                  let completed = 2 // Email and account created
                  if (profile?.full_name) completed++
                  if (profile?.company) completed++
                  return `${Math.round((completed / 4) * 100)}%`
                })()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ 
                  width: `${(() => {
                    let completed = 2
                    if (profile?.full_name) completed++
                    if (profile?.company) completed++
                    return Math.round((completed / 4) * 100)
                  })()}%` 
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}