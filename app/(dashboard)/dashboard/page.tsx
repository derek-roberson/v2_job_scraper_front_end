'use client'

import { useState } from 'react'
import { useAuth } from '@/utils/hooks/use-auth'
import { useQueries, useQueryMutations } from '@/utils/hooks/use-queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateQueryForm } from '@/components/queries/create-query-form'
import { QueryList } from '@/components/queries/query-list'

export default function DashboardPage() {
  const { user } = useAuth()
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Use actual query hooks
  const { data: queries = [], isLoading } = useQueries()
  const { createQuery, updateQuery, deleteQuery } = useQueryMutations()

  const handleCreateQuery = async (data: {
    keywords: string
    work_types: number[]
    state?: string
    city?: string
  }) => {
    try {
      const queryData = {
        keywords: data.keywords,
        work_types: data.work_types,
        location_string: data.state && data.city ? `${data.city}, ${data.state}` : data.state,
      }
      
      await createQuery.mutateAsync(queryData)
      setShowCreateForm(false)
    } catch (error) {
      console.error('Failed to create query:', error)
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.email}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6">
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
              Total Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queries.length}</div>
            <p className="text-xs text-gray-600">Search configurations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Jobs Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-600">Total opportunities discovered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-gray-600">Query effectiveness</p>
          </CardContent>
        </Card>
      </div>

      {/* Query Management Section */}
      <div className="grid lg:grid-cols-2 gap-6">
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
                <CardTitle>Create New Query</CardTitle>
                <CardDescription>
                  Set up automated job search with your criteria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowCreateForm(true)}>
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
  )
}