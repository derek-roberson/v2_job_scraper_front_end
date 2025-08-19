'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/utils/hooks/use-auth'
import { useQueries, useQueryMutations } from '@/utils/hooks/use-queries'
import { useJobStats } from '@/utils/hooks/use-jobs'
import { useCanCreateQuery, useSubscription } from '@/utils/hooks/use-subscription'
import { useUserProfile, useProfileMutations } from '@/utils/hooks/use-profile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreateQueryForm } from '@/components/queries/create-query-form'
import { QueryList } from '@/components/queries/query-list'
import { NotificationOnboarding } from '@/components/onboarding/notification-onboarding'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [statsExpanded, setStatsExpanded] = useState(false)
  
  // Use actual query hooks
  const { data: queries = [], isLoading } = useQueries()
  const { createQuery, updateQuery, deleteQuery } = useQueryMutations()
  const { data: jobStats } = useJobStats()
  const { data: canCreate } = useCanCreateQuery()
  const { data: subscription } = useSubscription()
  const { data: profile } = useUserProfile()
  const { updateProfile } = useProfileMutations()

  // Check if user needs onboarding
  const shouldShowOnboarding = profile && !profile.onboarding_completed

  const handleOnboardingComplete = async () => {
    try {
      await updateProfile.mutateAsync({ onboarding_completed: true })
    } catch (error) {
      console.error('Failed to mark onboarding as completed:', error)
    }
  }

  const handleCreateQuery = async (data: {
    keywords: string
    work_types: number[]
    state?: string
    city?: string
    city_id?: number
  }) => {
    try {
      const queryData = {
        keywords: data.keywords,
        work_types: data.work_types,
        city_id: data.city_id || undefined,
        location_string: data.state && data.city ? `${data.city}, ${data.state}` : data.state,
      }
      
      await createQuery.mutateAsync(queryData)
      setShowCreateForm(false)
    } catch (error) {
      console.error('Failed to create query:', error)
      alert(`Failed to create query: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleToggleQuery = async (id: number, active: boolean) => {
    try {
      await updateQuery.mutateAsync({ id, is_active: active })
    } catch (error) {
      console.error('Failed to toggle query:', error)
    }
  }

  const handleDeleteQuery = async (id: number) => {
    try {
      await deleteQuery.mutateAsync(id)
    } catch (error) {
      console.error('Failed to delete query:', error)
    }
  }

  return (
    <>
      <NotificationOnboarding 
        open={!!shouldShowOnboarding}
        onComplete={handleOnboardingComplete}
      />
      
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.email}</p>
        </div>

      {/* Trial/Subscription Status Banner */}
      {subscription && (
        <>
          {subscription.isPrivileged && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">
                    Welcome! You have privileged access
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    All features are available to you without any subscription requirements.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {!subscription.isPrivileged && subscription.isTrial && subscription.trialEndsAt && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">
                    You&apos;re on a free trial of the Pro plan
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Your trial ends on {new Date(subscription.trialEndsAt).toLocaleDateString()}. 
                    After that, you&apos;ll be moved to the Free plan unless you upgrade.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {!subscription.isPrivileged && subscription.planId === 'free' && !subscription.isTrial && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">
                      You&apos;re on the Free plan
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      You can view previously fetched jobs but cannot create or resume queries.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push('/pricing')}
                  className="w-full sm:w-auto"
                >
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Stats Cards - Collapsible on Mobile */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          className="w-full mb-3 flex items-center justify-between"
          onClick={() => setStatsExpanded(!statsExpanded)}
        >
          <span className="font-medium">View Statistics</span>
          {statsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {statsExpanded && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Active Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{queries.filter(q => q.is_active).length}</div>
                <p className="text-xs text-gray-600">Currently monitoring</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Jobs Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{jobStats?.todayJobs || 0}</div>
                <p className="text-xs text-gray-600">New today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{jobStats?.totalJobs || 0}</div>
                <p className="text-xs text-gray-600">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {queries.length > 0 && jobStats?.uniqueQueries
                    ? `${Math.round((jobStats.uniqueQueries / queries.length) * 100)}%`
                    : '0%'}
                </div>
                <p className="text-xs text-gray-600">With results</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queries.filter(q => q.is_active).length}</div>
            <p className="text-xs text-gray-600">Currently monitoring</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Jobs Found Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats?.todayJobs || 0}</div>
            <p className="text-xs text-gray-600">New opportunities today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats?.totalJobs || 0}</div>
            <p className="text-xs text-gray-600">All opportunities found</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queries.length > 0 && jobStats?.uniqueQueries
                ? `${Math.round((jobStats.uniqueQueries / queries.length) * 100)}%`
                : '0%'}
            </div>
            <p className="text-xs text-gray-600">Queries with results</p>
          </CardContent>
        </Card>
      </div>

      {/* Query Management Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Create Query Form */}
        <div>
          {showCreateForm ? (
            <CreateQueryForm
              onSubmit={handleCreateQuery}
              onCancel={() => setShowCreateForm(false)}
              loading={createQuery.isPending}
            />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Create New Query</CardTitle>
                    <CardDescription>
                      Set up automated job search with your criteria
                    </CardDescription>
                  </div>
                  {subscription && (
                    <Badge variant={subscription.planId === 'free' ? 'secondary' : 'default'}>
                      {subscription.planName}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {canCreate && !canCreate.canCreate && !subscription?.isPrivileged && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">{canCreate.reason}</p>
                      <Button
                        variant="link"
                        className="p-0 h-auto text-yellow-700 underline"
                        onClick={() => router.push('/pricing')}
                      >
                        Upgrade your plan
                      </Button>
                    </div>
                  </div>
                )}
                
                {subscription && !subscription.isPrivileged && subscription.maxQueries !== -1 && canCreate?.remaining !== undefined && (
                  <p className="text-sm text-gray-600">
                    You can create {canCreate.remaining} more {canCreate.remaining === 1 ? 'query' : 'queries'} on your {subscription.planName} plan
                  </p>
                )}
                
                {subscription?.isPrivileged && (
                  <p className="text-sm text-green-600">
                    ✓ Unlimited queries available with your privileged access
                  </p>
                )}
                
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  disabled={canCreate && !canCreate.canCreate}
                >
                  Create Query
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Query List */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Your Queries</CardTitle>
              <CardDescription>
                Manage your active job search configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading queries...
                </div>
              ) : (
                <QueryList
                  queries={queries}
                  onToggle={handleToggleQuery}
                  onDelete={handleDeleteQuery}
                  loading={updateQuery.isPending || deleteQuery.isPending}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </>
  )
}