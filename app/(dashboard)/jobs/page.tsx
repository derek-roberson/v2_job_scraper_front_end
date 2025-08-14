'use client'

import { useState, useMemo } from 'react'
import { useJobs, useJobStats } from '@/utils/hooks/use-jobs'
import { useQueries } from '@/utils/hooks/use-queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { JobList } from '@/components/jobs/job-list'
import { JobFilters } from '@/types/api'
import { Search, Filter } from 'lucide-react'

export default function JobsPage() {
  const [search, setSearch] = useState('')
  const [selectedQueryId, setSelectedQueryId] = useState<number | undefined>()
  const [sortBy, setSortBy] = useState<'posted' | 'company' | 'title'>('posted')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showAppliedJobs, setShowAppliedJobs] = useState(false)
  const [appliedOnlyFilter, setAppliedOnlyFilter] = useState(false)

  // Get user queries for filtering
  const { data: queries = [] } = useQueries()
  
  // Build filters object
  const filters: JobFilters = useMemo(() => ({
    search: search || undefined,
    queryId: selectedQueryId,
    sortBy,
    sortOrder,
    showApplied: showAppliedJobs,
    appliedOnly: appliedOnlyFilter,
    limit: 50
  }), [search, selectedQueryId, sortBy, sortOrder, showAppliedJobs, appliedOnlyFilter])

  // Get jobs and stats
  const { data: jobs = [], isLoading, error } = useJobs(filters)
  const { data: stats } = useJobStats()

  const clearFilters = () => {
    setSearch('')
    setSelectedQueryId(undefined)
    setSortBy('posted')
    setSortOrder('desc')
    setShowAppliedJobs(false)
    setAppliedOnlyFilter(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Jobs</h1>
        <p className="text-gray-600">Discover opportunities found by your queries</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalJobs || 0}</div>
            <p className="text-xs text-gray-600">All discovered jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayJobs || 0}</div>
            <p className="text-xs text-gray-600">Posted today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.weekJobs || 0}</div>
            <p className="text-xs text-gray-600">Posted this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueQueries || 0}</div>
            <p className="text-xs text-gray-600">Queries finding jobs</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters & Search
          </CardTitle>
          <CardDescription>
            Filter and search through your discovered jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search jobs, companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Query Filter */}
            <Select 
              value={selectedQueryId?.toString() || 'all'} 
              onValueChange={(value) => setSelectedQueryId(value === 'all' ? undefined : parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All queries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All queries</SelectItem>
                {queries.map((query) => (
                  <SelectItem key={query.id} value={query.id.toString()}>
                    {query.keywords}
                    {query.location_string && ` • ${query.location_string}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'posted' | 'company' | 'title')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="posted">Posted Date</SelectItem>
                <SelectItem value="title">Job Title</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Applied Job Filters */}
          <div className="flex items-center gap-6 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-applied"
                checked={showAppliedJobs}
                onCheckedChange={(checked) => {
                  setShowAppliedJobs(checked)
                  if (!checked) setAppliedOnlyFilter(false)
                }}
              />
              <Label htmlFor="show-applied" className="text-sm">
                Show applied jobs
              </Label>
            </div>
            
            {showAppliedJobs && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="applied-only"
                  checked={appliedOnlyFilter}
                  onCheckedChange={setAppliedOnlyFilter}
                />
                <Label htmlFor="applied-only" className="text-sm">
                  Show only applied jobs
                </Label>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <div className="text-sm text-gray-600">
              {!showAppliedJobs && (
                <span className="text-amber-600">
                  🙈 Applied jobs are hidden by default
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Job Opportunities
            {jobs.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({jobs.length} {jobs.length === 1 ? 'job' : 'jobs'})
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Jobs discovered by your active queries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading jobs...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Error loading jobs: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : (
            <JobList jobs={jobs} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}