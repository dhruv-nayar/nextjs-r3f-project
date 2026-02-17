'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from './storage'

// Extend storage keys for trellis jobs
const TRELLIS_JOBS_KEY = 'trellis_jobs'

export interface TrellisJob {
  jobId: string
  itemId: string
  type: 'rembg' | 'trellis'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  downloadUrls?: string[]
  error?: string
  createdAt: string
  // For rembg jobs, track which images were processed
  inputImageUrls?: string[]
  // For completed jobs, track the resulting URLs
  resultUrls?: string[]
}

interface TrellisJobContextType {
  jobs: TrellisJob[]
  addJob: (job: Omit<TrellisJob, 'createdAt'>) => void
  updateJob: (jobId: string, updates: Partial<TrellisJob>) => void
  removeJob: (jobId: string) => void
  getJobsForItem: (itemId: string) => TrellisJob[]
  getActiveJobs: () => TrellisJob[]
  activeGlbJob: TrellisJob | null
  // Toast state for notifications
  toastMessage: string | null
  toastType: 'success' | 'error' | 'info'
  clearToast: () => void
}

const TrellisJobContext = createContext<TrellisJobContextType | undefined>(undefined)

const POLL_INTERVAL = 3000 // 3 seconds

export function TrellisJobProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<TrellisJob[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info')

  // Load jobs from localStorage on mount
  useEffect(() => {
    const loadedJobs = loadFromStorage<TrellisJob[]>(TRELLIS_JOBS_KEY, [])
    setJobs(loadedJobs)
    setIsLoaded(true)
  }, [])

  // Save jobs to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return
    saveToStorage(TRELLIS_JOBS_KEY, jobs)
  }, [jobs, isLoaded])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(message)
    setToastType(type)
  }, [])

  const clearToast = useCallback(() => {
    setToastMessage(null)
  }, [])

  const addJob = useCallback((jobData: Omit<TrellisJob, 'createdAt'>) => {
    const newJob: TrellisJob = {
      ...jobData,
      createdAt: new Date().toISOString(),
    }
    setJobs(prev => [...prev, newJob])
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

  const activeGlbJob = jobs.find(
    job => job.type === 'trellis' && (job.status === 'pending' || job.status === 'processing')
  ) || null

  // Poll active jobs
  useEffect(() => {
    if (!isLoaded) return

    const activeJobs = jobs.filter(
      job => job.status === 'pending' || job.status === 'processing'
    )

    if (activeJobs.length === 0) return

    const pollJobs = async () => {
      for (const job of activeJobs) {
        try {
          const response = await fetch(`/api/trellis/jobs/${job.jobId}`)
          if (!response.ok) {
            console.error(`[TrellisJobContext] Failed to poll job ${job.jobId}`)
            continue
          }

          const data = await response.json()

          // Update job status
          const newStatus = data.status as TrellisJob['status']
          const updates: Partial<TrellisJob> = {
            status: newStatus,
            progress: data.progress || 0,
            message: data.message,
          }

          if (newStatus === 'completed') {
            updates.downloadUrls = data.download_urls || []

            // Handle completion
            if (job.type === 'trellis' && data.download_urls?.length > 0) {
              // Download and store the GLB
              await handleGlbCompletion(job, data.download_urls)
              showToast('3D model generated successfully!', 'success')
            } else if (job.type === 'rembg' && data.download_urls?.length > 0) {
              // Download and store processed images
              await handleRembgCompletion(job, data.download_urls)
              showToast('Background removal complete!', 'success')
            }
          } else if (newStatus === 'failed') {
            updates.error = data.error || 'Job failed'
            showToast(`Job failed: ${data.error || 'Unknown error'}`, 'error')
          }

          updateJob(job.jobId, updates)
        } catch (error) {
          console.error(`[TrellisJobContext] Error polling job ${job.jobId}:`, error)
        }
      }
    }

    // Initial poll
    pollJobs()

    // Set up interval
    const intervalId = setInterval(pollJobs, POLL_INTERVAL)

    return () => clearInterval(intervalId)
  }, [jobs, isLoaded, updateJob, showToast])

  // Handle GLB generation completion
  const handleGlbCompletion = async (job: TrellisJob, downloadUrls: string[]) => {
    try {
      // Get the GLB filename from the first download URL
      const glbUrl = downloadUrls.find(url => url.includes('.glb'))
      if (!glbUrl) {
        console.error('[TrellisJobContext] No GLB URL found in download_urls')
        return
      }

      // Extract filename from URL path
      const filename = glbUrl.split('/').pop() || 'model.glb'

      // Download and store in Vercel Blob
      const response = await fetch('/api/trellis/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.jobId,
          filename,
          itemId: job.itemId,
          type: 'glb',
        }),
      })

      if (!response.ok) {
        console.error('[TrellisJobContext] Failed to download and store GLB')
        return
      }

      const data = await response.json()

      // Update job with the permanent URL
      updateJob(job.jobId, {
        resultUrls: [data.url],
      })

      // Dispatch a custom event so the item page can update
      window.dispatchEvent(new CustomEvent('trellis-glb-complete', {
        detail: { itemId: job.itemId, modelPath: data.url, jobId: job.jobId }
      }))

    } catch (error) {
      console.error('[TrellisJobContext] Error handling GLB completion:', error)
    }
  }

  // Handle background removal completion
  const handleRembgCompletion = async (job: TrellisJob, downloadUrls: string[]) => {
    try {
      const resultUrls: string[] = []

      for (const url of downloadUrls) {
        const filename = url.split('/').pop() || 'processed.png'

        const response = await fetch('/api/trellis/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: job.jobId,
            filename,
            itemId: job.itemId,
            type: 'image',
          }),
        })

        if (response.ok) {
          const data = await response.json()
          resultUrls.push(data.url)
        }
      }

      // Update job with the permanent URLs
      updateJob(job.jobId, {
        resultUrls,
      })

      // Dispatch a custom event so the image upload component can update
      window.dispatchEvent(new CustomEvent('trellis-rembg-complete', {
        detail: {
          itemId: job.itemId,
          jobId: job.jobId,
          processedUrls: resultUrls,
          originalUrls: job.inputImageUrls || [],
        }
      }))

    } catch (error) {
      console.error('[TrellisJobContext] Error handling rembg completion:', error)
    }
  }

  return (
    <TrellisJobContext.Provider
      value={{
        jobs,
        addJob,
        updateJob,
        removeJob,
        getJobsForItem,
        getActiveJobs,
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
