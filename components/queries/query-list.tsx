'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Query {
  id: number
  keywords: string
  work_types: number[]
  location_string?: string
  is_active: boolean
  created_at: string
}

interface QueryListProps {
  queries: Query[]
  onToggle: (id: number, active: boolean) => void
  onDelete: (id: number) => void
  loading?: boolean
}

const workTypeNames = {
  1: 'On-site',
  2: 'Hybrid', 
  3: 'Remote'
}

export function QueryList({ queries, onToggle, onDelete, loading }: QueryListProps) {
  if (queries.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <p>No queries created yet.</p>
            <p className="text-sm mt-1">Create your first query to start discovering jobs!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {queries.map((query) => (
        <Card key={query.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{query.keywords}</CardTitle>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  query.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {query.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium text-gray-600">Work Types: </span>
                <span className="text-sm">
                  {query.work_types.map(id => workTypeNames[id as keyof typeof workTypeNames]).join(', ')}
                </span>
              </div>
              {query.location_string && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Location: </span>
                  <span className="text-sm">{query.location_string}</span>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-600">Created: </span>
                <span className="text-sm">
                  {new Date(query.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggle(query.id, !query.is_active)}
                disabled={loading}
              >
                {query.is_active ? 'Pause' : 'Resume'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(query.id)}
                disabled={loading}
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}