'use client'

import { useState } from 'react'
import { useAuth } from '@/utils/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateQueryForm } from '@/components/queries/create-query-form'
import { QueryList } from '@/components/queries/query-list'

export default function DashboardPage() {
  const { user } = useAuth()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [queries] = useState<Array<{
    id: number; 
    keywords: string;
    work_types: number[];
    location_string?: string;
    is_active: boolean;
    created_at: string;
  }>>([]) // TODO: Replace with actual queries hook

  const handleCreateQuery = (data: {
    keywords: string
    work_types: number[]
    state?: string
    city?: string
  }) => {
    console.log('Creating query:', data)
    // TODO: Implement actual query creation
    setShowCreateForm(false)
  }

  const handleToggleQuery = (id: number, active: boolean) => {
    console.log('Toggle query:', id, active)
    // TODO: Implement query toggle
  }

  const handleDeleteQuery = (id: number) => {
    console.log('Delete query:', id)
    // TODO: Implement query deletion
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
              loading={false}
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
              <QueryList
                queries={queries}
                onToggle={handleToggleQuery}
                onDelete={handleDeleteQuery}
                loading={false}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}