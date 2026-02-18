'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrellisJobRow } from '@/types/database'

export interface TrellisJob {
  id: string
  jobId: string
  itemId: string
  type: 'rembg' | 'trellis'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  downloadUrls?: string[]
  error?: string
  createdAt: string
  inputImageUrls?: string[]
  resultUrls?: string[]
}

interface TrellisJobContextType {
  jobs: TrellisJob[]
  addJob: (jobData: { jobId: string; itemId: string; type: 'rembg' | 'trellis'; inputImageUrls?: string[] }) => void
  updateJob: (jobId: string, updates: Partial<TrellisJob>) => void
  removeJob: (jobId: string) => void
  getJobsForItem: (itemId: string) => TrellisJob[]
  getActiveJobs: () => TrellisJob[]
  hasActiveGlbJobForItem: (itemId: string) => boolean
  activeGlbJob: TrellisJob | null  // Kept for backward compatibility
  toastMessage: string | null
  toastType: 'success' | 'error' | 'info'
  clearToast: () => void
}

const TrellisJobContext = createContext<TrellisJobContextType | undefined>(undefined)

// Convert Supabase row to TrellisJob interface
function rowToJob(row: TrellisJobRow): TrellisJob {
  return {
    id: row.id,
    jobId: row.job_id,
    itemId: row.item_id,
    type: row.type,
    status: row.status,
    progress: row.progress,
    message: row.message || undefined,
    downloadUrls: row.download_urls || undefined,
    resultUrls: row.result_urls || undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
    inputImageUrls: row.input_image_urls || undefined,
  }
}

export function TrellisJobProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<TrellisJob[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info')

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(message)
    setToastType(type)
  }, [])

  const clearToast = useCallback(() => {
    setToastMessage(null)
  }, [])

  // Poll for job updates as fallback when webhooks fail
  const pollJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/trellis/poll-jobs', { method: 'POST' })
      if (response.ok) {
        const result = await response.json()
        if (result.updated > 0) {
          console.log(`[TrellisJobContext] Polling updated ${result.updated} jobs`)
        }
      }
    } catch (err) {
      console.error('[TrellisJobContext] Polling error:', err)
    }
  }, [])

  // Load jobs from Supabase and subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient()

    // Load initial jobs
    async function loadJobs() {
      const { data, error } = await supabase
        .from('trellis_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (data && !error) {
        setJobs(data.map(rowToJob))
      } else if (error) {
        console.error('[TrellisJobContext] Failed to load jobs:', error)
      }
    }

    loadJobs()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('trellis_jobs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trellis_jobs' },
        (payload) => {
          console.log('[TrellisJobContext] Realtime update:', payload.eventType)

          if (payload.eventType === 'INSERT') {
            const newJob = rowToJob(payload.new as TrellisJobRow)
            setJobs(prev => [newJob, ...prev.filter(j => j.jobId !== newJob.jobId)])
          } else if (payload.eventType === 'UPDATE') {
            const updatedJob = rowToJob(payload.new as TrellisJobRow)
            const oldJob = payload.old as TrellisJobRow

            setJobs(prev => prev.map(job =>
              job.jobId === updatedJob.jobId ? updatedJob : job
            ))

            // Show toast and dispatch events on completion
            if (oldJob.status !== 'completed' && updatedJob.status === 'completed') {
              if (updatedJob.type === 'trellis') {
                showToast('3D model generated successfully!', 'success')

                // Dispatch event for item update
                window.dispatchEvent(new CustomEvent('trellis-glb-complete', {
                  detail: {
                    itemId: updatedJob.itemId,
                    modelPath: updatedJob.resultUrls?.[0],
                    jobId: updatedJob.jobId,
                  }
                }))
              } else if (updatedJob.type === 'rembg') {
                showToast('Background removal complete!', 'success')

                window.dispatchEvent(new CustomEvent('trellis-rembg-complete', {
                  detail: {
                    itemId: updatedJob.itemId,
                    jobId: updatedJob.jobId,
                    processedUrls: updatedJob.resultUrls,
                    originalUrls: updatedJob.inputImageUrls,
                  }
                }))
              }
            } else if (oldJob.status !== 'failed' && updatedJob.status === 'failed') {
              showToast(`Job failed: ${updatedJob.error || 'Unknown error'}`, 'error')
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedJob = payload.old as TrellisJobRow
            setJobs(prev => prev.filter(job => job.jobId !== deletedJob.job_id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [showToast])

  // Poll for updates when there are active jobs (fallback for failed webhooks)
  useEffect(() => {
    const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'processing')

    if (activeJobs.length === 0) return

    // Poll every 10 seconds when there are active jobs
    const pollInterval = setInterval(() => {
      pollJobs()
    }, 10000)

    // Also poll immediately
    pollJobs()

    return () => clearInterval(pollInterval)
  }, [jobs, pollJobs])

  // Add job - optimistically add to local state (job is created by API route)
  const addJob = useCallback((jobData: {
    jobId: string
    itemId: string
    type: 'rembg' | 'trellis'
    inputImageUrls?: string[]
  }) => {
    const newJob: TrellisJob = {
      id: `temp-${Date.now()}`,
      jobId: jobData.jobId,
      itemId: jobData.itemId,
      type: jobData.type,
      status: 'pending',
      progress: 0,
      message: 'Starting...',
      createdAt: new Date().toISOString(),
      inputImageUrls: jobData.inputImageUrls,
    }
    setJobs(prev => [newJob, ...prev])
  }, [])

  const updateJob = useCallback((jobId: string, updates: Partial<TrellisJob>) => {
    setJobs(prev => prev.map(job =>
      job.jobId === jobId ? { ...job, ...updates } : job
    ))
  }, [])

  const removeJob = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(job => job.jobId !== jobId))
  }, [])

  const getJobsForItem = useCallback((itemId: string) => {
    return jobs.filter(job => job.itemId === itemId)
  }, [jobs])

  const getActiveJobs = useCallback(() => {
    return jobs.filter(job => job.status === 'pending' || job.status === 'processing')
  }, [jobs])

  const hasActiveGlbJobForItem = useCallback((itemId: string) => {
    return jobs.some(
      job => job.itemId === itemId &&
             job.type === 'trellis' &&
             (job.status === 'pending' || job.status === 'processing')
    )
  }, [jobs])

  // Kept for backward compatibility - but UI should use hasActiveGlbJobForItem instead
  const activeGlbJob = jobs.find(
    job => job.type === 'trellis' && (job.status === 'pending' || job.status === 'processing')
  ) || null

  return (
    <TrellisJobContext.Provider
      value={{
        jobs,
        addJob,
        updateJob,
        removeJob,
        getJobsForItem,
        getActiveJobs,
        hasActiveGlbJobForItem,
        activeGlbJob,
        toastMessage,
        toastType,
        clearToast,
      }}
    >
      {children}
    </TrellisJobContext.Provider>
  )
}

export function useTrellisJobs() {
  const context = useContext(TrellisJobContext)
  if (context === undefined) {
    throw new Error('useTrellisJobs must be used within a TrellisJobProvider')
  }
  return context
}
