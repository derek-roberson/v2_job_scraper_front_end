'use client'

import { Job } from '@/types/api'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, MapPin, Calendar, Building2, Search, Copy, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

interface JobDetailModalProps {
  job: Job
  isOpen: boolean
  onClose: () => void
}

export function JobDetailModal({ job, isOpen, onClose }: JobDetailModalProps) {
  const [copiedLink, setCopiedLink] = useState(false)

  const formatPostedDate = (posted: string | null | undefined) => {
    if (!posted) return 'Date unknown'
    
    try {
      const date = new Date(posted)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'Date unknown'
    }
  }

  const formatFullDate = (posted: string | null | undefined) => {
    if (!posted) return 'Date unknown'
    
    try {
      const date = new Date(posted)
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'Date unknown'
    }
  }

  const copyJobLink = async () => {
    if (job.link) {
      try {
        await navigator.clipboard.writeText(job.link)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      } catch (error) {
        console.error('Failed to copy link:', error)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{job.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-4 text-base">
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {job.location}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Job Info */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Posted Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Posted:</span>
                  <div className="text-gray-600">
                    {formatPostedDate(job.posted)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatFullDate(job.posted)}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium">Discovered:</span>
                  <div className="text-gray-600">
                    {job.scraped_at ? formatDistanceToNow(new Date(job.scraped_at), { addSuffix: true }) : 'Unknown'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Query Source */}
            {job.queries && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Found By Query
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">Keywords:</span>
                      <Badge variant="secondary" className="ml-2">
                        {job.queries.keywords}
                      </Badge>
                    </div>
                    {job.queries.location_string && (
                      <div>
                        <span className="text-sm font-medium">Location Filter:</span>
                        <Badge variant="outline" className="ml-2">
                          {job.queries.location_string}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Job Description */}
          <div className="space-y-4">
            {job.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Job Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {job.description}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Salary */}
            {job.salary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Compensation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold text-green-600">
                    {job.salary}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={copyJobLink}>
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {job.link && (
              <Button
                onClick={() => window.open(job.link, '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Apply Now
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}