'use client'

import { useState } from 'react'
import { useTrellisJobs, TrellisJob } from '@/lib/trellis-job-context'
import Link from 'next/link'

export function TrellisJobIndicator() {
  const { getActiveJobs, jobs } = useTrellisJobs()
  const [isExpanded, setIsExpanded] = useState(false)

  const activeJobs = getActiveJobs()
  const recentCompletedJobs = jobs
    .filter(job => job.status === 'completed' || job.status === 'failed')
    .slice(-3)

  // Don't render if no jobs to show
  if (activeJobs.length === 0 && recentCompletedJobs.length === 0) {
    return null
  }

  const getJobStatusIcon = (job: TrellisJob) => {
    switch (job.status) {
      case 'pending':
        return <div className="w-3 h-3 rounded-full bg-taupe/50 animate-pulse" />
      case 'processing':
        return (
          <div className="w-3 h-3 rounded-full border-2 border-sage border-t-transparent animate-spin" />
        )
      case 'completed':
        return (
          <div className="w-3 h-3 rounded-full bg-sage flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'failed':
        return (
          <div className="w-3 h-3 rounded-full bg-scarlet flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
    }
  }

  const getJobTypeLabel = (job: TrellisJob) => {
    return job.type === 'trellis' ? '3D Model' : 'Background Removal'
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collapsed View - Floating Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-4 py-3 bg-graphite text-white rounded-xl shadow-lg hover:bg-graphite/90 transition-all"
        >
          {activeJobs.length > 0 ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span className="font-body text-sm">
                {activeJobs.length} job{activeJobs.length !== 1 ? 's' : ''} running
              </span>
            </>
          ) : (
            <>
              <div className="w-4 h-4 rounded-full bg-sage flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-body text-sm">Jobs completed</span>
            </>
          )}
        </button>
      )}

      {/* Expanded View - Panel */}
      {isExpanded && (
        <div className="w-80 bg-white rounded-xl shadow-xl border border-taupe/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-porcelain border-b border-taupe/10">
            <h3 className="font-body font-medium text-graphite text-sm">Processing Jobs</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-taupe/50 hover:text-taupe transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Job List */}
          <div className="max-h-64 overflow-y-auto">
            {/* Active Jobs */}
            {activeJobs.map(job => (
              <div key={job.jobId} className="px-4 py-3 border-b border-taupe/5 last:border-0">
                <div className="flex items-center gap-2 mb-2">
                  {getJobStatusIcon(job)}
                  <span className="font-body text-sm text-graphite flex-1">
                    {getJobTypeLabel(job)}
                  </span>
                  <Link
                    href={`/items/${job.itemId}?edit=true`}
                    className="text-sage text-xs hover:underline"
                  >
                    View Item
                  </Link>
                </div>

                {/* Progress Bar */}
                {(job.status === 'pending' || job.status === 'processing') && (
                  <div className="space-y-1">
                    <div className="w-full bg-taupe/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-sage transition-all duration-300"
                        style={{ width: `${Math.max(job.progress, 5)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-taupe/60">
                      <span>{job.message || 'Processing...'}</span>
                      <span>{job.progress}%</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Recent Completed Jobs */}
            {recentCompletedJobs.length > 0 && activeJobs.length > 0 && (
              <div className="px-4 py-2 bg-taupe/5">
                <span className="text-xs text-taupe/60 font-body">Recent</span>
              </div>
            )}

            {recentCompletedJobs.map(job => (
              <div key={job.jobId} className="px-4 py-3 border-b border-taupe/5 last:border-0 opacity-70">
                <div className="flex items-center gap-2">
                  {getJobStatusIcon(job)}
                  <span className="font-body text-sm text-graphite flex-1">
                    {getJobTypeLabel(job)}
                  </span>
                  <Link
                    href={`/items/${job.itemId}`}
                    className="text-sage text-xs hover:underline"
                  >
                    View Item
                  </Link>
                </div>
                {job.status === 'failed' && job.error && (
                  <p className="text-xs text-scarlet mt-1">{job.error}</p>
                )}
              </div>
            ))}

            {/* Empty State */}
            {activeJobs.length === 0 && recentCompletedJobs.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-taupe/60 font-body">No jobs to display</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
