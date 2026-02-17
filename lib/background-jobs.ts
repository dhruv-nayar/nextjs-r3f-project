/**
 * Background job queue system for async image processing
 * Persists job state to localStorage so processing continues even after page refresh
 */

import { saveToStorage, loadFromStorage } from './storage'

export type JobType = 'rembg' | 'glb_generation'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface BackgroundJob {
  id: string
  type: JobType
  status: JobStatus
  itemId: string
  createdAt: string
  updatedAt: string

  // Input data
  input: {
    originalImageUrl?: string
    originalImageBase64?: string
    imageUrls?: string[]
  }

  // Output data
  output?: {
    processedImageUrl?: string
    glbUrl?: string
    error?: string
  }

  // Progress tracking
  progress?: number
  retryCount?: number
  maxRetries?: number
}

const JOBS_STORAGE_KEY = 'homeEditor_backgroundJobs_v1'
const MAX_RETRIES = 3
const RETRY_DELAY = 5000 // 5 seconds

/**
 * Get all jobs from storage
 */
export function getAllJobs(): BackgroundJob[] {
  return loadFromStorage<BackgroundJob[]>(JOBS_STORAGE_KEY, [])
}

/**
 * Get jobs by status
 */
export function getJobsByStatus(status: JobStatus): BackgroundJob[] {
  const jobs = getAllJobs()
  return jobs.filter(job => job.status === status)
}

/**
 * Get jobs by item ID
 */
export function getJobsByItemId(itemId: string): BackgroundJob[] {
  const jobs = getAllJobs()
  return jobs.filter(job => job.itemId === itemId)
}

/**
 * Get a specific job by ID
 */
export function getJob(jobId: string): BackgroundJob | undefined {
  const jobs = getAllJobs()
  return jobs.find(job => job.id === jobId)
}

/**
 * Create a new background job
 */
export function createJob(
  type: JobType,
  itemId: string,
  input: BackgroundJob['input']
): BackgroundJob {
  const job: BackgroundJob = {
    id: `job-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    type,
    status: 'pending',
    itemId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    input,
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    progress: 0
  }

  const jobs = getAllJobs()
  jobs.push(job)
  saveToStorage(JOBS_STORAGE_KEY, jobs)

  return job
}

/**
 * Update a job's status and data
 */
export function updateJob(
  jobId: string,
  updates: Partial<Omit<BackgroundJob, 'id' | 'createdAt'>>
): BackgroundJob | null {
  const jobs = getAllJobs()
  const jobIndex = jobs.findIndex(j => j.id === jobId)

  if (jobIndex === -1) return null

  jobs[jobIndex] = {
    ...jobs[jobIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveToStorage(JOBS_STORAGE_KEY, jobs)
  return jobs[jobIndex]
}

/**
 * Mark job as completed with output
 */
export function completeJob(
  jobId: string,
  output: BackgroundJob['output']
): BackgroundJob | null {
  return updateJob(jobId, {
    status: 'completed',
    output,
    progress: 100
  })
}

/**
 * Mark job as failed with error
 */
export function failJob(jobId: string, error: string): BackgroundJob | null {
  const job = getJob(jobId)
  if (!job) return null

  const retryCount = (job.retryCount || 0) + 1
  const shouldRetry = retryCount < (job.maxRetries || MAX_RETRIES)

  if (shouldRetry) {
    // Schedule retry
    return updateJob(jobId, {
      status: 'pending',
      retryCount,
      output: { ...job.output, error }
    })
  } else {
    // Max retries reached, mark as failed
    return updateJob(jobId, {
      status: 'failed',
      output: { ...job.output, error }
    })
  }
}

/**
 * Delete a job
 */
export function deleteJob(jobId: string): boolean {
  const jobs = getAllJobs()
  const filteredJobs = jobs.filter(j => j.id !== jobId)

  if (filteredJobs.length === jobs.length) return false

  saveToStorage(JOBS_STORAGE_KEY, filteredJobs)
  return true
}

/**
 * Delete all jobs for a specific item
 */
export function deleteJobsByItemId(itemId: string): number {
  const jobs = getAllJobs()
  const filteredJobs = jobs.filter(j => j.itemId !== itemId)
  const deletedCount = jobs.length - filteredJobs.length

  if (deletedCount > 0) {
    saveToStorage(JOBS_STORAGE_KEY, filteredJobs)
  }

  return deletedCount
}

/**
 * Clean up old completed/failed jobs (older than 24 hours)
 */
export function cleanupOldJobs(): number {
  const jobs = getAllJobs()
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

  const filteredJobs = jobs.filter(job => {
    const isOld = new Date(job.updatedAt).getTime() < oneDayAgo
    const isCompleted = job.status === 'completed' || job.status === 'failed'
    return !(isOld && isCompleted)
  })

  const deletedCount = jobs.length - filteredJobs.length

  if (deletedCount > 0) {
    saveToStorage(JOBS_STORAGE_KEY, filteredJobs)
  }

  return deletedCount
}

/**
 * Get job statistics
 */
export function getJobStats(): {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
} {
  const jobs = getAllJobs()

  return {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length
  }
}
