'use client'

import { useState } from 'react'
import { Job } from '@/types/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { JobDetailModal } from './job-detail-modal'
import { useJobMutations } from '@/utils/hooks/use-jobs'
import { ExternalLink, MapPin, Calendar, Building2, Trash2, Check, RotateCcw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface JobListProps {
  jobs: Job[]
}

export function JobList({ jobs }: JobListProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const { softDeleteJob, markJobAsApplied } = useJobMutations()

  const handleDeleteJob = async (jobId: number) => {
    if (confirm('Are you sure you want to remove this job from your list?')) {
      try {
        await softDeleteJob.mutateAsync(jobId)
      } catch (error) {
        console.error('Failed to delete job:', error)
      }
    }
  }

  const handleMarkAsApplied = async (jobId: number, applied: boolean) => {
    try {
      await markJobAsApplied.mutateAsync({ jobId, applied })
    } catch (error) {
      console.error('Failed to update job application status:', error)
    }
  }

  const formatPostedDate = (posted: string | null | undefined) => {
    if (!posted) return 'Date unknown'
    
    try {
      const date = new Date(posted)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'Date unknown'
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          No job opportunities match your current filters. Try adjusting your search criteria or check back later as our scrapers discover new positions.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id} className={`hover:shadow-md transition-shadow ${job.applied ? 'bg-green-50 border-green-200' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <CardTitle className="text-base sm:text-lg break-words">{job.title}</CardTitle>
                    {job.applied && (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs whitespace-nowrap flex-shrink-0">
                        Applied
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                    <span className="flex items-center gap-1 truncate">
                      <Building2 className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">{job.company}</span>
                    </span>
                    {job.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      {formatPostedDate(job.posted)}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteJob(job.id)}
                    disabled={softDeleteJob.isPending}
                    className="p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {job.queries && (
                    <Badge variant="secondary" className="text-xs">
                      {job.queries.keywords}
                    </Badge>
                  )}
                  {job.queries?.location_string && (
                    <Badge variant="outline" className="text-xs">
                      {job.queries.location_string}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedJob(job)}
                    className="flex-1 sm:flex-none"
                  >
                    View Details
                  </Button>
                  
                  {job.applied ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkAsApplied(job.id, false)}
                      disabled={markJobAsApplied.isPending}
                      className="flex items-center gap-2 flex-1 sm:flex-none"
                    >
                      <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Mark as Not Applied</span>
                      <span className="sm:hidden">Not Applied</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline" 
                      size="sm"
                      onClick={() => handleMarkAsApplied(job.id, true)}
                      disabled={markJobAsApplied.isPending}
                      className="flex items-center gap-2 flex-1 sm:flex-none"
                    >
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Mark as Applied</span>
                      <span className="sm:hidden">Mark Applied</span>
                    </Button>
                  )}
                  
                  {job.link && (
                    <Button
                      size="sm"
                      onClick={() => window.open(job.link, '_blank')}
                      className="flex items-center gap-2 flex-1 sm:flex-none"
                    >
                      <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                      {job.applied ? 'View Job' : 'Apply'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </>
  )
}